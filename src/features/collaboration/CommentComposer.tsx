import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { Avatar } from '@/components/Avatar';
import { GradientButton } from '@/components/buttons/GradientButton';
import { cn } from '@/lib/cn';

export interface ComposerMember {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface CommentComposerProps {
  members: ComposerMember[];
  /** Receives the trimmed body; the parent resolves mentions + posts. */
  onSubmit: (body: string) => void;
  busy?: boolean;
  initialBody?: string;
  placeholder?: string;
  submitLabel?: string;
  autoFocus?: boolean;
  /** When provided, a Cancel button appears (edit / reply contexts). */
  onCancel?: () => void;
}

/** The text from the last `@` up to the caret, if it's an active mention query. */
function activeMention(value: string, caret: number): { start: number; query: string } | null {
  const upto = value.slice(0, caret);
  const at = upto.lastIndexOf('@');
  if (at === -1) return null;
  // The '@' must start the line/string or follow whitespace.
  if (at > 0 && !/\s/.test(value[at - 1] ?? '')) return null;
  const query = upto.slice(at + 1);
  if (query.includes('\n') || query.length > 40) return null;
  return { start: at, query };
}

/**
 * Comment composer with @mention autocomplete over the project roster. Mentions
 * are inserted as plain `@Display Name` text (the parent resolves them to user
 * ids on submit). Enter submits; Shift+Enter is a newline; while the mention
 * menu is open, ↑/↓ navigate and Enter/Tab pick.
 */
export function CommentComposer({
  members,
  onSubmit,
  busy = false,
  initialBody = '',
  placeholder = 'Write a comment… use @ to mention',
  submitLabel = 'Comment',
  autoFocus = false,
  onCancel,
}: CommentComposerProps) {
  const [value, setValue] = useState(initialBody);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [highlight, setHighlight] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingCaret = useRef<number | null>(null);

  const matches = useMemo(() => {
    if (!mention) return [];
    const query = mention.query.toLowerCase();
    return members
      .filter((member) => member.displayName && member.displayName.toLowerCase().includes(query))
      .slice(0, 6);
  }, [mention, members]);

  // Restore the caret after a programmatic insert (mention pick).
  useLayoutEffect(() => {
    if (pendingCaret.current != null && textareaRef.current) {
      textareaRef.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  });

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const next = event.target.value;
    const caret = event.target.selectionStart ?? next.length;
    setValue(next);
    setMention(activeMention(next, caret));
    setHighlight(0);
  }

  function insertMention(member: ComposerMember) {
    if (!mention || !member.displayName) return;
    const caret = textareaRef.current?.selectionStart ?? value.length;
    const before = value.slice(0, mention.start);
    const after = value.slice(caret);
    const insert = `@${member.displayName} `;
    pendingCaret.current = (before + insert).length;
    setValue(before + insert + after);
    setMention(null);
    textareaRef.current?.focus();
  }

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    onSubmit(trimmed);
    setValue('');
    setMention(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (mention && matches.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlight((h) => (h + 1) % matches.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlight((h) => (h - 1 + matches.length) % matches.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        insertMention(matches[highlight] ?? matches[0]!);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setMention(null);
        return;
      }
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          rows={3}
          className={cn(
            'w-full resize-y rounded-2xl border border-[var(--glass-border)] bg-[var(--field-bg)] px-3.5 py-2.5',
            'text-sm text-fg placeholder:text-fg-subtle outline-none transition-colors',
            'focus:border-[color:var(--accent-from)] focus:ring-2 focus:ring-[var(--accent-from)]',
          )}
        />

        {mention && matches.length > 0 && (
          <ul
            role="listbox"
            className="glass-menu absolute left-0 top-full z-50 mt-1 max-h-56 w-64 overflow-auto rounded-2xl p-1"
          >
            {matches.map((member, index) => (
              <li key={member.userId}>
                <button
                  type="button"
                  role="option"
                  aria-selected={index === highlight}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    insertMention(member);
                  }}
                  onMouseEnter={() => setHighlight(index)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition-colors',
                    index === highlight ? 'bg-[var(--glass-fill)] text-fg' : 'text-fg-muted',
                  )}
                >
                  <Avatar name={member.displayName ?? 'Member'} src={member.avatarUrl} size={24} />
                  <span className="truncate font-medium">{member.displayName ?? 'Member'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <GradientButton type="button" variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
            Cancel
          </GradientButton>
        )}
        <GradientButton
          type="button"
          size="sm"
          onClick={submit}
          isLoading={busy}
          disabled={!value.trim()}
        >
          {submitLabel}
        </GradientButton>
      </div>
    </div>
  );
}
