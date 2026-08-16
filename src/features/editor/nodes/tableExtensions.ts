import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import type { AnyExtension } from '@tiptap/core';

/**
 * The Notes table block (official Tiptap table node set). Note-only — like
 * NoteImage/NoteEmbed/CanvasLink, this is NOT part of the shared `blockExtensions`
 * schema in extensions.ts, so it never reaches canvas text boxes (a tiny
 * floating annotation is the wrong place for a grid; canvas gets its own table
 * NODE instead — see features/canvas/TableGrid.tsx). `resizable: true` gives
 * drag-to-resize column borders and a `colgroup` for free from ProseMirror's
 * table plugin; `lastColumnResizable: false` keeps the last column filling the
 * remaining width instead of being independently draggable, which reads better
 * inside a prose column than a spreadsheet-style fixed grid.
 */
export const noteTableExtensions: AnyExtension[] = [
  Table.configure({
    resizable: true,
    lastColumnResizable: false,
    allowTableNodeSelection: true,
  }),
  TableRow,
  TableHeader,
  TableCell,
];
