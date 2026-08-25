import type { AuditLogEntry } from "@/lib/types";

const ACTION_LABEL: Record<string, string> = {
  "member.invited": "invited",
  "member.invite_revoked": "revoked an invite for",
  "member.joined": "joined the team",
  "member.role_changed": "changed the role of",
  "member.removed": "removed",
  "reminder.sent": "sent a renewal reminder to",
  "apikey.created": "created API key",
  "apikey.revoked": "revoked API key",
  "webhook.added": "added webhook",
  "webhook.deleted": "deleted webhook",
};

function describe(entry: AuditLogEntry): string {
  const who = entry.actor_email ?? "System";
  const verb = ACTION_LABEL[entry.action] ?? entry.action;
  const target = entry.target ? ` ${entry.target}` : "";
  const meta = entry.metadata ?? {};
  let suffix = "";
  if (entry.action === "member.role_changed" && meta.from && meta.to) {
    suffix = ` (${String(meta.from)} → ${String(meta.to)})`;
  } else if ((entry.action === "member.invited" || entry.action === "member.joined") && meta.role) {
    suffix = ` as ${String(meta.role)}`;
  }
  return `${who} ${verb}${target}${suffix}`;
}

export function AuditLog({ entries }: { entries: AuditLogEntry[] }) {
  return (
    <section className="rounded-xl border border-border">
      <div className="border-b border-border px-5 py-3">
        <h3 className="font-semibold">Activity log</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          The 20 most recent team and account changes.
        </p>
      </div>
      {entries.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {entries.map((e) => (
            <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5">
              <span className="text-sm">{describe(e)}</span>
              <time className="text-xs text-muted-foreground" dateTime={e.created_at}>
                {new Date(e.created_at).toLocaleString()}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
