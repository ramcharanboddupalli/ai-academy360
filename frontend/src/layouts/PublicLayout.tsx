import { Outlet, Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-card)]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3 font-semibold text-[var(--color-text)]">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary)] text-[var(--color-card)]">
              <Sparkles className="h-5 w-5" />
            </div>
            <span>AI Academy360</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm font-medium text-[var(--color-muted)]">
            <Link to="/" className="hover:text-[var(--color-text)]">Home</Link>
            <Link to="/login" className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-[var(--color-card)] shadow-[0_8px_18px_rgba(252,108,38,0.18)] hover:bg-[var(--color-primary-strong)]">Login</Link>
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
