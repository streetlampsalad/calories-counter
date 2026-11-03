import { describe, expect, it } from "vitest";
import {
  FakeNotesReader,
  getNotesReader,
  type NotesReader,
  ReaderUnavailable,
} from "./notes-reader";
import { validateImportRow } from "./parse";

const photo = new Uint8Array([1, 2, 3]);

describe("FakeNotesReader", () => {
  it("returns fixture rows that Import Review accepts", async () => {
    const reader: NotesReader = new FakeNotesReader();
    const rows = await reader.readNotes(photo, "image/jpeg");

    expect(rows.length).toBeGreaterThan(1);
    for (const row of rows) expect(validateImportRow(row).ok).toBe(true);
  });
});

describe("getNotesReader", () => {
  it("uses the fake when asked to", async () => {
    const reader = getNotesReader({
      NOTES_READER: "fake",
      NODE_ENV: "production",
    });

    expect(reader).toBeInstanceOf(FakeNotesReader);
  });

  it("uses the fake in development when there is no API key, so validate never calls Google", () => {
    expect(getNotesReader({ NODE_ENV: "development" })).toBeInstanceOf(
      FakeNotesReader,
    );
  });

  it("never serves fake rows in production: with no reader configured it is unavailable", async () => {
    const reader = getNotesReader({ NODE_ENV: "production" });

    await expect(reader.readNotes(photo, "image/jpeg")).rejects.toBeInstanceOf(
      ReaderUnavailable,
    );
  });
});
