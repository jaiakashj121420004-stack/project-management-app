import { useCallback, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { Editor } from '@tiptap/react';
import { ToolbarPopover } from '@/components/forms/ToolbarPopover';
import {
  Bold,
  ChevronDown,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  ListTree,
  Minus,
  Palette,
  Quote,
  Shapes,
  Smile,
  Strikethrough,
  Underline,
  Unlink,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Spinner } from '@/components/feedback/Spinner';
import { uploadNoteImage } from '@/features/notes/noteMedia';
import { safeLinkHref, BULLET_LIST_STYLES, ORDERED_LIST_STYLES } from './extensions';
import { CanvasPickerModal } from './CanvasPickerModal';
import { useNoteRef } from './noteContext';

interface EditorToolbarProps {
  editor: Editor;
  className?: string;
}

/** A generous colour palette (Nvexis earthy + brights) for text + highlight. */
const DEFAULT_TEXT_COLOR = '#7A2A26';
const TEXT_COLORS: readonly string[] = [
  DEFAULT_TEXT_COLOR,
  '#C24A40',
  '#B45309',
  '#D97706',
  '#CA8A04',
  '#4D7C0F',
  '#0F766E',
  '#0369A1',
  '#4338CA',
  '#7C3AED',
  '#BE185D',
  '#1F2937',
];

const LIST_STYLE_LABELS: Record<string, string> = {
  disc: '• Disc',
  circle: '○ Circle',
  square: '▪ Square',
  hyphen: '– Hyphen',
  decimal: '1. Decimal',
  'lower-alpha': 'a. Lower alpha',
  'upper-alpha': 'A. Upper alpha',
  'lower-roman': 'i. Lower roman',
  'upper-roman': 'I. Upper roman',
};

/** Highlight (marker) colours — soft, translucent so text stays legible. */
const HIGHLIGHT_COLORS: readonly string[] = [
  '#FEF08A',
  '#FED7AA',
  '#FBCFE8',
  '#BBF7D0',
  '#BAE6FD',
  '#DDD6FE',
  '#E5E7EB',
];

/** A quick-pick set for the toolbar emoji button (`: ` autocomplete has the rest). */
const COMMON_EMOJIS: readonly string[] = [
  '😀', '😄', '😅', '😂', '🙂', '😉', '😍', '🤔',
  '😎', '😴', '🥳', '😳', '😭', '😡', '👍', '👎',
  '👏', '🙌', '🙏', '💪', '🔥', '✨', '⭐', '💡',
  '✅', '❌', '⚠️', '📌', '📝', '📎', '🚀', '🎯',
  '❤️', '💯', '🎉', '🥲', '👀', '🤝', '⏰', '📅',
];

type OpenPopover = 'color' | 'highlight' | 'link' | 'liststyle' | 'emoji' | null;

/**
 * The block editor's formatting toolbar. Buttons run Tiptap chain commands;
 * `onMouseDown` is prevented so a click never steals the selection. Colour, link
 * and list-style open small popovers. Links are sanitised to http/https/mailto
 * before they're set. Wraps so it never scroll-clips on a phone.
 */
export function EditorToolbar({ editor, className }: EditorToolbarProps) {
  const [open, setOpen] = useState<OpenPopover>(null);
  const [linkValue, setLinkValue] = useState('');
  const [canvasPickerOpen, setCanvasPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const noteRef = useNoteRef();
  const close = () => setOpen(null);

  async function uploadAndInsert(file: File) {
    if (!noteRef) return;
    setUploading(true);
    setImageError(null);
    try {
      const { path } = await uploadNoteImage(noteRef.noteId, file);
      editor.chain().focus().insertNoteImage({ path }).run();
    } catch (error) {
      setImageError(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  const styleAttrs: Record<string, unknown> = editor.getAttributes('textStyle');
  const currentColor = typeof styleAttrs.color === 'string' ? styleAttrs.color : null;
  const highlightAttrs: Record<string, unknown> = editor.getAttributes('highlight');
  const currentHighlight = typeof highlightAttrs.color === 'string' ? highlightAttrs.color : null;
  const linkAttrs: Record<string, unknown> = editor.getAttributes('link');
  const currentHref = typeof linkAttrs.href === 'string' ? linkAttrs.href : '';
  const linkActive = editor.isActive('link');

  const inBullet = editor.isActive('bulletList');
  const inOrdered = editor.isActive('orderedList');
  const inList = inBullet || inOrdered;
  const listStyles = inOrdered ? ORDERED_LIST_STYLES : BULLET_LIST_STYLES;

  const clearColor = useCallback(() => {
    editor.chain().focus().unsetColor().run();
    setOpen(null);
  }, [editor]);

  const openLink = useCallback(() => {
    setLinkValue(currentHref);
    setOpen((o) => (o === 'link' ? null : 'link'));
  }, [currentHref]);

  const applyLink = useCallback(() => {
    const trimmed = linkValue.trim();
    if (trimmed === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      setOpen(null);
      return;
    }
    const safe = safeLinkHref(trimmed);
    if (!safe) return;
    editor.chain().focus().extendMarkRange('link').setLink({ href: safe }).run();
    setOpen(null);
  }, [editor, linkValue]);

  const removeLink = useCallback(() => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setOpen(null);
  }, [editor]);

  const applyListStyle = useCallback(
    (style: string) => {
      editor
        .chain()
        .focus()
        .updateAttributes(inOrdered ? 'orderedList' : 'bulletList', { listStyle: style })
        .run();
      setOpen(null);
    },
    [editor, inOrdered],
  );

  const onLinkKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      applyLink();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(null);
    }
  };

  const linkInvalid = linkValue.trim() !== '' && safeLinkHref(linkValue) === null;

  return (
    <div
      role="toolbar"
      aria-label="Text formatting"
      className={cn(
        'glass-menu sticky top-0 z-10 flex max-w-full flex-wrap items-center gap-0.5 rounded-xl border border-[var(--glass-border)] px-1.5 py-1',
        className,
      )}
    >
      <Btn label="Bold" active={editor.isActive('bold')} onRun={() => editor.chain().focus().toggleBold().run()}>
        <Bold size={15} />
      </Btn>
      <Btn label="Italic" active={editor.isActive('italic')} onRun={() => editor.chain().focus().toggleItalic().run()}>
        <Italic size={15} />
      </Btn>
      <Btn label="Underline" active={editor.isActive('underline')} onRun={() => editor.chain().focus().toggleUnderline().run()}>
        <Underline size={15} />
      </Btn>
      <Btn label="Strikethrough" active={editor.isActive('strike')} onRun={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough size={15} />
      </Btn>
      <Popover
        open={open === 'highlight'}
        onClose={close}
        title="Highlight"
        trigger={
          <Btn
            label="Highlight"
            active={editor.isActive('highlight') || open === 'highlight'}
            onRun={() => setOpen((o) => (o === 'highlight' ? null : 'highlight'))}
          >
            <span className="relative grid place-items-center">
              <Highlighter size={15} />
              <span
                aria-hidden
                className="absolute -bottom-1 h-0.5 w-4 rounded-full"
                style={{ background: currentHighlight ?? '#FEF08A' }}
              />
            </span>
          </Btn>
        }
      >
        <div className="flex w-40 flex-wrap gap-1.5">
          {HIGHLIGHT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Highlight ${color}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                editor.chain().focus().toggleHighlight({ color }).run();
                setOpen(null);
              }}
              className="h-6 w-6 rounded-full border border-black/10 transition-transform hover:scale-110 dark:border-white/20"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            editor.chain().focus().unsetHighlight().run();
            setOpen(null);
          }}
          className="mt-2 w-full rounded-lg px-2 py-1 text-xs text-fg-muted transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
        >
          Remove highlight
        </button>
      </Popover>

      <Divider />

      <Popover
        open={open === 'color'}
        onClose={close}
        title="Text colour"
        trigger={
          <Btn label="Text colour" active={open === 'color'} onRun={() => setOpen((o) => (o === 'color' ? null : 'color'))}>
            <span className="relative grid place-items-center">
              <Palette size={16} />
              <span
                aria-hidden
                className="absolute -bottom-1 h-0.5 w-4 rounded-full"
                style={{ background: currentColor ?? 'currentColor' }}
              />
            </span>
          </Btn>
        }
      >
        <div className="grid grid-cols-6 gap-2">
          {TEXT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={color}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => {
                editor.chain().focus().setColor(color).run();
                close();
              }}
              className="h-8 w-8 rounded-full border border-black/10 transition-transform hover:scale-110 dark:border-white/25"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <button
          type="button"
          onPointerDown={(e) => e.preventDefault()}
          onClick={clearColor}
          className="mt-3 w-full rounded-lg border border-[var(--glass-border)] px-2 py-1.5 text-xs text-fg-muted transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
        >
          Default colour
        </button>
      </Popover>

      <Popover
        open={open === 'link'}
        onClose={close}
        title="Link"
        trigger={
          <Btn label="Link" active={linkActive || open === 'link'} onRun={openLink}>
            <Link2 size={16} />
          </Btn>
        }
      >
        <div className="flex items-center gap-1">
          <input
            type="url"
            inputMode="url"
            autoFocus
            value={linkValue}
            placeholder="https://example.com"
            aria-label="Link URL"
            aria-invalid={linkInvalid}
            onChange={(e) => setLinkValue(e.target.value)}
            onKeyDown={onLinkKeyDown}
            className={cn(
              'w-52 rounded-lg border bg-[var(--glass-fill)] px-2 py-1 text-sm text-fg outline-none placeholder:text-fg-subtle',
              linkInvalid ? 'border-danger' : 'border-[var(--glass-border)]',
            )}
          />
          <button
            type="button"
            aria-label="Apply link"
            disabled={linkInvalid}
            onMouseDown={(e) => e.preventDefault()}
            onClick={applyLink}
            className="grid h-8 w-8 place-items-center rounded-lg bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)] disabled:opacity-40"
          >
            <Link2 size={15} />
          </button>
          {linkActive && (
            <button
              type="button"
              aria-label="Remove link"
              onMouseDown={(e) => e.preventDefault()}
              onClick={removeLink}
              className="grid h-8 w-8 place-items-center rounded-lg text-fg-muted transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
            >
              <Unlink size={15} />
            </button>
          )}
        </div>
        {linkInvalid && <p className="mt-1 text-xs text-danger">Only http, https and mailto links are allowed.</p>}
      </Popover>

      <Divider />

      <Btn label="Heading 1" active={editor.isActive('heading', { level: 1 })} onRun={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <Heading1 size={16} />
      </Btn>
      <Btn label="Heading 2" active={editor.isActive('heading', { level: 2 })} onRun={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 size={16} />
      </Btn>
      <Btn label="Heading 3" active={editor.isActive('heading', { level: 3 })} onRun={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 size={16} />
      </Btn>

      <Divider />

      <Btn label="Bullet list" active={inBullet} onRun={() => editor.chain().focus().toggleBulletList().run()}>
        <List size={16} />
      </Btn>
      <Btn label="Numbered list" active={inOrdered} onRun={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered size={16} />
      </Btn>
      <Btn label="Task list" active={editor.isActive('taskList')} onRun={() => editor.chain().focus().toggleTaskList().run()}>
        <ListChecks size={16} />
      </Btn>

      <Popover
        open={open === 'liststyle'}
        onClose={close}
        title="List style"
        trigger={
          <Btn
            label="List style"
            active={open === 'liststyle'}
            disabled={!inList}
            onRun={() => setOpen((o) => (o === 'liststyle' ? null : 'liststyle'))}
          >
            <span className="flex items-center">
              <ListTree size={16} />
              <ChevronDown size={12} />
            </span>
          </Btn>
        }
      >
        <div className="flex w-40 flex-col">
          {listStyles.map((style) => (
            <button
              key={style}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyListStyle(style)}
              className="rounded-lg px-2 py-1.5 text-left text-sm text-fg-muted transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
            >
              {LIST_STYLE_LABELS[style]}
            </button>
          ))}
        </div>
      </Popover>

      <Divider />

      <Btn label="Quote" active={editor.isActive('blockquote')} onRun={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote size={15} />
      </Btn>
      <Btn label="Code block" active={editor.isActive('codeBlock')} onRun={() => editor.chain().focus().toggleCodeBlock().run()}>
        <Code2 size={15} />
      </Btn>
      <Btn label="Divider" active={false} onRun={() => editor.chain().focus().setHorizontalRule().run()}>
        <Minus size={16} />
      </Btn>

      <Divider />

      <Popover
        open={open === 'emoji'}
        onClose={close}
        title="Emoji"
        trigger={
          <Btn label="Emoji" active={open === 'emoji'} onRun={() => setOpen((o) => (o === 'emoji' ? null : 'emoji'))}>
            <Smile size={16} />
          </Btn>
        }
      >
        <div className="grid w-56 grid-cols-8 gap-0.5">
          {COMMON_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={`Insert ${emoji}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                editor.chain().focus().insertContent(emoji).run();
                setOpen(null);
              }}
              className="grid h-7 w-7 place-items-center rounded-md text-lg transition-colors hover:bg-[var(--glass-fill)]"
            >
              {emoji}
            </button>
          ))}
        </div>
      </Popover>

      <Divider />

      <Btn label="Insert image" active={false} disabled={uploading} onRun={() => fileInputRef.current?.click()}>
        {uploading ? <Spinner size={14} className="text-current" /> : <ImageIcon size={16} />}
      </Btn>
      <Btn label="Insert canvas" active={canvasPickerOpen} onRun={() => setCanvasPickerOpen(true)}>
        <Shapes size={16} />
      </Btn>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadAndInsert(file);
          event.target.value = '';
        }}
      />
      <CanvasPickerModal
        open={canvasPickerOpen}
        onClose={() => setCanvasPickerOpen(false)}
        onSelect={(canvasId, title) =>
          editor.chain().focus().insertCanvasLink({ canvasId, title }).run()
        }
      />
      {imageError && <span className="w-full px-1 text-xs text-danger">{imageError}</span>}
    </div>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px bg-[var(--glass-border)]" aria-hidden />;
}

function Popover({
  open,
  onClose,
  title,
  trigger,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  trigger: ReactNode;
  children: ReactNode;
}) {
  return (
    <ToolbarPopover open={open} onClose={onClose} title={title} trigger={trigger}>
      {children}
    </ToolbarPopover>
  );
}

function Btn({
  label,
  active,
  onRun,
  disabled = false,
  children,
}: {
  label: string;
  active: boolean;
  onRun: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onRun}
      className={cn(
        'grid h-8 w-8 place-items-center rounded-lg transition-colors disabled:opacity-40',
        active
          ? 'bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)]'
          : 'text-fg-muted hover:bg-[var(--glass-fill)] hover:text-fg',
      )}
    >
      {children}
    </button>
  );
}
