// A line for the server log saying why a request failed: the kind of error, its status and Google's
// reason (cut short). The API key and what was sent are never part of an SDK error message.
export function describeFailure(error: unknown): string {
  if (!(error instanceof Error)) return "unknown error";
  const status = (error as { status?: unknown }).status;
  const where = typeof status === "number" ? ` (${status})` : "";
  return `${error.name}${where}: ${error.message.slice(0, 300)}`;
}
