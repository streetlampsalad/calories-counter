import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FoodForm } from "./food-form";
import type { Food } from "./types";

async function fill(name: string, portion: string, calories: string) {
  await userEvent.type(screen.getByLabelText("Name"), name);
  await userEvent.type(screen.getByLabelText("Portion"), portion);
  await userEvent.type(screen.getByLabelText("Calories"), calories);
}

describe("FoodForm", () => {
  it("submits a valid Food with its values cleaned up", async () => {
    const onSubmit = vi.fn();
    render(<FoodForm onSubmit={onSubmit} />);

    await fill("  Sourdough   toast ", "1 slice", "110");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Sourdough toast",
      portion: "1 slice",
      calories: 110,
    });
  });

  it("shows what is wrong, and submits nothing, when the form is empty", async () => {
    const onSubmit = vi.fn();
    render(<FoodForm onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Enter a name")).toBeInTheDocument();
    expect(
      screen.getByText("Enter a portion, like 1 slice or 100 g"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Calories must be a whole number from 0 to 9,999"),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("marks the failing fields as invalid for assistive technology", async () => {
    render(<FoodForm onSubmit={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByLabelText("Name")).toBeInvalid();
    expect(screen.getByLabelText("Calories")).toBeInvalid();
  });

  it("uses the numeric keypad for calories", () => {
    render(<FoodForm onSubmit={vi.fn()} />);

    expect(screen.getByLabelText("Calories")).toHaveAttribute(
      "inputmode",
      "numeric",
    );
  });

  it("refuses a Food that duplicates one in the list, naming it", async () => {
    const existing: Food = {
      id: "1",
      name: "Sourdough toast",
      portion: "1 slice",
      calories: 110,
      archivedAt: null,
    };
    const onSubmit = vi.fn();
    render(<FoodForm onSubmit={onSubmit} findExisting={() => existing} />);

    await fill("sourdough TOAST", "1 slice", "120");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(
      screen.getByText("You already have Sourdough toast (1 slice)"),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("starts from initial values and a custom button label", () => {
    render(
      <FoodForm
        submitLabel="Save changes"
        initialValues={{ name: "Rice", portion: "100 g", calories: "130" }}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Name")).toHaveValue("Rice");
    expect(screen.getByLabelText("Calories")).toHaveValue("130");
    expect(
      screen.getByRole("button", { name: "Save changes" }),
    ).toBeInTheDocument();
  });
});

describe("FoodForm: Portion chips", () => {
  const chips = ["100 g", "100 ml", "1 serve", "1 slice", "1 cup", "1 piece"];

  it("offers the common Portions as tap targets", () => {
    render(<FoodForm onSubmit={vi.fn()} />);

    const group = screen.getByRole("group", { name: "Common portions" });
    expect(
      Array.from(group.querySelectorAll("button")).map((b) => b.textContent),
    ).toEqual(chips);
  });

  it("fills the Portion field when tapped, and the field stays editable", async () => {
    render(<FoodForm onSubmit={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "1 slice" }));
    expect(screen.getByLabelText("Portion")).toHaveValue("1 slice");

    await userEvent.type(screen.getByLabelText("Portion"), "s");
    expect(screen.getByLabelText("Portion")).toHaveValue("1 slices");
  });

  it("highlights the chip that matches the Portion, ignoring case and spacing", async () => {
    render(<FoodForm onSubmit={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Portion"), "  100   G ");

    expect(screen.getByRole("button", { name: "100 g" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "100 ml" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});

describe("FoodForm: errors appear as you type", () => {
  it("stays quiet until a field has been visited", async () => {
    render(<FoodForm onSubmit={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Name"), "x");
    await userEvent.clear(screen.getByLabelText("Name"));

    expect(screen.queryByText("Enter a name")).not.toBeInTheDocument();
  });

  it("flags a field once the User leaves it, and clears the message when fixed", async () => {
    render(<FoodForm onSubmit={vi.fn()} />);

    await userEvent.click(screen.getByLabelText("Name"));
    await userEvent.tab();
    expect(screen.getByText("Enter a name")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Name"), "Toast");
    expect(screen.queryByText("Enter a name")).not.toBeInTheDocument();
  });

  it("keeps checking the calories as digits change", async () => {
    render(<FoodForm onSubmit={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Calories"), "12000");
    await userEvent.tab();
    expect(
      screen.getByText("Calories must be a whole number from 0 to 9,999"),
    ).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Calories"));
    await userEvent.type(screen.getByLabelText("Calories"), "120");
    expect(
      screen.queryByText("Calories must be a whole number from 0 to 9,999"),
    ).not.toBeInTheDocument();
  });
});

describe("FoodForm: Save and add another", () => {
  it("is only offered when the caller can handle it", () => {
    const { unmount } = render(<FoodForm onSubmit={vi.fn()} />);
    expect(
      screen.queryByRole("button", { name: "Save and add another" }),
    ).not.toBeInTheDocument();
    unmount();

    render(<FoodForm onSubmit={vi.fn()} onSubmitAnother={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Save and add another" }),
    ).toBeInTheDocument();
  });

  it("saves, clears the name and calories, keeps the Portion, and refocuses the name", async () => {
    const onSubmit = vi.fn();
    const onSubmitAnother = vi.fn();
    render(<FoodForm onSubmit={onSubmit} onSubmitAnother={onSubmitAnother} />);

    await fill("Sourdough toast", "1 slice", "110");
    await userEvent.click(
      screen.getByRole("button", { name: "Save and add another" }),
    );

    expect(onSubmitAnother).toHaveBeenCalledWith({
      name: "Sourdough toast",
      portion: "1 slice",
      calories: 110,
    });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Name")).toHaveValue("");
    expect(screen.getByLabelText("Calories")).toHaveValue("");
    expect(screen.getByLabelText("Portion")).toHaveValue("1 slice");
    expect(screen.getByRole("button", { name: "1 slice" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("Name")).toHaveFocus();
  });

  it("starts the next Food with a clean slate, without leftover error messages", async () => {
    render(<FoodForm onSubmit={vi.fn()} onSubmitAnother={vi.fn()} />);

    await fill("Toast", "1 slice", "110");
    await userEvent.click(
      screen.getByRole("button", { name: "Save and add another" }),
    );

    expect(screen.queryByText("Enter a name")).not.toBeInTheDocument();
  });

  it("does not clear anything when the Food is invalid", async () => {
    const onSubmitAnother = vi.fn();
    render(<FoodForm onSubmit={vi.fn()} onSubmitAnother={onSubmitAnother} />);

    await userEvent.type(screen.getByLabelText("Name"), "Toast");
    await userEvent.click(
      screen.getByRole("button", { name: "Save and add another" }),
    );

    expect(onSubmitAnother).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Name")).toHaveValue("Toast");
  });
});

describe("FoodForm: prefilled from elsewhere", () => {
  it("shows where the values came from", () => {
    render(
      <FoodForm
        sourceLabel="From Open Food Facts"
        initialValues={{ name: "Banana", portion: "100 g", calories: "89" }}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText("From Open Food Facts")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Banana");
  });

  it("shows no source line when there is none", () => {
    render(<FoodForm onSubmit={vi.fn()} />);

    expect(screen.queryByText(/^From /)).not.toBeInTheDocument();
  });
});

describe("FoodForm: kilojoules", () => {
  beforeEach(() => localStorage.clear());

  const unit = (name: "kcal" | "kJ") => screen.getByRole("button", { name });

  it("offers kcal and kJ, starting on Calories", () => {
    render(<FoodForm onSubmit={vi.fn()} />);

    expect(
      screen.getByRole("group", { name: "Energy unit" }),
    ).toBeInTheDocument();
    expect(unit("kcal")).toHaveAttribute("aria-pressed", "true");
    expect(unit("kJ")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByLabelText("Calories")).toBeInTheDocument();
  });

  it("shows the conversion as the kilojoules are typed", async () => {
    render(<FoodForm onSubmit={vi.fn()} />);

    await userEvent.click(unit("kJ"));
    await userEvent.type(screen.getByLabelText("Kilojoules"), "1000");

    expect(screen.getByText("= 239 kcal")).toBeInTheDocument();
  });

  it("saves the converted Calories", async () => {
    const onSubmit = vi.fn();
    render(<FoodForm onSubmit={onSubmit} />);

    await userEvent.click(unit("kJ"));
    await userEvent.type(screen.getByLabelText("Name"), "Flat white");
    await userEvent.click(screen.getByRole("button", { name: "100 ml" }));
    await userEvent.type(screen.getByLabelText("Kilojoules"), "1000");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Flat white",
      portion: "100 ml",
      calories: 239,
    });
  });

  it("shows no conversion until there is a usable number", async () => {
    render(<FoodForm onSubmit={vi.fn()} />);

    await userEvent.click(unit("kJ"));
    expect(screen.queryByText(/^= /)).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Kilojoules"), "abc");
    expect(screen.queryByText(/^= /)).not.toBeInTheDocument();
  });

  it("rejects more kilojoules than 9,999 kcal allows", async () => {
    const onSubmit = vi.fn();
    render(<FoodForm onSubmit={onSubmit} />);

    await userEvent.click(unit("kJ"));
    await userEvent.type(screen.getByLabelText("Name"), "Feast");
    await userEvent.type(screen.getByLabelText("Portion"), "1 piece");
    await userEvent.type(screen.getByLabelText("Kilojoules"), "41838");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(
      screen.getByText("Kilojoules must be a whole number from 0 to 41,837"),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("converts the number already typed when the unit is switched", async () => {
    render(<FoodForm onSubmit={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Calories"), "239");
    await userEvent.click(unit("kJ"));
    expect(screen.getByLabelText("Kilojoules")).toHaveValue("1000");

    await userEvent.click(unit("kcal"));
    expect(screen.getByLabelText("Calories")).toHaveValue("239");
  });

  it("leaves unusable text alone when the unit is switched", async () => {
    render(<FoodForm onSubmit={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Calories"), "12x");
    await userEvent.click(unit("kJ"));

    expect(screen.getByLabelText("Kilojoules")).toHaveValue("12x");
  });

  it("remembers the choice for the next Food", async () => {
    const { unmount } = render(<FoodForm onSubmit={vi.fn()} />);
    await userEvent.click(unit("kJ"));
    unmount();

    render(<FoodForm onSubmit={vi.fn()} />);

    expect(await screen.findByLabelText("Kilojoules")).toBeInTheDocument();
    expect(unit("kJ")).toHaveAttribute("aria-pressed", "true");
  });

  it("shows an existing Food's Calories in kcal, whatever the saved choice", () => {
    localStorage.setItem("calories-counter:energy-unit", "kj");
    render(
      <FoodForm
        submitLabel="Save changes"
        initialValues={{ name: "Rice", portion: "100 g", calories: "130" }}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Calories")).toHaveValue("130");
  });

  it("copes with browser storage being unavailable", async () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    render(<FoodForm onSubmit={vi.fn()} />);

    await userEvent.click(unit("kJ"));

    expect(screen.getByLabelText("Kilojoules")).toBeInTheDocument();
    setItem.mockRestore();
  });
});
