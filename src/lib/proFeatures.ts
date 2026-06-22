/**
 * proFeatures.ts — the single source of truth for what is Pro-only and the
 * upload caps for Pro media. Imported by the UI (ProGate copy, the storage
 * helper's validation, the billing/marketing pages) so nothing drifts.
 *
 * Gating is enforced TWICE (prompts.md → "The Pro-gating principle"):
 *   - here + `useIsPro()` / `<ProGate>` in the UI — UX only, can be bypassed;
 *   - `project_is_pro()` in RLS + the `canvas-media` Storage policies — the real
 *     gate. The board OWNER's plan governs a shared board.
 *
 * Keep MEDIA_CAPS in sync with the `canvas-media` bucket's file_size_limit in
 * supabase/migrations/20260622000000_pro_foundation.sql.
 */

/** Stable identifier for each Pro-gated capability. */
export type ProFeatureKey =
  | 'emailReminders'
  | 'customReminders'
  | 'collaboration'
  | 'canvas'
  | 'media';

export interface ProFeature {
  key: ProFeatureKey;
  /** Short label for pricing cards / upgrade CTAs. */
  label: string;
  /** One line on what it unlocks. */
  description: string;
  /** False until the feature has actually shipped (don't market vapor). */
  shipped: boolean;
}

/**
 * The registry of Pro capabilities. `shipped: false` items are on the Pro
 * roadmap (prompts.md P1–P3) — list them for internal reference, but only
 * surface shipped ones on the public pricing page until they exist.
 */
export const PRO_FEATURES: Record<ProFeatureKey, ProFeature> = {
  emailReminders: {
    key: 'emailReminders',
    label: 'Email due-date reminders',
    description: 'Get emailed digests of cards due soon, even with the app closed.',
    shipped: true,
  },
  customReminders: {
    key: 'customReminders',
    label: 'Custom timed reminders',
    description: 'Due times (not just dates) and multiple offsets like "2h" and "15m before".',
    shipped: true,
  },
  collaboration: {
    key: 'collaboration',
    label: 'Pro collaboration',
    description: 'Threaded comments, @mentions, review & approval, activity log and reactions.',
    shipped: false,
  },
  canvas: {
    key: 'canvas',
    label: 'Notes Canvas',
    description: 'A live, collaborative whiteboard per project — freehand, rich text and media.',
    shipped: true,
  },
  media: {
    key: 'media',
    label: 'Canvas media',
    description: 'Record or upload images, audio and video onto the canvas.',
    shipped: false,
  },
};

/** Pro features that have actually shipped — safe to advertise. */
export const SHIPPED_PRO_FEATURES: ProFeature[] = Object.values(PRO_FEATURES).filter(
  (f) => f.shipped,
);

const MB = 1024 * 1024;

/** The kinds of media a Pro user may put on a canvas (uploaded to Storage). */
export type MediaKind = 'image' | 'audio' | 'video';

export interface MediaCap {
  /** Human label, used in caps copy and error messages. */
  label: string;
  /** Maximum allowed file size in bytes (enforced client-side before upload). */
  maxBytes: number;
  /** Exact MIME types accepted for this kind (the client-side allow-list). */
  mimeTypes: readonly string[];
}

/**
 * Per-file caps for the `canvas-media` bucket. These are enforced client-side in
 * lib/storage.ts BEFORE upload (a single bucket file_size_limit can only express
 * one number — set to the largest, the video cap, as a hard server ceiling).
 * SVG is deliberately excluded from images (it can carry script).
 */
export const MEDIA_CAPS: Record<MediaKind, MediaCap> = {
  image: {
    label: 'Image',
    maxBytes: 10 * MB,
    mimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
  },
  audio: {
    label: 'Audio',
    maxBytes: 25 * MB,
    mimeTypes: ['audio/webm', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav'],
  },
  video: {
    label: 'Video',
    maxBytes: 100 * MB,
    mimeTypes: ['video/webm', 'video/mp4', 'video/ogg', 'video/quicktime'],
  },
};

/** Name of the private Storage bucket for canvas media (matches the migration). */
export const CANVAS_MEDIA_BUCKET = 'canvas-media';

/** The largest per-type cap — mirrors the bucket's file_size_limit ceiling. */
export const MAX_MEDIA_BYTES = MEDIA_CAPS.video.maxBytes;

/** Resolve a file's MIME type to its media kind, or `null` if not allowed. */
export function mediaKindForMime(mime: string): MediaKind | null {
  const type = mime.toLowerCase();
  for (const kind of Object.keys(MEDIA_CAPS) as MediaKind[]) {
    if (MEDIA_CAPS[kind].mimeTypes.includes(type)) return kind;
  }
  return null;
}

/** Format a byte count as a friendly "MB" string for caps/error copy. */
export function formatBytes(bytes: number): string {
  const mb = bytes / MB;
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
}
