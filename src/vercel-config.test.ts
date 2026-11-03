import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const config = JSON.parse(
  readFileSync(path.join(process.cwd(), "vercel.json"), "utf8"),
);

const readJson = (file: string) =>
  JSON.parse(readFileSync(path.join(process.cwd(), file), "utf8"));
const nvmrc = readFileSync(path.join(process.cwd(), ".nvmrc"), "utf8").trim();

describe("package.json engines", () => {
  it("pins Node to the .nvmrc major, because Vercel's project default (26.x) is rejected by its own build tooling", () => {
    expect(readJson("package.json").engines?.node).toBe(`${nvmrc}.x`);
  });
});

describe("vercel.json", () => {
  it("runs functions in Sydney, next to the database (spec 001 AC-6)", () => {
    expect(config.regions).toEqual(["syd1"]);
  });

  it("never deploys from Git pushes, so the deploy workflow is the only path (spec 001 AC-5)", () => {
    expect(config.git?.deploymentEnabled).toBe(false);
  });
});
