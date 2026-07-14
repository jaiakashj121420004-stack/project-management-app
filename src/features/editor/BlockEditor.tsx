import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import type { AnyExtension, JSONContent } from '@tiptap/core';
import { Placeholder } from '@tiptap/extension-placeholder';
import { cn } from '@/lib/cn';
import { blockExtensions } from './extensions';
import { EditorToolbar } from './EditorToolbar';
import { SlashCommand } from './suggestion/SlashCommand';
import { EmojiCommand } from './suggestion/EmojiCommand';
import { docToPlainText } from './serialize';
import './editor.css';

interface BlockEditorProps {
  /** Initial document. The editor owns its state after mount, so the parent
   *  should re-key by id to load a different document (never push new content). */
  content: JSONContent | null;
  editable: boolean;
  placeholder?: string;
  /** Fires on every edit with the new doc JSON + a plain-text mirror (for the
   *  searchable `content` column). The parent debounces the actual save. */
  onChange?: (doc: JSONContent, plainText: string) => void;
  /** Extra Tiptap extensions for this surface only (e.g. notes' Insert-canvas).
   *  Must be a stable reference (module constant) — the editor is built once. */
  extraExtensions?: AnyExtension[];
  className?: string;
}

/**
 * The shared Notion-style block editor (Nvexis Phase 3). A Tiptap editor over the
 * app-wide `blockExtensions` schema with a formatting toolbar (shown only when
 * editable). Used by notes now and canvas text boxes in the same phase. The heavy
 * Tiptap bundle is code-split by lazy-loading THIS component at its call sites.
 */
export function BlockEditor({
  content,
  editable,
  placeholder = 'Write something, or press “/” for blocks…',
  onChange,
  extraExtensions = [],
  className,
}: BlockEditorProps) {
  const editor = useEditor({
    editable,
    // immediatelyRender:false avoids a first-paint race in React 18/19 StrictMode.
    immediatelyRender: false,
    extensions: [
      ...blockExtensions,
      Placeholder.configure({ placeholder }),
      SlashCommand,
      EmojiCommand,
      ...extraExtensions,
    ],
    content: content ?? undefined,
    onUpdate: ({ editor: instance }) => {
      if (!onChange) return;
      const json = instance.getJSON();
      onChange(json, docToPlainText(json as Record<string, unknown>));
    },
  });

  // Keep the editor's editable flag in sync if the parent flips it (e.g. a viewer
  // vs an editor) without remounting.
  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col gap-2', className)}>
      {editable && editor && <EditorToolbar editor={editor} />}
      <div className="block-editor relative min-h-[40vh] flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
