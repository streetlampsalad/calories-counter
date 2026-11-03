import { type NotesReader, ReaderUnavailable } from "./notes-reader";

export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type Deps = {
  /** The signed-in User's id, or null. */
  userId: () => Promise<string | null>;
  reader: NotesReader;
};

const reply = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

// The photo endpoint, apart from how it is wired to Next. The photo arrives as the request body,
// goes to the reader, and is dropped: it is never stored, and neither its bytes nor anything
// derived from them is logged.
export async function handlePhoto(
  request: Request,
  { userId, reader }: Deps,
): Promise<Response> {
  if ((await userId()) === null) return reply(401, { code: "unauthorized" });

  const type = (request.headers.get("content-type") ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (!PHOTO_TYPES.has(type)) {
    return reply(400, {
      code: "unsupported_type",
      message: "Send a JPEG, PNG or WebP photo.",
    });
  }

  const declared = Number(request.headers.get("content-length"));
  if (declared > MAX_PHOTO_BYTES) return reply(413, { code: "too_large" });

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length > MAX_PHOTO_BYTES) return reply(413, { code: "too_large" });
  if (bytes.length === 0) {
    return reply(400, { code: "empty", message: "The photo was empty." });
  }

  try {
    return reply(200, { rows: await reader.readNotes(bytes, type) });
  } catch (error) {
    if (error instanceof ReaderUnavailable) {
      return reply(503, { code: "reader_unavailable" });
    }
    // The error's name only: its message could quote what the model was given.
    console.error(
      `Photo reading failed: ${error instanceof Error ? error.name : "unknown error"}`,
    );
    return reply(500, { code: "reader_failed" });
  }
}
