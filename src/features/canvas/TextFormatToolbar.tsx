import { useCallback, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { Editor } from '@tiptap/react';
import { ToolbarPopover } from '@/components/forms/ToolbarPopover';
import {
  Bold,
  Heading1,
  Heading2,
  Highlighter,
  Italic,
  Link2,
  List,
  ListOrdered,
  Palette,
  Quote,
  Strikethrough,
  Underline,
  Unlink,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { safeLinkHref } from './richText';

interface TextFormatToolbarProps {
  editor: Editor;
  className?: string;
}

/** Text colours offered by the colour popover (Nvexis earthy + brights). */
const TEXT_COLORS: readonly string[] = [
  '#7A2A26', '#C24A40', '#B45309', '#D97706', '#CA8A04', '#4D7C0F',
  '#0F766E', '#0369A1', '#4338CA', '#7C3AED', '#BE185D', '#1F2937',
];

type OpenPopover = 'color' | 'link' | null;

/**
 * The floating rich-text toolbar shown above a text box while it's being edited.
 * Buttons run Tiptap chain commands; `onMouseDown` is prevented so clicking a
 * control never steals the selection from the editor (the editor keeps its
 * selection in state, and each command re-`focus()`es to reapply it). Active
 * state reflects the mark/node under the caret (the parent re-renders on every
 * editor transaction). Colour + link open small popovers; links are sanitised to
 * http/https/mailto before they're ever set.
 */
export function TextFormatToolbar({ editor, className }: TextFormatToolbarProps) {
  const [open, setOpen] = useState<OpenPopover>(null);
  const [linkValue, setLinkValue] = useState('');
  const close = () => setOpen(null);

  const linkAttrs: Record<string, unknown> = editor.getAttributes('link');
  const currentHref = typeof linkAttrs.href === 'string' ? linkAttrs.href : '';
  const styleAttrs: Record<string, unknown> = editor.getAttributes('textStyle');
  const currentColor = typeof styleAttrs.color === 'string' ? styleAttrs.color : null;
  const linkActive = editor.isActive('link');

  const toggleColor = useCallback(() => setOpen((o) => (o === 'color' ? null : 'color')), []);

  const openLink = useCallback(() => {
    setLinkValue(currentHref);
    setOpen((o) => (o === 'link' ? null : 'link'));
  }, [currentHref]);

  const clearColor = useCallback(() => {
    editor.chain().focus().unsetColor().run();
    setOpen(null);
  }, [editor]);

  const applyLink = useCallback(() => {
    const trimmed = linkValue.trim();
    if (trimmed === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      setOpen(null);
      return;
    }
    const safe = safeLinkHref(trimmed);
    if (!safe) return; // invalid scheme — keep the popover open, input shows the error
    editor.chain().focus().extendMarkRange('link').setLink({ href: safe }).run();
    setOpen(null);
  }, [editor, linkValue]);

  const removeLink = useCallback(() => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setOpen(null);
  }, [editor]);

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

      <Popover
        open={open === 'color'}
        onClose={close}
        title="Text colour"
        trigger={
          <FmtButton label="Text colour" active={open === 'color'} onRun={toggleColor}>
            <span className="relative grid place-items-center">
              <Palette size={16} />
              <span
                aria-hidden
                className="absolute -bottom-1 h-0.5 w-4 rounded-full"
                style={{ background: currentColor ?? 'currentColor' }}
              />
            </span>
          </FmtButton>
        }
      >
        <div className="grid grid-cols-6 gap-2">
          {TEXT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={color}
              onPointerDown={(event) => event.preventDefault()}
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
          onPointerDown={(event) => event.preventDefault()}
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
          <FmtButton label="Link" active={linkActive || open === 'link'} onRun={openLink}>
            <Link2 size={16} />
          </FmtButton>
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
            onChange={(event) => setLinkValue(event.target.value)}
            onKeyDown={onLinkKeyDown}
            className={cn(
              'w-52 rounded-lg border bg-[var(--glass-fill)] px-2 py-1 text-sm text-fg outline-none placeholder:text-fg-subtle',
              linkInvalid ? 'border-[var(--danger,#EF4444)]' : 'border-[var(--glass-border)]',
            )}
          />
          <button
            type="button"
            aria-label="Apply link"
            title="Apply link"
            disabled={linkInvalid}
            onMouseDown={(event) => event.preventDefault()}
            onClick={applyLink}
            className="grid h-8 w-8 place-items-center rounded-lg bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)] transition-opacity disabled:opacity-40"
          >
            <Link2 size={15} />
          </button>
          {linkActive && (
            <button
              type="button"
              aria-label="Remove link"
              title="Remove link"
              onMouseDown={(event) => event.preventDefault()}
              onClick={removeLink}
              className="grid h-8 w-8 place-items-center rounded-lg text-fg-muted transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
            >
              <Unlink size={15} />
            </button>
          )}
        </div>
        {linkInvalid && (
          <p className="mt-1 text-xs text-[var(--danger,#EF4444)]">
            Only http, https and mailto links are allowed.
          </p>
        )}
      </Popover>

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

/** A toolbar control with a viewport-safe (portaled) popover — clean on mobile. */
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
          ? 'bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)]'
          : 'text-fg-muted hover:bg-[var(--glass-fill)] hover:text-fg',
      )}
    >
      {children}
    </button>
  );
}
