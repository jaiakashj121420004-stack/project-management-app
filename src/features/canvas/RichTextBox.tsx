import { useCallback, useEffect, useRef, type CSSProperties, type KeyboardEvent } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { emptyTextDoc, textExtensions } from './richText';
import { TextFormatToolbar } from './TextFormatToolbar';

interface RichTextBoxProps {
  /** Initial Tiptap document (null → a fresh empty paragraph). */
  body: Record<string, unknown> | null;
  /** Transform/size for the content box (world units, camera-scaled). */
  boxStyle: CSSProperties;
  /** Screen-space position for the floating format toolbar. */
  toolbarStyle: CSSProperties;
  /** Resolved ink colour for the text. */
  color: string;
  /** Ruled page: align each line to the rule spacing so text sits on the lines. */
  ruled?: boolean;
  /** Persist the edited content (debounced while typing + flushed on exit). */
  onCommit: (body: Record<string, unknown>, text: string) => void;
  /** Leave edit mode (Escape). */
  onExit: () => void;
}

/** Commit at most one history step per this idle gap while typing. */
const COMMIT_DEBOUNCE = 400;

/**
 * The live Tiptap editor for the one text box being edited. Mounted only while
 * editing; it owns the editor instance and renders both the in-canvas editable
 * content (aligned to the box) and the screen-space formatting toolbar. Edits are
 * debounced into a single scene commit so typing doesn't flood undo history, and
 * the latest content is flushed on unmount so switching away never drops it.
 */
export function RichTextBox({
  body,
  boxStyle,
  toolbarStyle,
  color,
  ruled = false,
  onCommit,
  onExit,
}: RichTextBoxProps) {
  // Keep callbacks in refs so the flush helpers stay identity-stable (the unmount
  // flush must not re-run every time the parent passes a new closure).
  const onCommitRef = useRef(onCommit);
  const onExitRef = useRef(onExit);
  useEffect(() => {
    onCommitRef.current = onCommit;
    onExitRef.current = onExit;
  });

  const latestRef = useRef<{ body: Record<string, unknown>; text: string } | null>(null);
  const dirtyRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (dirtyRef.current && latestRef.current) {
      onCommitRef.current(latestRef.current.body, latestRef.current.text);
      dirtyRef.current = false;
    }
  }, []);

  const editor = useEditor({
    extensions: textExtensions,
    content: body ?? emptyTextDoc(),
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
  });

  // Flush any pending edit when the editor unmounts (exit / canvas switch).
  useEffect(() => () => flush(), [flush]);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      flush();
      onExitRef.current();
    }
  };

  return (
    <>
      {editor && (
        <div style={toolbarStyle} className="pointer-events-auto">
          <TextFormatToolbar editor={editor} />
        </div>
      )}
      <div
        style={{ ...boxStyle, color }}
        className="pointer-events-auto overflow-hidden rounded-2xl bg-[var(--glass-fill)] ring-2 ring-[var(--accent-from)]"
        onKeyDownCapture={handleKeyDown}
      >
        {editor && <EditorContent editor={editor} className="h-full w-full" />}
      </div>
    </>
  );
}
