import type { ImportRow } from "./parse";

// Reads a photo of handwritten food notes into rows for Import Review. The rows have the same
// shape the CSV and JSON parser produces, so Import Review does not know where they came from.
export interface NotesReader {
  readNotes(image: Uint8Array, mimeType: string): Promise<ImportRow[]>;
}

// The service cannot help right now: its free quota is used up, or it is down. Not a bug, so the
// User is offered the copy-prompt route instead.
export class ReaderUnavailable extends Error {
  constructor(reason: string) {
    super(`Notes reader unavailable: ${reason}`);
    this.name = "ReaderUnavailable";
  }
}

const FIXTURE_ROWS: ImportRow[] = [
  {
    name: "Vegemite toast",
    portion: "1 slice",
    calories: "95",
    kilojoules: "",
  },
  { name: "Banana", portion: "1 medium", calories: "105", kilojoules: "" },
  { name: "Chocolate", portion: "1 bar", calories: "", kilojoules: "1000" },
];

// Stands in for the real reader in tests and in local development without a key, so `pnpm
// validate` never calls Google.
export class FakeNotesReader implements NotesReader {
  async readNotes(): Promise<ImportRow[]> {
    return FIXTURE_ROWS.map((row) => ({ ...row }));
  }
}

// What production uses when no reader is set up, so nobody is ever given made-up foods.
class UnavailableReader implements NotesReader {
  async readNotes(): Promise<ImportRow[]> {
    throw new ReaderUnavailable("no reader is configured");
  }
}

// Which reader this deployment uses. Production without a reader is unavailable, never fake.
export function getNotesReader(
  env: Record<string, string | undefined> = process.env,
): NotesReader {
  if (env.NOTES_READER === "fake") return new FakeNotesReader();
  if (env.NODE_ENV !== "production") return new FakeNotesReader();
  return new UnavailableReader();
}
