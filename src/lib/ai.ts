// An AI service cannot help right now: its free quota is used up, or it is down. Not a bug, so the
// person is pointed at another way to do the same thing instead of seeing an error.
export class AiUnavailable extends Error {
  constructor(reason: string) {
    super(`AI service unavailable: ${reason}`);
    this.name = "AiUnavailable";
  }
}
