import { Search } from 'lucide-react';

interface SearchInputProps {
  value?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
}

export function SearchInput({ value, placeholder = 'Search', onChange }: SearchInputProps) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm text-[var(--color-muted)]">
      <Search className="h-4 w-4 text-[var(--color-primary)]" />
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange?.(event.target.value)}
        className="w-full border-0 bg-transparent text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-muted)]"
      />
    </label>
  );
}
