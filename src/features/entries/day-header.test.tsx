import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DayHeader } from "./day-header";

const TODAY = "2026-11-03";

function open(day: string) {
  const onChange = vi.fn();
  render(<DayHeader day={day} today={TODAY} onChange={onChange} />);
  return { onChange };
}

describe("DayHeader", () => {
  it("names the Day as the page heading", () => {
    open("2026-11-02");

    expect(
      screen.getByRole("heading", { level: 1, name: "Yesterday" }),
    ).toBeInTheDocument();
  });

  it("steps back one Day", async () => {
    const { onChange } = open(TODAY);

    await userEvent.click(screen.getByRole("button", { name: "Previous day" }));

    expect(onChange).toHaveBeenCalledWith("2026-11-02");
  });

  it("steps forward one Day from a past Day", async () => {
    const { onChange } = open("2026-10-31");

    await userEvent.click(screen.getByRole("button", { name: "Next day" }));

    expect(onChange).toHaveBeenCalledWith("2026-11-01");
  });

  it("cannot step into the future", async () => {
    const { onChange } = open(TODAY);

    const next = screen.getByRole("button", { name: "Next day" });
    expect(next).toBeDisabled();
    await userEvent.click(next);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("can step forward onto today", async () => {
    const { onChange } = open("2026-11-02");

    await userEvent.click(screen.getByRole("button", { name: "Next day" }));

    expect(onChange).toHaveBeenCalledWith(TODAY);
  });

  it("steps across a month and year boundary", async () => {
    const { onChange } = open("2026-01-01");

    await userEvent.click(screen.getByRole("button", { name: "Previous day" }));

    expect(onChange).toHaveBeenCalledWith("2025-12-31");
  });

  it("offers the phone's date picker, showing the Day and stopping at today", () => {
    open("2026-10-20");

    const picker = screen.getByLabelText("Pick a day");
    expect(picker).toHaveAttribute("type", "date");
    expect(picker).toHaveValue("2026-10-20");
    expect(picker).toHaveAttribute("max", TODAY);
  });

  it("goes to a Day chosen in the date picker", () => {
    const { onChange } = open(TODAY);

    fireEvent.change(screen.getByLabelText("Pick a day"), {
      target: { value: "2026-09-15" },
    });

    expect(onChange).toHaveBeenCalledWith("2026-09-15");
  });

  it("ignores a cleared date picker", () => {
    const { onChange } = open("2026-10-20");

    fireEvent.change(screen.getByLabelText("Pick a day"), {
      target: { value: "" },
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("refuses a future Day even if the picker allows one", () => {
    const { onChange } = open(TODAY);

    fireEvent.change(screen.getByLabelText("Pick a day"), {
      target: { value: "2026-11-09" },
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("has phone-sized buttons", () => {
    open(TODAY);

    for (const name of ["Previous day", "Next day"]) {
      expect(screen.getByRole("button", { name })).toHaveClass("size-11");
    }
  });
});
