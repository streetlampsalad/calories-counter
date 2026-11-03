import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { AI_PROMPT } from "./ai-prompt";
import { ImportScreen } from "./import-screen";

function stubClipboard(writeText: ((text: string) => Promise<void>) | null) {
  Object.defineProperty(navigator, "clipboard", {
    value: writeText ? { writeText } : undefined,
    configurable: true,
  });
}

describe("ImportScreen", () => {
  beforeEach(() => {
    toast.mockReset();
    toast.error.mockReset();
    window.getSelection()?.removeAllRanges();
  });

  it("shows the three steps", () => {
    render(<ImportScreen />);

    expect(
      screen.getByRole("heading", { name: "Import from notes", level: 1 }),
    ).toBeInTheDocument();
    const steps = screen.getAllByRole("listitem");
    expect(steps).toHaveLength(3);
    expect(steps[0]).toHaveTextContent("Copy the prompt");
    expect(steps[1]).toHaveTextContent("Ask any AI");
    expect(steps[1]).toHaveTextContent("photo");
    expect(steps[2]).toHaveTextContent("Upload or paste");
  });

  it("shows the full prompt text", () => {
    render(<ImportScreen />);

    expect(screen.getByTestId("prompt").textContent).toBe(AI_PROMPT);
  });

  it("copies the exact prompt and says so", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    render(<ImportScreen />);

    await userEvent.click(screen.getByRole("button", { name: "Copy prompt" }));

    expect(writeText).toHaveBeenCalledWith(AI_PROMPT);
    expect(toast).toHaveBeenCalledWith("Prompt copied");
  });

  it("selects the prompt for copying by hand when the clipboard is refused", async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    render(<ImportScreen />);

    await userEvent.click(screen.getByRole("button", { name: "Copy prompt" }));

    expect(window.getSelection()?.toString()).toBe(AI_PROMPT);
    expect(toast).not.toHaveBeenCalledWith("Prompt copied");
    expect(toast).toHaveBeenCalledWith(
      expect.stringContaining("copy it by hand"),
    );
  });

  it("selects the prompt when there is no clipboard at all", async () => {
    stubClipboard(null);
    render(<ImportScreen />);

    await userEvent.click(screen.getByRole("button", { name: "Copy prompt" }));

    expect(window.getSelection()?.toString()).toBe(AI_PROMPT);
  });

  it("leads back to the Food List", () => {
    render(<ImportScreen />);

    expect(screen.getByRole("link", { name: /Foods/ })).toHaveAttribute(
      "href",
      "/foods",
    );
  });
});
