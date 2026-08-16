/**
 * table.ts — the ONE thing shared between the Notes table block (Tiptap's
 * official table node schema) and the Canvas table node (a plain CRDT-friendly
 * grid rendered by a standalone HTML component — see canvas/TableGrid.tsx).
 *
 * The two have entirely different runtime document models: Notes' table lives
 * inside a ProseMirror doc (table > tableRow > tableCell, each cell its own
 * mini-document); Canvas's table is a flat `string[][]` on a CanvasElement,
 * consistent with every other canvas element (CRDT-friendly, no methods,
 * diffed by value — see elements.ts). Tiptap's table can't be embedded inside
 * a Konva node (Konva renders to <canvas>, not the DOM), so there's no shared
 * rendering — only these sizing/limits primitives, kept in sync so a "3×3
 * table" means the same thing and resizes to the same minimum whether it was
 * inserted in a note or dropped on a canvas.
 */

/** Starting grid size for a freshly inserted table, either surface. */
export const DEFAULT_TABLE_ROWS = 3;
export const DEFAULT_TABLE_COLS = 3;

/** A table can't shrink below one row/column — delete the table instead. */
export const MIN_TABLE_ROWS = 1;
export const MIN_TABLE_COLS = 1;

/** Sane upper bound so a runaway "add row/column" click can't produce an
 *  unusably huge grid (matches this app's "opinionated, not a spreadsheet"
 *  scope — see reports/SIMPLICITY-GUARDRAIL.md). */
export const MAX_TABLE_ROWS = 50;
export const MAX_TABLE_COLS = 12;

/** Default + minimum column width (px) for the canvas table's drag-to-resize
 *  column borders. Notes' table uses Tiptap's own resizable-column default. */
export const DEFAULT_TABLE_COL_WIDTH = 140;
export const MIN_TABLE_COL_WIDTH = 64;

/** Fixed row height (world px) for the canvas table — rows don't resize
 *  individually, only columns do (see reports/SIMPLICITY-GUARDRAIL.md #7: one
 *  resize mechanism, not two). */
export const TABLE_ROW_HEIGHT = 40;
