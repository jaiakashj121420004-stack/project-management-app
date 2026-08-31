import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
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

  // The toolbar is positioned in real viewport coordinates (`position: fixed`,
  // derived from the text box's own `getBoundingClientRect()`) rather than the
  // camera-transformed world coordinates the caller used to compute — that
  // approach couldn't tell where the app shell's top nav actually is, so a
  // text box edited near the top of the canvas could push the toolbar up
  // underneath (or, before the flip, behind) the top bar. Anchoring to the
  // box's live viewport rect and to the top bar's own measured bottom edge
  // (`#app-topbar`, set in Topbar.tsx) keeps it correct regardless of camera
  // pan/zoom, canvas scroll position, or the shell's own layout changing.
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarStyle, setToolbarStyle] = useState<CSSProperties | null>(null);

  const recomputeToolbarPosition = useCallback(() => {
    const boxNode = boxRef.current;
    const toolbarNode = toolbarRef.current;
    if (!boxNode || !toolbarNode) return;
    const MARGIN = 8;
    const boxRect = boxNode.getBoundingClientRect();
    const toolbarRect = toolbarNode.getBoundingClientRect();
    const toolbarHeight = toolbarRect.height || 44;
    // The top nav's real bottom edge — never let the toolbar render above it.
    const navBottom = document.getElementById('app-topbar')?.getBoundingClientRect().bottom ?? 0;
    const minTop = navBottom + MARGIN;

    if (isMobile) {
      // Stable, full-width bar just below the nav (also escapes the canvas
      // overlay's own clipping, since it's fixed to the viewport).
      setToolbarStyle({ position: 'fixed', top: minTop, left: '0.5rem', right: '0.5rem', zIndex: 50 });
      return;
    }

    const toolbarWidth = toolbarRect.width || 320;
    const spaceAbove = boxRect.top - minTop;
    const spaceBelow = window.innerHeight - boxRect.bottom;
    // Prefer above the box (out of the way of typing); flip below it when
    // there isn't room above but there is below.
    const placeAbove = spaceAbove >= toolbarHeight + MARGIN && spaceAbove >= spaceBelow;
    const rawTop = placeAbove ? boxRect.top - toolbarHeight - MARGIN : boxRect.bottom + MARGIN;
    const top = Math.min(
      Math.max(minTop, rawTop),
      Math.max(minTop, window.innerHeight - toolbarHeight - MARGIN),
    );
    const left = Math.min(
      Math.max(MARGIN, boxRect.left),
      Math.max(MARGIN, window.innerWidth - toolbarWidth - MARGIN),
    );
    setToolbarStyle({ position: 'fixed', top, left, zIndex: 50 });
  }, [isMobile]);

  useLayoutEffect(() => {
    if (!editor) return;
    // Positioning the toolbar requires measuring the box/toolbar DOM nodes
    // after layout, which is why this lives in an effect rather than
    // render; `recomputeToolbarPosition` sets state as part of that
    // measurement.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    recomputeToolbarPosition();
    // The toolbar's own size can change independent of the box (popovers,
    // wrapping onto a second row) — that also invalidates the last computed
    // position, so it gets its own observer alongside the box's.
    const observer = new ResizeObserver(recomputeToolbarPosition);
    if (boxRef.current) observer.observe(boxRef.current);
    if (toolbarRef.current) observer.observe(toolbarRef.current);
    window.addEventListener('resize', recomputeToolbarPosition);
    // Capture phase: the canvas's scrollable ancestor (`<main>`) doesn't bubble.
    window.addEventListener('scroll', recomputeToolbarPosition, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', recomputeToolbarPosition);
      window.removeEventListener('scroll', recomputeToolbarPosition, true);
    };
  }, [editor, recomputeToolbarPosition]);

  // `boxStyle` carries the box's on-screen transform and is a fresh object
  // every render the parent produces from camera state — so this fires on
  // every pan/zoom tick too. A pure camera pan translates the box via CSS
  // transform without changing its pixel size, which the ResizeObserver
  // above can't see, so it needs this separate trigger to stay anchored.
  useLayoutEffect(() => {
    // Same DOM-measurement rationale as above — this trigger just fires on
    // camera pan/zoom in addition to box/toolbar resize.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    recomputeToolbarPosition();
  }, [boxStyle, recomputeToolbarPosition]);

  return (
    <>
      {editor && (
        <div
          ref={toolbarRef}
          style={toolbarStyle ?? { position: 'fixed', top: -9999, left: -9999, zIndex: 50 }}
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
