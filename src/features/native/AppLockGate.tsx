import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Fingerprint, Lock } from 'lucide-react';
import { readLock, unlockWithBiometrics, verifyPin } from '@/lib/native/appLock';
import { haptic } from '@/lib/native/haptics';

/**
 * Wraps the app. Locked on cold start and again after the app has been in the
 * background longer than the chosen timeout. Content stays mounted underneath
 * (hidden), so unlocking never loses in-progress work.
 */
export function AppLockGate({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState(() => readLock() !== null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const hiddenAt = useRef<number | null>(null);
  const hasBio = readLock()?.credId != null;

  const tryBio = useCallback(() => {
    void unlockWithBiometrics().then((ok) => {
      if (ok) {
        haptic('success');
        setLocked(false);
      }
    });
  }, []);

  useEffect(() => {
    const onVis = () => {
      const cfg = readLock();
      if (!cfg) return;
      if (document.visibilityState === 'hidden') hiddenAt.current = Date.now();
      else if (hiddenAt.current && Date.now() - hiddenAt.current >= cfg.timeoutSec * 1000) setLocked(true);
    };
    const onChange = () => setLocked((l) => (readLock() ? l : false));
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('aurora-applock-changed', onChange);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('aurora-applock-changed', onChange);
    };
  }, []);

  useEffect(() => {
    if (locked && hasBio) tryBio();
  }, [locked, hasBio, tryBio]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (await verifyPin(pin)) {
      haptic('success');
      setPin('');
      setError(false);
      setLocked(false);
    } else {
      haptic('error');
      setError(true);
      setPin('');
    }
  }

  return (
    <>
      <div aria-hidden={locked} inert={locked}>{children}</div>
      {locked && (
        <div role="dialog" aria-modal="true" aria-label="Jotspring is locked" className="fixed inset-0 z-[9999] grid place-items-center bg-[var(--bg)]/70 backdrop-blur-2xl">
          <form onSubmit={(e) => void submit(e)} className="glass-strong neu-raised flex w-[min(92vw,340px)] flex-col items-center gap-4 rounded-3xl p-7">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)]"><Lock size={24} /></span>
            <h2 className="font-display text-xl font-semibold text-fg">Jotspring is locked</h2>
            <input
              autoFocus
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              value={pin}
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError(false); }}
              aria-label="PIN"
              aria-invalid={error}
              placeholder="Enter PIN"
              className="neu-field w-full rounded-2xl px-4 py-3 text-center text-lg tracking-[0.4em] text-fg outline-none"
            />
            {error && <p role="alert" className="text-sm text-danger">Wrong PIN, try again.</p>}
            <button type="submit" disabled={pin.length < 4} className="w-full rounded-2xl bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] px-4 py-3 font-semibold text-[var(--accent-fg)] disabled:opacity-50">Unlock</button>
            {hasBio && (
              <button type="button" onClick={tryBio} className="flex items-center gap-2 text-sm font-medium text-fg-muted hover:text-fg">
                <Fingerprint size={18} /> Use biometrics
              </button>
            )}
          </form>
        </div>
      )}
    </>
  );
}
