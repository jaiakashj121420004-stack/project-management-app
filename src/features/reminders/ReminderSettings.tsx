import { useState, type ReactNode } from 'react';
import { Bell, BellRing, Mail } from 'lucide-react';
import { cn } from '@/lib/cn';
import { GlassSelect } from '@/components/forms/GlassSelect';
import { useProfile, useUpdateProfile } from '@/features/auth/useProfile';
import {
  browserNotificationsSupported,
  notificationPermission,
  requestNotificationPermission,
  setBrowserRemindersEnabled,
  useBrowserRemindersPref,
} from './notifications';

const LEAD_OPTIONS = [
  { value: 0, label: 'On the due date' },
  { value: 1, label: '1 day before' },
  { value: 2, label: '2 days before' },
  { value: 3, label: '3 days before' },
  { value: 7, label: '1 week before' },
];

/** Accessible on/off switch, on-brand (accent gradient when on). */
function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked
          ? 'border-transparent bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))]'
          : 'border-[var(--glass-border)] bg-[var(--field-bg)]',
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  );
}

function SettingRow({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--glass-fill)] text-fg-muted">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="font-medium text-fg">{title}</p>
          <p className="mt-0.5 text-sm text-fg-subtle">{description}</p>
        </div>
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  );
}

/** Due-date reminder preferences (Phase 9), shown on the Profile screen. */
export function ReminderSettings() {
  const { data: profile } = useProfile();
  const update = useUpdateProfile();

  const emailEnabled = profile?.reminder_emails_enabled ?? false;
  const leadDays = profile?.reminder_lead_days ?? 1;

  const browserPref = useBrowserRemindersPref();
  const permission = notificationPermission();
  const browserOn = browserPref && permission === 'granted';
  const [permissionDenied, setPermissionDenied] = useState(permission === 'denied');

  async function toggleBrowser(next: boolean) {
    if (!next) {
      setBrowserRemindersEnabled(false);
      return;
    }
    let granted = permission === 'granted';
    if (!granted) {
      granted = (await requestNotificationPermission()) === 'granted';
    }
    setPermissionDenied(!granted);
    setBrowserRemindersEnabled(granted);
  }

  return (
    <div className="divide-y divide-[var(--glass-border)]">
      <SettingRow
        icon={<Mail size={18} />}
        title="Email reminders"
        description="Email me before tasks assigned to me are due. Works even when Aurora is closed."
      >
        <Toggle
          label="Email reminders"
          checked={emailEnabled}
          disabled={update.isPending}
          onChange={(next) => update.mutate({ reminderEmailsEnabled: next })}
        />
      </SettingRow>

      <SettingRow
        icon={browserOn ? <BellRing size={18} /> : <Bell size={18} />}
        title="Browser notifications"
        description={
          browserNotificationsSupported() ? (
            permissionDenied ? (
              <span className="text-warning">
                Blocked — allow notifications for this site in your browser settings.
              </span>
            ) : (
              'Notify me while Aurora is open in this browser. No setup required.'
            )
          ) : (
            <span className="text-fg-subtle">Not supported in this browser.</span>
          )
        }
      >
        <Toggle
          label="Browser notifications"
          checked={browserOn}
          disabled={!browserNotificationsSupported()}
          onChange={(next) => void toggleBrowser(next)}
        />
      </SettingRow>

      <SettingRow
        icon={<Bell size={18} />}
        title="Remind me"
        description="How far ahead to send reminders (applies to both email and browser)."
      >
        <GlassSelect
          label="Reminder lead time"
          value={leadDays}
          disabled={update.isPending}
          onChange={(next) => update.mutate({ reminderLeadDays: next })}
          options={LEAD_OPTIONS}
          openUp
          className="w-44"
        />
      </SettingRow>
    </div>
  );
}
