type Tone = 'info' | 'success' | 'warning' | 'danger';

interface StatusBadgeProps {
  label: string;
  tone?: Tone;
}

const toneClasses: Record<Tone, string> = {
  info: 'border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-green)]',
  success: 'border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-green)]',
  warning: 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-card)]',
  danger: 'border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-primary)]',
};

export function StatusBadge({ label, tone = 'info' }: StatusBadgeProps) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClasses[tone]}`}>{label}</span>;
}
