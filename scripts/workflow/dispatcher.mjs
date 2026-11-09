// When an Issue event should start the Dispatcher at once rather than at its next hourly run
// (docs/agents/dispatcher.md, .github/workflows/dispatcher.yml). Each case is an event that can
// give `/deliver next` a new candidate (.claude/skills/deliver/next.md).

const READY = "ready-for-agent";
const TRIAGE = "needs-triage";
const WAITING_FOR_HUMAN = ["needs-human-review", "human-step"];

/**
 * `payload` is an `issues` webhook payload. Only the owner's events count: the in-app Feature
 * Requests, the Dispatcher and the deploy all act as the owner, so a stranger opening an Issue on
 * this public repository starts no run.
 */
export function wakesDispatcher(payload, owner) {
  if (payload.sender?.login !== owner) return false;
  const labels = (payload.issue?.labels ?? []).map((label) => label.name);
  const changed = payload.label?.name;
  switch (payload.action) {
    case "opened":
      return (
        labels.includes(READY) ||
        (labels.includes(TRIAGE) &&
          (labels.includes("feature") || labels.includes("bug")))
      );
    case "labeled":
      return changed === READY;
    case "unlabeled":
      return WAITING_FOR_HUMAN.includes(changed);
    // A closed Issue can unblock the next Slice, or finish a Spec whose Feature then closes.
    case "closed":
      return true;
    default:
      return false;
  }
}
