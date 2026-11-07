import { countryCode, countryName } from "@/lib/country";

export function CustomerCountry({ code }: { code?: string | null }) {
  const valid = countryCode(code);
  const name = countryName(valid);
  if (!valid || !name) return <span className="shrink-0 text-xs font-normal text-muted-foreground" title="Owner's connection country has not been observed">Unknown</span>;
  const label = `${name} — owner's last observed connection country (approximate)`;
  return <span title={label} aria-label={label} className="inline-flex shrink-0 items-center gap-1.5 text-xs font-normal text-muted-foreground">
    <span aria-hidden="true" className={`fi fi-${valid.toLowerCase()} rounded-sm`} />
    <span aria-hidden="true">{valid}</span>
  </span>;
}
