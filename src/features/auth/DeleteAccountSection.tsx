import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { supabase } from '@/lib/supabase';
import { signOut } from './api';

/**
 * Permanent account deletion. Required by the Apple App Store and Google Play:
 * any app with sign-up must let people delete their account from inside the app.
 * Calls the `delete-account` Edge Function, then signs out locally.
 */
export function DeleteAccountSection() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    setBusy(true);
    setError(null);
    const { data, error: fnError } = (await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
      'delete-account',
      { body: { confirm: 'DELETE' } },
    )) as { data: { ok?: boolean; error?: string } | null; error: Error | null };
    if (fnError || !data?.ok) {
      setBusy(false);
      setError(data?.error ?? 'Could not delete your account. Please try again.');
      return;
    }
    await signOut();
    window.location.assign('/');
  }

  return (
    <section className="mt-8">
      <h2 className="px-1 font-display text-title font-semibold text-fg">Delete account</h2>
      <GlassPanel strong className="mt-3 px-5 py-5 sm:px-6">
        <p className="text-sm text-fg-muted">
          Permanently delete your account and everything you own: boards, cards, notes, canvases and
          files. Boards you only belong to stay with their other members. This cannot be undone. If
          you subscribed through Google Play or the App Store, cancel that subscription in the store
          as well.
        </p>
        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="neu-raised mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-danger"
          >
            <Trash2 size={16} /> Delete my account
          </button>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="block text-sm text-fg">
              Type <strong>DELETE</strong> to confirm
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                autoComplete="off"
                className="neu-field mt-1 block w-full rounded-xl px-3 py-2 text-fg outline-none sm:max-w-xs"
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={text !== 'DELETE' || busy}
                onClick={() => void onDelete()}
                className="rounded-xl bg-danger px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? 'Deleting…' : 'Permanently delete'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setOpen(false);
                  setText('');
                  setError(null);
                }}
                className="neu-raised rounded-xl px-4 py-2 text-sm font-medium text-fg"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </GlassPanel>
    </section>
  );
}
