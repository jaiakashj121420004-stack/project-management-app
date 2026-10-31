/**
 * appLock.ts — optional on-device app lock.
 *
 * A PIN (PBKDF2-hashed, never stored in clear) plus optional biometrics via
 * WebAuthn's platform authenticator (Face ID / Touch ID / fingerprint /
 * Windows Hello). Everything is local to this device: it keeps someone who
 * picks up your unlocked phone out of your boards. It is a privacy gate, not
 * a replacement for your account sign-in.
 */
const KEY = 'aurora-applock';
const ITER = 150_000;

export interface AppLockConfig {
  pinHash: string;
  salt: string;
  credId: string | null;
  /** Seconds in the background before the lock re-engages. */
  timeoutSec: number;
}

const b64 = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
};
const unb64 = (s: string): Uint8Array<ArrayBuffer> => {
  const raw = atob(s);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

async function hashPin(pin: string, salt: Uint8Array<ArrayBuffer>): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER }, key, 256);
  return b64(bits);
}

export function readLock(): AppLockConfig | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AppLockConfig) : null;
  } catch {
    return null;
  }
}

function writeLock(cfg: AppLockConfig | null): void {
  try {
    if (cfg) localStorage.setItem(KEY, JSON.stringify(cfg));
    else localStorage.removeItem(KEY);
    window.dispatchEvent(new Event('aurora-applock-changed'));
  } catch {
    /* ignore */
  }
}

export async function enableLock(pin: string, timeoutSec = 30): Promise<void> {
  if (!/^\d{4,8}$/.test(pin)) throw new Error('PIN must be 4–8 digits');
  const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));
  writeLock({ pinHash: await hashPin(pin, salt), salt: b64(salt), credId: null, timeoutSec });
}

export function disableLock(): void {
  writeLock(null);
}

export function setTimeoutSec(timeoutSec: number): void {
  const cfg = readLock();
  if (cfg) writeLock({ ...cfg, timeoutSec });
}

export async function verifyPin(pin: string): Promise<boolean> {
  const cfg = readLock();
  if (!cfg) return true;
  return (await hashPin(pin, unb64(cfg.salt))) === cfg.pinHash;
}

export async function biometricsAvailable(): Promise<boolean> {
  try {
    return (
      typeof PublicKeyCredential !== 'undefined' &&
      (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
    );
  } catch {
    return false;
  }
}

/** Register this device's biometrics for unlock. Returns false if refused/unsupported. */
export async function enrollBiometrics(): Promise<boolean> {
  const cfg = readLock();
  if (!cfg || !(await biometricsAvailable())) return false;
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(new ArrayBuffer(32))),
        rp: { name: 'Aurora' },
        user: { id: crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16))), name: 'aurora-device', displayName: 'Aurora on this device' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;
    if (!cred) return false;
    writeLock({ ...cfg, credId: b64(cred.rawId) });
    return true;
  } catch {
    return false;
  }
}

export async function unlockWithBiometrics(): Promise<boolean> {
  const cfg = readLock();
  if (!cfg?.credId) return false;
  try {
    const got = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(new ArrayBuffer(32))),
        allowCredentials: [{ type: 'public-key', id: unb64(cfg.credId) }],
        userVerification: 'required',
        timeout: 60_000,
      },
    });
    return got !== null;
  } catch {
    return false;
  }
}
