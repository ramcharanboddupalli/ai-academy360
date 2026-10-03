interface ProgressBarProps {
  value: number;
  label?: string;
  color?: string;
}

export function ProgressBar({ value, label, color = 'var(--color-primary)' }: ProgressBarProps) {
  return (
    <div className="w-full">
      {label ? <div className="mb-2 flex items-center justify-between text-xs font-medium text-[var(--color-muted)]"><span>{label}</span><span>{value}%</span></div> : null}
      <div className="h-2.5 overflow-hidden rounded-full bg-[var(--color-vanilla)]">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(Math.max(value, 0), 100)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
