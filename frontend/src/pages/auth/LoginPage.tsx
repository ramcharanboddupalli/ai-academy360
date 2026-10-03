import { ArrowRight, BrainCircuit, Users, BriefcaseBusiness } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { PasswordInput } from '../../components/PasswordInput';
import { useAuth } from '../../contexts/AuthContext';
import { authErrorMessage } from './authErrorMessage';

export function AuthShell({
  title,
  description,
  accent,
  children,
}: {
  title: string;
  description: string;
  accent: 'management' | 'student';
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-72px)] max-w-6xl items-center justify-center px-4 py-10 sm:px-6">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[28px] border border-[var(--color-border)] bg-[var(--color-card)] shadow-[0_18px_46px_rgba(6,59,45,0.08)] md:grid-cols-2">
        <div className="flex flex-col justify-between bg-[var(--color-green)] p-8 text-[var(--color-card)]">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--color-card)]/20 bg-[var(--color-card)]/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-card)]">
              <BrainCircuit className="h-3.5 w-3.5" />
              AI Academy360
            </div>
            <h1 className="text-3xl font-black text-[var(--color-card)]">{title}</h1>
            <p className="mt-3 max-w-sm text-sm text-[var(--color-card)]/80">{description}</p>
          </div>

          <div className="mt-8 space-y-4">
            <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-card)]/10 bg-[var(--color-card)]/5 p-4">
              <div className="rounded-xl bg-[var(--color-primary)] p-2 text-[var(--color-card)]">
                {accent === 'management' ? <BriefcaseBusiness className="h-4 w-4" /> : <Users className="h-4 w-4" />}
              </div>
              <div>
                <div className="font-semibold text-[var(--color-card)]">{accent === 'management' ? 'Management portal' : 'Student portal'}</div>
                <div className="text-xs text-[var(--color-card)]/70">Secure role-based access</div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8">
          <Card className="border-none bg-transparent p-0 shadow-none">{children}</Card>
        </div>
      </div>
    </div>
  );
}

export function LoginPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl rounded-[28px] border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-[0_18px_46px_rgba(6,59,45,0.08)] md:p-8">
        <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)]">Access</p>
        <h1 className="mt-3 text-3xl font-black text-[var(--color-text)] md:text-4xl">Choose how you want to access AI Academy360</h1>
        <p className="mt-3 max-w-2xl text-sm text-[var(--color-muted)]">Select the login path that matches your role in the academy experience.</p>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <Card className="p-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-background)] text-[var(--color-primary)]">
              <BriefcaseBusiness className="h-5 w-5" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--color-text)]">Management</h2>
            <p className="mt-3 text-sm text-[var(--color-muted)]">Manage students, courses, payments, complaints and academy operations.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Link to="/management/login">
                <Button variant="primary" size="lg" className="w-full">Management Login</Button>
              </Link>
              <Link to="/management/signup">
                <Button variant="secondary" size="lg" className="w-full">Management Sign Up</Button>
              </Link>
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-background)] text-[var(--color-primary)]">
              <Users className="h-5 w-5" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--color-text)]">Student / Learner Login</h2>
            <p className="mt-3 text-sm text-[var(--color-muted)]">Use your academy-provided Student ID and password to access your learning dashboard.</p>
            <Link to="/login/student" className="mt-5 block">
              <Button variant="secondary" size="lg" className="w-full">Student Login</Button>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function ManagementLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading } = useAuth();
  const [errorMessage, setErrorMessage] = useState('');
  const notice = (location.state as { notice?: string } | null)?.notice;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    const formData = new FormData(event.currentTarget);
    try {
      await login({ role: 'ADMIN', email: String(formData.get('email') ?? ''), password: String(formData.get('password') ?? '') });
      navigate('/admin/dashboard', { replace: true });
    } catch (error) {
      setErrorMessage(authErrorMessage(error, 'management-login'));
    }
  };

  return (
    <AuthShell
      title="Management Login"
      description="Manage students, courses, payments, complaints and academy operations."
      accent="management"
    >
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-[var(--color-text)]">Management Login</h2>
        <p className="text-sm text-[var(--color-muted)]">Sign in with your management account.</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <Input label="Email" name="email" type="email" placeholder="manager@academy360.edu" autoComplete="username" required />
        <PasswordInput label="Password" name="password" placeholder="Enter your password" autoComplete="current-password" required />

        {notice ? <p role="status" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-3 text-sm text-[var(--color-green)]">{notice}</p> : null}
        {errorMessage ? <p role="alert" className="rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-background)] p-3 text-sm text-[var(--color-text)]">{errorMessage}</p> : null}

        <Button type="submit" variant="primary" size="lg" className="w-full" loading={isLoading}>
          Sign In to Management <ArrowRight className="h-4 w-4" />
        </Button>

        <Link to="/login" className="block text-center text-sm font-medium text-[var(--color-primary)]">Back to Login Options</Link>
      </form>
      <p className="mt-5 text-center text-sm text-[var(--color-muted)]">
        Don&apos;t have a management account?{' '}
        <Link to="/management/signup" className="font-semibold text-[var(--color-primary)] underline underline-offset-2">Sign up</Link>
      </p>
    </AuthShell>
  );
}

export function StudentLoginPage() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    const formData = new FormData(event.currentTarget);
    try {
      await login({ role: 'STUDENT', studentId: String(formData.get('studentId') ?? '').trim().toUpperCase(), password: String(formData.get('password') ?? '') });
      navigate('/student/dashboard', { replace: true });
    } catch (error) {
      setErrorMessage(authErrorMessage(error, 'student-login'));
    }
  };

  return (
    <AuthShell
      title="Student / Learner Login"
      description="Sign in with the Student ID and password provided by academy management."
      accent="student"
    >
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-[var(--color-text)]">Student / Learner Login</h2>
        <p className="text-sm text-[var(--color-muted)]">Sign in with credentials provided by academy management.</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <Input label="Student ID" name="studentId" type="text" placeholder="ACA26ST001" autoComplete="username" autoCapitalize="characters" required />
        <PasswordInput label="Password" name="password" placeholder="Enter your password" autoComplete="current-password" required />

        {errorMessage ? <p role="alert" className="rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-background)] p-3 text-sm text-[var(--color-text)]">{errorMessage}</p> : null}

        <Button type="submit" variant="primary" size="lg" className="w-full" loading={isLoading}>
          Sign In as Student <ArrowRight className="h-4 w-4" />
        </Button>

        <div className="space-y-1 rounded-xl border border-[var(--color-border)] p-3 text-sm">
          <p className="font-medium text-[var(--color-text)]">Your Student ID is provided by academy management.</p>
          <p className="text-[var(--color-muted)]">Don't have your Student ID? Please contact academy management.</p>
        </div>

        <Link to="/login" className="block text-center text-sm font-medium text-[var(--color-primary)]">
          Back to Login Options
        </Link>
      </form>
    </AuthShell>
  );
}
