import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileStack, LayoutGrid, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { GradientButton } from '@/components/buttons/GradientButton';
import { NameDialog } from '@/features/library/NameDialog';
import { toast } from '@/components/feedback/toast';
import type { ProjectTemplateRow } from '@/types/database';
import { useCreateProject } from './useProjects';
import {
  useDeleteProjectTemplate,
  useProjectTemplates,
  useUpdateProjectTemplateMeta,
} from './useProjectTemplates';
import { PROJECT_TEMPLATES } from './projectTemplates';
import { parseTemplatePayload, type ProjectTemplatePayload } from './templateSchemas';
import { instantiateProjectTemplate } from './instantiateTemplate';

interface TemplatePickerModalProps {
  open: boolean;
  onClose: () => void;
  /** "Blank project" was chosen — the caller opens the existing name/accent
   *  form (ProjectFormModal) itself; this component never collects a name. */
  onBlank: () => void;
  /** Threaded through from the Calendar's "?new=1&date=…" quick-create so a
   *  template-created project still lands on the right day. */
  presetTargetDate?: string | null;
}

type Selected =
  | { kind: 'system'; id: string; name: string; description: string; payload: ProjectTemplatePayload }
  | { kind: 'user'; id: string; name: string; description: string; payload: ProjectTemplatePayload };

type View = 'grid' | { preview: Selected };

/**
 * "New project" flow, step one: a curated grid (Simplicity Guardrail #3 —
 * zero-config starter templates beat a blank canvas) with "Blank project"
 * always first and always the implicit default — nothing here ever blocks
 * creating an empty project. Picking a template shows a lightweight preview
 * (its columns + starter card count) before committing; "Use this template"
 * creates the project and seeds it in one step, no separate naming form —
 * the project is named after the template and instantly opens, matching the
 * task's "instantiates instantly … into the new board."
 */
export function TemplatePickerModal({
  open,
  onClose,
  onBlank,
  presetTargetDate = null,
}: TemplatePickerModalProps) {
  const navigate = useNavigate();
  const { data: userTemplateRows } = useProjectTemplates();
  const createProject = useCreateProject();
  const updateMeta = useUpdateProjectTemplateMeta();
  const deleteTemplate = useDeleteProjectTemplate();

  const [view, setView] = useState<View>('grid');
  const [renaming, setRenaming] = useState<ProjectTemplateRow | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const userTemplates = (userTemplateRows ?? [])
    .map((row) => {
      const payload = parseTemplatePayload(row.payload);
      return payload ? { row, payload } : null;
    })
    .filter((entry): entry is { row: ProjectTemplateRow; payload: ProjectTemplatePayload } =>
      Boolean(entry),
    );

  function reset() {
    setView('grid');
    setRenaming(null);
    setConfirmDeleteId(null);
  }

  function handleClose() {
    if (creating) return; // a create-in-flight shouldn't vanish mid-way
    reset();
    onClose();
  }

  // Named createFromTemplate, not useTemplate — a `use`-prefixed name here
  // would look like a React Hook to both readers and eslint-plugin-react-hooks
  // (it's a plain async event handler, not a hook).
  async function createFromTemplate(selected: Selected) {
    setCreating(true);
    try {
      const project = await createProject.mutateAsync({
        name: selected.name,
        description: '',
        accent: 'aurora',
        targetDate: presetTargetDate,
      });
      try {
        await instantiateProjectTemplate(project.id, selected.payload);
      } catch {
        toast.error('The project was created, but some starter content could not be added.');
      }
      reset();
      onClose();
      void navigate(`/projects/${project.id}`);
    } catch {
      toast.error('Could not create that project. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  const totalCards = (payload: ProjectTemplatePayload) =>
    payload.columns.reduce((sum, column) => sum + column.cards.length, 0);

  const preview = typeof view === 'object' ? view.preview : null;

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title={preview ? preview.name : 'New project'}
        description={
          preview ? undefined : 'Start from a blank board, or a curated starting point.'
        }
        className="max-w-2xl"
      >
        {preview ? (
          <div className="flex flex-col gap-5">
            <button
              type="button"
              onClick={() => setView('grid')}
              disabled={creating}
              className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-fg-muted transition-colors hover:text-fg disabled:opacity-50"
            >
              <ArrowLeft size={15} /> Back to templates
            </button>

            {preview.description && <p className="text-sm text-fg-muted">{preview.description}</p>}

            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">
                {preview.payload.columns.length} column
                {preview.payload.columns.length === 1 ? '' : 's'} · {totalCards(preview.payload)}{' '}
                starter card
                {totalCards(preview.payload) === 1 ? '' : 's'}
              </p>
              <div className="flex flex-wrap gap-2">
                {preview.payload.columns.map((column, index) => (
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
            </div>

            <div className="mt-1 flex justify-end gap-2.5">
              <GradientButton
                type="button"
                variant="ghost"
                onClick={() => setView('grid')}
                disabled={creating}
              >
                Back
              </GradientButton>
              <GradientButton
                type="button"
                onClick={() => void createFromTemplate(preview)}
                isLoading={creating}
              >
                Use this template
              </GradientButton>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <button
              type="button"
              onClick={onBlank}
              className="btn-3d-soft glass-strong flex items-center gap-3 rounded-2xl p-4 text-left transition-transform hover:-translate-y-0.5"
            >
              <span
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)]"
                aria-hidden
              >
                <Plus size={20} />
              </span>
              <span>
                <p className="font-display text-sm font-semibold text-fg">Blank project</p>
                <p className="mt-0.5 text-xs text-fg-subtle">Start from an empty board.</p>
              </span>
            </button>

            <section className="flex flex-col gap-2.5">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
                <Sparkles size={13} aria-hidden /> Templates
              </h3>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {PROJECT_TEMPLATES.map((template) => (
                  <TemplateTile
                    key={template.id}
                    icon={<template.icon size={18} />}
                    name={template.name}
                    description={template.description}
                    onClick={() =>
                      setView({
                        preview: {
                          kind: 'system',
                          id: template.id,
                          name: template.name,
                          description: template.description,
                          payload: template.payload,
                        },
                      })
                    }
                  />
                ))}
              </div>
            </section>

            {userTemplates.length > 0 && (
              <section className="flex flex-col gap-2.5">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
                  <FileStack size={13} aria-hidden /> My templates
                </h3>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {userTemplates.map(({ row, payload }) => (
                    <TemplateTile
                      key={row.id}
                      icon={row.icon ? <span className="text-lg leading-none">{row.icon}</span> : <LayoutGrid size={18} />}
                      name={row.name}
                      description={row.description ?? 'Your saved template'}
                      onClick={() =>
                        setView({
                          preview: {
                            kind: 'user',
                            id: row.id,
                            name: row.name,
                            description: row.description ?? '',
                            payload,
                          },
                        })
                      }
                      confirmingDelete={confirmDeleteId === row.id}
                      onRename={() => setRenaming(row)}
                      onDelete={() => setConfirmDeleteId(row.id)}
                      onConfirmDelete={() => {
                        deleteTemplate.mutate({ id: row.id });
                        setConfirmDeleteId(null);
                      }}
                      onCancelDelete={() => setConfirmDeleteId(null)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </Modal>

      <NameDialog
        open={Boolean(renaming)}
        title="Rename template"
        initialValue={renaming?.name ?? ''}
        placeholder="Template name…"
        confirmLabel="Rename"
        maxLength={80}
        onClose={() => setRenaming(null)}
        onSubmit={(name) => {
          if (!renaming) return;
          updateMeta.mutate({
            id: renaming.id,
            name,
            description: renaming.description,
            icon: renaming.icon,
          });
        }}
      />
    </>
  );
}

function TemplateTile({
  icon,
  name,
  description,
  onClick,
  confirmingDelete,
  onRename,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  icon: ReactNode;
  name: string;
  description: string;
  onClick: () => void;
  confirmingDelete?: boolean;
  onRename?: () => void;
  onDelete?: () => void;
  onConfirmDelete?: () => void;
  onCancelDelete?: () => void;
}) {
  const editable = Boolean(onRename && onDelete);

  return (
    <GlassPanel accent="aurora" className="group relative flex flex-col p-3.5">
      <button
        type="button"
        onClick={onClick}
        className="flex flex-1 flex-col items-start gap-2 text-left"
      >
        <span
          className="grid h-9 w-9 place-items-center rounded-xl bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)]"
          aria-hidden
        >
          {icon}
        </span>
        <span>
          <p className="font-display text-[0.85rem] font-semibold leading-tight text-fg">{name}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-fg-subtle">{description}</p>
        </span>
      </button>

      {editable && !confirmingDelete && (
        <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <button
            type="button"
            aria-label={`Rename ${name}`}
            onClick={onRename}
            className="grid h-7 w-7 place-items-center rounded-lg text-fg-subtle hover:bg-[var(--glass-fill)] hover:text-fg"
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            aria-label={`Delete ${name}`}
            onClick={onDelete}
            className="grid h-7 w-7 place-items-center rounded-lg text-fg-subtle hover:bg-danger/10 hover:text-danger"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}

      {confirmingDelete && (
        <div className="glass-strong absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl p-2 text-center">
          <p className="text-xs font-medium text-fg">Delete this template?</p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onConfirmDelete}
              className="rounded-md bg-danger/20 px-2 py-1 text-xs font-semibold text-danger hover:bg-danger/30"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              className="rounded-md px-2 py-1 text-xs font-medium text-fg-muted hover:bg-[var(--glass-fill)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </GlassPanel>
  );
}
