import { type CSSProperties } from 'react';
import { cn } from '@/lib/cn';
import type { Camera, ElementBox } from './constants';
import type { CanvasElement, MediaElement } from './elements';
import { useSignedUrl } from './useSignedUrl';
import type { CanvasPalette } from './useCanvasPalette';

interface MediaLayerProps {
  elements: CanvasElement[];
  camera: Camera;
  palette: CanvasPalette;
  /** The currently selected element (its player becomes interactive in edit mode). */
  selectedId: string | null;
  /** True while the canvas is editable. In View mode / for viewers, ALL players
   *  are interactive so they can be played without a selection. */
  editing: boolean;
  /** Live transform of a media box mid drag/resize (follows the Konva node). */
  liveBox: ElementBox | null;
}

/**
 * The HTML media overlay. Konva can't host an <audio>/<video> player or an
 * <iframe>, so media elements are drawn as HTML layered exactly over their Konva
 * background rects via the same camera transform — the same technique as the
 * rich-text overlay.
 *
 * Pointer routing: a player is interactive (controls clickable) only when the
 * canvas is read-only (View mode / viewers) OR the element is the current
 * selection in edit mode. Otherwise it's `pointer-events: none` so clicks fall
 * through to Konva for select / drag / resize. To MOVE a selected media element,
 * click empty space to deselect, then drag it (the Transformer's handles, offset
 * outward by its padding, stay reachable for resize while selected).
 */
export function MediaLayer({
  elements,
  camera,
  palette,
  selectedId,
  editing,
  liveBox,
}: MediaLayerProps) {
  const medias = elements.filter((el): el is MediaElement => el.type === 'media');
  const scale = camera.scale;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {medias.map((el) => {
        const box: ElementBox =
          liveBox && liveBox.id === el.id
            ? liveBox
            : {
                id: el.id,
                x: el.x,
                y: el.y,
                width: el.width,
                height: el.height,
                rotation: el.rotation,
              };

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
            className={cn(
              'overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-black/60 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]',
              interactive ? 'pointer-events-auto' : 'pointer-events-none select-none',
            )}
          >
            {el.source === 'file' ? (
              <FilePlayer element={el} palette={palette} />
            ) : (
              <EmbedPlayer element={el} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** A recorded/uploaded clip, played from a short-lived signed URL. */
function FilePlayer({ element, palette }: { element: MediaElement; palette: CanvasPalette }) {
  const { url, loading, error } = useSignedUrl(element.path);

  if (loading) {
    return <Placeholder label="Loading…" color={palette.text} />;
  }
  if (error || !url) {
    return <Placeholder label="⚠️ Media unavailable" color={palette.text} />;
  }

  if (element.kind === 'audio') {
    return (
      <div className="grid h-full w-full place-items-center px-3">
        <audio src={url} controls className="w-full" preload="metadata" />
      </div>
    );
  }
  return (
    <video src={url} controls playsInline preload="metadata" className="h-full w-full bg-black" />
  );
}

/**
 * An allow-listed embed. `embedUrl` was produced by embeds.ts from a known
 * provider's canonical endpoint — never a raw user string — so this iframe can
 * only ever point at an allow-listed host. `referrerPolicy` is tightened and the
 * iframe is lazy so off-screen embeds don't load until needed.
 */
function EmbedPlayer({ element }: { element: MediaElement }) {
  if (!element.embedUrl) return <Placeholder label="⚠️ Embed unavailable" color="#fff" />;
  return (
    <iframe
      src={element.embedUrl}
      title="Embedded media"
      className="h-full w-full border-0"
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
      sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      allowFullScreen
    />
  );
}

function Placeholder({ label, color }: { label: string; color: string }) {
  return (
    <div
      className="grid h-full w-full place-items-center px-3 text-center text-sm"
      style={{ color }}
    >
      {label}
    </div>
  );
}
