import { beforeEach, describe, expect, it, vi } from "vitest";
import { type NotesReader, ReaderUnavailable } from "./notes-reader";
import type { ImportRow } from "./parse";
import { handlePhoto, MAX_PHOTO_BYTES } from "./photo-handler";

const rows: ImportRow[] = [
  { name: "Toast", portion: "1 slice", calories: "110", kilojoules: "" },
];
const readNotes = vi.fn<NotesReader["readNotes"]>();
const reader: NotesReader = { readNotes };

function photo(
  body: BodyInit | null = new Uint8Array([1, 2, 3]),
  headers: Record<string, string> = { "content-type": "image/jpeg" },
) {
  return new Request("http://localhost/api/import/photo", {
    method: "POST",
    body,
    headers,
  });
}
const signedIn = () => Promise.resolve("user-1");
const signedOut = () => Promise.resolve(null);

describe("handlePhoto", () => {
  beforeEach(() => {
    readNotes.mockReset();
    readNotes.mockResolvedValue(rows);
  });

  it("turns away someone who is signed out, without reading the photo", async () => {
    const response = await handlePhoto(photo(), { userId: signedOut, reader });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ code: "unauthorized" });
    expect(readNotes).not.toHaveBeenCalled();
  });

  it("returns the rows the reader found, in the shape Import Review takes", async () => {
    const response = await handlePhoto(photo(), { userId: signedIn, reader });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ rows });
  });

  it("hands the reader the photo's bytes and type", async () => {
    await handlePhoto(photo(new Uint8Array([9, 8, 7])), {
      userId: signedIn,
      reader,
    });

    expect(readNotes).toHaveBeenCalledWith(
      new Uint8Array([9, 8, 7]),
      "image/jpeg",
    );
  });

  it("says nothing was found when the photo has no foods (AC-5)", async () => {
    readNotes.mockResolvedValue([]);

    const response = await handlePhoto(photo(), { userId: signedIn, reader });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ rows: [] });
  });

  it("answers 503 reader_unavailable when the service is out of quota or down (AC-6)", async () => {
    readNotes.mockRejectedValue(new ReaderUnavailable("quota"));

    const response = await handlePhoto(photo(), { userId: signedIn, reader });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: "reader_unavailable" });
  });

  it("answers 500 reader_failed for any other failure, without crashing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    readNotes.mockRejectedValue(new Error("model returned nonsense"));

    const response = await handlePhoto(photo(), { userId: signedIn, reader });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ code: "reader_failed" });
  });

  it("never logs the photo's bytes (AC-7)", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    readNotes.mockRejectedValue(new Error("boom"));
    const secret = "SECRET-PHOTO-BYTES";

    await handlePhoto(photo(new TextEncoder().encode(secret)), {
      userId: signedIn,
      reader,
    });

    expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
    expect(JSON.stringify(log.mock.calls)).not.toContain("83,69,67");
  });

  it("accepts JPEG, PNG and WebP, and nothing else", async () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      const response = await handlePhoto(
        photo(undefined, { "content-type": type }),
        {
          userId: signedIn,
          reader,
        },
      );
      expect(response.status).toBe(200);
    }
    for (const type of ["text/plain", "application/pdf", "image/gif", ""]) {
      const response = await handlePhoto(
        photo(undefined, type ? { "content-type": type } : {}),
        { userId: signedIn, reader },
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "unsupported_type" });
    }
  });

  it("rejects an empty body", async () => {
    const response = await handlePhoto(photo(new Uint8Array([])), {
      userId: signedIn,
      reader,
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "empty" });
  });

  it("rejects a photo over 4 MB, by its declared size or its real size", async () => {
    expect(MAX_PHOTO_BYTES).toBe(4 * 1024 * 1024);
    const declared = await handlePhoto(
      photo(new Uint8Array([1]), {
        "content-type": "image/jpeg",
        "content-length": String(MAX_PHOTO_BYTES + 1),
      }),
      { userId: signedIn, reader },
    );
    const actual = await handlePhoto(
      photo(new Uint8Array(MAX_PHOTO_BYTES + 1)),
      { userId: signedIn, reader },
    );

    expect(declared.status).toBe(413);
    expect(actual.status).toBe(413);
    expect(readNotes).not.toHaveBeenCalled();
  });

  it("is never cached", async () => {
    const response = await handlePhoto(photo(), { userId: signedIn, reader });

    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
