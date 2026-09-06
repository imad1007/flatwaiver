export default function AppLoading() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading page" className="animate-pulse">
      <span className="sr-only">Loading page…</span>
      <div className="h-8 w-48 rounded-md bg-muted" />
      <div className="mt-3 h-4 w-full max-w-md rounded bg-muted/70" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-36 rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="h-5 w-2/3 rounded bg-muted" />
            <div className="mt-4 h-3 w-full rounded bg-muted/70" />
            <div className="mt-2 h-3 w-4/5 rounded bg-muted/70" />
          </div>
        ))}
      </div>
    </div>
  );
}
