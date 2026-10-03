import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <label className="block w-full">
      {label ? <span className="mb-2 block text-sm font-medium text-[var(--color-text)]">{label}</span> : null}
      <input
        {...props}
        className={`w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3.5 py-2.5 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] ${className}`}
      />
      {error ? <span className="mt-1 block text-xs text-[var(--color-primary)]">{error}</span> : null}
    </label>
  );
}
