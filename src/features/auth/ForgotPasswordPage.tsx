import { useState, type FormEvent } from 'react';
import { Mail } from 'lucide-react';
import { Field } from '@/components/forms/Field';
import { GradientButton } from '@/components/buttons/GradientButton';
import { AuthLayout, AuthLink } from './AuthLayout';
import { FormNotice } from './FormNotice';
import { sendPasswordReset } from './api';
import { fieldErrorsOf, forgotPasswordSchema } from './schemas';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setFieldError(fieldErrorsOf(parsed.error).email);
      return;
    }
    setFieldError(undefined);
    setSubmitting(true);
    const result = await sendPasswordReset(parsed.data.email);
    setSubmitting(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    // Don't reveal whether the address exists — always show the same success.
    setSent(true);
  }

  if (sent) {
    return (
      <AuthLayout title="Reset link sent" subtitle="Check your email to continue.">
        <FormNotice tone="success">
          If an account exists for <strong>{email}</strong>, a password-reset link is on its way.
          The link opens a page where you can set a new password.
        </FormNotice>
        <p className="text-center text-sm text-fg-muted">
          <AuthLink to="/login">Back to log in</AuthLink>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Forgot password?"
      subtitle="Enter your email and we'll send a reset link."
      footer={
        <>
          Remembered it? <AuthLink to="/login">Back to log in</AuthLink>
        </>
      }
    >
      {formError && <FormNotice tone="error">{formError}</FormNotice>}

      <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-4">
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          leftIcon={<Mail size={17} />}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldError}
        />
        <GradientButton type="submit" className="mt-1 w-full" isLoading={submitting}>
          Send reset link
        </GradientButton>
      </form>
    </AuthLayout>
  );
}
