import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SuggestionSheet } from "./suggestion-sheet";
import type { Suggestion } from "./suggestions";

const reference: Suggestion = {
  key: "reference:1",
  name: "Chicken, breast",
  per100: { calories: 165, unit: "g" },
  sourceLabel: "From the Australian Food Composition Database",
};
const packaged: Suggestion = {
  key: "off:1",
  name: "Tim Tam",
  brand: "Arnott's",
  per100: { calories: 500, unit: "g" },
  serving: { calories: 150, label: "30 g" },
  sourceLabel: "From Open Food Facts",
};

function open(suggestion: Suggestion) {
  const onSave = vi.fn();
  const view = render(
    <SuggestionSheet
      suggestion={suggestion}
      foods={[]}
      onSave={onSave}
      onEditExisting={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  return { onSave, ...view };
}

describe("SuggestionSheet: rescaling the portion (AC-4)", () => {
  it("rescales the Calories when the Portion becomes a gram amount", async () => {
    open(reference);

    await userEvent.clear(await screen.findByLabelText("Portion"));
    await userEvent.type(screen.getByLabelText("Portion"), "150 g");

    expect(screen.getByLabelText("Calories")).toHaveValue("248");
  });

  it("rescales as the Portion is typed, and when a chip is tapped", async () => {
    open(reference);
    const portion = await screen.findByLabelText("Portion");

    await userEvent.clear(portion);
    await userEvent.type(portion, "50 g");
    expect(screen.getByLabelText("Calories")).toHaveValue("83"); // 82.5

    await userEvent.click(screen.getByRole("button", { name: "100 g" }));
    expect(screen.getByLabelText("Calories")).toHaveValue("165");
  });

  it("leaves the Calories alone for a Portion that is not in grams, like 1 cup", async () => {
    open(reference);

    await userEvent.clear(await screen.findByLabelText("Portion"));
    await userEvent.type(screen.getByLabelText("Portion"), "1 cup");

    expect(screen.getByLabelText("Calories")).toHaveValue("165");
  });

  it("does not turn grams into millilitres", async () => {
    open(reference);

    await userEvent.clear(await screen.findByLabelText("Portion"));
    await userEvent.type(screen.getByLabelText("Portion"), "150 ml");

    expect(screen.getByLabelText("Calories")).toHaveValue("165");
  });

  it("scales per 100 ml for a liquid", async () => {
    open({ ...reference, per100: { calories: 65, unit: "ml" } });

    await userEvent.clear(await screen.findByLabelText("Portion"));
    await userEvent.type(screen.getByLabelText("Portion"), "250 ml");

    expect(screen.getByLabelText("Calories")).toHaveValue("163"); // 162.5
  });

  it("lets the User override the number, and then stops rescaling", async () => {
    open(reference);
    await userEvent.clear(await screen.findByLabelText("Portion"));
    await userEvent.type(screen.getByLabelText("Portion"), "150 g");

    await userEvent.clear(screen.getByLabelText("Calories"));
    await userEvent.type(screen.getByLabelText("Calories"), "260");
    await userEvent.clear(screen.getByLabelText("Portion"));
    await userEvent.type(screen.getByLabelText("Portion"), "200 g");

    expect(screen.getByLabelText("Calories")).toHaveValue("260");
  });

  it("saves the rescaled values", async () => {
    const { onSave } = open(reference);
    await userEvent.clear(await screen.findByLabelText("Portion"));
    await userEvent.type(screen.getByLabelText("Portion"), "150 g");

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith({
      name: "Chicken, breast",
      portion: "150 g",
      calories: 248,
    });
  });

  it("rescales in kilojoules too, if that unit is chosen", async () => {
    open(reference);
    await userEvent.click(await screen.findByRole("button", { name: "kJ" }));

    await userEvent.clear(screen.getByLabelText("Portion"));
    await userEvent.type(screen.getByLabelText("Portion"), "150 g");

    expect(screen.getByLabelText("Kilojoules")).toHaveValue("1038"); // 248 kcal
  });
});

describe("SuggestionSheet: per serving or per 100 g (AC-5)", () => {
  it("asks which to use when the product gives both, before the form opens", async () => {
    open(packaged);

    expect(
      await screen.findByText(/Which do you want to save/),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Per serving/ }),
    ).toHaveTextContent("30 g: 150 kcal");
    expect(screen.getByRole("button", { name: /Per 100 g/ })).toHaveTextContent(
      "500 kcal",
    );
  });

  it("opens the form with the serving's values", async () => {
    open(packaged);

    await userEvent.click(
      await screen.findByRole("button", { name: /Per serving/ }),
    );

    expect(screen.getByLabelText("Name")).toHaveValue("Tim Tam");
    expect(screen.getByLabelText("Portion")).toHaveValue("1 serving (30 g)");
    expect(screen.getByLabelText("Calories")).toHaveValue("150");
  });

  it("does not rescale a serving, since 150 kcal is for that serving", async () => {
    open(packaged);
    await userEvent.click(
      await screen.findByRole("button", { name: /Per serving/ }),
    );

    await userEvent.clear(screen.getByLabelText("Portion"));
    await userEvent.type(screen.getByLabelText("Portion"), "60 g");

    expect(screen.getByLabelText("Calories")).toHaveValue("150");
  });

  it("opens the form per 100 g, which does rescale", async () => {
    open(packaged);
    await userEvent.click(
      await screen.findByRole("button", { name: /Per 100 g/ }),
    );

    expect(screen.getByLabelText("Portion")).toHaveValue("100 g");
    expect(screen.getByLabelText("Calories")).toHaveValue("500");
    await userEvent.clear(screen.getByLabelText("Portion"));
    await userEvent.type(screen.getByLabelText("Portion"), "30 g");
    expect(screen.getByLabelText("Calories")).toHaveValue("150");
  });

  it("goes straight to the form when only per 100 g is known", async () => {
    open(reference);

    expect(await screen.findByLabelText("Name")).toBeInTheDocument();
  });

  it("goes straight to the form with the serving when that is all there is", async () => {
    open({ ...packaged, per100: undefined });

    expect(await screen.findByLabelText("Portion")).toHaveValue(
      "1 serving (30 g)",
    );
  });

  it("keeps a long serving label within the Portion limit", async () => {
    open({
      ...packaged,
      per100: undefined,
      serving: {
        calories: 90,
        label: "1 sachet of the extra large family sized pack",
      },
    });

    const portion = (await screen.findByLabelText(
      "Portion",
    )) as HTMLInputElement;

    expect(portion.value.length).toBeLessThanOrEqual(40);
  });

  it("starts the choice again for the next product", async () => {
    const view = open(packaged);
    await userEvent.click(
      await screen.findByRole("button", { name: /Per serving/ }),
    );
    view.rerender(
      <SuggestionSheet
        suggestion={{ ...packaged, key: "off:2", name: "Anzac biscuit" }}
        foods={[]}
        onSave={vi.fn()}
        onEditExisting={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(
      await screen.findByText(/Which do you want to save/),
    ).toBeInTheDocument();
  });
});

describe("SuggestionSheet: an estimate", () => {
  it("opens with the guessed portion and calories", async () => {
    open({
      key: "guess:1",
      name: "Lamington",
      portion: "1 piece",
      calories: 190,
      basis: "Sponge with chocolate and coconut",
      estimate: true,
      sourceLabel: "Estimate: check before saving",
    });

    expect(await screen.findByLabelText("Portion")).toHaveValue("1 piece");
    expect(screen.getByLabelText("Calories")).toHaveValue("190");
    expect(
      screen.getByText("Estimate: check before saving"),
    ).toBeInTheDocument();
  });
});
