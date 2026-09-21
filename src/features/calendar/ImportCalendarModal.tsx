import { useRef, useState } from 'react';
import { AlertCircle, CalendarPlus, CheckCircle2, Upload } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { GlassSelect, type GlassSelectOption } from '@/components/forms/GlassSelect';
import { GradientButton } from '@/components/buttons/GradientButton';
import { cn } from '@/lib/cn';
import { useProjectIsPro } from '@/features/collaboration/useProjectIsPro';
import type { Project } from '@/types/database';
import { parseIcs, type ParsedIcs } from './icsParser';
import { useImportIcsEvents } from './useCalendar';

interface ImportCalendarModalProps {
  open: boolean;
  onClose: () => void;
  projects: Project[];
  defaultProjectId: string;
}

const MAX_ICS_BYTES = 10 * 1024 * 1024;

type Step =
  | { kind: 'pick' }
  | { kind: 'preview'; parsed: ParsedIcs }
  | { kind: 'done'; imported: number; notes: string[] };

/**
 * One-time `.ics` → cards import (the Calendar's "Import" button — see
 * CalendarToolbar.tsx). Deliberately the same shape as features/import/
 * ImportModal.tsx (drop/pick → preview with notes → write → done): a
 * snapshot copy into an EXISTING project the user picks, not a new one, and
 * — unlike the calendar-feed export — never a live, ongoing sync. Running it
 * again just creates duplicate cards; there's no de-dupe against a previous
 * import.
 */
export function ImportCalendarModal({ open, onClose, projects, defaultProjectId }: ImportCalendarModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>({ kind: 'pick' });
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const importEvents = useImportIcsEvents();
  const { data: isPro } = useProjectIsPro(projectId || undefined);

  const projectOptions: GlassSelectOption<string>[] = projects.map((project) => ({
    value: project.id,
    label: project.name,
  }));

  function reset(): void {
    setStep({ kind: 'pick' });
    setProjectId(defaultProjectId);
    setError(null);
    setDragOver(false);
  }

  function handleClose(): void {
    if (importEvents.isPending) return; // don't vanish mid-write
    reset();
    onClose();
  }

  async function handleFile(file: File): Promise<void> {
    setError(null);
    if (file.size > MAX_ICS_BYTES) {
      setError('That file is too large (10 MB max).');
      return;
    }
    try {
      const text = await file.text();
      const parsed = parseIcs(text);
      if (parsed.events.length === 0) {
        setError(parsed.notes[0] ?? 'No events found in that file.');
        return;
      }
      setStep({ kind: 'preview', parsed });
    } catch {
      setError('Could not read that file — make sure it is a standard .ics calendar export.');
    }
  }

  function handlePick(fileList: FileList | null): void {
    const file = fileList?.[0];
    if (file) void handleFile(file);
  }

  async function handleImport(): Promise<void> {
    if (step.kind !== 'preview' || !projectId) return;
    const { parsed } = step;
    try {
      const result = await importEvents.mutateAsync({
        projectId,
        events: parsed.events,
        keepRecurrence: Boolean(isPro),
      });
      const notes = [...parsed.notes];
      const recurringCount = parsed.events.filter((event) => event.recurrence).length;
      if (recurringCount > 0 && !isPro) {
        notes.push(
          `${recurringCount} recurring event${recurringCount === 1 ? '' : 's'} came in as one-time cards — repeat schedules need this project on Pro.`,
        );
      }
      setStep({ kind: 'done', imported: result.imported, notes });
    } catch {
      setError('The import failed partway through. Please try again.');
      setStep({ kind: 'preview', parsed });
    }
  }

  const recurringInPreview =
    step.kind === 'preview' ? step.parsed.events.filter((event) => event.recurrence).length : 0;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={step.kind === 'done' ? 'Import complete' : 'Import calendar'}
      description={
        step.kind === 'pick'
          ? 'One-time only: bring events from a .ics file (exported from Google, Outlook, Apple Calendar, etc.) in as cards. Aurora stays disconnected afterward — nothing here stays synced, and importing the same file again creates duplicates.'
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
              dragOver ? 'border-[var(--accent-from)] bg-[var(--glass-fill)]' : 'border-[var(--glass-border)]',
            )}
          >
            <span
              className="grid h-12 w-12 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)]"
              aria-hidden
            >
              <Upload size={22} />
            </span>
            <div>
              <p className="font-display text-sm font-semibold text-fg">Drop a .ics file, or browse</p>
              <p className="mt-1 text-xs text-fg-subtle">
                Exported from Google Calendar, Outlook, Apple Calendar, or any app that supports iCalendar.
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
              accept=".ics,text/calendar"
              className="hidden"
              onChange={(event) => handlePick(event.target.files)}
            />
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
          {projectOptions.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-fg-muted">Import into</span>
              <GlassSelect label="Project" value={projectId} onChange={setProjectId} options={projectOptions} />
            </div>
          ) : (
            <p className="text-sm text-fg-muted">Create a project first, then events can be imported here.</p>
          )}

          <GlassPanel className="flex items-center gap-3 p-4">
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--glass-fill)] text-[color:var(--accent-from)]"
              aria-hidden
            >
              <CalendarPlus size={18} />
            </span>
            <p className="text-sm font-medium text-fg">
              {step.parsed.events.length} event{step.parsed.events.length === 1 ? '' : 's'} found
              {recurringInPreview > 0 &&
                ` (${recurringInPreview} repeating${!isPro ? ' — needs Pro to keep repeating' : ''})`}
            </p>
          </GlassPanel>

          {step.parsed.notes.length > 0 && <NoteList title="What won't come along" notes={step.parsed.notes} />}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-2xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger"
            >
              <AlertCircle size={18} className="mt-px shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-1 flex justify-end gap-2.5">
            <GradientButton type="button" variant="ghost" onClick={() => setStep({ kind: 'pick' })}>
              Back
            </GradientButton>
            <GradientButton
              type="button"
              onClick={() => void handleImport()}
              disabled={!projectId}
              isLoading={importEvents.isPending}
            >
              Import
            </GradientButton>
          </div>
        </div>
      )}

      {step.kind === 'done' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
            <CheckCircle2 size={20} className="shrink-0 text-emerald-500" aria-hidden />
            <p className="text-sm text-fg">
              Imported {step.imported} event{step.imported === 1 ? '' : 's'} as cards.
            </p>
          </div>

          {step.notes.length > 0 && <NoteList title="Heads up" notes={step.notes} />}

          <p className="text-xs text-fg-subtle">
            This was a one-time copy — Aurora isn&apos;t connected to the source calendar, so nothing here
            will sync or update later.
          </p>

          <div className="mt-1 flex justify-end">
            <GradientButton type="button" onClick={handleClose}>
              Close
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
