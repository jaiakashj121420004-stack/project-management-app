import { useCallback, useEffect, useMemo, useRef, type CSSProperties, type KeyboardEvent } from 'react';
import type { XmlFragment } from 'yjs';
import { EditorContent, useEditor } from '@tiptap/react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { collabTextExtensions, type CaretUser } from './richText';
import { SlashCommand } from '@/features/editor/suggestion/SlashCommand';
import { EmojiCommand } from '@/features/editor/suggestion/EmojiCommand';
import { TextFormatToolbar } from './TextFormatToolbar';

interface RichTextBoxProps {
  /** This box's collaborative Y.XmlFragment (the live source of truth). */
  fragment: XmlFragment;
  /** Awareness-bearing provider for the remote-caret extension. */
  caretProvider: { awareness: unknown };
  /** Identity shown on this editor's caret to other participants. */
  user: CaretUser;
  /** Transform/size for the content box (world units, camera-scaled). */
  boxStyle: CSSProperties;
  /** Screen-space position for the floating format toolbar. */
  toolbarStyle: CSSProperties;
  /** Resolved ink colour for the text. */
  color: string;
  /** Ruled page: align each line to the rule spacing so text sits on the lines. */
  ruled?: boolean;
  /** Mirror the edited content into the element's body/text cache (debounced). */
  onBodyChange: (body: Record<string, unknown>, text: string) => void;
  /** Report the content's measured height (world units) so the box auto-grows. */
  onResize: (height: number) => void;
  /** Leave edit mode (Escape). */
  onExit: () => void;
}

/** Refresh the derived body/text cache at most once per this idle gap. */
const COMMIT_DEBOUNCE = 400;

/**
 * The live Tiptap editor for the one text box being edited (P3.7: collaborative).
 * It binds to this box's `Y.XmlFragment` via @tiptap/extension-collaboration, so
 * concurrent typing from multiple people merges, and shows remote carets via
 * @tiptap/extension-collaboration-caret. The fragment is the source of truth;
 * `onBodyChange` keeps the element's denormalised `body`/`text` cache (used by
 * the static renderer + previews + duplicate/paste) in step, debounced.
 */
export function RichTextBox({
  fragment,
  caretProvider,
  user,
  boxStyle,
  toolbarStyle,
  color,
  ruled = false,
  onBodyChange,
  onResize,
  onExit,
}: RichTextBoxProps) {
  // Keep callbacks in refs so the flush helpers stay identity-stable.
  const onBodyChangeRef = useRef(onBodyChange);
  const onResizeRef = useRef(onResize);
  const onExitRef = useRef(onExit);
  useEffect(() => {
    onBodyChangeRef.current = onBodyChange;
    onResizeRef.current = onResize;
    onExitRef.current = onExit;
  });

  // Auto-grow: report the content's natural (unscaled) height to the parent so
  // the box height tracks the text, document-style. offsetHeight is pre-transform
  // (the box is camera-scaled), so it's already in world units.
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = boxRef.current;
    if (!node) return;
    let last = 0;
    const report = () => {
      const h = node.offsetHeight;
      if (Math.abs(h - last) > 0.5) {
        last = h;
        onResizeRef.current(h);
      }
    };
    const observer = new ResizeObserver(report);
    observer.observe(node);
    report();
    return () => observer.disconnect();
  }, []);

  const latestRef = useRef<{ body: Record<string, unknown>; text: string } | null>(null);
  const dirtyRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (dirtyRef.current && latestRef.current) {
      onBodyChangeRef.current(latestRef.current.body, latestRef.current.text);
      dirtyRef.current = false;
    }
  }, []);

  // Collaborative extensions are built once for this fragment/box. The slash `/`
  // and emoji `:` commands are added here (editor-only, not part of the shared
  // schema) so canvas text gets the same block picker as notes.
  const extensions = useMemo(
    () => [
      ...collabTextExtensions({ fragment, provider: caretProvider, user }),
      SlashCommand,
      EmojiCommand,
    ],
    [fragment, caretProvider, user],
  );

  const editor = useEditor(
    {
      extensions,
      // NO `content`: a collaborative editor takes its content from the fragment
      // (pre-seeded from `body` when the doc was built), never from a prop.
      autofocus: 'end',
      editorProps: {
        attributes: {
          class: ruled
            ? 'canvas-rich canvas-rich-edit canvas-rich--ruled'
            : 'canvas-rich canvas-rich-edit',
        },
      },
      onUpdate: ({ editor: ed }) => {
        latestRef.current = { body: ed.getJSON() as Record<string, unknown>, text: ed.getText() };
        dirtyRef.current = true;
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(flush, COMMIT_DEBOUNCE);
      },
    },
    [extensions],
  );

  // Flush any pending cache update when the editor unmounts (exit / canvas switch).
  useEffect(() => () => flush(), [flush]);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      flush();
      onExitRef.current();
    }
  };

  // On phones the floating toolbar (positioned above the box) jumps as the box
  // grows and moves; dock it to a stable, full-width bar at the top of the screen
  // instead. Escapes the canvas overlay's clipping (no transformed ancestor here).
  const isMobile = useMediaQuery('(max-width: 640px)');
  const mobileToolbarStyle: CSSProperties = {
    position: 'fixed',
    top: 'calc(0.5rem + env(safe-area-inset-top))',
    left: '0.5rem',
    right: '0.5rem',
    zIndex: 50,
  };

  return (
    <>
      {editor && (
        <div
          style={isMobile ? mobileToolbarStyle : toolbarStyle}
          className="pointer-events-auto flex justify-center"
        >
          <TextFormatToolbar editor={editor} />
        </div>
      )}
      <div
        ref={boxRef}
        style={{ ...boxStyle, height: 'auto', color }}
        className="pointer-events-auto rounded-md"
        onKeyDownCapture={handleKeyDown}
      >
        {editor && <EditorContent editor={editor} className="h-full w-full" />}
      </div>
    </>
  );
}
