import { useState } from 'react';
import { Bookmark, BookmarkPlus, FileText, Pencil, Trash2 } from 'lucide-react';
import type { JSONContent } from '@tiptap/core';
import { Modal } from '@/components/Modal';
import { GradientButton } from '@/components/buttons/GradientButton';
import { NameDialog } from '@/features/library/NameDialog';
import { toast } from '@/components/feedback/toast';
import { isEmptyDoc } from './serialize';
import { noteTemplateInputSchema } from './templateSchemas';
import { templateSubtitle } from './templateDoc';
import {
  useCreateNoteTemplate,
  useDeleteNoteTemplate,
  useNoteTemplates,
  useRenameNoteTemplate,
} from './useNoteTemplates';

interface TemplatesMenuProps {
  /** The note's current document, including unsaved edits (may be null/empty). */
  getDoc: () => JSONContent | null;
}

/** One modal is open at a time; `create`/`rename` return to `manager` on close. */
type View = 'closed' | 'manager' | 'create' | { rename: { id: string; title: string } };

/**
 * "Save as template" + a small manager for a note's own custom templates, opened
 * from a bookmark button in the note header. Reuses NameDialog for the name
 * prompt (create + rename) and keeps exactly one modal open at a time so focus
 * traps never fight. Free feature; the saved templates surface in the editor
 * slash menu under "Your templates".
 */
export function TemplatesMenu({ getDoc }: TemplatesMenuProps) {
  const [view, setView] = useState<View>('closed');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const { data: templates } = useNoteTemplates();
  const create = useCreateNoteTemplate();
  const rename = useRenameNoteTemplate();
  const remove = useDeleteNoteTemplate();

  const managerOpen = view === 'manager';
  const creating = view === 'create';
  const renaming = typeof view === 'object' ? view.rename : null;

  function saveTemplate(name: string) {
    const doc = getDoc();
    if (!doc || isEmptyDoc(doc as Record<string, unknown>)) {
      toast.error('Add some content before saving this note as a template.');
      return;
    }
    const parsed = noteTemplateInputSchema.safeParse({
      title: name,
      subtitle: templateSubtitle(doc),
      content_json: doc,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'That note can’t be saved as a template.');
      return;
    }
    create.mutate({
      title: parsed.data.title,
      subtitle: parsed.data.subtitle ?? null,
      icon: null,
      content_json: parsed.data.content_json as Record<string, unknown>,
      tempId: crypto.randomUUID(),
    });
    toast.success('Template saved.');
  }

  function renameTemplate(name: string) {
    if (renaming) rename.mutate({ id: renaming.id, title: name });
  }

  const list = templates ?? [];

  return (
    <>
      <button
        type="button"
        aria-label="Note templates"
        title="Save as template · manage templates"
        onClick={() => setView('manager')}
        className="grid h-9 w-9 place-items-center rounded-xl text-fg-subtle transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
      >
        <Bookmark size={16} />
      </button>

      <Modal
        open={managerOpen}
        onClose={() => {
          setView('closed');
          setConfirmingId(null);
        }}
        title="Note templates"
        className="max-w-md"
      >
        <div className="flex flex-col gap-4">
          <GradientButton type="button" onClick={() => setView('create')} className="self-start">
            <BookmarkPlus size={16} /> Save this note as a template
          </GradientButton>

          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">
              Your templates
            </p>
            {list.length === 0 ? (
              <p className="py-2 text-sm text-fg-subtle">
                No templates yet. Save a note to reuse its structure from the slash menu.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {list.map((template) => (
                  <li
                    key={template.id}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--glass-fill)]"
                  >
                    <FileText size={15} className="shrink-0 text-fg-subtle" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-sm text-fg">{template.title}</span>
                    {confirmingId === template.id ? (
                      <span className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            remove.mutate({ id: template.id });
                            setConfirmingId(null);
                          }}
                          className="rounded-md bg-danger/20 px-2 py-0.5 text-xs font-semibold text-danger hover:bg-danger/30"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingId(null)}
                          className="rounded-md px-2 py-0.5 text-xs font-medium text-fg-muted hover:bg-[var(--glass-fill)]"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <span className="flex shrink-0 items-center">
                        <button
                          type="button"
                          aria-label={`Rename ${template.title}`}
                          onClick={() => setView({ rename: { id: template.id, title: template.title } })}
                          className="grid h-7 w-7 place-items-center rounded-md text-fg-subtle hover:bg-[var(--glass-fill)] hover:text-fg"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${template.title}`}
                          onClick={() => setConfirmingId(template.id)}
                          className="grid h-7 w-7 place-items-center rounded-md text-fg-subtle hover:bg-danger/10 hover:text-danger"
                        >
                          <Trash2 size={14} />
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Modal>

      <NameDialog
        open={creating}
        title="Save as template"
        placeholder="Template name…"
        confirmLabel="Save template"
        onClose={() => setView('manager')}
        onSubmit={saveTemplate}
      />

      <NameDialog
        open={Boolean(renaming)}
        title="Rename template"
        initialValue={renaming?.title ?? ''}
        placeholder="Template name…"
        confirmLabel="Rename"
        onClose={() => setView('manager')}
        onSubmit={renameTemplate}
      />
    </>
  );
}
