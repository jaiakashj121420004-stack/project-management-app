import { ReactRenderer } from '@tiptap/react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type {
  SuggestionOptions,
  SuggestionProps,
  SuggestionKeyDownProps,
} from '@tiptap/suggestion';

/** A suggestion list component exposes keyboard handling to the plugin. */
export interface SuggestionListHandle {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

type RenderFn<I> = NonNullable<SuggestionOptions<I>['render']>;

/**
 * A reusable `render` implementation for a Tiptap suggestion (slash menu, emoji).
 * Mounts the given React list component into a fixed-position container at the
 * caret (no tippy dependency), forwards keyboard events to it, and tears down on
 * exit. The component must forwardRef a {@link SuggestionListHandle}.
 */
export function makeSuggestionRender<I>(
  Component: ForwardRefExoticComponent<SuggestionProps<I> & RefAttributes<SuggestionListHandle>>,
): RenderFn<I> {
  return () => {
    let renderer: ReactRenderer<SuggestionListHandle, SuggestionProps<I>> | null = null;
    let container: HTMLDivElement | null = null;
    const MARGIN = 8;
    const FALLBACK_HEIGHT = 320; // best guess before the menu has painted/laid out
    const FALLBACK_WIDTH = 280;

    // `position: fixed` is laid out against the LAYOUT viewport, while the part
    // the person can actually see is the VISUAL viewport (shrunk by the iPad /
    // iPhone keyboard, shifted when iOS scrolls the page up, scaled by pinch
    // zoom). Place and clamp against the visual viewport's rectangle expressed in
    // layout coordinates, otherwise the menu can open off-screen or under the
    // keyboard and "/" looks dead.
    const visible = () => {
      const vv = window.visualViewport;
      return {
        top: vv?.offsetTop ?? 0,
        left: vv?.offsetLeft ?? 0,
        height: vv?.height ?? window.innerHeight,
        width: vv?.width ?? window.innerWidth,
      };
    };

    const place = (rect: DOMRect | null | undefined) => {
      if (!container || !rect) return;
      const menuHeight = Math.min(container.offsetHeight || FALLBACK_HEIGHT, visible().height - 2 * MARGIN);
      const menuWidth = container.offsetWidth || FALLBACK_WIDTH;
      const v = visible();
      const minTop = v.top + MARGIN;
      const maxTop = v.top + v.height - menuHeight - MARGIN;

      const spaceBelow = v.top + v.height - rect.bottom;
      const spaceAbove = rect.top - v.top;
      // Prefer below the cursor; flip above only when there's no room below but
      // more above — and never leave the visible area either way.
      const placeAbove = spaceBelow < menuHeight + MARGIN && spaceAbove > spaceBelow;
      const rawTop = placeAbove ? rect.top - menuHeight - 6 : rect.bottom + 6;
      const top = Math.min(Math.max(minTop, rawTop), Math.max(minTop, maxTop));
      const left = Math.min(
        Math.max(v.left + MARGIN, rect.left),
        Math.max(v.left + MARGIN, v.left + v.width - menuWidth - MARGIN),
      );

      container.style.top = `${top}px`;
      container.style.left = `${left}px`;
      container.style.maxHeight = `${Math.max(120, v.height - 2 * MARGIN)}px`;
    };

    // The keyboard opening/closing or iOS scrolling the page moves the visible
    // area without any editor update, so re-place on those too.
    let lastRect: (() => DOMRect | null) | null | undefined;
    const reposition = () => place(lastRect?.());
    const attachViewportListeners = () => {
      window.visualViewport?.addEventListener('resize', reposition);
      window.visualViewport?.addEventListener('scroll', reposition);
    };
    const detachViewportListeners = () => {
      window.visualViewport?.removeEventListener('resize', reposition);
      window.visualViewport?.removeEventListener('scroll', reposition);
    };

    return {
      onStart: (props) => {
        renderer = new ReactRenderer(Component, { props, editor: props.editor });
        container = document.createElement('div');
        container.style.position = 'fixed';
        // Above the full-screen canvas overlay (z-80) and modals (z-90).
        container.style.zIndex = '200';
        container.appendChild(renderer.element);
        document.body.appendChild(container);
        lastRect = props.clientRect;
        attachViewportListeners();
        place(props.clientRect?.());
        // Re-place once more after layout settles (fonts/async item list can
        // change the menu's real height right after mount).
        requestAnimationFrame(() => place(props.clientRect?.()));
      },
      onUpdate: (props) => {
        renderer?.updateProps(props);
        lastRect = props.clientRect;
        place(props.clientRect?.());
      },
      onKeyDown: (props) => {
        if (props.event.key === 'Escape') return false;
        return renderer?.ref?.onKeyDown(props) ?? false;
      },
      onExit: () => {
        detachViewportListeners();
        lastRect = null;
        renderer?.destroy();
        container?.remove();
        renderer = null;
        container = null;
      },
    };
  };
}
