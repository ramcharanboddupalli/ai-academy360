export function LoadingState() {
  return (
    <div className="flex min-h-[200px] items-center justify-center">
      <div className="flex items-center gap-3 text-sm font-medium text-[var(--color-muted)]">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
        Loading...
      </div>
    </div>
  );
}
