export default function SettingsLoading() {
  return (
    <div role="status" aria-label="Loading settings" className="space-y-5 motion-safe:animate-pulse">
      <span className="sr-only">Loading settings</span>
      {[0, 1].map((item) => (
        <div key={item} className="rounded-xl border bg-card p-6">
          <div className="h-5 w-32 rounded bg-muted" />
          <div className="mt-3 h-4 w-3/4 rounded bg-muted" />
          <div className="mt-6 h-10 rounded-lg bg-muted" />
        </div>
      ))}
    </div>
  );
}
