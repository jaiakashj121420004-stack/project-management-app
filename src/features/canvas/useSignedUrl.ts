/**
 * useSignedUrl — resolve a private `canvas-media` storage path to a short-lived
 * signed URL, shared by the Konva image renderer and the HTML media overlay.
 *
 * The cache is module-level so signed URLs survive re-renders and component
 * remounts. URLs are valid for 1 hour (the storage helper default); we don't
 * expire them within a session — the worst case is a stale URL after 1h and a
 * page reload. `inFlight` dedupes concurrent fetches for the same path.
 */
import { useEffect, useState } from 'react';
import { signedUrl } from '@/lib/storage';

const urlCache = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();

function fetchCachedSignedUrl(path: string): Promise<string> {
  const cached = urlCache.get(path);
  if (cached) return Promise.resolve(cached);
  const existing = inFlight.get(path);
  if (existing) return existing;
  const promise = signedUrl(path)
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

export interface SignedUrlState {
  url: string | null;
  loading: boolean;
  error: boolean;
}

/** Resolves a canvas-media storage path to a signed URL and caches it. */
export function useSignedUrl(path: string | null): SignedUrlState {
  const [url, setUrl] = useState<string | null>(() =>
    path ? (urlCache.get(path) ?? null) : null,
  );
  const [loading, setLoading] = useState<boolean>(path !== null && !urlCache.has(path));
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    // All state updates happen in the (micro)task callbacks below, never
    // synchronously in the effect body — a cache hit resolves immediately via
    // Promise.resolve, so this still paints the cached URL on the next tick.
    fetchCachedSignedUrl(path)
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
