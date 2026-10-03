import type { ReactNode } from 'react';

interface TabItem {
  label: string;
  value: string;
}

interface TabsProps {
  items: TabItem[];
  active: string;
  onChange: (value: string) => void;
  children?: ReactNode;
}

export function Tabs({ items, active, onChange, children }: TabsProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-1">
        {items.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              active === item.value
                ? 'bg-[var(--color-primary)] text-[var(--color-card)]'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}
