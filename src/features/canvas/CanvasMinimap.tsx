import { useMemo, type MouseEvent } from 'react';
import { Maximize2, Locate } from 'lucide-react';
import { clampScale, type Camera } from './constants';
import type { CanvasElement } from './elements';
import { sceneBounds, fitCamera, centerCamera, type Bounds } from './bounds';

const W = 176;
const H = 116;

interface CanvasMinimapProps {
  elements: CanvasElement[];
  camera: Camera;
  viewport: { width: number; height: number };
  onCameraChange: (camera: Camera) => void;
}

/**
 * Corner overview of the whole canvas (Phase 5): every element as a tinted rect,
 * the current viewport as an outlined box, click/drag to jump the camera there,
 * plus fit-to-content and reset buttons. Pure HTML/SVG — no Konva — so it stays
 * out of the heavy stage. Renders in both edit and view modes.
 */
export function CanvasMinimap({ elements, camera, viewport, onCameraChange }: CanvasMinimapProps) {
  const view = useMemo<Bounds>(() => {
    const scale = camera.scale || 1;
    return {
      minX: (0 - camera.x) / scale,
      minY: (0 - camera.y) / scale,
      maxX: (viewport.width - camera.x) / scale,
      maxY: (viewport.height - camera.y) / scale,
    };
  }, [camera, viewport]);

  // The minimap frames content AND the current viewport, so the viewport box is
  // always visible even when panned into empty space.
  const combined = useMemo<Bounds>(() => {
    const content = sceneBounds(elements);
    if (!content) return view;
    return {
      minX: Math.min(content.minX, view.minX),
      minY: Math.min(content.minY, view.minY),
      maxX: Math.max(content.maxX, view.maxX),
      maxY: Math.max(content.maxY, view.maxY),
    };
  }, [elements, view]);

  const cw = Math.max(1, combined.maxX - combined.minX);
  const ch = Math.max(1, combined.maxY - combined.minY);
  const m = Math.min(W / cw, H / ch);
  const offX = (W - cw * m) / 2;
  const offY = (H - ch * m) / 2;
  const px = (wx: number) => (wx - combined.minX) * m + offX;
  const py = (wy: number) => (wy - combined.minY) * m + offY;

  function jump(event: MouseEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const worldX = (localX - offX) / m + combined.minX;
    const worldY = (localY - offY) / m + combined.minY;
    onCameraChange(centerCamera(worldX, worldY, viewport, camera.scale));
  }

  function fit() {
    const content = sceneBounds(elements);
    if (!content) {
      onCameraChange({ x: viewport.width / 2, y: viewport.height / 2, scale: 1 });
      return;
    }
    onCameraChange(fitCamera(content, viewport, clampScale));
  }

  function reset() {
    onCameraChange({ x: viewport.width / 2, y: viewport.height / 2, scale: 1 });
  }

  return (
    <div className="glass-menu pointer-events-auto flex flex-col gap-1.5 rounded-2xl border border-[var(--glass-border)] p-1.5 shadow-[0_14px_34px_-18px_rgba(0,0,0,0.7)]">
      <svg
        width={W}
        height={H}
        onClick={jump}
        role="img"
        aria-label="Canvas minimap — click to jump"
        className="cursor-pointer rounded-lg bg-[var(--glass-fill)]"
      >
        {elements.map((el) => (
          <rect
            key={el.id}
            x={px(el.x)}
            y={py(el.y)}
            width={Math.max(1.5, el.width * m)}
            height={Math.max(1.5, el.height * m)}
            rx={1}
            fill="var(--accent-from)"
            fillOpacity={0.4}
          />
        ))}
        <rect
          x={px(view.minX)}
          y={py(view.minY)}
          width={Math.max(4, (view.maxX - view.minX) * m)}
          height={Math.max(4, (view.maxY - view.minY) * m)}
          fill="none"
          stroke="var(--accent-from)"
          strokeWidth={1.5}
        />
      </svg>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={fit}
          title="Fit to content"
          aria-label="Fit to content"
          className="flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1 text-xs text-fg-muted transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
        >
          <Maximize2 size={13} /> Fit
        </button>
        <button
          type="button"
          onClick={reset}
          title="Reset view"
          aria-label="Reset view"
          className="flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1 text-xs text-fg-muted transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
        >
          <Locate size={13} /> Reset
        </button>
      </div>
    </div>
  );
}
