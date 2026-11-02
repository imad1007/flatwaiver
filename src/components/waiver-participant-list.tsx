import Link from "next/link";

/** Names only: never serialize DOBs or signature evidence into listing markup. */
export function WaiverParticipantList({ participants, href, query = "" }: {
  participants: { full_name: string; guardian_name?: string | null; is_minor?: boolean }[] | null;
  query?: string;
  /** Omit when the entire card is already a link. */
  href?: string;
}) {
  if (!participants?.length) return null;
  return (
    <div className="mt-2 border-l-2 border-border pl-3">
      <p className="text-xs text-muted-foreground">
        Group waiver · {participants.length} participants · one signed record
      </p>
      <ul className="mt-1 space-y-1">
        {participants.map((participant, index) => (
          <li key={index} className="break-words text-sm [overflow-wrap:anywhere]">
            {href ? <Link href={href} className="font-medium hover:underline">{participant.full_name}</Link> : <span className="font-medium">{participant.full_name}</span>}
            <span className="ml-2 text-xs text-muted-foreground">{index === 0 ? "Primary signer" : participant.is_minor ? "Child" : "Participant"}</span>
            {query && [participant.full_name, participant.guardian_name].some(name => name?.toLowerCase().includes(query.toLowerCase())) && <span className="ml-2 text-xs font-semibold text-primary">Name match</span>}
            {participant.guardian_name && <p className="text-xs text-muted-foreground">Guardian: {participant.guardian_name}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Show only matching name answers, never unrelated custom answers. */
export function WaiverCustomNameMatches({ fields, values, query }: {
  fields?: { key: string; type: string; label: string }[];
  values?: Record<string, unknown>;
  query: string;
}) {
  if (!query || !fields || !values) return null;
  const matches = fields.filter(field =>
    (field.type === "name" || (field.type === "text" &&
      (/(^|_)name(_|$)/i.test(field.key) || /\bname\b/i.test(field.label)))) &&
    typeof values[field.key] === "string" &&
    (values[field.key] as string).toLowerCase().includes(query.toLowerCase()));
  return matches.length ? <ul className="mt-2 space-y-1">
    {matches.map(field => <li key={field.key} className="break-words text-sm">
      <span className="font-semibold">{field.label}: {String(values[field.key])}</span>
      <span className="ml-2 text-xs font-semibold text-primary">Name match</span>
    </li>)}
  </ul> : null;
}
