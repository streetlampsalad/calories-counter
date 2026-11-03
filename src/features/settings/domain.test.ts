import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  goalProgress,
  parseGoal,
  toSettings,
} from "./domain";

describe("toSettings", () => {
  it("falls back to the defaults for a User with no row", () => {
    expect(toSettings(null)).toEqual({ dailyGoal: null, weekStartsOn: 1 });
    expect(toSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("reads a saved row", () => {
    expect(
      toSettings({ daily_goal_calories: 2200, week_starts_on: 0 }),
    ).toEqual({
      dailyGoal: 2200,
      weekStartsOn: 0,
    });
  });

  it("keeps a cleared Goal as no Goal", () => {
    expect(
      toSettings({ daily_goal_calories: null, week_starts_on: 1 }).dailyGoal,
    ).toBeNull();
  });
});

describe("parseGoal", () => {
  it.each(["500", "2200", "10000", " 1800 "])("accepts %j", (text) => {
    expect(parseGoal(text)).toEqual({ ok: true, value: Number(text.trim()) });
  });

  it.each([
    "",
    "   ",
    "abc",
    "-2000",
    "2200.5",
    "2,200",
    "1e3",
    "499",
    "10001",
    "0",
  ])("rejects %j with a message that names the range", (text) => {
    expect(parseGoal(text)).toEqual({
      ok: false,
      error: "Enter a goal between 500 and 10,000 calories",
    });
  });
});

describe("goalProgress", () => {
  it("is nothing without a Goal", () => {
    expect(goalProgress(1840, null)).toBeNull();
  });

  it("shows how far through the Goal the Day is", () => {
    const progress = goalProgress(1100, 2200);

    expect(progress).toMatchObject({
      fraction: 0.5,
      over: false,
      overBy: 0,
      remaining: 1100,
    });
  });

  it("is empty at zero", () => {
    expect(goalProgress(0, 2200)).toMatchObject({
      fraction: 0,
      over: false,
      remaining: 2200,
    });
  });

  it("is full, but not over, exactly on the Goal", () => {
    expect(goalProgress(2200, 2200)).toMatchObject({
      fraction: 1,
      over: false,
      overBy: 0,
      remaining: 0,
    });
  });

  it("is over once the total passes the Goal, and the bar stays full", () => {
    expect(goalProgress(2500, 2200)).toMatchObject({
      fraction: 1,
      over: true,
      overBy: 300,
      remaining: 0,
    });
  });

  it("is over by one at one kcal past", () => {
    expect(goalProgress(2201, 2200)).toMatchObject({ over: true, overBy: 1 });
  });
});
