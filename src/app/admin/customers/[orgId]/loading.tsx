export default function LoadingCustomer() {
  return <div role="status" aria-label="Loading customer" className="space-y-6 animate-pulse"><div className="h-40 rounded-2xl bg-muted" /><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[1,2,3,4].map(n => <div key={n} className="h-32 rounded-xl bg-muted" />)}</div><div className="h-80 rounded-2xl bg-muted" /><span className="sr-only">Loading customer details…</span></div>;
}
