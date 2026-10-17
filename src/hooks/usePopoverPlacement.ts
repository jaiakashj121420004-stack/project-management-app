import { useLayoutEffect, useState, type RefObject } from 'react';

export interface PopoverPlacement {
  /** Open above the anchor instead of below. */
  openUp: boolean;
  /** Tallest the menu may be so it stays fully visible; undefined until measured. */
  maxHeight: number | undefined;
}

const EDGE = 12;
/** Below this, an ancestor's clip box is too cramped to be a useful bound. */
const MIN_USEFUL = 140;

/** The visible band (layout-viewport coordinates), shrunk by an on-screen keyboard. */
function viewportBand(): { top: number; bottom: number } {
  const vv = window.visualViewport;
  const top = vv?.offsetTop ?? 0;
  return { top, bottom: top + (vv?.height ?? window.innerHeight) };
}

/** The viewport band further cut down by any scroll/overflow-clipping ancestor. */
function clippedBand(el: HTMLElement): { top: number; bottom: number } {
  const band = viewportBand();
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowY)) {
      const r = p.getBoundingClientRect();
      band.top = Math.max(band.top, r.top);
      band.bottom = Math.min(band.bottom, r.bottom);
    }
  }
  return band;
}

/**
 * Decide, each time a dropdown opens, whether it fits below its trigger or must
 * flip above — and cap its height to the room actually available. A menu opened
 * near the bottom of the screen (or of a scrolling modal) used to run off the
 * edge; this is the one shared rule for every anchored dropdown.
 *
 * `forceUp` keeps the old manual `openUp` prop working.
 */
export function usePopoverPlacement(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  desiredHeight: number,
  forceUp = false,
): PopoverPlacement {
  const [placement, setPlacement] = useState<PopoverPlacement>({
    openUp: forceUp,
    maxHeight: undefined,
  });

  useLayoutEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current;
    if (!anchor) return;

    const measure = () => {
      const rect = anchor.getBoundingClientRect();
      let band = clippedBand(anchor);
      if (band.bottom - rect.bottom < MIN_USEFUL && rect.top - band.top < MIN_USEFUL) {
        band = viewportBand();
      }
      const below = band.bottom - rect.bottom - EDGE;
      const above = rect.top - band.top - EDGE;
      const up = forceUp || (below < desiredHeight && above > below);
      const room = Math.max(MIN_USEFUL, up ? above : below);
      setPlacement({ openUp: up, maxHeight: Math.min(desiredHeight, room) });
    };

    measure();
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, [open, anchorRef, desiredHeight, forceUp]);

  return placement;
}
