import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithOAuth = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithOAuth } }),
}));

import { SignInForm } from "./sign-in-form";

describe("SignInForm", () => {
  beforeEach(() => signInWithOAuth.mockReset());

  it("offers Google as the only way in", () => {
    render(<SignInForm next="/" />);

    expect(
      screen.getByRole("button", { name: /continue with google/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });

  it("starts Google sign-in and returns through the callback to where the User was going", async () => {
    signInWithOAuth.mockResolvedValue({ error: null });
    render(<SignInForm next="/foods" />);

    await userEvent.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=%2Ffoods`,
      },
    });
  });

  it("tells the User when sign-in could not start", async () => {
    signInWithOAuth.mockResolvedValue({
      error: new Error("provider is not enabled"),
    });
    render(<SignInForm next="/" />);

    await userEvent.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /couldn't start google sign-in/i,
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /continue with google/i }),
      ).toBeEnabled(),
    );
  });

  it("shows the invite-only message with the refused email", () => {
    render(
      <SignInForm next="/" error="not_allowed" email="stranger@gmail.com" />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "This app is invite-only. Ask the owner to add stranger@gmail.com.",
    );
  });

  it("shows a generic message when sign-in failed for another reason", () => {
    render(<SignInForm next="/" error="auth_failed" />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      /something went wrong signing in/i,
    );
  });
});
