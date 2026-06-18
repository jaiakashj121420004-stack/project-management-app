import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { Field } from '@/components/forms/Field';
import { GradientButton } from '@/components/buttons/GradientButton';
import { useAuth } from '@/hooks/useAuth';
import { AuthLayout, AuthLink } from './AuthLayout';
import { FormNotice } from './FormNotice';
import { FullScreenLoader } from './FullScreenLoader';
import { updatePassword } from './api';
import { fieldErrorsOf, resetPasswordSchema } from './schemas';

/**
 * Lands here from the password-reset email. Supabase parses the recovery token
 * from the URL and creates a temporary session, which lets us call updateUser.
 */
export function ResetPasswordPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState({ password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const set = (key: keyof typeof values) => (event: { target: { value: string } }) =>
    setValues((prev) => ({ ...prev, [key]: event.target.value }));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = resetPasswordSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrorsOf(parsed.error));
      return;
    }
    setErrors({});
    setSubmitting(true);
    const result = await updatePassword(parsed.data.password);
    setSubmitting(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    setDone(true);
  }

  if (loading) return <FullScreenLoader />;

  if (!session) {
    return (
      <AuthLayout title="Link expired" subtitle="This reset link is invalid or already used.">
        <FormNotice tone="error">Request a fresh password-reset link to continue.</FormNotice>
        <p className="text-center text-sm text-fg-muted">
          <AuthLink to="/forgot-password">Send a new link</AuthLink>
        </p>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout title="Password updated" subtitle="You're all set.">
        <FormNotice tone="success">Your password has been changed.</FormNotice>
        <GradientButton
          className="w-full"
          onClick={() => {
            void navigate('/', { replace: true });
          }}
        >
          Go to Aurora
        </GradientButton>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set a new password" subtitle="Choose a strong password you'll remember.">
      {formError && <FormNotice tone="error">{formError}</FormNotice>}

      <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-4">
        <Field
          label="New password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          leftIcon={<Lock size={17} />}
          value={values.password}
          onChange={set('password')}
          error={errors.password}
          hint={errors.password ? undefined : 'At least 8 characters.'}
        />
        <Field
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          leftIcon={<Lock size={17} />}
          value={values.confirmPassword}
          onChange={set('confirmPassword')}
          error={errors.confirmPassword}
        />
        <GradientButton type="submit" className="mt-1 w-full" isLoading={submitting}>
          Update password
        </GradientButton>
      </form>
    </AuthLayout>
  );
}
