import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return <div className={`rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-sm ${className}`}>{children}</div>;
}
