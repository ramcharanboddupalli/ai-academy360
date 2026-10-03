import type { ReactNode } from 'react';

interface AIActionButtonProps {
  children: ReactNode;
  onClick?: () => void;
}

export function AIActionButton({ children, onClick }: AIActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-primary)] bg-[rgba(252,108,38,0.08)] px-3 py-2 text-sm font-semibold text-[var(--color-primary)] transition hover:bg-[rgba(252,108,38,0.12)]"
    >
      {children}
    </button>
  );
}
