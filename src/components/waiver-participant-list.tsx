import Link from "next/link";

/** Names only: never serialize DOBs or signature evidence into listing markup. */
export function WaiverParticipantList({ participants, href }: {
  participants: { full_name: string }[] | null;
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
            <span className="ml-2 text-xs text-muted-foreground">{index === 0 ? "Primary signer" : "Participant"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
