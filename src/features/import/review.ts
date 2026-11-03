import { type ImportRow, type RowValidation, validateImportRow } from "./parse";

// A row in Import Review: what the file said, and whether the User means to save it.
export type ReviewRow = ImportRow & { id: string; keep: boolean };

export type ReviewState = { rows: ReviewRow[] };

export type EditableField = "name" | "portion" | "calories";

export type ReviewAction =
  | { type: "load"; rows: ReviewRow[] }
  | { type: "add"; rows: ReviewRow[] }
  | { type: "edit"; id: string; field: EditableField; value: string }
  | { type: "toggle"; id: string }
  | { type: "restore"; state: ReviewState }
  | { type: "reset" };

export const initialReview: ReviewState = { rows: [] };

export const checkRow = (row: ImportRow): RowValidation =>
  validateImportRow(row);

// Rows start switched on if they are valid and off if they are flagged.
export function reviewRows(
  rows: readonly ImportRow[],
  makeId: () => string = () => crypto.randomUUID(),
): ReviewRow[] {
  return rows.map((row) => ({
    ...row,
    id: makeId(),
    keep: checkRow(row).ok,
  }));
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
      return { rows: [...state.rows, ...action.rows] };
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
    case "restore":
      return action.state;
    case "reset":
      return initialReview;
  }
}

const isReviewRow = (value: unknown): value is ReviewRow => {
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
    return { rows };
  } catch {
    return null;
  }
}
