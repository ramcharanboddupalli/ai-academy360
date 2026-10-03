import { ArrowRight } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { PasswordInput } from '../../components/PasswordInput';
import { AuthShell } from './LoginPage';
import { authService } from '../../services/auth.service';
import { authErrorMessage } from './authErrorMessage';

export function ManagementSignupPage() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    const form = event.currentTarget;
    const formData = new FormData(form);
    const password = String(formData.get('password') ?? '');
    const confirmPassword = String(formData.get('confirmPassword') ?? '');

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }
    if (password.length < 12) {
      setErrorMessage('Password must be at least 12 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.signupManagement({
        fullName: String(formData.get('fullName') ?? ''),
        email: String(formData.get('email') ?? ''),
        password,
        confirmPassword,
        signupCode: String(formData.get('signupCode') ?? ''),
      });
      navigate('/management/login', {
        replace: true,
        state: { notice: 'Management account created. Sign in to continue.' },
      });
    } catch (error) {
      setErrorMessage(authErrorMessage(error, 'signup'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Management Signup"
      description="Create a secure management account for AI Academy360."
      accent="management"
    >
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-[var(--color-text)]">Create management account</h2>
        <p className="text-sm text-[var(--color-muted)]">An authorized signup code is required to register.</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Input label="Full Name" name="fullName" type="text" autoComplete="name" maxLength={200} required />
        <Input label="Email" name="email" type="email" autoComplete="email" maxLength={254} required />
        <PasswordInput
          label="Password"
          name="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={72}
          required
        />
        <PasswordInput
          label="Confirm Password"
          name="confirmPassword"
          autoComplete="new-password"
          minLength={12}
          maxLength={72}
          required
        />
        <Input label="Management Signup Code" name="signupCode" type="password" autoComplete="off" required />

        {errorMessage ? <p role="alert" className="rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-background)] p-3 text-sm text-[var(--color-text)]">{errorMessage}</p> : null}

        <Button type="submit" variant="primary" size="lg" className="w-full" loading={isSubmitting}>
          Create Account <ArrowRight className="h-4 w-4" />
        </Button>

        <p className="text-center text-sm text-[var(--color-muted)]">
          Already have a management account?{' '}
          <Link to="/management/login" className="font-medium text-[var(--color-primary)]">Sign in</Link>
        </p>
        <Link to="/login" className="block text-center text-sm font-medium text-[var(--color-primary)]">
          Back to Login Options
        </Link>
      </form>
    </AuthShell>
  );
}
