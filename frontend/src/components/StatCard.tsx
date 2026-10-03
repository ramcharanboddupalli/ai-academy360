import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string;
  icon?: ReactNode;
  trend?: string;
}

export function StatCard({ label, value, icon, trend }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-[0_4px_18px_rgba(6,59,45,0.05)]">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-[var(--color-muted)]">{label}</span>
        {icon ? <div className="rounded-lg bg-[var(--color-background)] p-2 text-[var(--color-primary)]">{icon}</div> : null}
      </div>
      <div className="text-2xl font-bold text-[var(--color-text)]">{value}</div>
      {trend ? <p className="mt-2 text-xs text-[var(--color-muted)]">{trend}</p> : null}
    </div>
  );
}
