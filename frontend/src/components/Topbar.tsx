import { Bell, Search } from 'lucide-react';
import { Avatar } from './Avatar';

interface TopbarProps {
  title: string;
  subtitle?: string;
}

export function Topbar({ title, subtitle }: TopbarProps) {
  return (
    <header className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-card)] px-5 py-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)]">{subtitle ?? 'Overview'}</p>
        <h2 className="mt-1 text-xl font-semibold text-[var(--color-text)]">{title}</h2>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-muted)] md:flex">
          <Search className="h-4 w-4 text-[var(--color-primary)]" />
          <span>Search</span>
        </div>
        <button type="button" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-2 text-[var(--color-text)]">
          <Bell className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1.5">
          <Avatar name="Student Member" size="sm" />
          <div className="hidden text-left md:block">
            <div className="text-sm font-medium text-[var(--color-text)]">Student Member</div>
            <div className="text-[11px] text-[var(--color-muted)]">Academic portal</div>
          </div>
        </div>
      </div>
    </header>
  );
}
