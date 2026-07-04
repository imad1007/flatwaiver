"use client";

import type { WaiverBlock, WaiverField } from "@/lib/types";

export const signerInputClass =
  "w-full rounded-md border border-input bg-card px-3 py-3 text-base focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 transition-shadow";

/** One block of waiver legal text, rendered exactly as the signer sees it. */
export function BlockView({ block }: { block: WaiverBlock }) {
  if (block.type === "heading") {
    return <h2 className="text-lg font-bold">{block.text}</h2>;
  }
  if (block.type === "paragraph") {
    return (
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
        {block.text}
      </p>
    );
  }
  return (
    <ul className="list-inside list-disc space-y-1 text-sm leading-relaxed text-foreground/90">
      {block.items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

/** One signer input, rendered exactly as the signer sees it. */
export function FieldInput({
  field,
  value,
  onChange,
  disabled = false,
}: {
  field: WaiverField;
  value: string | boolean | undefined;
  onChange: (v: string | boolean) => void;
  disabled?: boolean;
}) {
  if (field.type === "checkbox") {
    return (
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          required={field.required}
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="mt-1 size-5 accent-primary"
        />
        <span className="text-sm">{field.label}</span>
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <label className="block">
        <FieldLabel field={field} />
        <select
          required={field.required}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={signerInputClass}
        >
          <option value="" disabled>
            Select…
          </option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === "multiline") {
    return (
      <label className="block">
        <FieldLabel field={field} />
        <textarea
          required={field.required}
          rows={3}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={signerInputClass}
        />
      </label>
    );
  }

  const inputType =
    field.type === "email"
      ? "email"
      : field.type === "phone"
        ? "tel"
        : field.type === "date" || field.type === "date_of_birth"
          ? "date"
          : "text";

  return (
    <label className="block">
      <FieldLabel field={field} />
      <input
        type={inputType}
        required={field.required}
        maxLength={field.type === "initials" ? 5 : undefined}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={signerInputClass}
      />
    </label>
  );
}

function FieldLabel({ field }: { field: WaiverField }) {
  return (
    <span className="mb-1 block text-sm font-medium text-foreground/90">
      {field.label}
      {field.required && <span className="text-destructive"> *</span>}
    </span>
  );
}
