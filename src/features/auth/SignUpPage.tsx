import { useState, type FormEvent } from 'react';
import { Lock, Mail, User } from 'lucide-react';
import { Field } from '@/components/forms/Field';
import { GradientButton } from '@/components/buttons/GradientButton';
import { markGoogleSignupIntent, track } from '@/lib/analytics';
import { AuthLayout, AuthLink, OrDivider } from './AuthLayout';
import { GoogleButton } from './GoogleButton';
import { FormNotice } from './FormNotice';
import { signUpWithEmail, signInWithGoogle } from './api';
import { fieldErrorsOf, signUpSchema } from './schemas';

export function SignUpPage() {
  const [values, setValues] = useState({ displayName: '', email: '', password: '', agreedToTerms: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [sentEmail, setSentEmail] = useState<string | null>(null);

  const set = (key: 'displayName' | 'email' | 'password') => (event: { target: { value: string } }) =>
    setValues((prev) => ({ ...prev, [key]: event.target.value }));

  const toggleAgreed = () =>
    setValues((prev) => ({ ...prev, agreedToTerms: !prev.agreedToTerms }));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = signUpSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrorsOf(parsed.error));
      return;
    }
    setErrors({});
    setSubmitting(true);
    track('signup_started', { method: 'email' });
    const result = await signUpWithEmail(parsed.data);
    setSubmitting(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    // "Completed" = the account was created, regardless of whether email
    // confirmation is still pending — that's the funnel-relevant milestone.
    // needs_confirmation lets a later query separate the two cohorts.
    track('signup_completed', { method: 'email', needs_confirmation: result.needsConfirmation });
    if (result.needsConfirmation) {
      setSentEmail(parsed.data.email);
    }
    // Otherwise a session was created and PublicOnlyRoute redirects into the app.
  }

  async function onGoogle() {
    setFormError(null);
    if (!values.agreedToTerms) {
      setErrors((prev) => ({
        ...prev,
        agreedToTerms: 'You must agree to the Terms of Service and Privacy Policy to create an account.',
      }));
      return;
    }
    setGoogleLoading(true);
    // Google is a redirect flow — the browser navigates away and back via
    // Supabase's OAuth callback, which this component never sees again, so
    // signup_completed can't fire from here. markGoogleSignupIntent() stamps a
    // short-lived flag that AuthProvider checks on the resulting SIGNED_IN
    // event instead, combined with the account's own created_at to rule out a
    // returning user who logged into their existing account via this same
    // button — see analytics.ts's markSignupCompletedIfGoogleIntent doc comment.
    track('signup_started', { method: 'google' });
    markGoogleSignupIntent();
    const result = await signInWithGoogle();
    if (result.error) {
      setFormError(result.error);
      setGoogleLoading(false);
    }
  }

  if (sentEmail) {
    return (
      <AuthLayout title="Check your inbox" subtitle="One last step to activate your account.">
        <FormNotice tone="success">
          We sent a confirmation link to <strong>{sentEmail}</strong>. Click it to finish creating
          your account, then log in.
        </FormNotice>
        <p className="text-center text-sm text-fg-muted">
          Already confirmed? <AuthLink to="/login">Log in</AuthLink>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start organizing everything in Aurora."
      footer={
        <>
          Already have an account? <AuthLink to="/login">Log in</AuthLink>
        </>
      }
    >
      {formError && <FormNotice tone="error">{formError}</FormNotice>}

      <GoogleButton onClick={() => void onGoogle()} isLoading={googleLoading} />
      <OrDivider />

      <label className="flex items-start gap-2.5 text-sm text-fg-muted">
        <input
          type="checkbox"
          checked={values.agreedToTerms}
          onChange={toggleAgreed}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--hairline)] accent-[var(--accent-from)]"
        />
        <span>
          I agree to the <AuthLink to="/terms">Terms of Service</AuthLink> and{' '}
          <AuthLink to="/privacy">Privacy Policy</AuthLink>.
        </span>
      </label>
      {errors.agreedToTerms && (
        <p className="-mt-2 text-sm text-danger">{errors.agreedToTerms}</p>
      )}

      <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-4">
        <Field
          label="Display name"
          name="name"
          id="signup-name"
          autoComplete="name"
          placeholder="Ada Lovelace"
          leftIcon={<User size={17} />}
          value={values.displayName}
          onChange={set('displayName')}
          error={errors.displayName}
        />
        <Field
          label="Email"
          type="email"
          name="email"
          id="signup-email"
          autoComplete="email"
          placeholder="you@example.com"
          leftIcon={<Mail size={17} />}
          value={values.email}
          onChange={set('email')}
          error={errors.email}
        />
        <Field
          label="Password"
          type="password"
          name="new-password"
          id="signup-password"
          autoComplete="new-password"
          placeholder="••••••••"
          leftIcon={<Lock size={17} />}
          value={values.password}
          onChange={set('password')}
          error={errors.password}
          hint={errors.password ? undefined : 'At least 8 characters.'}
        />
        <GradientButton type="submit" className="mt-1 w-full" isLoading={submitting}>
          Create account
        </GradientButton>
      </form>
    </AuthLayout>
  );
}
