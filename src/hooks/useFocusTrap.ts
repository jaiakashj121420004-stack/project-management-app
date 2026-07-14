import { useEffect, useRef, type RefObject } from 'react';

/**
 * Trap keyboard focus inside an overlay while it's open, and restore focus to
 * the triggering element when it closes (Phase 3, accessibility — audit §1:
 * modals/palette/drawer previously let Tab escape and never restored focus).
 *
 * Usage: attach the returned ref to the overlay container and drive `active`
 * with its open state. Give the container `tabIndex={-1}` so focus can land on
 * it when it has no focusable children yet.
 *
 * - On activate: remembers the current `activeElement`, then moves focus into
 *   the container (unless focus is already inside — e.g. an `autoFocus` input).
 * - While active: `Tab`/`Shift+Tab` cycle within the container; `Escape` calls
 *   `onEscape`.
 * - On deactivate/unmount: restores focus to the remembered trigger.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
]
  .map((s) => `${s}:not([hidden])`)
  .join(',');

interface FocusTrapOptions {
  onEscape?: () => void;
}

export function useFocusTrap<T extends HTMLElement = HTMLElement>(
  active: boolean,
  { onEscape }: FocusTrapOptions = {},
): RefObject<T | null> {
  const containerRef = useRef<T>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  // Keep the latest onEscape without re-running the effect on every render.
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    triggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Keep genuinely focusable, non-hidden elements. (Elements explicitly
    // removed from the tab order via tabindex="-1" — e.g. activedescendant
    // options — are excluded so Tab stays on the real controls.)
    const focusables = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.tabIndex >= 0,
      );

    // Move focus in unless it's already inside (e.g. an autoFocus field).
    if (!container.contains(document.activeElement)) {
      (focusables()[0] ?? container).focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onEscapeRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const activeEl = document.activeElement;

      if (event.shiftKey) {
        if (activeEl === first || !container.contains(activeEl)) {
          event.preventDefault();
          last.focus();
        }
      } else if (activeEl === last || !container.contains(activeEl)) {
        event.preventDefault();
        first.focus();
      }
    };

    container.addEventListener('keydown', onKeyDown);
    return () => {
      container.removeEventListener('keydown', onKeyDown);
      const trigger = triggerRef.current;
      if (trigger && document.contains(trigger)) trigger.focus();
    };
  }, [active]);

  return containerRef;
}
