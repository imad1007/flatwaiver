import { z } from "zod";
import type { DraftContent } from "./types";

// Send only editable document text. Field keys, validation rules, flags and
// participant answers never enter the translation response contract.
export function translationSegments(draft: DraftContent): string[] {
  return [draft.title, ...draft.blocks.flatMap(b => b.type === "list" ? b.items : [b.text]),
    ...draft.fields.flatMap(f => [f.label, ...(f.option_labels ?? f.options ?? [])]), draft.consent_text];
}

export function applyTranslation(draft: DraftContent, raw: unknown): DraftContent {
  const values = z.array(z.string().trim().max(30000)).parse(raw);
  if (values.length !== translationSegments(draft).length) throw new Error("Incomplete translation. Your draft has not changed.");
  if (translationSegments(draft).some((text, i) => text.trim() && !values[i])) throw new Error("Translation omitted document text.");
  let index = 0;
  const title = values[index++];
  const blocks = draft.blocks.map(b => b.type === "list"
    ? { ...b, items: b.items.map(() => values[index++]) }
    : { ...b, text: values[index++] });
  const fields = draft.fields.map(f => ({ ...f, label: values[index++],
    ...(f.options ? { option_labels: f.options.map(() => values[index++]) } : {}) }));
  return { ...draft, title, blocks, fields, consent_text: values[index] };
}
