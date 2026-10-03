import type { ReactNode } from 'react';

interface DropdownProps {
  trigger: ReactNode;
  children: ReactNode;
}

export function Dropdown({ trigger, children }: DropdownProps) {
  return (
    <div className="relative group">
      <div>{trigger}</div>
      <div className="absolute right-0 top-full z-20 mt-2 hidden min-w-[180px] rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-2 shadow-[0_10px_25px_rgba(6,59,45,0.08)] group-hover:block group-focus-within:block">
        {children}
      </div>
    </div>
  );
}
