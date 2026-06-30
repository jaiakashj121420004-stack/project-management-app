import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import {
  getRecentColors,
  hexToHsv,
  hsvToHex,
  normalizeHex,
  pushRecentColor,
  type Hsv,
} from './color';

interface ColorPickerProps {
  /** Current colour (hex). */
  color: string;
  /** Called on every change (drag / hex / swatch). */
  onChange: (hex: string) => void;
  /** Quick-pick preset swatches shown above the spectrum. */
  presets: readonly string[];
  className?: string;
}

/**
 * An on-brand colour picker: preset swatches + a saturation/value spectrum + a
 * hue slider + a hex field + recently-used custom colours. Works entirely in
 * HSV (intuitive to drag) but emits hex. Dragging commits live; the hex field
 * commits on valid input. Recent custom colours persist in localStorage.
 *
 * Pointer-driven (no native <input type="color">), so it matches the app's
 * custom-control design and themes cleanly.
 */
export function ColorPicker({ color, onChange, presets, className }: ColorPickerProps) {
  // Initialised once from the incoming colour. The picker is mounted fresh each
  // time its popover opens (both toolbars conditionally render it), so it always
  // starts from the current colour — no in-render prop-sync needed, and dragging
  // never fights a round-trip echo of its own onChange.
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(color) ?? { h: 262, s: 0.8, v: 0.9 });
  const [hexText, setHexText] = useState(() => normalizeHex(color) ?? color);
  const [recent, setRecent] = useState<string[]>(() => getRecentColors());

  const emit = useCallback(
    (next: Hsv) => {
      setHsv(next);
      const hex = hsvToHex(next);
      setHexText(hex);
      onChange(hex);
    },
    [onChange],
  );

  // ── saturation/value square drag ──
  const svRef = useRef<HTMLDivElement>(null);
  const handleSvPointer = useCallback(
    (clientX: number, clientY: number) => {
      const el = svRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const s = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const v = Math.min(1, Math.max(0, 1 - (clientY - rect.top) / rect.height));
      emit({ ...hsv, s, v });
    },
    [emit, hsv],
  );

  // ── hue slider drag ──
  const hueRef = useRef<HTMLDivElement>(null);
  const handleHuePointer = useCallback(
    (clientX: number) => {
      const el = hueRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const h = Math.min(360, Math.max(0, ((clientX - rect.left) / rect.width) * 360));
      emit({ ...hsv, h });
    },
    [emit, hsv],
  );

  const dragField = useRef<'sv' | 'hue' | null>(null);
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (dragField.current === 'sv') handleSvPointer(e.clientX, e.clientY);
      else if (dragField.current === 'hue') handleHuePointer(e.clientX);
    };
    const up = () => {
      if (dragField.current) {
        dragField.current = null;
        setRecent(pushRecentColor(hsvToHex(hsv)));
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [handleSvPointer, handleHuePointer, hsv]);

  const commitHex = useCallback(
    (raw: string) => {
      const normal = normalizeHex(raw);
      if (!normal) return;
      const next = hexToHsv(normal)!;
      emit(next);
      setRecent(pushRecentColor(normal));
    },
    [emit],
  );

  const pickSwatch = useCallback(
    (hex: string) => {
      const next = hexToHsv(hex);
      if (next) emit(next);
    },
    [emit],
  );

  const hueHex = hsvToHex({ h: hsv.h, s: 1, v: 1 });
  const currentHex = hsvToHex(hsv);

  return (
    <div className={cn('w-56 select-none', className)}>
      {/* Presets */}
      <div className="mb-2 grid grid-cols-8 gap-1">
        {presets.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            title={c}
            onClick={() => pickSwatch(c)}
            className="h-5 w-5 rounded-md ring-1 ring-[var(--glass-border)] transition-transform hover:scale-110"
            style={{ background: c }}
          />
        ))}
      </div>

      {/* Saturation / value square */}
      <div
        ref={svRef}
        className="relative h-32 w-full cursor-crosshair rounded-lg"
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueHex})`,
        }}
        onPointerDown={(e) => {
          dragField.current = 'sv';
          handleSvPointer(e.clientX, e.clientY);
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: currentHex }}
        />
      </div>

      {/* Hue slider */}
      <div
        ref={hueRef}
        className="relative mt-2 h-3 w-full cursor-pointer rounded-full"
        style={{
          background:
            'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
        }}
        onPointerDown={(e) => {
          dragField.current = 'hue';
          handleHuePointer(e.clientX);
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${(hsv.h / 360) * 100}%`, background: hueHex }}
        />
      </div>

      {/* Hex field */}
      <div className="mt-2 flex items-center gap-2">
        <span
          aria-hidden
          className="h-7 w-7 shrink-0 rounded-md ring-1 ring-[var(--glass-border)]"
          style={{ background: currentHex }}
        />
        <input
          value={hexText}
          spellCheck={false}
          aria-label="Hex colour"
          onChange={(e) => {
            setHexText(e.target.value);
            commitHex(e.target.value);
          }}
          onKeyDown={(e) => e.stopPropagation()}
          className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass-fill)] px-2 py-1 text-sm tabular-nums text-fg outline-none"
        />
      </div>

      {/* Recent custom colours */}
      {recent.length > 0 && (
        <div className="mt-2">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-fg-subtle">Recent</p>
          <div className="flex flex-wrap gap-1">
            {recent.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                title={c}
                onClick={() => pickSwatch(c)}
                className="h-5 w-5 rounded-md ring-1 ring-[var(--glass-border)] transition-transform hover:scale-110"
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
