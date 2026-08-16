import { useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { MIN_TABLE_ROWS, MIN_TABLE_COLS, MAX_TABLE_ROWS, MAX_TABLE_COLS } from '@/lib/table';
import {
  tableAddRow,
  tableRemoveRow,
  tableAddColumn,
  tableRemoveColumn,
  tableSetCell,
  tableResizeColumn,
  tableToggleHeaderRow,
  type TableElement,
} from './elements';
import type { CanvasPalette } from './useCanvasPalette';

interface TableGridProps {
  element: TableElement;
  /** Interactive cell inputs + add/remove/resize controls vs. a plain
   *  read-only render (mirrors MediaLayer's `interactive` split). */
  editable: boolean;
  /** Camera zoom — converts a resize drag's SCREEN px delta to a WORLD px
   *  delta (the grid itself is already camera-scaled by its CSS transform). */
  scale: number;
  palette: CanvasPalette;
  /** Commit a full replacement of the table's grid fields (+ recomputed
   *  width/height) — one history step per structural change. */
  onCommit: (next: TableElement) => void;
}

/**
 * The shared table-editing UI: add/remove rows and columns, edit cell text,
 * drag-resize column borders, toggle the header-row style. Used standalone
 * here for the canvas table node (see TableLayer.tsx). Notes' table block is
 * a SEPARATE implementation (the official Tiptap table extension, a
 * ProseMirror node) — Tiptap's table can't be embedded in a Konva canvas, so
 * only the sizing primitives are shared (`@/lib/table.ts`), not this component
 * or its rendering.
 */
export function TableGrid({ element, editable, scale, palette, onCommit }: TableGridProps) {
  // Live column-resize preview: mirrors the codebase's drag convention (Konva
  // element drag/transform, NoteImageView's width handle) — render the live
  // value locally during the gesture, commit ONCE on release, so a fast drag
  // doesn't spam a Yjs transaction per pointermove.
  const [resizing, setResizing] = useState<{ col: number; width: number } | null>(null);
  const colWidths =
    resizing != null
      ? element.colWidths.map((w, i) => (i === resizing.col ? resizing.width : w))
      : element.colWidths;

  function startColumnResize(event: ReactPointerEvent, colIndex: number) {
    event.preventDefault();
    event.stopPropagation();
    const startWidth = element.colWidths[colIndex] ?? 0;
    const startX = event.clientX;
    setResizing({ col: colIndex, width: startWidth });

    const onMove = (moveEvent: PointerEvent) => {
      const deltaWorld = (moveEvent.clientX - startX) / scale;
      setResizing({ col: colIndex, width: Math.max(1, startWidth + deltaWorld) });
    };
    const onUp = (moveEvent: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const deltaWorld = (moveEvent.clientX - startX) / scale;
      onCommit(tableResizeColumn(element, colIndex, startWidth + deltaWorld));
      setResizing(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  // Cumulative left offsets, for the resize-handle overlay's positions.
  const offsets: number[] = [];
  colWidths.reduce((left, w) => {
    offsets.push(left + w);
    return left + w;
  }, 0);

  return (
    <div className="canvas-table" style={{ color: palette.text }}>
      {editable && (
        <div className="canvas-table__toolbar" contentEditable={false}>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onCommit(tableToggleHeaderRow(element))}
            className={cn('canvas-table__pill', element.hasHeaderRow && 'canvas-table__pill--active')}
          >
            Header row
          </button>
        </div>
      )}

      <div className="canvas-table__row">
      <div className="canvas-table__scroll">
        <table
          className="canvas-table__grid"
          style={{ borderColor: palette.border }}
          onPointerDown={(e) => editable && e.stopPropagation()}
        >
          <tbody>
            {element.cells.map((row, r) => {
              const isHeader = element.hasHeaderRow && r === 0;
              const Cell = isHeader ? 'th' : 'td';
              return (
                <tr key={r}>
                  {row.map((value, c) => (
                    <Cell
                      key={c}
                      className={cn('canvas-table__cell', isHeader && 'canvas-table__cell--header')}
                      style={{
                        width: colWidths[c],
                        borderColor: palette.border,
                        background: isHeader
                          ? `color-mix(in srgb, ${palette.accent} 14%, transparent)`
                          : undefined,
                      }}
                    >
                      {editable ? (
                        <input
                          value={value}
                          onChange={(e) => onCommit(tableSetCell(element, r, c, e.target.value))}
                          onPointerDown={(e) => e.stopPropagation()}
                          className={cn('canvas-table__input', isHeader && 'canvas-table__input--header')}
                          style={{ color: palette.text }}
                          aria-label={`Row ${r + 1}, column ${c + 1}`}
                        />
                      ) : (
                        <span className={cn('canvas-table__text', isHeader && 'canvas-table__text--header')}>
                          {value}
                        </span>
                      )}
                    </Cell>
                  ))}
                  {editable && (
                    <td className="canvas-table__control-cell">
                      <button
                        type="button"
                        aria-label="Delete row"
                        title="Delete row"
                        disabled={element.rows <= MIN_TABLE_ROWS}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => onCommit(tableRemoveRow(element, r))}
                        className="canvas-table__icon-btn"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {editable && (
              <tr>
                {colWidths.map((_, c) => (
                  <td key={c} className="canvas-table__control-cell">
                    <button
                      type="button"
                      aria-label="Delete column"
                      title="Delete column"
                      disabled={element.cols <= MIN_TABLE_COLS}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => onCommit(tableRemoveColumn(element, c))}
                      className="canvas-table__icon-btn"
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                ))}
                <td className="canvas-table__control-cell">
                  <button
                    type="button"
                    aria-label="Add row"
                    title="Add row"
                    disabled={element.rows >= MAX_TABLE_ROWS}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => onCommit(tableAddRow(element))}
                    className="canvas-table__icon-btn"
                  >
                    <Plus size={12} />
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Column-resize handles — a full-height overlay so a handle isn't
            confined to (and cursor-clipped by) a single row's cell. Touch and
            mouse both drive the same pointer-event gesture. */}
        {editable && (
          <div className="canvas-table__resize-layer" aria-hidden>
            {offsets.slice(0, -1).map((left, c) => (
              <div
                key={c}
                role="separator"
                aria-label={`Resize column ${c + 1}`}
                className="canvas-table__resize-handle"
                style={{ left }}
                onPointerDown={(e) => startColumnResize(e, c)}
              />
            ))}
          </div>
        )}
      </div>

      {editable && (
        <button
          type="button"
          aria-label="Add column"
          title="Add column"
          disabled={element.cols >= MAX_TABLE_COLS}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onCommit(tableAddColumn(element))}
          className="canvas-table__icon-btn canvas-table__add-col"
        >
          <Plus size={12} />
        </button>
      )}
      </div>
    </div>
  );
}
