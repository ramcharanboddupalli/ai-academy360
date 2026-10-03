import type { ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: string;
  note?: string;
  icon?: ReactNode;
}

export function MetricCard({ label, value, note, icon }: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-[0_4px_18px_rgba(6,59,45,0.05)]">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-[var(--color-muted)]">{label}</span>
        {icon ? <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-background)] text-[var(--color-primary)]">{icon}</div> : null}
      </div>
      <div className="text-2xl font-bold text-[var(--color-text)]">{value}</div>
      {note ? <p className="mt-2 text-xs text-[var(--color-muted)]">{note}</p> : null}
    </div>
  );
}
