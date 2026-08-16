import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, FileJson, FileSpreadsheet, Upload } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { Field } from '@/components/forms/Field';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { GradientButton } from '@/components/buttons/GradientButton';
import { toast } from '@/components/feedback/toast';
import { cn } from '@/lib/cn';
import { track } from '@/lib/analytics';
import { useCreateProject } from '@/features/projects/useProjects';
import { ImportParseError } from './errors';
import { parseTrelloExport } from './trelloParser';
import { parseCsvImport } from './csvParser';
import { runImport, type ImportProgress } from './runImport';
import { IMPORT_MAX_FILE_BYTES, type ImportPayload } from './schemas';

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
}

type ImportSource = 'trello' | 'csv';

type Step =
  | { kind: 'pick' }
  | {
      kind: 'preview';
      payload: ImportPayload;
      notes: string[];
      source: ImportSource;
    }
  | { kind: 'importing'; progress: ImportProgress }
  | {
      kind: 'done';
      projectId: string;
      projectName: string;
      result: { columns: number; cards: number };
      notes: string[];
    };

/**
 * One-time Trello board JSON / CSV → Aurora project import (see the task
 * brief). This ALWAYS creates a brand-new project from a snapshot of the file
 * at import time — there is no ongoing sync back to Trello and no
 * re-import/diff against an existing project. Running it again just makes
 * another new project; it never touches or updates a previous import. The UI
 * copy below says so explicitly so it's never mistaken for a live
 * integration.
 */
export function ImportModal({ open, onClose }: ImportModalProps) {
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>({ kind: 'pick' });
  const [projectName, setProjectName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function reset(): void {
    setStep({ kind: 'pick' });
    setProjectName('');
    setError(null);
    setDragOver(false);
  }

  function handleClose(): void {
    if (step.kind === 'importing') return; // don't vanish mid-write
    reset();
    onClose();
  }

  async function handleFile(file: File): Promise<void> {
    setError(null);
    if (file.size > IMPORT_MAX_FILE_BYTES) {
      setError('That file is too large (25 MB max).');
      return;
    }
    const isJson = file.name.toLowerCase().endsWith('.json');
    try {
      const text = await file.text();
      const { payload, notes } = isJson
        ? parseTrelloExport(JSON.parse(text))
        : parseCsvImport(text);
      setProjectName(payload.projectName);
      setStep({
        kind: 'preview',
        payload,
        notes,
        source: isJson ? 'trello' : 'csv',
      });
    } catch (caught) {
      if (caught instanceof ImportParseError) {
        setError(caught.message);
      } else if (isJson) {
        setError('That file is not valid JSON. Re-export it from Trello, or use a CSV instead.');
      } else {
        setError('Could not read that file. Please try again.');
      }
    }
  }

  function handlePick(fileList: FileList | null): void {
    const file = fileList?.[0];
    if (file) void handleFile(file);
  }

  async function handleImport(): Promise<void> {
    if (step.kind !== 'preview') return;
    const { payload, notes, source } = step;
    const name = projectName.trim() || 'Imported board';
    setStep({
      kind: 'importing',
      progress: { fraction: 0, label: 'Creating project…' },
    });

    let project: { id: string };
    try {
      project = await createProject.mutateAsync({
        name,
        description: '',
        accent: 'aurora',
        targetDate: null,
      });
    } catch {
      toast.error('Could not create the project. Please try again.');
      setStep({ kind: 'preview', payload, notes, source });
      return;
    }

    try {
      const result = await runImport(project.id, payload, (progress) =>
        setStep((current) =>
          current.kind === 'importing' ? { kind: 'importing', progress } : current,
        ),
      );
      track('import_completed', { source, card_count: result.cards });
      setStep({
        kind: 'done',
        projectId: project.id,
        projectName: name,
        result: { columns: result.columns, cards: result.cards },
        notes,
      });
    } catch {
      // The project exists either way — don't offer "try again" (which would
      // create a second, duplicate project). Send them into the project
      // itself to see what made it in, same fallback ImportModal's sibling
      // TemplatePickerModal.tsx uses for a partial instantiateTemplate failure.
      toast.error('The import stopped partway through. Open the project to see what made it in.');
      setStep({
        kind: 'done',
        projectId: project.id,
        projectName: name,
        result: { columns: 0, cards: 0 },
        notes: [
          ...notes,
          'The import stopped partway through — some columns or cards may be missing.',
        ],
      });
    }
  }

  const totalCards =
    step.kind === 'preview'
      ? step.payload.columns.reduce((sum, column) => sum + column.cards.length, 0)
      : 0;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={step.kind === 'done' ? 'Import complete' : 'Import from Trello or CSV'}
      description={
        step.kind === 'pick'
          ? "One-time only: this creates a brand-new project from the file, right now. Aurora won't stay connected to Trello — nothing here syncs or updates later, and importing again just makes another new project."
          : undefined
      }
      className="max-w-xl"
    >
      {step.kind === 'pick' && (
        <div className="flex flex-col gap-4">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              handlePick(event.dataTransfer.files);
            }}
            className={cn(
              'flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-colors',
              dragOver
                ? 'border-[var(--accent-from)] bg-[var(--glass-fill)]'
                : 'border-[var(--glass-border)]',
            )}
          >
            <span
              className="grid h-12 w-12 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)]"
              aria-hidden
            >
              <Upload size={22} />
            </span>
            <div>
              <p className="font-display text-sm font-semibold text-fg">Drop a file, or browse</p>
              <p className="mt-1 text-xs text-fg-subtle">
                A Trello board export (.json) or a CSV with List, Card Title, Description, Due Date,
                Labels
              </p>
            </div>
            <GradientButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose file
            </GradientButton>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.csv,application/json,text/csv"
              className="hidden"
              onChange={(event) => handlePick(event.target.files)}
            />
          </div>

          <div className="flex items-start gap-2 text-xs text-fg-subtle">
            <FileJson size={14} className="mt-0.5 shrink-0" aria-hidden />
            <span>Trello: Menu → Print, export, and share → Export as JSON.</span>
          </div>
          <div className="flex items-start gap-2 text-xs text-fg-subtle">
            <FileSpreadsheet size={14} className="mt-0.5 shrink-0" aria-hidden />
            <span>CSV: one row per card — List names the column it lands in.</span>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-2xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger"
            >
              <AlertCircle size={18} className="mt-px shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}

      {step.kind === 'preview' && (
        <div className="flex flex-col gap-4">
          <Field
            label="Project name"
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            maxLength={80}
            autoFocus
          />

          <GlassPanel className="flex flex-col gap-2 p-4">
            <p className="text-sm font-medium text-fg">
              {step.payload.columns.length} column
              {step.payload.columns.length === 1 ? '' : 's'} · {totalCards} card
              {totalCards === 1 ? '' : 's'}
            </p>
            <div className="flex flex-wrap gap-2">
              {step.payload.columns.map((column, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--glass-border)] bg-[var(--glass-fill)] px-3 py-1 text-xs font-medium text-fg-muted"
                >
                  {column.name}
                  <span className="rounded-full bg-[var(--glass-fill-strong)] px-1.5 py-px text-[0.7rem] text-fg-subtle">
                    {column.cards.length}
                  </span>
                </span>
              ))}
            </div>
          </GlassPanel>

          {step.notes.length > 0 && <NoteList title="What won't come along" notes={step.notes} />}

          <div className="mt-1 flex justify-end gap-2.5">
            <GradientButton type="button" variant="ghost" onClick={() => setStep({ kind: 'pick' })}>
              Back
            </GradientButton>
            <GradientButton
              type="button"
              onClick={() => void handleImport()}
              disabled={!projectName.trim()}
            >
              Import
            </GradientButton>
          </div>
        </div>
      )}

      {step.kind === 'importing' && (
        <div className="flex flex-col items-center gap-4 py-6">
          <div
            role="progressbar"
            aria-valuenow={Math.round(step.progress.fraction * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-2 w-full overflow-hidden rounded-full bg-[var(--glass-fill)]"
          >
            <div
              className="h-full rounded-full bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] transition-[width] duration-300 ease-out"
              style={{ width: `${Math.round(step.progress.fraction * 100)}%` }}
            />
          </div>
          <p className="text-sm text-fg-muted">{step.progress.label}</p>
        </div>
      )}

      {step.kind === 'done' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
            <CheckCircle2 size={20} className="shrink-0 text-emerald-500" aria-hidden />
            <p className="text-sm text-fg">
              Imported {step.result.cards} card
              {step.result.cards === 1 ? '' : 's'} into <strong>{step.projectName}</strong> across{' '}
              {step.result.columns} column
              {step.result.columns === 1 ? '' : 's'}.
            </p>
          </div>

          {step.notes.length > 0 && <NoteList title="Skipped during import" notes={step.notes} />}

          <p className="text-xs text-fg-subtle">
            This was a one-time copy — Aurora isn&apos;t connected to Trello, so nothing here will
            sync or update later.
          </p>

          <div className="mt-1 flex justify-end gap-2.5">
            <GradientButton type="button" variant="ghost" onClick={handleClose}>
              Close
            </GradientButton>
            <GradientButton
              type="button"
              onClick={() => {
                const projectId = step.projectId;
                handleClose();
                void navigate(`/projects/${projectId}`);
              }}
            >
              Open project
            </GradientButton>
          </div>
        </div>
      )}
    </Modal>
  );
}

function NoteList({ title, notes }: { title: string; notes: string[] }) {
  return (
    <GlassPanel className="flex flex-col gap-1.5 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">{title}</p>
      <ul className="flex flex-col gap-1 text-xs text-fg-subtle">
        {notes.map((note, index) => (
          <li key={index}>• {note}</li>
        ))}
      </ul>
    </GlassPanel>
  );
}
