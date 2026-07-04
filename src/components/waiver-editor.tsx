"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  archiveTemplate,
  publishTemplate,
  saveDraft,
  unarchiveTemplate,
} from "@/app/(app)/waivers/actions";
import {
  DEFAULT_CONSENT_TEXT,
  type DraftContent,
  type FieldType,
  type TemplateVersion,
  type WaiverBlock,
  type WaiverField,
  type WaiverTemplate,
} from "@/lib/types";

type VersionSummary = Pick<
  TemplateVersion,
  "id" | "template_id" | "version_number" | "minor_mode" | "content_sha256" | "created_at"
>;

const FIELD_TYPES: FieldType[] = [
  "name",
  "email",
  "phone",
  "date_of_birth",
  "text",
  "checkbox",
  "initials",
];

function emptyDraft(name: string): DraftContent {
  return {
    title: name,
    blocks: [{ type: "paragraph", text: "" }],
    fields: [],
    consent_text: DEFAULT_CONSENT_TEXT,
    minor_mode: "allowed",
  };
}

export function WaiverEditor({
  template,
  versions,
}: {
  template: WaiverTemplate;
  versions: VersionSummary[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<DraftContent>(
    template.draft_content ?? emptyDraft(template.name)
  );
  const [name, setName] = useState(template.name);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function update(patch: Partial<DraftContent>) {
    setDraft((d) => ({ ...d, ...patch }));
    setMessage(null);
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await saveDraft(template.id, draft, name);
        setMessage("Draft saved.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed.");
      }
    });
  }

  function handlePublish() {
    if (
      !confirm(
        "Publish this waiver? This creates a new locked version. Signers will see exactly this text — review every clause against your original first."
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      try {
        await publishTemplate(template.id, draft, name);
        setMessage("Published.");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Publish failed.");
      }
    });
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/waivers" className="text-sm text-muted-foreground hover:underline">
            ← Waivers
          </Link>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full max-w-md rounded-md border border-transparent px-2 py-1 text-2xl font-bold hover:border-input focus:border-ring focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
            {template.status}
          </span>
          {template.status === "published" && (
            <Link
              href={`/waivers/${template.id}/share`}
              className="text-sm font-medium underline"
            >
              Share
            </Link>
          )}
          <button
            onClick={handleSave}
            disabled={isPending}
            className="rounded-md border border-input px-4 py-2 text-sm font-semibold hover:border-ring disabled:opacity-50"
          >
            Save draft
          </button>
          <button
            onClick={handlePublish}
            disabled={isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Publish
          </button>
        </div>
      </div>

      {message && <p className="mt-3 text-sm text-success">{message}</p>}
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      {/* AI draft disclaimer */}
      <div className="mt-6 rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
        AI conversion is a draft. Review every clause against your original before
        publishing — you are responsible for the legal text.
      </div>

      {draft.warnings && draft.warnings.length > 0 && (
        <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <p className="font-semibold">Conversion warnings:</p>
          <ul className="mt-1 list-inside list-disc">
            {draft.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Blocks */}
      <section className="mt-8">
        <h2 className="text-lg font-bold">Waiver text</h2>
        <p className="text-sm text-muted-foreground">
          This is the legal content signers will read, in order.
        </p>
        <div className="mt-4 space-y-3">
          {draft.blocks.map((block, i) => (
            <BlockEditor
              key={i}
              block={block}
              onChange={(b) =>
                update({ blocks: draft.blocks.map((x, j) => (j === i ? b : x)) })
              }
              onRemove={() =>
                update({ blocks: draft.blocks.filter((_, j) => j !== i) })
              }
              onMoveUp={
                i > 0
                  ? () => update({ blocks: swap(draft.blocks, i, i - 1) })
                  : undefined
              }
              onMoveDown={
                i < draft.blocks.length - 1
                  ? () => update({ blocks: swap(draft.blocks, i, i + 1) })
                  : undefined
              }
            />
          ))}
        </div>
        <div className="mt-3 flex gap-2 text-sm">
          <AddButton
            label="+ Heading"
            onClick={() =>
              update({ blocks: [...draft.blocks, { type: "heading", text: "" }] })
            }
          />
          <AddButton
            label="+ Paragraph"
            onClick={() =>
              update({ blocks: [...draft.blocks, { type: "paragraph", text: "" }] })
            }
          />
          <AddButton
            label="+ List"
            onClick={() =>
              update({ blocks: [...draft.blocks, { type: "list", items: [""] }] })
            }
          />
        </div>
      </section>

      {/* Fields */}
      <section className="mt-10">
        <h2 className="text-lg font-bold">Signer fields</h2>
        <p className="text-sm text-muted-foreground">
          Inputs the signer fills in. Full legal name and the signature are always
          included automatically.
        </p>
        <div className="mt-4 space-y-2">
          {draft.fields.map((field, i) => (
            <FieldEditor
              key={i}
              field={field}
              onChange={(f) =>
                update({ fields: draft.fields.map((x, j) => (j === i ? f : x)) })
              }
              onRemove={() =>
                update({ fields: draft.fields.filter((_, j) => j !== i) })
              }
            />
          ))}
        </div>
        <div className="mt-3">
          <AddButton
            label="+ Add field"
            onClick={() =>
              update({
                fields: [
                  ...draft.fields,
                  {
                    key: `field_${draft.fields.length + 1}`,
                    type: "text",
                    label: "",
                    required: false,
                  },
                ],
              })
            }
          />
        </div>
      </section>

      {/* Minors */}
      <section className="mt-10">
        <h2 className="text-lg font-bold">Minors</h2>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.minor_mode === "allowed"}
            onChange={(e) =>
              update({ minor_mode: e.target.checked ? "allowed" : "disallowed" })
            }
          />
          Allow minors to be signed for (adds guardian name, relationship, and
          guardian signature when the signer is under 18)
        </label>
      </section>

      {/* Consent text */}
      <section className="mt-10">
        <h2 className="text-lg font-bold">E-sign consent text</h2>
        <p className="text-sm text-muted-foreground">
          Shown next to the consent checkbox and stored with every signature.
        </p>
        <textarea
          value={draft.consent_text}
          onChange={(e) => update({ consent_text: e.target.value })}
          rows={3}
          className="mt-3 w-full rounded-md border border-input px-3 py-2 text-sm focus:border-ring focus:outline-none"
        />
      </section>

      {/* Version history */}
      <section className="mt-10">
        <h2 className="text-lg font-bold">Version history</h2>
        {versions.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Not published yet. Publishing creates version 1.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border/60 rounded-xl border border-border text-sm">
            {versions.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="font-semibold">
                  v{v.version_number}
                  {template.current_version_id === v.id && (
                    <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                      live
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground">
                  {new Date(v.created_at).toLocaleString()}
                </span>
                <span
                  className="ml-auto font-mono text-xs text-muted-foreground/70"
                  title="SHA-256 of this version's content"
                >
                  {v.content_sha256.slice(0, 16)}…
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted-foreground/70">
          Versions are immutable. Signed waivers stay locked to the exact version
          they were signed against, forever.
        </p>
      </section>

      {/* Archive */}
      <section className="mt-10 border-t border-border pt-6">
        {template.status === "archived" ? (
          <button
            onClick={() =>
              startTransition(async () => {
                await unarchiveTemplate(template.id);
                router.refresh();
              })
            }
            className="text-sm text-muted-foreground underline hover:text-foreground"
          >
            Restore this waiver
          </button>
        ) : (
          <button
            onClick={() => {
              if (
                confirm(
                  "Archive this waiver? The public signing link will stop working. Existing signed waivers are unaffected."
                )
              )
                startTransition(async () => {
                  await archiveTemplate(template.id);
                  router.refresh();
                });
            }}
            className="text-sm text-muted-foreground underline hover:text-foreground"
          >
            Archive this waiver
          </button>
        )}
      </section>
    </div>
  );
}

function swap<T>(arr: T[], i: number, j: number): T[] {
  const copy = [...arr];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-input px-3 py-1.5 text-sm hover:border-ring"
    >
      {label}
    </button>
  );
}

function BlockEditor({
  block,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  block: WaiverBlock;
  onChange: (b: WaiverBlock) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground/70">
        <span className="uppercase tracking-wide">{block.type}</span>
        <span className="flex gap-2">
          {onMoveUp && (
            <button type="button" onClick={onMoveUp} title="Move up">
              ↑
            </button>
          )}
          {onMoveDown && (
            <button type="button" onClick={onMoveDown} title="Move down">
              ↓
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            className="text-destructive/60 hover:text-destructive"
            title="Remove block"
          >
            ✕
          </button>
        </span>
      </div>

      {block.type === "heading" && (
        <input
          value={block.text}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
          placeholder="Heading text"
          className="mt-2 w-full rounded border border-border px-2 py-1.5 font-bold focus:border-ring focus:outline-none"
        />
      )}
      {block.type === "paragraph" && (
        <textarea
          value={block.text}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
          placeholder="Paragraph text"
          rows={Math.min(10, Math.max(2, Math.ceil(block.text.length / 90)))}
          className="mt-2 w-full rounded border border-border px-2 py-1.5 text-sm focus:border-ring focus:outline-none"
        />
      )}
      {block.type === "list" && (
        <div className="mt-2 space-y-1.5">
          {block.items.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-muted-foreground/70">•</span>
              <input
                value={item}
                onChange={(e) =>
                  onChange({
                    ...block,
                    items: block.items.map((x, j) => (j === i ? e.target.value : x)),
                  })
                }
                className="w-full rounded border border-border px-2 py-1 text-sm focus:border-ring focus:outline-none"
              />
              <button
                type="button"
                onClick={() =>
                  onChange({ ...block, items: block.items.filter((_, j) => j !== i) })
                }
                className="text-xs text-destructive/60 hover:text-destructive"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange({ ...block, items: [...block.items, ""] })}
            className="text-xs text-muted-foreground underline"
          >
            + item
          </button>
        </div>
      )}
    </div>
  );
}

function FieldEditor({
  field,
  onChange,
  onRemove,
}: {
  field: WaiverField;
  onChange: (f: WaiverField) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3 text-sm">
      <input
        value={field.label}
        onChange={(e) => onChange({ ...field, label: e.target.value })}
        placeholder="Label shown to signer"
        className="min-w-40 flex-1 rounded border border-border px-2 py-1.5 focus:border-ring focus:outline-none"
      />
      <input
        value={field.key}
        onChange={(e) =>
          onChange({
            ...field,
            key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
          })
        }
        placeholder="snake_case_key"
        className="w-40 rounded border border-border px-2 py-1.5 font-mono text-xs focus:border-ring focus:outline-none"
      />
      <select
        value={field.type}
        onChange={(e) => onChange({ ...field, type: e.target.value as FieldType })}
        className="rounded border border-border px-2 py-1.5"
      >
        {FIELD_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={field.required}
          onChange={(e) => onChange({ ...field, required: e.target.checked })}
        />
        required
      </label>
      <button
        type="button"
        onClick={onRemove}
        className="text-destructive/60 hover:text-destructive"
        title="Remove field"
      >
        ✕
      </button>
    </div>
  );
}
