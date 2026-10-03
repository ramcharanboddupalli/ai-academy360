import type { ReactNode } from 'react';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Drawer({ open, onClose, title, children }: DrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-green)]/70" onClick={onClose}>
      <div className="ml-auto h-full w-full max-w-xl border-l border-[var(--color-border)] bg-[var(--color-card)] p-5" onClick={(event) => event.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[var(--color-text)]">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-lg border border-[var(--color-border)] px-2 py-1 text-sm text-[var(--color-muted)]">Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}
