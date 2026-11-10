// Text the app puts into public GitHub Issues (Feature Requests, spec 124; Bug reports, spec 194).
// The repo is public and agents read every Issue, so a User's words are kept from shaping it: each
// field is quoted (no headings), and mentions and references are broken with a zero-width space
// (nobody is notified, no other Issue is linked).

const TITLE_MAX = 70;
const ZERO_WIDTH_SPACE = "​";
export const NOT_GIVEN = "_Not given_";

export function neutralise(text: string): string {
  return text
    .replace(/@(?=[\w-])/g, `@${ZERO_WIDTH_SPACE}`)
    .replace(/#(?=\d)/g, `#${ZERO_WIDTH_SPACE}`);
}

export function quote(text: string | undefined): string {
  const trimmed = text?.trim();
  if (!trimmed) return NOT_GIVEN;
  return neutralise(trimmed)
    .split(/\r?\n/)
    .map((line) => (line.trim() ? `> ${line}` : ">"))
    .join("\n");
}

// A title: the prefix and the first line of the text, cut at a word to 70 characters with an ellipsis.
export function cutTitle(prefix: string, text: string): string {
  const line = (text.trim().split(/\r?\n/)[0] ?? "").replace(/\s+/g, " ");
  const room = TITLE_MAX - prefix.length;
  if (line.length <= room) return prefix + neutralise(line);

  const cut = line.slice(0, room - 1);
  const atWord =
    cut.lastIndexOf(" ") > 0 ? cut.slice(0, cut.lastIndexOf(" ")) : cut;
  return `${prefix}${neutralise(atWord.trimEnd())}…`;
}
