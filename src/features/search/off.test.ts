import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mapOffProducts } from "./off";

const recorded = JSON.parse(
  readFileSync(
    join(process.cwd(), "src/features/search/fixtures/off-tim-tam.json"),
    "utf8",
  ),
);

const product = (over: Record<string, unknown> = {}) => ({
  code: "1",
  product_name: "Test bar",
  brands: "Acme",
  serving_size: "1 bar (40 g)",
  nutriments: {
    "energy-kcal_100g": 400,
    "energy-kj_100g": 1674,
    "energy-kcal_serving": 160,
    "energy-kj_serving": 670,
  },
  ...over,
});

describe("mapOffProducts: a recorded response", () => {
  it("maps each product to a Suggestion with name, brand, energy and serving", () => {
    const [first] = mapOffProducts(recorded);

    expect(first).toMatchObject({
      key: "off:9310072000282",
      name: "Tim Tam",
      brand: "Arnott's",
      per100: { calories: 524, unit: "g" },
      serving: { calories: 96, label: "1 biscuit (18.3 g)" },
      sourceLabel: "From Open Food Facts",
    });
  });

  it("maps all of them", () => {
    expect(mapOffProducts(recorded).map((s) => s.key)).toEqual([
      "off:9310072000282",
      "off:9310072034607",
      "off:9310072013855",
    ]);
  });

  it("uses the kilojoules when kcal and kJ disagree, since Australian labels are in kJ (AC-6)", () => {
    // The third product says 233 kcal but 2,220 kJ per 100 g: 2,220 kJ is about 531 kcal.
    const third = mapOffProducts(recorded)[2];

    expect(third.per100?.calories).toBe(531);
  });
});

describe("mapOffProducts: energy", () => {
  it("uses the kcal figure when it agrees with the kJ figure", () => {
    const [s] = mapOffProducts({ products: [product()] });

    expect(s.per100?.calories).toBe(400);
    expect(s.serving?.calories).toBe(160);
  });

  it("converts a product that only gives kilojoules (AC-6)", () => {
    const [s] = mapOffProducts({
      products: [
        product({
          nutriments: { "energy-kj_100g": 1674, "energy-kj_serving": 670 },
        }),
      ],
    });

    expect(s.per100?.calories).toBe(400); // 1674 / 4.184
    expect(s.serving?.calories).toBe(160); // 670 / 4.184
  });

  it("uses kcal when that is all there is", () => {
    const [s] = mapOffProducts({
      products: [product({ nutriments: { "energy-kcal_100g": 250.4 } })],
    });

    expect(s.per100?.calories).toBe(250);
  });

  it("has no serving when the product gives none, but keeps the per-100 values", () => {
    const [s] = mapOffProducts({
      products: [
        product({
          serving_size: "",
          nutriments: { "energy-kcal_100g": 400 },
        }),
      ],
    });

    expect(s.serving).toBeUndefined();
    expect(s.per100?.calories).toBe(400);
  });

  it("has no serving label to go with a serving's energy but no serving size", () => {
    const [s] = mapOffProducts({
      products: [
        product({
          serving_size: undefined,
          nutriments: { "energy-kcal_100g": 400, "energy-kcal_serving": 160 },
        }),
      ],
    });

    expect(s.serving).toBeUndefined();
  });

  it("drops a product with no usable energy at all", () => {
    expect(mapOffProducts({ products: [product({ nutriments: {} })] })).toEqual(
      [],
    );
    expect(
      mapOffProducts({
        products: [product({ nutriments: { "energy-kcal_100g": "n/a" } })],
      }),
    ).toEqual([]);
  });

  it("drops an energy value that is not allowed (negative or over 9,999 per 100)", () => {
    expect(
      mapOffProducts({
        products: [product({ nutriments: { "energy-kcal_100g": -5 } })],
      }),
    ).toEqual([]);
    expect(
      mapOffProducts({
        products: [product({ nutriments: { "energy-kcal_100g": 12000 } })],
      }),
    ).toEqual([]);
  });

  it("accepts energy given as text", () => {
    const [s] = mapOffProducts({
      products: [product({ nutriments: { "energy-kcal_100g": "310" } })],
    });

    expect(s.per100?.calories).toBe(310);
  });
});

describe("mapOffProducts: names", () => {
  it("drops a product with no name", () => {
    expect(
      mapOffProducts({ products: [product({ product_name: "  " })] }),
    ).toEqual([]);
  });

  it("takes the first brand of several", () => {
    const [s] = mapOffProducts({
      products: [product({ brands: "Arnott's, Nabisco" })],
    });

    expect(s.brand).toBe("Arnott's");
  });

  it("has no brand when there is none", () => {
    const [s] = mapOffProducts({ products: [product({ brands: "" })] });

    expect(s.brand).toBeUndefined();
  });

  it("cuts an over-long name to what a Food may hold", () => {
    const [s] = mapOffProducts({
      products: [product({ product_name: "x".repeat(200) })],
    });

    expect(s.name.length).toBeLessThanOrEqual(80);
  });

  it("is per 100 g for products, and never marks them as estimates", () => {
    const [s] = mapOffProducts({ products: [product()] });

    expect(s.per100?.unit).toBe("g");
    expect(s.estimate).toBeUndefined();
  });
});

describe("mapOffProducts: bad input", () => {
  it("gives nothing for a response that is not what was expected", () => {
    expect(mapOffProducts(null)).toEqual([]);
    expect(mapOffProducts({})).toEqual([]);
    expect(mapOffProducts({ products: "nope" })).toEqual([]);
    expect(mapOffProducts({ products: [null, 3, "x"] })).toEqual([]);
  });

  it("skips a product with no code, since it has no stable key", () => {
    expect(
      mapOffProducts({ products: [product({ code: undefined })] }),
    ).toEqual([]);
  });
});
