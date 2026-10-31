/**
 * palmGuard.ts — keeps a resting palm from wrecking a pen session.
 *
 * Two failures on an iPad / pen tablet while writing:
 *   1. The palm drags across the page and the browser selects text everywhere
 *      (the whole header, sidebar and toolbar turn blue).
 *   2. The palm lands on a toolbar/dock button and fires it (switches tool,
 *      opens a menu, deletes something).
 *
 * While a canvas is mounted we (a) disable text selection app-wide except in real
 * inputs/editors, and (b) swallow touch presses on UI chrome that look like a palm
 * — a large contact, or any touch while the pen was active a moment ago. Touches on
 * the drawing surface itself are handled by CanvasStage's own palm rejection.
 */
import { useEffect } from 'react';

/** A touch contact this large is a palm / fist, not a fingertip. */
const PALM_CONTACT_PX = 36;
/** A touch this soon after pen activity is a palm resting beside the pen. */
const PEN_RECENT_MS = 1500;
/** How long after a swallowed press its synthetic click is still swallowed. */
const CLICK_SWALLOW_MS = 700;

const EDITABLE = 'input, textarea, select, [contenteditable="true"], [contenteditable=""]';

function isEditable(target: EventTarget | null): boolean {
  const el = target instanceof Element ? target : (target as Node | null)?.parentElement;
  return !!el?.closest(EDITABLE);
}

export function isPalmLikeContact(evt: PointerEvent, penRecent: boolean): boolean {
  if (evt.pointerType !== 'touch') return false;
  return penRecent || evt.width > PALM_CONTACT_PX || evt.height > PALM_CONTACT_PX;
}

export function usePalmGuard(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return undefined;
    const root = document.documentElement;
    root.classList.add('canvas-open');

    let lastPenAt = 0;
    let swallowClickUntil = 0;

    const onSelectStart = (e: Event) => {
      if (!isEditable(e.target)) e.preventDefault();
    };

    const onPointer = (e: PointerEvent) => {
      if (e.pointerType === 'pen') {
        lastPenAt = performance.now();
        return;
      }
      if (e.type !== 'pointerdown') return;
      const target = e.target instanceof Element ? e.target : null;
      // The drawing surface has its own (finer) palm rejection.
      if (!target || target.closest('.canvas-surface') || isEditable(target)) return;
      const penRecent = performance.now() - lastPenAt < PEN_RECENT_MS;
      if (isPalmLikeContact(e, penRecent)) {
        swallowClickUntil = performance.now() + CLICK_SWALLOW_MS;
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const onClick = (e: MouseEvent) => {
      if (performance.now() > swallowClickUntil) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('.canvas-surface') || isEditable(target)) return;
      e.preventDefault();
      e.stopPropagation();
    };

    document.addEventListener('selectstart', onSelectStart, true);
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('pointermove', onPointer, true);
    document.addEventListener('click', onClick, true);
    return () => {
      root.classList.remove('canvas-open');
      document.removeEventListener('selectstart', onSelectStart, true);
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('pointermove', onPointer, true);
      document.removeEventListener('click', onClick, true);
    };
  }, [enabled]);
}
