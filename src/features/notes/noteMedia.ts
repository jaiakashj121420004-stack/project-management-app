/**
 * noteMedia.ts — client helper for the private `note-media` Storage bucket
 * (images in notes). Mirrors lib/storage.ts but for note-keyed paths
 * (`<noteId>/<uuid>.<ext>`) and image-only validation. Objects are private; read
 * them via short-lived signed URLs (useNoteMediaUrl). The real gate is the
 * Storage RLS in 20260714180000_note_media.sql.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { MEDIA_CAPS, formatBytes, mediaKindForMime } from '@/lib/proFeatures';
import { MediaUploadError } from '@/lib/storage';

const NOTE_MEDIA_BUCKET = 'note-media';

function extensionFor(file: File): string {
  const fromName = file.name.includes('.') ? file.name.split('.').pop() : undefined;
  const candidate = (fromName ?? file.type.split('/').pop() ?? 'bin').toLowerCase();
  const cleaned = candidate.replace(/[^a-z0-9]/g, '');
  return cleaned.length > 0 ? cleaned : 'bin';
}

/** Validate + upload an IMAGE to note-media; returns its storage path. */
export async function uploadNoteImage(noteId: string, file: File): Promise<{ path: string }> {
  if (mediaKindForMime(file.type) !== 'image') {
    throw new MediaUploadError(
      'unsupported-type',
      'Please choose an image (PNG, JPEG, GIF or WebP).',
    );
  }
  const cap = MEDIA_CAPS.image;
  if (file.size > cap.maxBytes) {
    throw new MediaUploadError(
      'too-large',
      `Images must be ${formatBytes(cap.maxBytes)} or smaller (this one is ${formatBytes(file.size)}).`,
    );
  }

  const path = `${noteId}/${crypto.randomUUID()}.${extensionFor(file)}`;
  const { error } = await supabase.storage
    .from(NOTE_MEDIA_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) {
    throw new MediaUploadError('upload-failed', 'Upload failed — please try again.');
  }
  return { path };
}

async function noteMediaSignedUrl(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(NOTE_MEDIA_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) {
    throw new MediaUploadError('signed-url-failed', 'Could not load this image.');
  }
  return data.signedUrl;
}

// Module-level cache so signed URLs survive re-renders / node re-mounts.
const urlCache = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();

function cachedSignedUrl(path: string): Promise<string> {
  const cached = urlCache.get(path);
  if (cached) return Promise.resolve(cached);
  const existing = inFlight.get(path);
  if (existing) return existing;
  const promise = noteMediaSignedUrl(path)
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

export interface NoteMediaUrlState {
  url: string | null;
  loading: boolean;
  error: boolean;
}

/** Resolve a note-media storage path to a cached signed URL. */
export function useNoteMediaUrl(path: string | null): NoteMediaUrlState {
  const [url, setUrl] = useState<string | null>(() => (path ? (urlCache.get(path) ?? null) : null));
  const [loading, setLoading] = useState<boolean>(path !== null && !urlCache.has(path));
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
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
