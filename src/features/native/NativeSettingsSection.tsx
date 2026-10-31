import { useEffect, useState } from 'react';
import { biometricsAvailable, disableLock, enableLock, enrollBiometrics, readLock, setTimeoutSec } from '@/lib/native/appLock';
import { haptic, hapticsEnabled, hapticsSupported, setHapticsEnabled } from '@/lib/native/haptics';

const TIMEOUTS = [
  { v: 0, l: 'Immediately' },
  { v: 30, l: 'After 30 seconds' },
  { v: 300, l: 'After 5 minutes' },
];

export function NativeSettingsSection() {
  const [lock, setLock] = useState(readLock);
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState('');
  const [bio, setBio] = useState(false);
  const [hap, setHap] = useState(hapticsEnabled);

  useEffect(() => { void biometricsAvailable().then(setBio); }, []);
  const refresh = () => setLock(readLock());

  async function turnOn() {
    try {
      await enableLock(pin);
      setPin('');
      setMsg('App lock is on.');
      refresh();
    } catch {
      setMsg('Use a PIN of 4–8 digits.');
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-fg">App lock</h3>
        <p className="mb-2 text-sm text-fg-muted">Ask for a PIN{bio ? ' or Face ID / fingerprint' : ''} when you open Aurora or come back to it. Stored on this device only.</p>
        {!lock ? (
          <div className="flex flex-wrap gap-2">
            <input aria-label="New PIN" inputMode="numeric" type="password" maxLength={8} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="4–8 digit PIN" className="neu-field rounded-xl px-3 py-2 text-fg outline-none" />
            <button type="button" onClick={() => void turnOn()} disabled={pin.length < 4} className="rounded-xl bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)] disabled:opacity-50">Turn on</button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Lock after" value={lock.timeoutSec} onChange={(e) => { setTimeoutSec(Number(e.target.value)); refresh(); }} className="neu-field rounded-xl px-3 py-2 text-fg">
              {TIMEOUTS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
            {bio && !lock.credId && (
              <button type="button" onClick={() => { void enrollBiometrics().then((ok) => { setMsg(ok ? 'Biometrics enabled.' : 'Could not enable biometrics.'); refresh(); }); }} className="rounded-xl px-3 py-2 text-sm font-medium text-fg neu-raised">Enable biometrics</button>
            )}
            <button type="button" onClick={() => { disableLock(); refresh(); setMsg('App lock is off.'); }} className="rounded-xl px-3 py-2 text-sm font-medium text-danger neu-raised">Turn off</button>
          </div>
        )}
        {msg && <p role="status" className="mt-2 text-sm text-fg-muted">{msg}</p>}
      </div>

      <label className="flex items-center justify-between gap-4">
        <span>
          <span className="block text-sm font-semibold text-fg">Haptic feedback</span>
          <span className="block text-sm text-fg-muted">{hapticsSupported() ? 'A light tap when you complete a to-do or unlock.' : 'Not supported by this browser (works on Android and in the native app).'}</span>
        </span>
        <input type="checkbox" checked={hap} onChange={(e) => { setHap(e.target.checked); setHapticsEnabled(e.target.checked); if (e.target.checked) haptic('success'); }} className="h-5 w-5 accent-[var(--accent-from)]" />
      </label>
    </div>
  );
}
