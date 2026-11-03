import { beforeEach, describe, expect, it, vi } from "vitest";
import { fitWithin, MAX_PHOTO_SIDE, readPhoto, resizePhoto } from "./photo";

describe("fitWithin", () => {
  it("leaves a photo that already fits alone", () => {
    expect(fitWithin(1200, 800, 1600)).toEqual({ width: 1200, height: 800 });
    expect(fitWithin(1600, 1600, 1600)).toEqual({ width: 1600, height: 1600 });
  });

  it("scales a landscape photo so its longest side is the limit", () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it("scales a portrait photo so its longest side is the limit", () => {
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it("keeps the shape and never rounds a side to zero", () => {
    expect(fitWithin(100000, 10, 1600)).toEqual({ width: 1600, height: 1 });
  });

  it("limits photos to 1,600 px", () => {
    expect(MAX_PHOTO_SIDE).toBe(1600);
  });
});

describe("resizePhoto", () => {
  const close = vi.fn();
  const encode = vi.fn();
  const decode = vi.fn();
  const file = new File(["x"], "notes.png", { type: "image/png" });

  beforeEach(() => {
    close.mockReset();
    encode.mockReset();
    decode.mockReset();
    encode.mockResolvedValue(new Blob(["jpeg"], { type: "image/jpeg" }));
  });

  it("encodes a big photo as a JPEG whose longest side is at most 1,600 px", async () => {
    decode.mockResolvedValue({ width: 4032, height: 3024, close });

    const blob = await resizePhoto(file, { decode, encode });

    expect(encode).toHaveBeenCalledWith(
      expect.objectContaining({ width: 4032 }),
      1600,
      1200,
    );
    expect(blob.type).toBe("image/jpeg");
  });

  it("still re-encodes a small photo as JPEG, at its own size", async () => {
    decode.mockResolvedValue({ width: 800, height: 600, close });

    await resizePhoto(file, { decode, encode });

    expect(encode).toHaveBeenCalledWith(expect.anything(), 800, 600);
  });

  it("releases the decoded picture", async () => {
    decode.mockResolvedValue({ width: 800, height: 600, close });

    await resizePhoto(file, { decode, encode });

    expect(close).toHaveBeenCalled();
  });

  it("fails clearly if the file cannot be read as a picture", async () => {
    decode.mockRejectedValue(new Error("bad image"));

    await expect(resizePhoto(file, { decode, encode })).rejects.toThrow(
      /couldn't read that photo/i,
    );
  });
});

describe("readPhoto", () => {
  const fetchMock = vi.fn();
  const blob = new Blob(["jpeg"], { type: "image/jpeg" });
  const rows = [
    { name: "Toast", portion: "1 slice", calories: "110", kilojoules: "" },
  ];

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("posts the photo as the body and returns the rows", async () => {
    fetchMock.mockResolvedValue(Response.json({ rows }));

    const result = await readPhoto(blob);

    expect(fetchMock).toHaveBeenCalledWith("/api/import/photo", {
      method: "POST",
      headers: { "content-type": "image/jpeg" },
      body: blob,
    });
    expect(result).toEqual({ kind: "rows", rows });
  });

  it("reports a photo with no foods", async () => {
    fetchMock.mockResolvedValue(Response.json({ rows: [] }));

    expect(await readPhoto(blob)).toEqual({ kind: "empty" });
  });

  it("reports the service being unavailable, from the 503 code", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ code: "reader_unavailable" }, { status: 503 }),
    );

    expect(await readPhoto(blob)).toEqual({ kind: "unavailable" });
  });

  it("treats a 429 as unavailable too, once the daily limit applies", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ code: "limit_reached" }, { status: 429 }),
    );

    expect(await readPhoto(blob)).toEqual({ kind: "unavailable" });
  });

  it("reports any other failure, and a network error, as failed", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ code: "reader_failed" }, { status: 500 }),
    );
    expect(await readPhoto(blob)).toEqual({ kind: "failed" });

    fetchMock.mockRejectedValue(new TypeError("offline"));
    expect(await readPhoto(blob)).toEqual({ kind: "failed" });
  });
});
