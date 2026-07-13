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

    const place = (rect: DOMRect | null | undefined) => {
      if (!container || !rect) return;
      const top = Math.min(rect.bottom + 6, window.innerHeight - 16);
      const left = Math.min(rect.left, window.innerWidth - 288);
      container.style.top = `${Math.max(8, top)}px`;
      container.style.left = `${Math.max(8, left)}px`;
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
