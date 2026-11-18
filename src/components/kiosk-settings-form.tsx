"use client";

import { useState, useTransition } from "react";
import { updateKioskSettings } from "@/app/(app)/settings/kiosk/actions";
import { kioskFieldCanBeHidden, type KioskSettings } from "@/lib/kiosk-settings";
import type { WaiverField } from "@/lib/types";

export function KioskSettingsForm({ initial, templates, canEdit }: {
  initial: KioskSettings; templates: { id: string; name: string; fields: WaiverField[] }[]; canEdit: boolean;
}) {
  const [settings, setSettings] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  return <form className="mt-6 max-w-3xl space-y-6" onSubmit={event => {
    event.preventDefault(); setMessage("");
    startTransition(async () => { try { await updateKioskSettings(settings); setMessage("Kiosk settings saved."); } catch (error) { setMessage(error instanceof Error ? error.message : "Couldn't save settings."); } });
  }}>
    {!canEdit && <p className="text-sm text-muted-foreground">Only the owner can change kiosk settings.</p>}
    <fieldset disabled={!canEdit || pending} className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">{(["en", "fr"] as const).map(language => <div key={language} className="space-y-4 rounded-xl border p-5">
        <h2 className="font-semibold">{language === "en" ? "English" : "French"}</h2>
        {(["welcome", "instructions"] as const).map(key => <label key={key} className="block text-sm font-medium">
          {key === "welcome" ? "Welcome text" : "Instructions"}
          <textarea value={settings[key][language]} maxLength={1000} rows={key === "welcome" ? 2 : 4} className="mt-1 w-full rounded-md border border-input bg-card p-3" onChange={event => setSettings(previous => ({ ...previous, [key]: { ...previous[key], [language]: event.target.value } }))} />
        </label>)}
      </div>)}</div>
      <section className="rounded-xl border p-5"><h2 className="font-semibold">Optional questions in kiosk mode</h2><p className="mt-1 text-sm text-muted-foreground">Select questions to hide. Standard signing links are unaffected. New or newly required fields stay visible.</p>
        {templates.map(template => <fieldset key={template.id} className="mt-5 space-y-3"><legend className="font-medium">{template.name}</legend>
          {template.fields.filter(kioskFieldCanBeHidden).map(field => <label key={field.key} className="flex items-center gap-3 text-sm">
            <input type="checkbox" className="size-5" checked={settings.hiddenOptionalFields[template.id]?.includes(field.key) ?? false} onChange={event => {
              const checked = event.target.checked;
              setSettings(previous => ({ ...previous, hiddenOptionalFields: { ...previous.hiddenOptionalFields, [template.id]: checked ? [...new Set([...(previous.hiddenOptionalFields[template.id] ?? []), field.key])] : (previous.hiddenOptionalFields[template.id] ?? []).filter(key => key !== field.key) } }));
            }} />Hide {field.label}
          </label>)}
          {!template.fields.some(kioskFieldCanBeHidden) && <p className="text-sm text-muted-foreground">No eligible optional questions.</p>}
        </fieldset>)}
      </section>
      <button className="rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground" type="submit">{pending ? "Saving..." : "Save kiosk settings"}</button>
    </fieldset>
    <p role="status" className="text-sm">{message}</p>
  </form>;
}
