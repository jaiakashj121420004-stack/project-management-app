import { useState, type FormEvent } from 'react';
import { Lock, Mail } from 'lucide-react';
import { Field } from '@/components/forms/Field';
import { GradientButton } from '@/components/buttons/GradientButton';
import { AuthLayout, AuthLink, OrDivider } from './AuthLayout';
import { GoogleButton } from './GoogleButton';
import { FormNotice } from './FormNotice';
import { signInWithEmail, signInWithGoogle } from './api';
import { fieldErrorsOf, loginSchema } from './schemas';

export function LoginPage() {
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const set = (key: keyof typeof values) => (event: { target: { value: string } }) =>
    setValues((prev) => ({ ...prev, [key]: event.target.value }));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrorsOf(parsed.error));
      return;
    }
    setErrors({});
    setSubmitting(true);
    const result = await signInWithEmail(parsed.data);
    setSubmitting(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    // Success: onAuthStateChange updates the session and PublicOnlyRoute redirects.
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

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to pick up where you left off."
      footer={
        <>
          New to Aurora? <AuthLink to="/signup">Create an account</AuthLink>
        </>
      }
    >
      {formError && <FormNotice tone="error">{formError}</FormNotice>}

      <GoogleButton onClick={() => void onGoogle()} isLoading={googleLoading} />
      <OrDivider />

      <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-4">
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
        <div className="flex flex-col gap-1.5">
          <Field
            label="Password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            leftIcon={<Lock size={17} />}
            value={values.password}
            onChange={set('password')}
            error={errors.password}
          />
          <div className="text-right text-sm">
            <AuthLink to="/forgot-password">Forgot password?</AuthLink>
          </div>
        </div>
        <GradientButton type="submit" className="mt-1 w-full" isLoading={submitting}>
          Log in
        </GradientButton>
      </form>
    </AuthLayout>
  );
}
