import { useState, type FormEvent } from 'react';
import { Lock, Mail, User } from 'lucide-react';
import { Field } from '@/components/forms/Field';
import { GradientButton } from '@/components/buttons/GradientButton';
import { AuthLayout, AuthLink, OrDivider } from './AuthLayout';
import { GoogleButton } from './GoogleButton';
import { FormNotice } from './FormNotice';
import { signUpWithEmail, signInWithGoogle } from './api';
import { fieldErrorsOf, signUpSchema } from './schemas';

export function SignUpPage() {
  const [values, setValues] = useState({ displayName: '', email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [sentEmail, setSentEmail] = useState<string | null>(null);

  const set = (key: keyof typeof values) => (event: { target: { value: string } }) =>
    setValues((prev) => ({ ...prev, [key]: event.target.value }));

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
    const result = await signUpWithEmail(parsed.data);
    setSubmitting(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    if (result.needsConfirmation) {
      setSentEmail(parsed.data.email);
    }
    // Otherwise a session was created and PublicOnlyRoute redirects into the app.
  }

  async function onGoogle() {
    setFormError(null);
    setGoogleLoading(true);
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

      <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-4">
        <Field
          label="Display name"
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
