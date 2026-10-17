import { useRef, useState } from 'react';
import { FileUp, NotebookText, PenLine } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/Modal';
import { GradientButton } from '@/components/buttons/GradientButton';
import { toast } from '@/components/feedback/toast';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/cn';
import { importFile, ImportError, type ImportResult, type ImportTarget } from './importFile';
import { ACCEPT_ATTR, MAX_IMPORT_BYTES, detectKind, type ImportKind } from './textImport';

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  folderId: string | null;
  isPro: boolean;
  /** Canvases are Pro — called instead of importing when a free user picks one. */
  onNeedPro: () => void;
  onImported: (result: ImportResult) => void;
}

const TARGETS: ReadonlyArray<{ id: ImportTarget; label: string; hint: string; icon: typeof PenLine }> = [
  { id: 'note', label: 'A note', hint: 'Text you can edit like any note', icon: NotebookText },
  { id: 'canvas', label: 'A canvas', hint: 'Keeps layout; PDF handwriting stays editable ink', icon: PenLine },
];

/** Pick a PDF / Word / Markdown / HTML / text file and bring it in as a note or canvas. */
export function ImportDialog({ open, onClose, folderId, isPro, onNeedPro, onImported }: ImportDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<ImportKind | null>(null);
  const [target, setTarget] = useState<ImportTarget>('note');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(next: File | undefined) {
    setError(null);
    if (!next) return;
    const detected = detectKind(next);
    if (!detected) {
      setError('Choose a PDF, Word (.docx), Markdown, HTML or text file.');
      return;
    }
    if (next.size > MAX_IMPORT_BYTES) {
      setError('That file is over 25 MB.');
      return;
    }
    setFile(next);
    setKind(detected);
    // PDFs usually carry layout and handwriting, so a canvas is the better default.
    setTarget(detected === 'pdf' && isPro ? 'canvas' : 'note');
  }

  async function submit() {
    if (!file || !kind || busy) return;
    if (target === 'canvas' && !isPro) {
      onNeedPro();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await importFile(file, kind, target, folderId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['library-notes', user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['canvas-all', user?.id] }),
      ]);
      if (result.notice) toast.info(result.notice);
      setFile(null);
      setKind(null);
      onImported(result);
    } catch (err) {
      setError(err instanceof ImportError ? err.message : "Couldn't import that file. Try another one.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={busy ? () => undefined : onClose} title="Import a file" description="Bring a PDF, Word, Markdown, HTML or text file into your Notebooks.">
      <div className="flex flex-col gap-4">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          className="sr-only"
          onChange={(event) => pick(event.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-3 rounded-2xl border border-dashed border-[var(--glass-border)] bg-[var(--field-bg)] px-4 py-4 text-left transition-colors hover:border-[color:var(--accent-from)]"
        >
          <FileUp size={22} className="shrink-0 text-fg-muted" />
          <span className="min-w-0 flex-1 truncate text-sm text-fg">
            {file ? file.name : 'Choose a file…'}
          </span>
        </button>

        {file && (
          <div role="radiogroup" aria-label="Import as" className="grid gap-2 sm:grid-cols-2">
            {TARGETS.map(({ id, label, hint, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={target === id}
                onClick={() => setTarget(id)}
                className={cn(
                  'flex flex-col gap-1 rounded-2xl border px-3.5 py-3 text-left transition-colors',
                  target === id
                    ? 'border-[color:var(--accent-from)] ring-2 ring-[var(--accent-from)]'
                    : 'border-[var(--glass-border)] hover:border-[color:var(--accent-from)]',
                )}
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-fg">
                  <Icon size={16} /> {label}
                  {id === 'canvas' && !isPro && <span className="text-xs font-medium text-fg-subtle">Pro</span>}
                </span>
                <span className="text-xs text-fg-muted">{hint}</span>
              </button>
            ))}
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-[var(--danger,#c24a40)]">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <GradientButton variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </GradientButton>
          <GradientButton size="sm" onClick={() => void submit()} isLoading={busy} disabled={!file}>
            Import
          </GradientButton>
        </div>
      </div>
    </Modal>
  );
}
