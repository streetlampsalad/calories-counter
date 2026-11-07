// Keeps the Kanban project in step with Issues and pull requests (.github/workflows/board.yml).
//   node scripts/workflow/board-sync.mjs          sync the Issues the triggering event touched
//   node scripts/workflow/board-sync.mjs --all    sync every open Issue and every board item
//   DRY_RUN=1 node scripts/workflow/board-sync.mjs --all   print the changes without making them
// Needs GH_TOKEN with the repo and project scopes, PROJECT_OWNER and PROJECT_NUMBER.
import {
  fieldsFromLabels,
  isParent,
  parentIsFinished,
  parseRefs,
  statusFor,
} from "./board.mjs";
import { graphql, readEvent, repo, rest, restAll } from "./github.mjs";

const [owner, name] = repo.split("/");
const projectOwner = process.env.PROJECT_OWNER ?? owner;
const projectNumber = Number(process.env.PROJECT_NUMBER ?? 1);
const dryRun = process.env.DRY_RUN === "1";

// Runs a write, or only describes it in a dry run.
function write(description, run) {
  if (dryRun) {
    console.log(`  would ${description}`);
    return undefined;
  }
  return run();
}

const ISSUE_QUERY = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      id number state
      labels(first: 50) { nodes { name } }
      assignees(first: 1) { totalCount }
      parent { number }
      subIssues(first: 100) { nodes { number state assignees(first: 1) { totalCount } } }
      timelineItems(first: 100, itemTypes: [CROSS_REFERENCED_EVENT]) {
        nodes { ... on CrossReferencedEvent { source { ... on PullRequest {
          number state merged isDraft body repository { nameWithOwner }
        } } } }
      }
      projectItems(first: 20) { nodes { id project { id } } }
    }
  }
}`;

const PROJECT_QUERY = `
query($login: String!, $number: Int!) {
  user(login: $login) {
    projectV2(number: $number) {
      id
      fields(first: 50) { nodes { ... on ProjectV2SingleSelectField { id name options { id name } } } }
      items(first: 100) { nodes { content { ... on Issue { number repository { nameWithOwner } } } } }
    }
  }
}`;

function loadProject() {
  const project = graphql(PROJECT_QUERY, {
    login: projectOwner,
    number: projectNumber,
  }).user.projectV2;
  const fields = {};
  for (const field of project.fields.nodes) {
    if (!field?.options) continue;
    fields[field.name] = {
      id: field.id,
      options: Object.fromEntries(field.options.map((o) => [o.name, o.id])),
    };
  }
  const items = project.items.nodes
    .map((item) => item.content)
    .filter((content) => content?.repository?.nameWithOwner === repo)
    .map((content) => content.number);
  return { id: project.id, fields, items };
}

function loadIssue(number) {
  try {
    return graphql(ISSUE_QUERY, { owner, name, number }).repository.issue;
  } catch {
    return null; // A pull request number, or a deleted Issue.
  }
}

function facts(issue) {
  const pulls = issue.timelineItems.nodes
    .map((node) => node.source)
    .filter(
      (pull) =>
        pull?.number &&
        pull.repository.nameWithOwner === repo &&
        parseRefs(pull.body).includes(issue.number),
    );
  return {
    state: issue.state,
    labels: issue.labels.nodes.map((label) => label.name),
    assigned: issue.assignees.totalCount > 0,
    pulls,
    subIssues: issue.subIssues.nodes.map((child) => ({
      number: child.number,
      state: child.state,
      assigned: child.assignees.totalCount > 0,
    })),
  };
}

function setField(project, itemId, fieldName, optionName) {
  const field = project.fields[fieldName];
  const optionId = field?.options[optionName];
  if (!optionId) {
    console.warn(`No "${optionName}" option in the board's ${fieldName} field`);
    return;
  }
  write(`set ${fieldName} to ${optionName}`, () =>
    graphql(
      `mutation($project: ID!, $item: ID!, $field: ID!, $option: String!) {
        updateProjectV2ItemFieldValue(input: { projectId: $project, itemId: $item, fieldId: $field,
          value: { singleSelectOptionId: $option } }) { projectV2Item { id } }
      }`,
      { project: project.id, item: itemId, field: field.id, option: optionId },
    ),
  );
}

function syncIssue(project, number, seen = new Set()) {
  if (seen.has(number)) return;
  seen.add(number);

  const issue = loadIssue(number);
  if (!issue) return;
  const issueFacts = facts(issue);

  // A Spec closes once its last Slice is in production, and a Feature once its Spec has.
  // Only when this event closed one of its sub-issues, so older parents are left alone.
  if (
    issue.state === "OPEN" &&
    isParent(issueFacts) &&
    parentIsFinished(issueFacts.subIssues) &&
    issueFacts.subIssues.some((child) => child.number === closedChild)
  ) {
    write(`close #${number}: every sub-issue is closed`, () => {
      rest("POST", `issues/${number}/comments`, {
        body: "Every sub-issue is in production, so this is done.",
      });
      rest("PATCH", `issues/${number}`, {
        state: "closed",
        state_reason: "completed",
      });
    });
    issueFacts.state = "CLOSED";
  }

  let itemId = issue.projectItems.nodes.find(
    (item) => item.project.id === project.id,
  )?.id;
  if (!itemId) {
    itemId = write(
      `add #${number} to the board`,
      () =>
        graphql(
          `mutation($project: ID!, $content: ID!) {
          addProjectV2ItemById(input: { projectId: $project, contentId: $content }) { item { id } }
        }`,
          { project: project.id, content: issue.id },
        ).addProjectV2ItemById.item.id,
    );
  }

  const status = statusFor(issueFacts);
  setField(project, itemId, "Status", status);
  for (const [field, value] of Object.entries(
    fieldsFromLabels(issueFacts.labels),
  )) {
    setField(project, itemId, field, value);
  }
  console.log(`#${number} → ${status}`);

  // A Slice's change can move its Spec.
  if (issue.parent) syncIssue(project, issue.parent.number, seen);
}

function issuesFromEvent({ name: eventName, payload }) {
  if (eventName === "issues") return [payload.issue.number];
  if (eventName === "pull_request" || eventName === "pull_request_target") {
    const bodies = [payload.pull_request.body, payload.changes?.body?.from];
    return [...new Set(bodies.flatMap(parseRefs))];
  }
  return null; // schedule or workflow_dispatch: everything.
}

const project = loadProject();
const event = readEvent();
const closedChild =
  event.name === "issues" && event.payload.action === "closed"
    ? event.payload.issue.number
    : null;
let numbers = process.argv.includes("--all") ? null : issuesFromEvent(event);
if (numbers === null) {
  const open = restAll("issues?state=open&per_page=100")
    .filter((issue) => !issue.pull_request)
    .map((issue) => issue.number);
  numbers = [...new Set([...open, ...project.items])];
}

const seen = new Set();
for (const number of numbers) syncIssue(project, number, seen);
