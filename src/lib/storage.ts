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
  MEDIA_CAPS,
  formatBytes,
  mediaKindForMime,
} from '@/lib/proFeatures';

/** Why a media operation failed — lets the UI branch / show the right message. */
export type MediaUploadErrorCode =
  | 'unsupported-type'
  | 'too-large'
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
 * Upload a file to the canvas-media bucket and return its storage path. Validates
 * BEFORE hitting the network; surfaces RLS/Storage failures as MediaUploadError.
 */
export async function uploadCanvasMedia(
  projectId: string,
  noteId: string,
  file: File,
): Promise<{ path: string }> {
  validateCanvasMedia(file);

  const path = `${projectId}/${noteId}/${crypto.randomUUID()}.${extensionFor(file)}`;
  const { error } = await supabase.storage
    .from(CANVAS_MEDIA_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    throw new MediaUploadError(
      'upload-failed',
      'Upload failed. You may not have permission, or the connection dropped — please try again.',
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
