import { type FoodErrors, parseFoodInput } from "@/features/foods/validation";
import { kilojoulesToCalories, parseKilojoules } from "@/lib/energy";

// One MB, and 200 rows: far more than a page of notes, small enough to review on a phone.
export const MAX_FILE_BYTES = 1024 * 1024;
export const MAX_ROWS = 200;

// A row exactly as the file gave it, before it is checked. Every value is text, possibly empty.
export type ImportRow = {
  name: string;
  portion: string;
  calories: string;
  kilojoules: string;
};

export type ParseResult =
  | { ok: true; rows: ImportRow[] }
  | { ok: false; error: string };

// A row that passed: what Import Review offers to save.
export type Suggestion = {
  name: string;
  portion: string;
  calories: number;
  /** The kilojoules the Calories were converted from, when the row had no calories. */
  fromKilojoules: number | null;
};

export type RowValidation =
  | { ok: true; value: Suggestion }
  | { ok: false; errors: FoodErrors };

const FORMATS =
  "Import a CSV or JSON file. A CSV starts with the header name,portion,calories (or kilojoules instead of calories). JSON is a list of { name, portion, calories } items.";
const SIZE_MESSAGE =
  "That's over 1 MB, which is too big to import. Try a smaller file.";
const COLUMNS = ["name", "portion", "calories", "kilojoules"] as const;

const IMPORT_TYPES = new Set([
  "text/csv",
  "text/comma-separated-values",
  "application/csv",
  "application/json",
  "application/vnd.ms-excel",
]);

// Checked before reading a chosen file, so a huge or wrong file is turned away without parsing.
export function checkImportFile(file: {
  name: string;
  size: number;
  type?: string;
}): string | null {
  const extension = file.name.toLowerCase().split(".").pop();
  const isImportable =
    extension === "csv" ||
    extension === "json" ||
    IMPORT_TYPES.has((file.type ?? "").toLowerCase());
  if (!isImportable) return `That isn't a CSV or JSON file. ${FORMATS}`;
  if (file.size > MAX_FILE_BYTES) return SIZE_MESSAGE;
  return null;
}

const rowsFailure = (count: number): string | null =>
  count > MAX_ROWS
    ? `That has ${count} rows, and ${MAX_ROWS} is the most you can import at once. Split it into smaller files.`
    : null;

// The first Markdown code fence's contents, or the text itself if there is none.
function unwrapFence(text: string): string {
  const fenced = /```[\w-]*[ \t]*\r?\n([\s\S]*?)```/.exec(text);
  return fenced ? fenced[1] : text;
}

// Splits CSV text into records of cells. Quoted cells may hold commas, doubled quotes and line breaks.
function readCsv(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let cell = "";
  let quoted = false;

  const endCell = () => {
    record.push(cell);
    cell = "";
  };
  const endRecord = () => {
    endCell();
    records.push(record);
    record = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      endCell();
    } else if (char === "\r") {
      if (text[i + 1] === "\n") i += 1;
      endRecord();
    } else if (char === "\n") {
      endRecord();
    } else {
      cell += char;
    }
  }
  if (cell !== "" || record.length > 0) endRecord();
  return records;
}

function parseCsv(text: string): ParseResult {
  const records = readCsv(text).filter((record) =>
    record.some((cell) => cell.trim() !== ""),
  );
  const header = records[0]?.map((cell) => cell.trim().toLowerCase()) ?? [];
  const known = COLUMNS.filter((column) => header.includes(column));

  if (known.length === 0) {
    return {
      ok: false,
      error: `I couldn't read that as CSV or JSON. ${FORMATS}`,
    };
  }
  if (!header.includes("name")) {
    return { ok: false, error: `The CSV needs a name column. ${FORMATS}` };
  }
  if (!header.includes("portion")) {
    return { ok: false, error: `The CSV needs a portion column. ${FORMATS}` };
  }
  if (!header.includes("calories") && !header.includes("kilojoules")) {
    return {
      ok: false,
      error: `The CSV needs a calories (or kilojoules) column. ${FORMATS}`,
    };
  }

  const data = records.slice(1);
  if (data.length === 0)
    return { ok: false, error: "No foods found under the header." };
  const tooMany = rowsFailure(data.length);
  if (tooMany) return { ok: false, error: tooMany };

  const at = (record: string[], column: (typeof COLUMNS)[number]) => {
    const index = header.indexOf(column);
    return index < 0 ? "" : (record[index] ?? "").trim();
  };
  return {
    ok: true,
    rows: data.map((record) => ({
      name: at(record, "name"),
      portion: at(record, "portion"),
      calories: at(record, "calories"),
      kilojoules: at(record, "kilojoules"),
    })),
  };
}

const jsonText = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
};

function parseJson(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return {
      ok: false,
      error: `That looks like JSON, but it couldn't be read. Check it is complete. ${FORMATS}`,
    };
  }
  const list = Array.isArray(data)
    ? data
    : data && typeof data === "object" && "foods" in data
      ? (data as { foods: unknown }).foods
      : null;
  const notFoods = {
    ok: false as const,
    error: `The JSON needs to be a list of foods, or { "foods": [...] }. ${FORMATS}`,
  };
  if (!Array.isArray(list)) return notFoods;
  if (
    list.some(
      (item) => !item || typeof item !== "object" || Array.isArray(item),
    )
  ) {
    return notFoods;
  }
  if (list.length === 0)
    return { ok: false, error: "No foods found in the list." };
  const tooMany = rowsFailure(list.length);
  if (tooMany) return { ok: false, error: tooMany };

  return {
    ok: true,
    rows: list.map((item: Record<string, unknown>) => ({
      name: jsonText(item.name),
      portion: jsonText(item.portion),
      calories: jsonText(item.calories),
      kilojoules: jsonText(item.kilojoules),
    })),
  };
}

// Reads pasted or uploaded text as CSV or JSON, whichever it is.
export function parseImportText(input: string): ParseResult {
  if (new TextEncoder().encode(input).length > MAX_FILE_BYTES) {
    return { ok: false, error: SIZE_MESSAGE };
  }
  const text = unwrapFence(input.replace(/^﻿/, "")).replace(/^﻿/, "").trim();
  if (text === "") {
    return {
      ok: false,
      error:
        "There is nothing to import. Paste the AI's answer, or choose a file.",
    };
  }
  return text.startsWith("[") || text.startsWith("{")
    ? parseJson(text)
    : parseCsv(text);
}

// Applies the same rules as adding a Food by hand, and converts kilojoules when there are no calories.
export function validateImportRow(row: ImportRow): RowValidation {
  const caloriesText = row.calories.trim();
  const kilojoulesText = row.kilojoules.trim();
  let energy = caloriesText;
  let fromKilojoules: number | null = null;
  let energyError: string | null = null;

  if (caloriesText === "") {
    if (kilojoulesText === "") {
      energyError = "Add calories or kilojoules";
    } else {
      const kilojoules = parseKilojoules(kilojoulesText);
      if (kilojoules === null) {
        energyError = "Kilojoules must be a whole number from 0 to 41,837";
      } else {
        energy = String(kilojoulesToCalories(kilojoules));
        fromKilojoules = kilojoules;
      }
    }
  }

  const parsed = parseFoodInput({
    name: row.name,
    portion: row.portion,
    calories: energy,
  });
  const errors: FoodErrors = parsed.ok ? {} : { ...parsed.errors };
  if (energyError) errors.calories = energyError;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  if (!parsed.ok) return { ok: false, errors };
  return { ok: true, value: { ...parsed.value, fromKilojoules } };
}

// "(from 1,000 kJ)", shown beside a converted row so the original is not lost.
export const formatFromKilojoules = (kilojoules: number) =>
  `(from ${kilojoules.toLocaleString("en-AU")} kJ)`;
