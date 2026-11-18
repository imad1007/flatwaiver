import { z } from "zod";
import { MEDICAL_CONDITION_KEY, MEDICAL_CONDITION_DETAIL_KEY, type WaiverField } from "./types";

const localizedText = z.object({ en: z.string().trim().max(1000), fr: z.string().trim().max(1000) }).strict();
export const kioskSettingsSchema = z.object({
  welcome: localizedText,
  instructions: localizedText,
  hiddenOptionalFields: z.record(z.string().uuid(), z.array(z.string().max(64)).max(100))
    .refine(value => Object.keys(value).length <= 100, "Too many waiver settings."),
}).strict();
export type KioskSettings = z.infer<typeof kioskSettingsSchema>;
export const DEFAULT_KIOSK_SETTINGS: KioskSettings = {
  welcome: { en: "", fr: "" }, instructions: { en: "", fr: "" }, hiddenOptionalFields: {},
};
export function readKioskSettings(raw: unknown): KioskSettings {
  const parsed = kioskSettingsSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_KIOSK_SETTINGS;
}
/** Presentation preferences never remove legal, flagged or conditional fields. */
export function kioskFieldCanBeHidden(field: WaiverField): boolean {
  return !field.required && !field.flag_values?.length
    && !["name", "date_of_birth", "checkbox", "initials"].includes(field.type)
    && ![MEDICAL_CONDITION_KEY, MEDICAL_CONDITION_DETAIL_KEY].includes(field.key);
}
export function kioskHiddenFields(settings: KioskSettings, templateId: string, fields: WaiverField[]): string[] {
  const requested = new Set(settings.hiddenOptionalFields[templateId] ?? []);
  return fields.filter(field => requested.has(field.key) && kioskFieldCanBeHidden(field)).map(field => field.key);
}
