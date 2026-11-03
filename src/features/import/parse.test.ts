import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkImportFile,
  formatFromKilojoules,
  MAX_FILE_BYTES,
  MAX_ROWS,
  parseImportText,
  validateImportRow,
} from "./parse";

const fixture = (name: string) =>
  readFileSync(
    join(process.cwd(), "src/features/import/fixtures", name),
    "utf8",
  );

function rowsOf(text: string) {
  const result = parseImportText(text);
  if (!result.ok) throw new Error(`expected rows, got: ${result.error}`);
  return result.rows;
}
function errorOf(text: string) {
  const result = parseImportText(text);
  if (result.ok) throw new Error("expected an error");
  return result.error;
}

describe("parseImportText: CSV (AC-3)", () => {
  it("reads each data row under the header", () => {
    expect(rowsOf(fixture("basic.csv"))).toEqual([
      {
        name: "Vegemite toast",
        portion: "1 slice",
        calories: "95",
        kilojoules: "",
      },
      { name: "Banana", portion: "1 medium", calories: "105", kilojoules: "" },
      { name: "Rice", portion: "100 g", calories: "130", kilojoules: "" },
    ]);
  });

  it("accepts columns in any order and a header in any case", () => {
    expect(rowsOf(fixture("reordered.csv"))).toEqual([
      {
        name: "Vegemite toast",
        portion: "1 slice",
        calories: "95",
        kilojoules: "",
      },
      { name: "Banana", portion: "1 medium", calories: "105", kilojoules: "" },
    ]);
  });

  it("copes with a UTF-8 BOM and CRLF line endings", () => {
    const text = fixture("bom-crlf.csv");
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain("\r\n");

    expect(rowsOf(text).map((r) => r.name)).toEqual([
      "Vegemite toast",
      "Banana",
    ]);
  });

  it("copes with a lone CR as a line ending", () => {
    expect(rowsOf("name,portion,calories\rBanana,1 medium,105\r").length).toBe(
      1,
    );
  });

  it("reads quoted fields with commas, doubled quotes and line breaks", () => {
    const rows = rowsOf(fixture("quoted.csv"));

    expect(rows.map((r) => r.name)).toEqual([
      "Eggs, scrambled",
      'The "big" one',
      "Two\nlines",
    ]);
    expect(rows[0].portion).toBe("2 eggs");
  });

  it("reads the optional kilojoules column", () => {
    expect(rowsOf(fixture("kilojoules.csv"))).toEqual([
      { name: "Chocolate", portion: "1 bar", calories: "", kilojoules: "1000" },
      { name: "Apple", portion: "1 medium", calories: "", kilojoules: "" },
    ]);
  });

  it("skips blank lines", () => {
    expect(rowsOf(fixture("blank-lines.csv")).map((r) => r.name)).toEqual([
      "Banana",
      "Rice",
    ]);
  });

  it("keeps a row whose energy is empty, so Import Review can flag it", () => {
    expect(rowsOf(fixture("missing-energy.csv"))[0]).toMatchObject({
      name: "Mystery",
      calories: "",
    });
  });

  it("trims spaces around values", () => {
    expect(
      rowsOf("name , portion , calories\n Banana , 1 medium , 105 \n"),
    ).toEqual([
      { name: "Banana", portion: "1 medium", calories: "105", kilojoules: "" },
    ]);
  });

  it("ignores columns it does not know", () => {
    expect(
      rowsOf("name,notes,portion,calories\nBanana,ripe,1 medium,105\n")[0],
    ).toMatchObject({ name: "Banana", portion: "1 medium", calories: "105" });
  });

  it("fills a short row's missing cells with nothing", () => {
    expect(rowsOf("name,portion,calories\nBanana,1 medium\n")[0].calories).toBe(
      "",
    );
  });
});

describe("parseImportText: JSON (AC-4)", () => {
  it("reads an array of foods, with calories as numbers or kilojoules", () => {
    expect(rowsOf(fixture("array.json"))).toEqual([
      {
        name: "Vegemite toast",
        portion: "1 slice",
        calories: "95",
        kilojoules: "",
      },
      { name: "Chocolate", portion: "1 bar", calories: "", kilojoules: "1000" },
    ]);
  });

  it("reads { foods: [...] }, with calories as text", () => {
    expect(rowsOf(fixture("object.json"))).toEqual([
      { name: "Banana", portion: "1 medium", calories: "105", kilojoules: "" },
    ]);
  });

  it("accepts a CSV wrapped in a Markdown code fence", () => {
    expect(rowsOf(fixture("fenced.csv.md"))).toEqual([
      { name: "Banana", portion: "1 medium", calories: "105", kilojoules: "" },
    ]);
  });

  it("accepts JSON in a code fence, with chat around it", () => {
    expect(rowsOf(fixture("fenced.json.md"))).toEqual([
      { name: "Banana", portion: "1 medium", calories: "105", kilojoules: "" },
    ]);
  });

  it("treats null and missing fields as empty", () => {
    expect(
      rowsOf('[{"name":"Banana","portion":null,"calories":105}]')[0],
    ).toMatchObject({ portion: "", kilojoules: "" });
  });

  it("explains JSON it cannot read", () => {
    expect(errorOf(fixture("broken.json"))).toMatch(/JSON/);
  });

  it("explains JSON that is not a list of foods", () => {
    expect(errorOf('{"hello":"world"}')).toMatch(/list of foods/);
    expect(errorOf('["Banana"]')).toMatch(/list of foods/);
  });
});

describe("parseImportText: rejections", () => {
  it("says so when there is nothing to import", () => {
    expect(errorOf("")).toMatch(/nothing to import/i);
    expect(errorOf("   \n  ")).toMatch(/nothing to import/i);
    expect(errorOf(fixture("header-only.csv"))).toMatch(/no foods/i);
  });

  it("spells out the expected formats for text that is neither CSV nor JSON", () => {
    const message = errorOf(fixture("not-an-import.txt"));

    expect(message).toMatch(/CSV or JSON/);
    expect(message).toContain("name,portion,calories");
  });

  it("asks for the columns that are missing", () => {
    expect(errorOf(fixture("no-name-column.csv"))).toMatch(/name/);
    expect(errorOf(fixture("no-energy-column.csv"))).toMatch(/calories/);
  });

  it("rejects more than 200 rows", () => {
    const body = Array.from(
      { length: MAX_ROWS + 1 },
      (_, i) => `Food ${i},1 serve,100`,
    );
    const message = errorOf(`name,portion,calories\n${body.join("\n")}\n`);

    expect(message).toMatch(/201/);
    expect(message).toMatch(/200/);
  });

  it("accepts exactly 200 rows", () => {
    const body = Array.from(
      { length: MAX_ROWS },
      (_, i) => `Food ${i},1 serve,100`,
    );

    expect(rowsOf(`name,portion,calories\n${body.join("\n")}\n`)).toHaveLength(
      200,
    );
  });

  it("rejects text over 1 MB before parsing it", () => {
    const message = errorOf("a".repeat(MAX_FILE_BYTES + 1));

    expect(message).toMatch(/1 MB/);
  });
});

describe("checkImportFile (AC-10)", () => {
  const file = (name: string, size = 100, type = "") => ({ name, size, type });

  it("accepts CSV and JSON files", () => {
    expect(checkImportFile(file("foods.csv"))).toBeNull();
    expect(checkImportFile(file("foods.JSON"))).toBeNull();
    expect(checkImportFile(file("download", 10, "text/csv"))).toBeNull();
    expect(
      checkImportFile(file("download", 10, "application/json")),
    ).toBeNull();
  });

  it("rejects a file over 1 MB, saying so", () => {
    expect(checkImportFile(file("foods.csv", MAX_FILE_BYTES + 1))).toMatch(
      /1 MB/,
    );
    expect(checkImportFile(file("foods.csv", MAX_FILE_BYTES))).toBeNull();
  });

  it("rejects other files, spelling out the expected formats", () => {
    const message = checkImportFile(file("notes.pdf", 100, "application/pdf"));

    expect(message).toMatch(/CSV or JSON/);
    expect(message).toContain("name,portion,calories");
  });
});

describe("validateImportRow (AC-5, AC-6)", () => {
  const row = (
    over: Partial<
      Record<"name" | "portion" | "calories" | "kilojoules", string>
    > = {},
  ) => ({
    name: "Banana",
    portion: "1 medium",
    calories: "105",
    kilojoules: "",
    ...over,
  });

  it("makes a Suggestion from a valid row", () => {
    expect(validateImportRow(row())).toEqual({
      ok: true,
      value: {
        name: "Banana",
        portion: "1 medium",
        calories: 105,
        fromKilojoules: null,
      },
    });
  });

  it("tidies spaces in the name and portion", () => {
    const result = validateImportRow(
      row({ name: "  Vegemite   toast ", portion: " 1  slice" }),
    );

    expect(result).toMatchObject({
      ok: true,
      value: { name: "Vegemite toast", portion: "1 slice" },
    });
  });

  it("converts kilojoules to Calories when there are no calories, remembering the original", () => {
    const result = validateImportRow(row({ calories: "", kilojoules: "1000" }));

    expect(result).toEqual({
      ok: true,
      value: {
        name: "Banana",
        portion: "1 medium",
        calories: 239,
        fromKilojoules: 1000,
      },
    });
  });

  it("prefers calories when both are given", () => {
    const result = validateImportRow(
      row({ calories: "240", kilojoules: "1000" }),
    );

    expect(result).toMatchObject({
      ok: true,
      value: { calories: 240, fromKilojoules: null },
    });
  });

  it("flags a missing name", () => {
    expect(validateImportRow(row({ name: " " }))).toMatchObject({
      ok: false,
      errors: { name: "Enter a name" },
    });
  });

  it("flags a missing portion", () => {
    expect(validateImportRow(row({ portion: "" }))).toMatchObject({
      ok: false,
      errors: { portion: expect.stringMatching(/portion/i) },
    });
  });

  it("flags missing energy, asking for calories or kilojoules", () => {
    const result = validateImportRow(row({ calories: "", kilojoules: "" }));

    expect(result).toMatchObject({
      ok: false,
      errors: { calories: expect.stringMatching(/calories or kilojoules/i) },
    });
  });

  it("flags calories out of bounds or not whole", () => {
    for (const calories of ["10000", "-5", "12.5", "lots"]) {
      expect(validateImportRow(row({ calories }))).toMatchObject({
        ok: false,
        errors: { calories: expect.stringMatching(/whole number/) },
      });
    }
  });

  it("flags kilojoules out of bounds or not whole", () => {
    for (const kilojoules of ["41838", "-1", "1.5", "lots"]) {
      expect(
        validateImportRow(row({ calories: "", kilojoules })),
      ).toMatchObject({
        ok: false,
        errors: { calories: expect.stringMatching(/kilojoules/i) },
      });
    }
  });

  it("flags an over-long name and portion", () => {
    expect(validateImportRow(row({ name: "x".repeat(81) }))).toMatchObject({
      ok: false,
      errors: { name: expect.stringMatching(/80/) },
    });
    expect(validateImportRow(row({ portion: "x".repeat(41) }))).toMatchObject({
      ok: false,
      errors: { portion: expect.stringMatching(/40/) },
    });
  });

  it("reports every problem in a row at once", () => {
    const result = validateImportRow(
      row({ name: "", portion: "", calories: "" }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual([
        "calories",
        "name",
        "portion",
      ]);
    }
  });

  it("accepts zero calories", () => {
    expect(
      validateImportRow(row({ name: "Water", calories: "0" })),
    ).toMatchObject({
      ok: true,
      value: { calories: 0 },
    });
  });
});

describe("formatFromKilojoules", () => {
  it("shows the original value as '(from 1,000 kJ)'", () => {
    expect(formatFromKilojoules(1000)).toBe("(from 1,000 kJ)");
    expect(formatFromKilojoules(420)).toBe("(from 420 kJ)");
  });
});
