import { describe, expect, it, vi } from "vitest";
import type { GeminiRequest } from "@/lib/gemini";
import { GeminiNotesReader } from "./gemini-notes-reader";

const photo = new Uint8Array([1, 2, 3]);
const reader = (reply: string) => {
  const ask = vi.fn(async (_request: GeminiRequest) => reply);
  return { ask, reader: new GeminiNotesReader(ask) };
};

// What the model returns, as recorded in the shape its schema asks for.
const recorded = JSON.stringify({
  foods: [
    { name: "Vegemite toast", portion: "1 slice", calories: 95 },
    { name: "Chocolate", portion: "1 bar", kilojoules: 1000 },
    { name: "Mystery", portion: "1 serve" },
    { name: "Water", portion: "250 ml", calories: 0, kilojoules: null },
  ],
});

describe("GeminiNotesReader", () => {
  it("maps the model's answer to rows for Import Review", async () => {
    const { reader: r } = reader(recorded);

    expect(await r.readNotes(photo, "image/jpeg")).toEqual([
      {
        name: "Vegemite toast",
        portion: "1 slice",
        calories: "95",
        kilojoules: "",
      },
      { name: "Chocolate", portion: "1 bar", calories: "", kilojoules: "1000" },
      { name: "Mystery", portion: "1 serve", calories: "", kilojoules: "" },
      { name: "Water", portion: "250 ml", calories: "0", kilojoules: "" },
    ]);
  });

  it("sends the photo as base64 with its type, and asks for JSON in a fixed shape", async () => {
    const { ask, reader: r } = reader(recorded);

    await r.readNotes(photo, "image/png");

    const request = ask.mock.calls[0][0];
    expect(request.input).toContainEqual({
      type: "image",
      data: Buffer.from(photo).toString("base64"),
      mime_type: "image/png",
    });
    expect(JSON.stringify(request.schema)).toContain("foods");
    expect(request.system).toContain("Australia");
    expect(request.system).toContain("handwritten");
  });

  it("returns no rows when the photo has no foods", async () => {
    const { reader: r } = reader(JSON.stringify({ foods: [] }));

    expect(await r.readNotes(photo, "image/jpeg")).toEqual([]);
  });

  it("refuses an answer that is not in the shape asked for", async () => {
    for (const bad of [
      "not json",
      JSON.stringify({ items: [] }),
      JSON.stringify({ foods: [{ name: "x" }] }),
      JSON.stringify({
        foods: [{ name: "x", portion: "y", calories: "lots" }],
      }),
      JSON.stringify({ foods: [{ name: "x", portion: "y", calories: -5 }] }),
    ]) {
      const { reader: r } = reader(bad);
      await expect(r.readNotes(photo, "image/jpeg")).rejects.toThrow();
    }
  });

  it("never returns more than 200 rows", async () => {
    const many = Array.from({ length: 250 }, (_, i) => ({
      name: `Food ${i}`,
      portion: "1 serve",
      calories: 1,
    }));
    const { reader: r } = reader(JSON.stringify({ foods: many }));

    expect(await r.readNotes(photo, "image/jpeg")).toHaveLength(200);
  });

  it("lets a failure from the service through, for the route to report", async () => {
    const r = new GeminiNotesReader(async () => {
      throw new Error("boom");
    });

    await expect(r.readNotes(photo, "image/jpeg")).rejects.toThrow("boom");
  });
});
