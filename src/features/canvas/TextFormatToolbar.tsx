import type { ReactNode } from 'react';
import type { Editor } from '@tiptap/react';
import {
  Bold,
  Heading1,
  Heading2,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  Underline,
} from 'lucide-react';
import { cn } from '@/lib/cn';

interface TextFormatToolbarProps {
  editor: Editor;
  className?: string;
}

/**
 * The floating rich-text toolbar shown above a text box while it's being edited.
 * Buttons run Tiptap chain commands; `onMouseDown` is prevented so clicking a
 * button never steals the selection from the editor. Active state reflects the
 * mark/node under the caret (the parent re-renders on every editor transaction).
 */
export function TextFormatToolbar({ editor, className }: TextFormatToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Text formatting"
      className={cn(
        'glass-menu flex max-w-full flex-wrap items-center gap-0.5 rounded-xl border border-[var(--glass-border)] px-1 py-1 shadow-[0_14px_34px_-18px_rgba(0,0,0,0.7)]',
        className,
      )}
    >
      <FmtButton
        label="Bold"
        active={editor.isActive('bold')}
        onRun={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold size={15} />
      </FmtButton>
      <FmtButton
        label="Italic"
        active={editor.isActive('italic')}
        onRun={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic size={15} />
      </FmtButton>
      <FmtButton
        label="Underline"
        active={editor.isActive('underline')}
        onRun={() => editor.chain().focus().toggleUnderline().run()}
      >
        <Underline size={15} />
      </FmtButton>
      <FmtButton
        label="Strikethrough"
        active={editor.isActive('strike')}
        onRun={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough size={15} />
      </FmtButton>
      <FmtButton
        label="Highlight"
        active={editor.isActive('highlight')}
        onRun={() => editor.chain().focus().toggleHighlight().run()}
      >
        <Highlighter size={15} />
      </FmtButton>

      <Divider />

      <FmtButton
        label="Heading 1"
        active={editor.isActive('heading', { level: 1 })}
        onRun={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 size={16} />
      </FmtButton>
      <FmtButton
        label="Heading 2"
        active={editor.isActive('heading', { level: 2 })}
        onRun={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 size={16} />
      </FmtButton>

      <Divider />

      <FmtButton
        label="Bullet list"
        active={editor.isActive('bulletList')}
        onRun={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List size={16} />
      </FmtButton>
      <FmtButton
        label="Numbered list"
        active={editor.isActive('orderedList')}
        onRun={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={16} />
      </FmtButton>
      <FmtButton
        label="Quote"
        active={editor.isActive('blockquote')}
        onRun={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote size={15} />
      </FmtButton>
    </div>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px bg-[var(--glass-border)]" aria-hidden />;
}

function FmtButton({
  label,
  active,
  onRun,
  children,
}: {
  label: string;
  active: boolean;
  onRun: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onRun}
      className={cn(
        'grid h-8 w-8 place-items-center rounded-lg transition-colors',
        active
          ? 'bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] text-white'
          : 'text-fg-muted hover:bg-[var(--glass-fill)] hover:text-fg',
      )}
    >
      {children}
    </button>
  );
}
