import { findDuplicate, foodKey } from "@/features/foods/domain";
import type { Food } from "@/features/foods/types";
import { normalizeText } from "@/features/foods/validation";
import { type ImportRow, type RowValidation, validateImportRow } from "./parse";

export type DuplicateAction = "skip" | "update";

// A row in Import Review: what the file said, and whether the User means to save it.
export type ReviewRow = ImportRow & {
  id: string;
  keep: boolean;
  /** What to do if the Food List already has this name and Portion. Skip until the User says otherwise. */
  onDuplicate: DuplicateAction;
  /** Identical rows of the file that were merged into this one. */
  merged: number;
  /** Calories other merged rows gave that differ from this one's, e.g. "110 kcal". */
  alsoListed: string[];
};

export type ReviewState = { rows: ReviewRow[] };

export type EditableField = "name" | "portion" | "calories";

export type ReviewAction =
  | { type: "load"; rows: ReviewRow[] }
  | { type: "add"; rows: ReviewRow[] }
  | { type: "edit"; id: string; field: EditableField; value: string }
  | { type: "toggle"; id: string }
  | { type: "duplicate"; id: string; action: DuplicateAction }
  | { type: "restore"; state: ReviewState }
  | { type: "reset" };

export const initialReview: ReviewState = { rows: [] };

export const checkRow = (row: ImportRow): RowValidation =>
  validateImportRow(row);

const rowKey = (row: ImportRow): string | null => {
  const name = normalizeText(row.name);
  const portion = normalizeText(row.portion);
  return name && portion ? foodKey(name, portion) : null;
};

const caloriesLabel = (row: ImportRow): string | null => {
  const check = checkRow(row);
  return check.ok ? `${check.value.calories} kcal` : null;
};

// Folds incoming rows into the rows already there: a row with the same name and Portion as an
// earlier one is merged into it, keeping the earlier row and noting any different Calories.
export function mergeRows(
  existing: readonly ReviewRow[],
  incoming: readonly ReviewRow[],
): ReviewRow[] {
  const rows = [...existing];
  for (const row of incoming) {
    const key = rowKey(row);
    const index = key === null ? -1 : rows.findIndex((r) => rowKey(r) === key);
    if (index < 0) {
      rows.push(row);
      continue;
    }
    const kept = rows[index];
    const theirs = caloriesLabel(row);
    const differs = theirs !== null && theirs !== caloriesLabel(kept);
    rows[index] = {
      ...kept,
      merged: kept.merged + 1 + row.merged,
      alsoListed: [
        ...kept.alsoListed,
        ...(differs ? [theirs] : []),
        ...row.alsoListed,
      ],
    };
  }
  return rows;
}

// Rows start switched on if they are valid and off if they are flagged. Identical rows are merged.
export function reviewRows(
  rows: readonly ImportRow[],
  makeId: () => string = () => crypto.randomUUID(),
): ReviewRow[] {
  return mergeRows(
    [],
    rows.map((row) => ({
      ...row,
      id: makeId(),
      keep: checkRow(row).ok,
      onDuplicate: "skip" as const,
      merged: 0,
      alsoListed: [],
    })),
  );
}

export const keptCount = (state: ReviewState) =>
  state.rows.filter((row) => row.keep).length;

function editRow(
  row: ReviewRow,
  field: EditableField,
  value: string,
): ReviewRow {
  // Typing calories replaces whatever kilojoules the file gave, so clearing the field stays cleared.
  const edited = {
    ...row,
    [field]: value,
    ...(field === "calories" && { kilojoules: "" }),
  };
  const wasValid = checkRow(row).ok;
  const isValid = checkRow(edited).ok;
  // Fixing a flagged row switches it on; breaking a row switches it off; otherwise the User's choice stands.
  const keep = isValid ? (wasValid ? row.keep : true) : false;
  return { ...edited, keep };
}

export function reviewReducer(
  state: ReviewState,
  action: ReviewAction,
): ReviewState {
  switch (action.type) {
    case "load":
      return { rows: action.rows };
    case "add":
      return { rows: mergeRows(state.rows, action.rows) };
    case "edit":
      return {
        rows: state.rows.map((row) =>
          row.id === action.id ? editRow(row, action.field, action.value) : row,
        ),
      };
    case "toggle":
      return {
        rows: state.rows.map((row) =>
          row.id === action.id && checkRow(row).ok
            ? { ...row, keep: !row.keep }
            : row,
        ),
      };
    case "duplicate":
      return {
        rows: state.rows.map((row) =>
          row.id === action.id ? { ...row, onDuplicate: action.action } : row,
        ),
      };
    case "restore":
      return action.state;
    case "reset":
      return initialReview;
  }
}

export type Plan =
  | { kind: "add" }
  | { kind: "update"; existing: Food }
  | { kind: "skip"; existing: Food }
  | { kind: "off" };

// What Save will do with a row, given the Foods the User already has.
export function planFor(row: ReviewRow, foods: readonly Food[]): Plan {
  const check = checkRow(row);
  if (!check.ok || !row.keep) return { kind: "off" };
  const existing = findDuplicate(foods, check.value);
  if (!existing) return { kind: "add" };
  return row.onDuplicate === "update"
    ? { kind: "update", existing }
    : { kind: "skip", existing };
}

export type PlanCounts = {
  add: number;
  update: number;
  skip: number;
  /** Valid rows the User switched off. */
  off: number;
  /** Rows that still need fixing. */
  flagged: number;
};

export function planCounts(
  state: ReviewState,
  foods: readonly Food[],
): PlanCounts {
  const counts: PlanCounts = { add: 0, update: 0, skip: 0, off: 0, flagged: 0 };
  for (const row of state.rows) {
    if (!checkRow(row).ok) counts.flagged += 1;
    else counts[planFor(row, foods).kind] += 1;
  }
  return counts;
}

type SavedRow = ImportRow & { id: string; keep: boolean } & Partial<ReviewRow>;
const isReviewRow = (value: unknown): value is SavedRow => {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.keep === "boolean" &&
    ["name", "portion", "calories", "kilojoules"].every(
      (field) => typeof row[field] === "string",
    )
  );
};

// Reads back what was saved for this tab, or null if it is missing or not what we wrote.
export function restoreReview(raw: string | null): ReviewState | null {
  if (!raw) return null;
  try {
    const data: unknown = JSON.parse(raw);
    const rows = (data as { rows?: unknown } | null)?.rows;
    if (!Array.isArray(rows) || !rows.every(isReviewRow)) return null;
    // Rows saved before duplicates were handled lack these fields.
    return {
      rows: rows.map((row) => ({
        ...row,
        onDuplicate: row.onDuplicate === "update" ? "update" : "skip",
        merged: typeof row.merged === "number" ? row.merged : 0,
        alsoListed: Array.isArray(row.alsoListed) ? row.alsoListed : [],
      })),
    };
  } catch {
    return null;
  }
}
