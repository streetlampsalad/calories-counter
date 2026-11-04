// Which items of a list are picked. Selection mode is simply "something is picked", so
// deselecting the last item ends it. These return new sets and never change the one given.
export type Selection = ReadonlySet<string>;

export const noSelection: Selection = new Set();

export const isSelecting = (selection: Selection) => selection.size > 0;

export const startSelection = (id: string): Selection => new Set([id]);

export function toggleSelected(selection: Selection, id: string): Selection {
  const next = new Set(selection);
  if (!next.delete(id)) next.add(id);
  return next;
}

export const selectAll = (ids: readonly string[]): Selection => new Set(ids);
