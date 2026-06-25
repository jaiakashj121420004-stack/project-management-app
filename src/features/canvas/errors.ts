/**
 * Human-friendly messages for canvas write failures.
 *
 * Canvas create/save is governed by RLS (a Pro board editor, or a Pro owner for
 * a personal canvas). When the database rejects a write it throws a Supabase
 * PostgrestError; the most important case is a row-level-security denial
 * (Postgres code 42501), which previously surfaced as nothing at all — the
 * optimistic editor just opened and rolled back ("flash and close"). We now
 * turn these into a clear, actionable message.
 */
interface MaybePostgrestError {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

/** True when an error is an RLS / permission denial from PostgREST. */
export function isRlsDenial(error: unknown): boolean {
  const e = error as MaybePostgrestError | null;
  return e?.code === '42501' || /row-level security/i.test(e?.message ?? '');
}

/** A friendly, specific message for a failed canvas create. */
export function canvasCreateErrorMessage(error: unknown): string {
  if (isRlsDenial(error)) {
    return "Couldn't create the canvas — the database blocked it (row-level security). If you're on Pro, the canvas access policy may be out of date; re-apply the canvas RLS migration in Supabase.";
  }
  const message = (error as MaybePostgrestError | null)?.message;
  return message
    ? `Couldn't create the canvas: ${message}`
    : "Couldn't create the canvas. Check your connection and try again.";
}
