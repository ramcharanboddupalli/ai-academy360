import type { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  meta?: string;
  children: ReactNode;
}

export function ChartCard({ title, meta, children }: ChartCardProps) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-[var(--color-text)]">{title}</h3>
        {meta ? <span className="text-xs text-[var(--color-muted)]">{meta}</span> : null}
      </div>
      {children}
    </div>
  );
}
