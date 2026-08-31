/**
 * cardAttachments.ts — client helper for the private `card-attachments`
 * Storage bucket (file attachments on Kanban cards). Mirrors
 * features/notes/noteMedia.ts and lib/storage.ts, but for card-keyed paths
 * (`<cardId>/<uuid>.<ext>`) and ANY file type (not just images) — a generic
 * attachment, not curated media, so only size is capped, not MIME type.
 *
 * Validates size BEFORE upload and throws a typed MediaUploadError (reused
 * from lib/storage.ts) the UI can show. The client check is UX only — the
 * REAL gate is the Storage RLS in
 * supabase/migrations/20260816160000_card_attachments.sql, which also
 * requires editor/owner role, not just membership.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { MediaUploadError } from '@/lib/storage';

const CARD_ATTACHMENTS_BUCKET = 'card-attachments';

/** Per-file cap — keep in sync with the 25 MB check in
 *  20260816160000_card_attachments.sql (both the bucket's file_size_limit
 *  and card_attachment_within_cap). */
export const CARD_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;

export function formatAttachmentBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
}

function extensionFor(file: File): string {
  const fromName = file.name.includes('.') ? file.name.split('.').pop() : undefined;
  const candidate = (fromName ?? file.type.split('/').pop() ?? 'bin').toLowerCase();
  // Only keep simple alphanumerics so the storage path can't be poisoned.
  const cleaned = candidate.replace(/[^a-z0-9]/g, '');
  return cleaned.length > 0 ? cleaned : 'bin';
}

/** Validate a file against the per-file size cap. Throws MediaUploadError if
 *  it's too large. */
export function validateCardAttachment(file: File): void {
  if (file.size > CARD_ATTACHMENT_MAX_BYTES) {
    throw new MediaUploadError(
      'too-large',
      `Attachments must be ${formatAttachmentBytes(CARD_ATTACHMENT_MAX_BYTES)} or smaller (this one is ${formatAttachmentBytes(file.size)}).`,
    );
  }
}

/** Upload a file to the card-attachments bucket and return its storage path.
 *  Validates BEFORE hitting the network; surfaces RLS/Storage failures as
 *  MediaUploadError. */
export async function uploadCardAttachment(
  cardId: string,
  file: File,
): Promise<{ path: string }> {
  validateCardAttachment(file);

  const path = `${cardId}/${crypto.randomUUID()}.${extensionFor(file)}`;
  const { error } = await supabase.storage
    .from(CARD_ATTACHMENTS_BUCKET)
    .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });

  if (error) {
    throw new MediaUploadError(
      'upload-failed',
      'Upload failed. You may not have permission to add attachments, or the connection dropped — please try again.',
    );
  }
  return { path };
}

export async function deleteCardAttachmentObject(path: string): Promise<void> {
  const { error } = await supabase.storage.from(CARD_ATTACHMENTS_BUCKET).remove([path]);
  if (error) throw error;
}

async function cardAttachmentSignedUrl(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(CARD_ATTACHMENTS_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) {
    throw new MediaUploadError('signed-url-failed', 'Could not load this attachment.');
  }
  return data.signedUrl;
}

// Module-level cache so signed URLs survive re-renders (same pattern as
// noteMedia.ts's cachedSignedUrl).
const urlCache = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();

function cachedSignedUrl(path: string): Promise<string> {
  const cached = urlCache.get(path);
  if (cached) return Promise.resolve(cached);
  const existing = inFlight.get(path);
  if (existing) return existing;
  const promise = cardAttachmentSignedUrl(path)
    .then((url) => {
      urlCache.set(path, url);
      inFlight.delete(path);
      return url;
    })
    .catch((err: unknown) => {
      inFlight.delete(path);
      throw err;
    });
  inFlight.set(path, promise);
  return promise;
}

export interface AttachmentUrlState {
  url: string | null;
  loading: boolean;
  error: boolean;
}

/** Resolve a card-attachments storage path to a cached signed URL — used for
 *  both image thumbnails and the download link. */
export function useAttachmentUrl(path: string | null): AttachmentUrlState {
  const [url, setUrl] = useState<string | null>(() => (path ? (urlCache.get(path) ?? null) : null));
  const [loading, setLoading] = useState<boolean>(path !== null && !urlCache.has(path));
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    // Kicking off an async fetch is a real side effect, and resetting
    // `loading` here (rather than only in the initializer) is what makes a
    // *changed* `path` show a fresh loading state instead of stale data
    // from the previous path while the new signed URL resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(!urlCache.has(path));
    cachedSignedUrl(path)
      .then((u) => {
        if (cancelled) return;
        setUrl(u);
        setError(false);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return { url, loading, error };
}
