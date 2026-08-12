/**
 * storage.ts — tiny client helper for the private `canvas-media` Storage bucket.
 *
 * Validates type + size against the proFeatures caps BEFORE upload and throws a
 * typed `MediaUploadError` the UI can show. The client check is UX (fail fast,
 * friendly message); the REAL gate is the Storage RLS in
 * supabase/migrations/20260622000000_pro_foundation.sql — a free board's uploads
 * are rejected there even if this check is bypassed.
 *
 * Path convention: '<projectId>/<noteId>/<uuid>.<ext>'. The first segment is the
 * projectId the RLS policies parse with split_part(name,'/',1). Objects are
 * private; read them via `signedUrl()`.
 */
import { supabase } from '@/lib/supabase';
import {
  CANVAS_MEDIA_BUCKET,
  CANVAS_MEDIA_QUOTA_BYTES,
  MEDIA_CAPS,
  formatBytes,
  mediaKindForMime,
} from '@/lib/proFeatures';

/** Why a media operation failed — lets the UI branch / show the right message. */
export type MediaUploadErrorCode =
  | 'unsupported-type'
  | 'too-large'
  | 'quota-exceeded'
  | 'upload-failed'
  | 'signed-url-failed';

/** A typed error for canvas-media operations (validation + Storage failures). */
export class MediaUploadError extends Error {
  readonly code: MediaUploadErrorCode;
  constructor(code: MediaUploadErrorCode, message: string) {
    super(message);
    this.name = 'MediaUploadError';
    this.code = code;
  }
}

/** Pull a safe lowercase file extension from a name or MIME subtype. */
function extensionFor(file: File): string {
  const fromName = file.name.includes('.') ? file.name.split('.').pop() : undefined;
  const candidate = (fromName ?? file.type.split('/').pop() ?? 'bin').toLowerCase();
  // Only keep simple alphanumerics so the storage path can't be poisoned.
  const cleaned = candidate.replace(/[^a-z0-9]/g, '');
  return cleaned.length > 0 ? cleaned : 'bin';
}

/**
 * Validate a file against the proFeatures caps. Throws `MediaUploadError` with a
 * user-facing message if the type isn't allowed or the file is too large.
 */
export function validateCanvasMedia(file: File): void {
  const kind = mediaKindForMime(file.type);
  if (!kind) {
    throw new MediaUploadError(
      'unsupported-type',
      `"${file.type || 'this file type'}" isn't supported. Add an image, audio or video file.`,
    );
  }
  const cap = MEDIA_CAPS[kind];
  if (file.size > cap.maxBytes) {
    throw new MediaUploadError(
      'too-large',
      `${cap.label} files must be ${formatBytes(cap.maxBytes)} or smaller (this one is ${formatBytes(
        file.size,
      )}).`,
    );
  }
}

/**
 * Total canvas-media bytes across every project the signed-in user owns. Backed
 * by the `my_canvas_media_usage_bytes()` RPC (supabase/migrations/
 * 20260812010000_canvas_media_caps_and_quota.sql). Used to show a "4.2 GB of
 * 10 GB used" indicator and to fail fast on upload before hitting the network —
 * the REAL quota gate is server-side (`canvas_media_quota_ok()` in Storage RLS).
 */
export async function getCanvasMediaUsageBytes(): Promise<number> {
  const { data, error } = await supabase.rpc('my_canvas_media_usage_bytes');
  if (error) throw error;
  return typeof data === 'number' ? data : Number(data ?? 0);
}

/**
 * Upload a file to the canvas-media bucket and return its storage path. Validates
 * BEFORE hitting the network; surfaces RLS/Storage failures as MediaUploadError.
 */
export async function uploadCanvasMedia(
  projectId: string,
  noteId: string,
  file: File,
): Promise<{ path: string }> {
  validateCanvasMedia(file);

  // Fail fast with a friendly message if this upload would blow the account's
  // total canvas-media quota — a courtesy check only. If it's stale (another
  // upload landed a second ago) or skipped, the Storage RLS still rejects the
  // insert server-side, just with a less specific error.
  try {
    const used = await getCanvasMediaUsageBytes();
    if (used + file.size > CANVAS_MEDIA_QUOTA_BYTES) {
      throw new MediaUploadError(
        'quota-exceeded',
        `You've used ${formatBytes(used)} of your ${formatBytes(CANVAS_MEDIA_QUOTA_BYTES)} canvas media storage. Delete some media to free up space.`,
      );
    }
  } catch (err) {
    if (err instanceof MediaUploadError) throw err;
    // Usage lookup failed for some other reason (network blip, RPC error) —
    // don't block the upload on a courtesy check; the real gate still applies.
  }

  const path = `${projectId}/${noteId}/${crypto.randomUUID()}.${extensionFor(file)}`;
  const { error } = await supabase.storage
    .from(CANVAS_MEDIA_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    throw new MediaUploadError(
      'upload-failed',
      'Upload failed. You may not have permission, your storage quota may be full, or the connection dropped — please try again.',
    );
  }
  return { path };
}

/**
 * Mint a short-lived signed URL for a private canvas-media object.
 * @param expiresIn seconds the URL stays valid (default 1 hour).
 */
export async function signedUrl(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(CANVAS_MEDIA_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    throw new MediaUploadError('signed-url-failed', 'Could not load this media. Please try again.');
  }
  return data.signedUrl;
}
