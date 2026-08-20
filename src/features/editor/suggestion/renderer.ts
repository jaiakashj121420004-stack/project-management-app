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

    // `visualViewport` tracks the on-screen viewport shrunk by the mobile
    // keyboard; `window.innerHeight`/`innerWidth` don't shrink, so using them
    // alone can place (or leave) the menu underneath the keyboard.
    const viewportHeight = () => window.visualViewport?.height ?? window.innerHeight;
    const viewportWidth = () => window.visualViewport?.width ?? window.innerWidth;

    const place = (rect: DOMRect | null | undefined) => {
      if (!container || !rect) return;
      // Measure the actual rendered menu (it's already mounted at this point,
      // even on the very first call in onStart — the ReactRenderer mounts
      // synchronously), falling back to a reasonable guess only if that
      // measurement isn't available yet (e.g. an empty item list).
      const menuHeight = container.offsetHeight || FALLBACK_HEIGHT;
      const menuWidth = container.offsetWidth || FALLBACK_WIDTH;
      const vh = viewportHeight();
      const vw = viewportWidth();

      const spaceBelow = vh - rect.bottom;
      const spaceAbove = rect.top;
      // Prefer below the cursor (Notion-style); flip above it only when
      // there isn't room below but there is above — never let it render
      // partially off-screen either way.
      const placeAbove = spaceBelow < menuHeight + MARGIN && spaceAbove > spaceBelow;
      const rawTop = placeAbove ? rect.top - menuHeight - 6 : rect.bottom + 6;
      const top = Math.min(Math.max(MARGIN, rawTop), Math.max(MARGIN, vh - menuHeight - MARGIN));
      const left = Math.min(Math.max(MARGIN, rect.left), Math.max(MARGIN, vw - menuWidth - MARGIN));

      container.style.top = `${top}px`;
      container.style.left = `${left}px`;
    };

    return {
      onStart: (props) => {
        renderer = new ReactRenderer(Component, { props, editor: props.editor });
        container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.zIndex = '60';
        container.appendChild(renderer.element);
        document.body.appendChild(container);
        place(props.clientRect?.());
        // Re-place once more after layout settles (fonts/async item list can
        // change the menu's real height right after mount).
        requestAnimationFrame(() => place(props.clientRect?.()));
      },
      onUpdate: (props) => {
        renderer?.updateProps(props);
        place(props.clientRect?.());
      },
      onKeyDown: (props) => {
        if (props.event.key === 'Escape') return false;
        return renderer?.ref?.onKeyDown(props) ?? false;
      },
      onExit: () => {
        renderer?.destroy();
        container?.remove();
        renderer = null;
        container = null;
      },
    };
  };
}
