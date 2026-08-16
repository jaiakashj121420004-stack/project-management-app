import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { AlertCircle, Download, File as FileIcon, ImageOff, Paperclip, Trash2, Upload } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { track } from '@/lib/analytics';
import { MediaUploadError } from '@/lib/storage';
import type { CardAttachment } from '@/types/database';
import {
  CARD_ATTACHMENT_MAX_BYTES,
  formatAttachmentBytes,
  useAttachmentUrl,
  validateCardAttachment,
} from './cardAttachments';
import { useAddAttachment, useDeleteAttachment } from './useCardExtras';

interface AttachmentsSectionProps {
  projectId: string;
  cardId: string;
  attachments: CardAttachment[];
  /** Owners/editors get upload + a full delete affordance (any attachment);
   *  viewers get a read-only list — see CardDetailModal. */
  canEdit: boolean;
}

/**
 * The "Attachments" section inside a card (IMPROVEMENT-PLAN task, plan.md §5):
 * file-picker (+ drag-drop) upload, a thumbnail preview for images and a
 * generic file icon + name/size for everything else, download via a signed
 * URL, and delete. Mirrors Checklist/TimeTracking's placement, styling, and
 * useCardExtras' optimistic-cache pattern. Upload requires editor/owner
 * (canEdit); delete is additionally allowed for the uploader even if they're
 * since been demoted to viewer — but the read-only card view (canEdit=false)
 * doesn't render any destructive actions, matching the rest of that view, so
 * that edge case only matters at the RLS layer.
 */
export function AttachmentsSection({
  projectId,
  cardId,
  attachments,
  canEdit,
}: AttachmentsSectionProps) {
  const { user } = useAuth();
  const addAttachment = useAddAttachment(projectId);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const sorted = [...attachments].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file || !user) return;
    setError(null);
    try {
      validateCardAttachment(file);
    } catch (err) {
      setError(err instanceof MediaUploadError ? err.message : "That file can't be used.");
      return;
    }
    addAttachment.mutate(
      { cardId, uploaderId: user.id, file, tempId: crypto.randomUUID() },
      {
        onSuccess: () => {
          track('attachment_uploaded', {
            project_id: projectId,
            mime_type: file.type || 'application/octet-stream',
            size_bytes: file.size,
          });
        },
        onError: () => setError('Upload failed. Please try again.'),
      },
    );
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    handleFiles(event.target.files);
    event.target.value = '';
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragging(false);
    handleFiles(event.dataTransfer.files);
  }

  return (
    <section aria-label="Attachments" className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
          <Paperclip size={16} aria-hidden /> Attachments
        </h3>
        {sorted.length > 0 && (
          <span className="text-xs font-medium text-fg-muted">{sorted.length}</span>
        )}
      </div>

      {sorted.length > 0 && (
        <ul className="flex flex-col gap-2">
          {sorted.map((attachment) => (
            <AttachmentRow
              key={attachment.id}
              attachment={attachment}
              projectId={projectId}
              canDelete={canEdit}
            />
          ))}
        </ul>
      )}

      {canEdit && (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            disabled={addAttachment.isPending}
            className={`grid w-full place-items-center gap-1.5 rounded-2xl border border-dashed px-4 py-6 text-center text-sm transition-colors ${
              isDragging
                ? 'border-[var(--accent-from)] bg-[var(--glass-fill)] text-fg'
                : 'border-[var(--glass-border)] bg-[var(--glass-fill)] text-fg-muted hover:border-[var(--accent-from)] hover:text-fg'
            }`}
          >
            <Upload size={18} aria-hidden />
            <span className="font-medium">
              {addAttachment.isPending ? 'Uploading…' : 'Add a file, or drag one here'}
            </span>
            <span className="text-xs text-fg-subtle">
              Up to {formatAttachmentBytes(CARD_ATTACHMENT_MAX_BYTES)}
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            aria-hidden
            tabIndex={-1}
            onChange={handleChange}
          />
        </>
      )}

      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-xs text-danger">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
    </section>
  );
}

function AttachmentRow({
  attachment,
  projectId,
  canDelete,
}: {
  attachment: CardAttachment;
  projectId: string;
  canDelete: boolean;
}) {
  const deleteAttachment = useDeleteAttachment(projectId);
  const isImage = attachment.mime_type.startsWith('image/');
  // Real (uploaded) attachments have a storage_path; the optimistic placeholder
  // shown while an upload is in flight doesn't yet, so skip resolving a URL.
  const { url, loading, error: urlError } = useAttachmentUrl(
    attachment.storage_path || null,
  );

  return (
    <li className="flex items-center gap-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-fill)] px-3 py-2">
      <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-[var(--field-bg)]">
        {isImage && url ? (
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : isImage && urlError ? (
          <ImageOff size={16} className="text-fg-subtle" aria-hidden />
        ) : (
          <FileIcon size={16} className="text-fg-subtle" aria-hidden />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-fg">{attachment.file_name}</span>
        <span className="text-xs text-fg-subtle">
          {formatAttachmentBytes(attachment.size_bytes)}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <a
          href={url ?? undefined}
          download={attachment.file_name}
          target="_blank"
          rel="noreferrer"
          aria-label={`Download ${attachment.file_name}`}
          aria-disabled={!url}
          className={`grid h-8 w-8 place-items-center rounded-lg text-fg-muted transition-colors hover:bg-[var(--field-bg)] hover:text-fg ${
            !url ? 'pointer-events-none opacity-40' : ''
          }`}
        >
          <Download size={15} aria-hidden />
        </a>
        {canDelete && (
          <button
            type="button"
            onClick={() => deleteAttachment.mutate({ attachment })}
            disabled={deleteAttachment.isPending || loading}
            aria-label={`Delete ${attachment.file_name}`}
            className="grid h-8 w-8 place-items-center rounded-lg text-fg-muted transition-colors hover:bg-danger/10 hover:text-danger"
          >
            <Trash2 size={15} aria-hidden />
          </button>
        )}
      </div>
    </li>
  );
}
