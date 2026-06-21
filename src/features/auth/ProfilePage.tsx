import { useState, type FormEvent } from 'react';
import { Mail, User } from 'lucide-react';
import { Field } from '@/components/forms/Field';
import { GradientButton } from '@/components/buttons/GradientButton';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { Reveal } from '@/components/motion/Reveal';
import { Avatar } from '@/components/Avatar';
import { Spinner } from '@/components/feedback/Spinner';
import { useAuth } from '@/hooks/useAuth';
import { ReminderSettings } from '@/features/reminders';
import { useProfile, useUpdateProfile } from './useProfile';
import { resolveAvatarUrl, resolveDisplayName } from './identity';
import { FormNotice } from './FormNotice';
import { fieldErrorsOf, profileSchema } from './schemas';

/** Minimal profile editor: change the display name. Avatar upload comes later. */
export function ProfilePage() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const update = useUpdateProfile();

  // `null` draft means "untouched" → show whatever the loaded profile has.
  const [draft, setDraft] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const displayName = draft ?? profile?.display_name ?? '';

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSaved(false);
    const parsed = profileSchema.safeParse({ displayName });
    if (!parsed.success) {
      setFieldError(fieldErrorsOf(parsed.error).displayName);
      return;
    }
    setFieldError(undefined);
    try {
      await update.mutateAsync({ displayName: parsed.data.displayName });
      setSaved(true);
    } catch {
      setFormError('Could not save your changes. Please try again.');
    }
  }

  const name = resolveDisplayName(profile, user);
  const avatarUrl = resolveAvatarUrl(profile, user);

  return (
    <Reveal className="mx-auto w-full max-w-xl">
      <header className="pb-6 pt-2">
        <h1 className="gradient-text font-display text-headline font-bold">Profile</h1>
        <p className="mt-2 text-fg-muted">Manage how you appear across Aurora.</p>
      </header>

      <GlassPanel strong glow className="p-6 sm:p-8">
        {isLoading ? (
          <div className="grid place-items-center py-10">
            <Spinner size={32} />
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center gap-4">
              <Avatar name={name} src={avatarUrl} size={64} />
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-semibold text-fg">{name}</p>
                {user?.email && <p className="truncate text-sm text-fg-subtle">{user.email}</p>}
              </div>
            </div>

            {formError && <FormNotice tone="error">{formError}</FormNotice>}
            {saved && <FormNotice tone="success">Your profile has been saved.</FormNotice>}

            <form
              onSubmit={(event) => void onSubmit(event)}
              noValidate
              className="flex flex-col gap-4"
            >
              <Field
                label="Display name"
                leftIcon={<User size={17} />}
                value={displayName}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setSaved(false);
                }}
                error={fieldError}
              />
              <Field
                label="Email"
                type="email"
                leftIcon={<Mail size={17} />}
                value={user?.email ?? ''}
                disabled
                className="disabled:cursor-not-allowed disabled:opacity-70"
                hint="Email is tied to your sign-in method."
              />
              <div className="flex justify-end">
                <GradientButton type="submit" isLoading={update.isPending}>
                  Save changes
                </GradientButton>
              </div>
            </form>
          </>
        )}
      </GlassPanel>

      <section className="mt-8">
        <h2 className="px-1 font-display text-title font-semibold text-fg">Reminders</h2>
        <p className="mt-1 px-1 text-sm text-fg-muted">
          Stay ahead of due dates. Email reminders need a one-time server setup (see the project
          README); browser notifications work right away.
        </p>
        <GlassPanel strong className="mt-3 px-5 py-1 sm:px-6">
          <ReminderSettings />
        </GlassPanel>
      </section>
    </Reveal>
  );
}
