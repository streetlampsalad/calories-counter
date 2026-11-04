import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeQueryClient } from "./query-client";

const vibrate = vi.fn((_pattern: VibratePattern) => true);

beforeEach(() => {
  vibrate.mockClear();
  window.localStorage.clear();
  Object.defineProperty(navigator, "vibrate", {
    configurable: true,
    writable: true,
    value: vibrate,
  });
});
afterEach(() => vi.restoreAllMocks());

function run(mutationFn: () => Promise<unknown>) {
  const client = makeQueryClient();
  return client
    .getMutationCache()
    .build(client, { mutationFn })
    .execute(undefined)
    .catch(() => undefined);
}

describe("makeQueryClient", () => {
  it("buzzes with the error pulse when a save fails and rolls back", async () => {
    await run(() => Promise.reject(new Error("down")));

    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith([30, 60, 30]);
  });

  it("stays quiet when a save works", async () => {
    await run(() => Promise.resolve("saved"));

    expect(vibrate).not.toHaveBeenCalled();
  });

  it("stays quiet when the User has turned vibration off", async () => {
    window.localStorage.setItem("vibration", "off");

    await run(() => Promise.reject(new Error("down")));

    expect(vibrate).not.toHaveBeenCalled();
  });
});
