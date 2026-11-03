import { beforeEach, describe, expect, it, vi } from "vitest";
import { askBestGuess, ESTIMATE_LABEL } from "./guess";

const fetchMock = vi.fn();

describe("askBestGuess", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("posts the query and returns an estimated Suggestion (AC-7)", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        guess: {
          name: "Lamington",
          portion: "1 piece",
          calories: 190,
          basis: "Sponge with chocolate and coconut",
        },
      }),
    );

    const result = await askBestGuess("lamington");

    expect(fetchMock).toHaveBeenCalledWith("/api/search/guess", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "lamington" }),
    });
    expect(result).toMatchObject({
      kind: "guess",
      suggestion: {
        name: "Lamington",
        portion: "1 piece",
        calories: 190,
        basis: "Sponge with chocolate and coconut",
        estimate: true,
        sourceLabel: "Estimate: check before saving",
      },
    });
    expect(ESTIMATE_LABEL).toBe("Estimate: check before saving");
  });

  it("gives each guess its own key, so the form starts afresh for each", async () => {
    fetchMock.mockImplementation(async () =>
      Response.json({
        guess: { name: "X", portion: "1 piece", calories: 1, basis: "b" },
      }),
    );

    const a = await askBestGuess("x");
    const b = await askBestGuess("x");

    expect(
      a.kind === "guess" &&
        b.kind === "guess" &&
        a.suggestion.key !== b.suggestion.key,
    ).toBe(true);
  });

  it("is unavailable on 503 or when the daily limit is reached", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ code: "guess_unavailable" }, { status: 503 }),
    );
    expect(await askBestGuess("x")).toEqual({ kind: "unavailable" });

    fetchMock.mockResolvedValueOnce(
      Response.json({ code: "limit_reached" }, { status: 429 }),
    );
    expect(await askBestGuess("x")).toEqual({ kind: "unavailable" });
  });

  it("fails on any other error or a network failure", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ code: "guess_failed" }, { status: 500 }),
    );
    expect(await askBestGuess("x")).toEqual({ kind: "failed" });

    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    expect(await askBestGuess("x")).toEqual({ kind: "failed" });
  });
});
