import { useEffect, useMemo, useState } from 'react';
import { Group, Image as KonvaImage, Path, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import { signedUrl } from '@/lib/storage';
import { MIN_ELEMENT_SIZE, type ElementBox } from './constants';
import type {
  CanvasElement,
  ElementPatch,
  ImageElement,
  MediaElement,
  StrokeElement,
} from './elements';
import { strokePathData } from './freehand';
import type { CanvasPalette } from './useCanvasPalette';

// ---------------------------------------------------------------------------
// Signed URL cache — module-level so URLs survive re-renders and component
// remounts. URLs are valid for 1 hour (the default); we don't expire them
// within a session — the worst case is a stale URL after 1h and a page reload.
// ---------------------------------------------------------------------------

const urlCache = new Map<string, string>();
// In-flight fetches keyed by path — prevents duplicate network requests when
// multiple renderers ask for the same path at the same time.
const inFlight = new Map<string, Promise<string>>();

function fetchCachedSignedUrl(path: string): Promise<string> {
  const cached = urlCache.get(path);
  if (cached) return Promise.resolve(cached);
  const existing = inFlight.get(path);
  if (existing) return existing;
  const promise = signedUrl(path)
    .then((url) => {
      urlCache.set(path, url);
      inFlight.delete(path);
      return url;
    })
    .catch((err: unknown) => {
      inFlight.delete(path);
      throw err;
    });
  inFlight.set(path, promise);
  return promise;
}

/** Resolves a canvas-media storage path to a signed URL and caches it. */
function useSignedUrl(path: string | null): {
  url: string | null;
  loading: boolean;
  error: boolean;
} {
  const [url, setUrl] = useState<string | null>(() =>
    path ? (urlCache.get(path) ?? null) : null,
  );
  const [loading, setLoading] = useState<boolean>(path !== null && !urlCache.has(path));
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!path) return;
    if (urlCache.has(path)) {
      setUrl(urlCache.get(path)!);
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchCachedSignedUrl(path)
      .then((u) => {
        if (!cancelled) {
          setUrl(u);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return { url, loading, error };
}

/**
 * Element renderers. Every element is a Konva <Group> positioned/rotated by its
 * transform box; strokes render their real perfect-freehand outline, while
 * text/image/media are still labelled placeholders (their bodies land in
 * P3.3–P3.5). The group carries id={element.id} so the stage's <Transformer>
 * attaches via stage.findOne('#id') and the eraser maps a hit back to its
 * element via findAncestor('.canvas-element').
 *
 * On drag/transform end we bake Konva's scale back into the model (resetting the
 * node scale to 1). A stroke has no inner geometry to stretch, so a resize is
 * baked into its sample points + width instead.
 */

type ElementChange = (id: string, patch: ElementPatch) => void;

interface ElementNodeProps {
  element: CanvasElement;
  /** Element can be dragged (select tool, editable, unlocked). */
  draggable: boolean;
  /** Clicking/tapping selects (select tool + editable) — off while drawing. */
  selectable: boolean;
  palette: CanvasPalette;
  onSelect: (id: string) => void;
  onChange: ElementChange;
  /** Double-click/tap to edit (text boxes only); undefined for other types. */
  onRequestEdit?: (id: string) => void;
  /** Report the live transform box mid drag/resize so an HTML overlay can follow
   *  (text boxes only); null on gesture end. */
  onLiveChange?: (box: ElementBox | null) => void;
}

/** The element's current transform box, reading any in-flight Konva scale. */
function nodeBox(node: Konva.Node, element: CanvasElement): ElementBox {
  return {
    id: element.id,
    x: node.x(),
    y: node.y(),
    width: Math.max(MIN_ELEMENT_SIZE, element.width * Math.abs(node.scaleX())),
    height: Math.max(MIN_ELEMENT_SIZE, element.height * Math.abs(node.scaleY())),
    rotation: node.rotation(),
  };
}

export function ElementNode({
  element,
  draggable,
  selectable,
  palette,
  onSelect,
  onChange,
  onRequestEdit,
  onLiveChange,
}: ElementNodeProps) {
  const select = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!selectable) return;
    e.cancelBubble = true; // don't let the stage clear the selection
    onSelect(element.id);
  };

  const requestEdit = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!onRequestEdit) return;
    e.cancelBubble = true;
    onRequestEdit(element.id);
  };

  const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    onLiveChange?.(nodeBox(e.target, element));
  };

  const handleTransform = (e: Konva.KonvaEventObject<Event>) => {
    onLiveChange?.(nodeBox(e.target, element));
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    onChange(element.id, { x: e.target.x(), y: e.target.y() });
    onLiveChange?.(null);
  };

  const handleTransformEnd = (e: Konva.KonvaEventObject<Event>) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);

    const base = {
      x: node.x(),
      y: node.y(),
      width: Math.max(MIN_ELEMENT_SIZE, element.width * Math.abs(scaleX)),
      height: Math.max(MIN_ELEMENT_SIZE, element.height * Math.abs(scaleY)),
      rotation: node.rotation(),
    };

    // A stroke has no inner shape to stretch — bake the resize into its sample
    // points + width so the recomputed outline matches the new box.
    if (element.type === 'stroke') {
      const uniform = (Math.abs(scaleX) + Math.abs(scaleY)) / 2;
      onChange(element.id, {
        ...base,
        points: scaleStrokePoints(element.points, scaleX, scaleY),
        size: Math.max(0.5, element.size * uniform),
      });
      onLiveChange?.(null);
      return;
    }

    onChange(element.id, base);
    onLiveChange?.(null);
  };

  return (
    <Group
      id={element.id}
      name="canvas-element"
      x={element.x}
      y={element.y}
      rotation={element.rotation}
      draggable={draggable}
      onClick={select}
      onTap={select}
      onDblClick={requestEdit}
      onDblTap={requestEdit}
      onDragMove={handleDragMove}
      onTransform={handleTransform}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
    >
      <ElementVisual element={element} palette={palette} />
    </Group>
  );
}

/** Scale a stroke's flattened `[x, y, pressure, …]` samples (pure). */
function scaleStrokePoints(points: number[], scaleX: number, scaleY: number): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < points.length; i += 3) {
    out.push((points[i] ?? 0) * scaleX, (points[i + 1] ?? 0) * scaleY, points[i + 2] ?? 0.5);
  }
  return out;
}

/** The body for each element type. */
function ElementVisual({ element, palette }: { element: CanvasElement; palette: CanvasPalette }) {
  if (element.type === 'stroke') {
    return <StrokeVisual element={element} />;
  }

  const { width, height } = element;

  // A text box renders ONLY its background rect here — the rect is the hit /
  // transform target, while the formatted text itself is drawn by the HTML
  // TextLayer overlay (Konva can't render rich text). Dashed while empty.
  if (element.type === 'text') {
    const isEmpty = element.text.trim().length === 0;
    return (
      <Rect
        width={width}
        height={height}
        cornerRadius={16}
        fill={palette.surface}
        stroke={palette.border}
        strokeWidth={1}
        dash={isEmpty ? [6, 5] : undefined}
        perfectDrawEnabled={false}
      />
    );
  }

  if (element.type === 'image') {
    return <ImageVisual element={element} palette={palette} />;
  }

  // Media (audio/video) remains a labelled stub (body lands in P3.5).
  return (
    <>
      <Rect
        width={width}
        height={height}
        cornerRadius={16}
        fill={palette.surface}
        stroke={palette.border}
        strokeWidth={1}
        perfectDrawEnabled={false}
      />
      <Text
        text={stubLabel(element)}
        width={width}
        height={height}
        padding={12}
        fontSize={15}
        fontFamily="Inter, system-ui, sans-serif"
        fill={palette.text}
        align="center"
        verticalAlign="middle"
        wrap="word"
        ellipsis
        listening={false}
      />
    </>
  );
}

/** A committed stroke: its filled perfect-freehand outline, recomputed from the
 *  stored samples so it stays crisp at any zoom. The filled path is the hit
 *  target (precise selection + erase); multiply gives the highlighter its look. */
function StrokeVisual({ element }: { element: StrokeElement }) {
  const data = useMemo(
    () =>
      strokePathData(element.points, {
        size: element.size,
        thinning: element.thinning,
        smoothing: element.smoothing,
        simulatePressure: element.simulatePressure,
      }),
    [element.points, element.size, element.thinning, element.smoothing, element.simulatePressure],
  );
  if (!data) return null;
  return (
    <Path
      data={data}
      fill={element.color}
      opacity={element.opacity}
      globalCompositeOperation={element.blend === 'multiply' ? 'multiply' : 'source-over'}
      perfectDrawEnabled={false}
      shadowForStrokeEnabled={false}
    />
  );
}

function stubLabel(element: MediaElement): string {
  return element.kind === 'audio' ? '🎙  Audio' : '🎬  Video';
}

/**
 * Renders an ImageElement as a real Konva Image node. While the signed URL is
 * being fetched (or the HTMLImageElement is loading), a skeleton placeholder is
 * shown so the bounding box / transformer remain in place. On error it falls
 * back to a labelled placeholder rather than disappearing.
 */
function ImageVisual({
  element,
  palette,
}: {
  element: ImageElement;
  palette: CanvasPalette;
}) {
  const { url, loading: urlLoading, error: urlError } = useSignedUrl(element.path);

  // Load the HTMLImageElement once the signed URL is ready. We keep it in state
  // so Konva can use it as its `image` prop — Konva requires the DOM object, not
  // just the src string.
  const [htmlImg, setHtmlImg] = useState<HTMLImageElement | null>(null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!url) {
      setHtmlImg(null);
      return;
    }
    let cancelled = false;
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!cancelled) setHtmlImg(img);
    };
    img.onerror = () => {
      if (!cancelled) setImgError(true);
    };
    img.src = url;
    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [url]);

  const { width, height } = element;

  // ── Skeleton (URL loading or HTMLImage loading) ───────────────────────────
  if (urlLoading || (url && !htmlImg && !imgError)) {
    return (
      <>
        <Rect
          width={width}
          height={height}
          cornerRadius={16}
          fill={palette.surface}
          stroke={palette.border}
          strokeWidth={1}
          dash={[8, 6]}
          perfectDrawEnabled={false}
        />
        <Text
          text="Loading…"
          width={width}
          height={height}
          padding={12}
          fontSize={13}
          fontFamily="Inter, system-ui, sans-serif"
          fill={palette.text}
          align="center"
          verticalAlign="middle"
          listening={false}
        />
      </>
    );
  }

  // ── Error fallback ────────────────────────────────────────────────────────
  if (urlError || imgError || !htmlImg) {
    return (
      <>
        <Rect
          width={width}
          height={height}
          cornerRadius={16}
          fill={palette.surface}
          stroke={palette.border}
          strokeWidth={1}
          perfectDrawEnabled={false}
        />
        <Text
          text="⚠️  Image unavailable"
          width={width}
          height={height}
          padding={12}
          fontSize={14}
          fontFamily="Inter, system-ui, sans-serif"
          fill={palette.text}
          align="center"
          verticalAlign="middle"
          listening={false}
        />
      </>
    );
  }

  // ── Loaded ────────────────────────────────────────────────────────────────
  return (
    <KonvaImage
      image={htmlImg}
      width={width}
      height={height}
      cornerRadius={16}
      perfectDrawEnabled={false}
    />
  );
}
