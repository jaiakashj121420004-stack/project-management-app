import { type CSSProperties } from 'react';
import type { Camera, ElementBox } from './constants';
import type { CanvasElement, TableElement } from './elements';
import { TableGrid } from './TableGrid';
import type { CanvasPalette } from './useCanvasPalette';

interface TableLayerProps {
  elements: CanvasElement[];
  camera: Camera;
  palette: CanvasPalette;
  /** The currently selected element (its grid becomes interactive — cell
   *  inputs, resize handles, add/remove controls — same routing rule as
   *  MediaLayer's player). */
  selectedId: string | null;
  /** True while the canvas is editable (edit mode, canEdit). Viewers / View
   *  mode always render the plain read-only grid. */
  editing: boolean;
  /** Live transform of a table mid drag (follows the Konva node). */
  liveBox: ElementBox | null;
  onCommit: (id: string, next: TableElement) => void;
}

/**
 * The HTML table overlay. Konva can't host <input> cells or a real <table>
 * layout, so table elements are drawn as HTML layered exactly over their Konva
 * background rect via the same camera-transform technique as the rich-text and
 * media overlays.
 *
 * Pointer routing mirrors MediaLayer exactly: a table's grid is interactive
 * (cells editable, resize handles live, add/remove controls shown) only when
 * the canvas is read-only (View mode / viewers) OR this element is the
 * current selection in edit mode — otherwise it's `pointer-events: none` so
 * clicks fall through to Konva for select/drag. To MOVE a selected table,
 * click empty space to deselect, then drag it (the Transformer stays reachable
 * around the selected box for rotate; free resize is disabled for tables —
 * see CanvasStage's `resizeEnabled` — since geometry is column-width/row-count
 * driven, not a free corner-drag).
 */
export function TableLayer({ elements, camera, palette, selectedId, editing, liveBox, onCommit }: TableLayerProps) {
  const tables = elements.filter((el): el is TableElement => el.type === 'table');
  const scale = camera.scale;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {tables.map((el) => {
        const box: ElementBox =
          liveBox && liveBox.id === el.id
            ? liveBox
            : { id: el.id, x: el.x, y: el.y, width: el.width, height: el.height, rotation: el.rotation };

        const screenX = camera.x + box.x * scale;
        const screenY = camera.y + box.y * scale;
        const boxStyle: CSSProperties = {
          position: 'absolute',
          left: 0,
          top: 0,
          width: box.width,
          height: box.height,
          transformOrigin: '0 0',
          transform: `translate(${screenX}px, ${screenY}px) rotate(${box.rotation}deg) scale(${scale})`,
        };

        const interactive = !editing || el.id === selectedId;

        return (
          <div
            key={el.id}
            style={boxStyle}
            className={interactive ? 'pointer-events-auto' : 'pointer-events-none select-none'}
          >
            <TableGrid
              element={el}
              editable={interactive}
              scale={scale}
              palette={palette}
              onCommit={(next) => onCommit(el.id, next)}
            />
          </div>
        );
      })}
    </div>
  );
}
