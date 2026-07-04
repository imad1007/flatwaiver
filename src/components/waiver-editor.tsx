"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  Flag,
  GripVertical,
  Heading2,
  List,
  Monitor,
  Pilcrow,
  Plus,
  Rocket,
  Smartphone,
  Trash2,
} from "lucide-react";
import {
  archiveTemplate,
  publishTemplate,
  saveDraft,
  unarchiveTemplate,
} from "@/app/(app)/waivers/actions";
import { BlockView, FieldInput } from "@/components/waiver-render";
import { ShareLinks } from "@/components/share-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  DEFAULT_CONSENT_TEXT,
  type DraftContent,
  type FieldType,
  type TemplateVersion,
  type WaiverBlock,
  type WaiverField,
  type WaiverTemplate,
} from "@/lib/types";
import { APP } from "@/lib/config";

type VersionSummary = Pick<
  TemplateVersion,
  "id" | "template_id" | "version_number" | "minor_mode" | "content_sha256" | "created_at"
>;

interface BlockItem {
  id: string;
  block: WaiverBlock;
}
interface FieldItem {
  id: string;
  field: WaiverField;
}

const FIELD_TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "multiline", label: "Multi-line text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "date", label: "Date" },
  { value: "date_of_birth", label: "Date of birth" },
  { value: "select", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
  { value: "initials", label: "Initials" },
];

const uid = () => crypto.randomUUID();

function toItems(draft: DraftContent): { blocks: BlockItem[]; fields: FieldItem[] } {
  return {
    blocks: draft.blocks.map((block) => ({ id: uid(), block })),
    fields: draft.fields.map((field) => ({ id: uid(), field })),
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
  const initial =
    template.draft_content ?? {
      title: template.name,
      blocks: [{ type: "paragraph" as const, text: "" }],
      fields: [],
      consent_text: DEFAULT_CONSENT_TEXT,
      minor_mode: "allowed" as const,
    };

  const [name, setName] = useState(template.name);
  const [{ blocks, fields }, setItems] = useState(() => toItems(initial));
  const [consentText, setConsentText] = useState(initial.consent_text);
  const [minorMode, setMinorMode] = useState(initial.minor_mode);
  const [warnings] = useState(initial.warnings ?? []);
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishedVersion, setPublishedVersion] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const setBlocks = (updater: (prev: BlockItem[]) => BlockItem[]) =>
    setItems((s) => ({ ...s, blocks: updater(s.blocks) }));
  const setFields = (updater: (prev: FieldItem[]) => FieldItem[]) =>
    setItems((s) => ({ ...s, fields: updater(s.fields) }));

  function buildDraft(): DraftContent {
    return {
      title: name.trim() || template.name,
      blocks: blocks.map((b) => b.block),
      fields: fields.map((f) => f.field),
      consent_text: consentText,
      minor_mode: minorMode,
      warnings: warnings.length ? warnings : undefined,
    };
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await saveDraft(template.id, buildDraft(), name);
        toast.success("Draft saved");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't save the draft.");
      }
    });
  }

  function handlePublish() {
    startTransition(async () => {
      try {
        const result = await publishTemplate(template.id, buildDraft(), name);
        setPublishOpen(false);
        setPublishedVersion(result.versionNumber);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Publish failed.");
      }
    });
  }

  function onBlockDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setBlocks((prev) => {
        const from = prev.findIndex((b) => b.id === active.id);
        const to = prev.findIndex((b) => b.id === over.id);
        return arrayMove(prev, from, to);
      });
    }
  }

  function onFieldDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setFields((prev) => {
        const from = prev.findIndex((f) => f.id === active.id);
        const to = prev.findIndex((f) => f.id === over.id);
        return arrayMove(prev, from, to);
      });
    }
  }

  const nextVersion = (versions[0]?.version_number ?? 0) + 1;
  const baseUrl = (APP.url ?? "").replace(/\/$/, "");

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/waivers"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Waivers
          </Link>
          <div className="mt-1 flex items-center gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Waiver name"
              className="w-full max-w-md rounded-md border border-transparent px-2 py-1 text-2xl font-bold transition-colors hover:border-input focus:border-ring focus:outline-none"
            />
            <StatusBadge status={template.status} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {template.status === "published" && (
            <Button variant="ghost" size="sm" render={<Link href={`/waivers/${template.id}/share`} />}>
              Share
            </Button>
          )}
          <Button variant="outline" onClick={handleSave} disabled={isPending}>
            Save draft
          </Button>
          <Button onClick={() => setPublishOpen(true)} disabled={isPending}>
            <Rocket className="size-4" />
            Publish
          </Button>
        </div>
      </div>

      {/* AI disclaimer + warnings */}
      <div className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
        AI conversion is a draft. Review every clause against your original before
        publishing — you are responsible for the legal text.
      </div>
      {warnings.length > 0 && (
        <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <p className="font-semibold">Conversion warnings</p>
          <ul className="mt-1 list-inside list-disc">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Two-pane layout */}
      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
        {/* ── Editor pane ── */}
        <div className="min-w-0 space-y-10">
          {/* Blocks */}
          <section>
            <SectionTitle
              title="Waiver text"
              sub="The legal content signers read, in order. Drag to reorder."
            />
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onBlockDragEnd}
            >
              <SortableContext
                items={blocks.map((b) => b.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="mt-4 space-y-2.5">
                  {blocks.map((item) => (
                    <SortableBlockCard
                      key={item.id}
                      item={item}
                      onChange={(block) =>
                        setBlocks((prev) =>
                          prev.map((b) => (b.id === item.id ? { ...b, block } : b))
                        )
                      }
                      onRemove={() =>
                        setBlocks((prev) => prev.filter((b) => b.id !== item.id))
                      }
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <div className="mt-3 flex flex-wrap gap-2">
              <AddChip
                icon={Heading2}
                label="Heading"
                onClick={() =>
                  setBlocks((prev) => [
                    ...prev,
                    { id: uid(), block: { type: "heading", text: "" } },
                  ])
                }
              />
              <AddChip
                icon={Pilcrow}
                label="Paragraph"
                onClick={() =>
                  setBlocks((prev) => [
                    ...prev,
                    { id: uid(), block: { type: "paragraph", text: "" } },
                  ])
                }
              />
              <AddChip
                icon={List}
                label="List"
                onClick={() =>
                  setBlocks((prev) => [
                    ...prev,
                    { id: uid(), block: { type: "list", items: [""] } },
                  ])
                }
              />
            </div>
          </section>

          {/* Fields */}
          <section>
            <SectionTitle
              title="Signer fields"
              sub="Inputs the signer fills in. Full legal name and the signature are always included automatically."
            />
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onFieldDragEnd}
            >
              <SortableContext
                items={fields.map((f) => f.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="mt-4 space-y-2.5">
                  {fields.map((item) => (
                    <SortableFieldCard
                      key={item.id}
                      item={item}
                      onChange={(field) =>
                        setFields((prev) =>
                          prev.map((f) => (f.id === item.id ? { ...f, field } : f))
                        )
                      }
                      onRemove={() =>
                        setFields((prev) => prev.filter((f) => f.id !== item.id))
                      }
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <div className="mt-3">
              <AddChip
                icon={Plus}
                label="Add field"
                onClick={() =>
                  setFields((prev) => [
                    ...prev,
                    {
                      id: uid(),
                      field: {
                        key: `field_${prev.length + 1}`,
                        type: "text",
                        label: "",
                        required: false,
                      },
                    },
                  ])
                }
              />
            </div>
          </section>

          {/* Minors */}
          <section>
            <SectionTitle title="Minors" />
            <label className="mt-3 flex items-center gap-3 text-sm">
              <Switch
                checked={minorMode === "allowed"}
                onCheckedChange={(checked) =>
                  setMinorMode(checked ? "allowed" : "disallowed")
                }
              />
              Allow signing for minors (adds guardian name, relationship, and
              signature when the participant is under 18)
            </label>
          </section>

          {/* Consent */}
          <section>
            <SectionTitle
              title="E-sign consent text"
              sub="Shown next to the consent checkbox and stored with every signature."
            />
            <textarea
              value={consentText}
              onChange={(e) => setConsentText(e.target.value)}
              rows={3}
              className="mt-3 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:border-ring focus:outline-none"
            />
          </section>

          {/* Version history */}
          <section>
            <SectionTitle title="Version history" />
            {versions.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Not published yet. Publishing creates version 1.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border/60 rounded-xl border border-border text-sm">
                {versions.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="font-semibold">v{v.version_number}</span>
                    {template.current_version_id === v.id && (
                      <Badge className="bg-success/15 text-success">live</Badge>
                    )}
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
              Versions are immutable. Signed waivers stay locked to the exact
              version they were signed against, forever.
            </p>
          </section>

          {/* Archive */}
          <section className="border-t border-border pt-5">
            {template.status === "archived" ? (
              <button
                onClick={() =>
                  startTransition(async () => {
                    await unarchiveTemplate(template.id);
                    toast.success("Waiver restored");
                    router.refresh();
                  })
                }
                className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
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
                      toast.success("Waiver archived");
                      router.refresh();
                    });
                }}
                className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Archive this waiver
              </button>
            )}
          </section>
        </div>

        {/* ── Live preview pane ── */}
        <div className="lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]">
          <div className="flex h-full flex-col rounded-2xl border border-border bg-muted/40">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Live preview
              </span>
              <div className="flex gap-1">
                <Button
                  variant={device === "mobile" ? "secondary" : "ghost"}
                  size="icon-sm"
                  onClick={() => setDevice("mobile")}
                  aria-label="Mobile preview"
                >
                  <Smartphone className="size-3.5" />
                </Button>
                <Button
                  variant={device === "desktop" ? "secondary" : "ghost"}
                  size="icon-sm"
                  onClick={() => setDevice("desktop")}
                  aria-label="Desktop preview"
                >
                  <Monitor className="size-3.5" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div
                className={cn(
                  "mx-auto bg-background transition-all duration-300",
                  device === "mobile"
                    ? "max-w-[375px] rounded-[1.75rem] border-4 border-foreground/70 p-4 dark:border-foreground/30"
                    : "max-w-full rounded-xl border border-border p-6"
                )}
              >
                <SignerPreview
                  name={name}
                  blocks={blocks.map((b) => b.block)}
                  fields={fields.map((f) => f.field)}
                  consentText={consentText}
                  minorMode={minorMode}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Publish confirmation */}
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Publish version {nextVersion}?</DialogTitle>
            <DialogDescription>
              Publishing locks this exact text as <strong>version {nextVersion}</strong>
              {" "}— {blocks.length} content block{blocks.length === 1 ? "" : "s"},{" "}
              {fields.length} signer field{fields.length === 1 ? "" : "s"}. Signers
              will see it immediately. Versions are immutable: to change anything
              later you&apos;ll publish a new version, and past signatures stay
              locked to the version they signed.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Review every clause against your original — you are responsible for the
            legal text.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishOpen(false)}>
              Keep editing
            </Button>
            <Button onClick={handlePublish} disabled={isPending}>
              {isPending ? "Publishing…" : `Publish v${nextVersion}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish success */}
      <Dialog
        open={publishedVersion !== null}
        onOpenChange={(open) => !open && setPublishedVersion(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-success/15 text-success">
                ✓
              </span>
              Version {publishedVersion} is live
            </DialogTitle>
            <DialogDescription>
              Your waiver is ready to collect signatures. Share it however works
              for your front desk:
            </DialogDescription>
          </DialogHeader>
          <ShareLinks
            signingUrl={`${baseUrl}/w/${template.slug}`}
            kioskUrl={`${baseUrl}/kiosk/${template.slug}`}
            compact
          />
          <DialogFooter>
            <Button
              variant="outline"
              render={<Link href={`/waivers/${template.id}/share`} />}
            >
              Open share page
            </Button>
            <Button onClick={() => setPublishedVersion(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Sortable cards ───────────────────────────────────────────────────────────

function SortableBlockCard({
  item,
  onChange,
  onRemove,
}: {
  item: BlockItem;
  onChange: (block: WaiverBlock) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const block = item.block;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-lg border border-border bg-card shadow-card",
        isDragging && "z-10 opacity-80 shadow-pop"
      )}
    >
      <div className="flex items-center gap-2 px-3 pt-2.5">
        <button
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="cursor-grab touch-none text-muted-foreground/50 transition-colors hover:text-muted-foreground active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          {block.type}
        </span>
        <button
          onClick={onRemove}
          aria-label="Remove block"
          className="ml-auto text-muted-foreground/50 transition-colors hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <div className="px-3 pb-3 pt-1.5">
        {block.type === "heading" && (
          <input
            value={block.text}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            placeholder="Heading text"
            className="w-full rounded border border-border bg-background px-2 py-1.5 font-bold focus:border-ring focus:outline-none"
          />
        )}
        {block.type === "paragraph" && (
          <textarea
            value={block.text}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            placeholder="Paragraph text"
            rows={Math.min(10, Math.max(2, Math.ceil(block.text.length / 90)))}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:border-ring focus:outline-none"
          />
        )}
        {block.type === "list" && (
          <div className="space-y-1.5">
            {block.items.map((listItem, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-muted-foreground/70">•</span>
                <input
                  value={listItem}
                  onChange={(e) =>
                    onChange({
                      ...block,
                      items: block.items.map((x, j) => (j === i ? e.target.value : x)),
                    })
                  }
                  className="w-full rounded border border-border bg-background px-2 py-1 text-sm focus:border-ring focus:outline-none"
                />
                <button
                  onClick={() =>
                    onChange({ ...block, items: block.items.filter((_, j) => j !== i) })
                  }
                  aria-label="Remove item"
                  className="text-muted-foreground/50 hover:text-destructive"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))}
            <button
              onClick={() => onChange({ ...block, items: [...block.items, ""] })}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              + item
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SortableFieldCard({
  item,
  onChange,
  onRemove,
}: {
  item: FieldItem;
  onChange: (field: WaiverField) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const field = item.field;
  const hasFlags = (field.flag_values?.length ?? 0) > 0;

  function toggleOptionFlag(option: string, flagged: boolean) {
    const current = new Set(field.flag_values ?? []);
    if (flagged) current.add(option);
    else current.delete(option);
    onChange({ ...field, flag_values: current.size ? [...current] : undefined });
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-lg border border-border bg-card p-3 shadow-card",
        isDragging && "z-10 opacity-80 shadow-pop"
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="cursor-grab touch-none text-muted-foreground/50 transition-colors hover:text-muted-foreground active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
        <input
          value={field.label}
          onChange={(e) => onChange({ ...field, label: e.target.value })}
          placeholder="Label shown to signer"
          className="min-w-36 flex-1 rounded border border-border bg-background px-2 py-1.5 text-sm focus:border-ring focus:outline-none"
        />
        <select
          value={field.type}
          onChange={(e) => {
            const type = e.target.value as FieldType;
            onChange({
              ...field,
              type,
              options:
                type === "select" ? field.options ?? ["Yes", "No"] : undefined,
              flag_values:
                type === "select" || type === "checkbox" ? field.flag_values : undefined,
            });
          }}
          className="rounded border border-border bg-background px-2 py-1.5 text-sm focus:border-ring focus:outline-none"
        >
          {FIELD_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Switch
            size="sm"
            checked={field.required}
            onCheckedChange={(checked) => onChange({ ...field, required: checked })}
          />
          required
        </label>
        {hasFlags && (
          <span title="Answers can flag this waiver">
            <Flag className="size-3.5 text-warning" />
          </span>
        )}
        <button
          onClick={onRemove}
          aria-label="Remove field"
          className="text-muted-foreground/50 transition-colors hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 pl-6">
        <span className="text-[10px] text-muted-foreground/70">key</span>
        <input
          value={field.key}
          onChange={(e) =>
            onChange({
              ...field,
              key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
            })
          }
          className="w-40 rounded border border-border bg-background px-2 py-1 font-mono text-xs focus:border-ring focus:outline-none"
        />
      </div>

      {/* Dropdown options + flags */}
      {field.type === "select" && (
        <div className="mt-3 space-y-1.5 border-t border-border/60 pl-6 pt-3">
          <p className="text-xs font-medium text-muted-foreground">
            Options — check <Flag className="inline size-3 text-warning" /> to flag
            that answer for staff attention:
          </p>
          {(field.options ?? []).map((option, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={option}
                onChange={(e) => {
                  const next = [...(field.options ?? [])];
                  const old = next[i];
                  next[i] = e.target.value;
                  // Keep flag selection following the renamed option
                  const flags = (field.flag_values ?? []).map((v) =>
                    v === old ? e.target.value : v
                  );
                  onChange({
                    ...field,
                    options: next,
                    flag_values: flags.length ? flags : undefined,
                  });
                }}
                className="w-48 rounded border border-border bg-background px-2 py-1 text-sm focus:border-ring focus:outline-none"
              />
              <label
                className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground"
                title="Flag signed waivers with this answer"
              >
                <input
                  type="checkbox"
                  checked={(field.flag_values ?? []).includes(option)}
                  onChange={(e) => toggleOptionFlag(option, e.target.checked)}
                  className="size-3.5 accent-warning"
                />
                <Flag className="size-3 text-warning" />
              </label>
              <button
                onClick={() => {
                  const next = (field.options ?? []).filter((_, j) => j !== i);
                  const flags = (field.flag_values ?? []).filter((v) => v !== option);
                  onChange({
                    ...field,
                    options: next,
                    flag_values: flags.length ? flags : undefined,
                  });
                }}
                aria-label="Remove option"
                className="text-muted-foreground/50 hover:text-destructive"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              onChange({
                ...field,
                options: [...(field.options ?? []), `Option ${(field.options?.length ?? 0) + 1}`],
              })
            }
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            + option
          </button>
        </div>
      )}

      {/* Checkbox flag */}
      {field.type === "checkbox" && (
        <label className="mt-3 flex items-center gap-2 border-t border-border/60 pl-6 pt-3 text-xs text-muted-foreground">
          <Switch
            size="sm"
            checked={(field.flag_values ?? []).includes("yes")}
            onCheckedChange={(checked) =>
              onChange({ ...field, flag_values: checked ? ["yes"] : undefined })
            }
          />
          <Flag className="size-3 text-warning" />
          Flag signed waivers when this box is checked
        </label>
      )}
    </div>
  );
}

// ── Preview ──────────────────────────────────────────────────────────────────

function SignerPreview({
  name,
  blocks,
  fields,
  consentText,
  minorMode,
}: {
  name: string;
  blocks: WaiverBlock[];
  fields: WaiverField[];
  consentText: string;
  minorMode: "allowed" | "disallowed";
}) {
  return (
    <div className="pointer-events-none space-y-4 text-left" aria-hidden>
      <div>
        <h2 className="text-lg font-bold">{name || "Untitled waiver"}</h2>
        <p className="text-xs text-muted-foreground">
          Please read the waiver below, fill in your details, and sign.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-card p-3">
        {blocks.length === 0 ? (
          <p className="text-sm text-muted-foreground/70">Waiver text appears here…</p>
        ) : (
          blocks.map((block, i) => <BlockView key={i} block={block} />)
        )}
      </div>

      {fields.length > 0 && (
        <div className="space-y-3">
          {fields.map((field, i) => (
            <FieldInput
              key={i}
              field={{ ...field, label: field.label || "Untitled field" }}
              value={field.type === "checkbox" ? false : ""}
              onChange={() => {}}
              disabled
            />
          ))}
        </div>
      )}

      {minorMode === "allowed" && (
        <div className="rounded-lg border border-border bg-card p-3 text-sm">
          <label className="flex items-center gap-2.5">
            <input type="checkbox" disabled className="size-4" />
            <span className="font-medium">The participant is under 18</span>
          </label>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-3">
        <label className="flex items-start gap-2.5">
          <input type="checkbox" disabled className="mt-0.5 size-4" />
          <span className="text-xs leading-relaxed">{consentText}</span>
        </label>
      </div>

      <div className="space-y-2">
        <div>
          <span className="mb-1 block text-sm font-medium text-foreground/90">
            Full legal name
          </span>
          <div className="h-10 rounded-md border border-input bg-card" />
        </div>
        <div>
          <span className="mb-1 block text-sm font-medium text-foreground/90">
            Your signature
          </span>
          <div className="flex h-24 items-center justify-center rounded-md border border-input bg-card text-xs text-muted-foreground/60">
            Signature canvas
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-primary py-3 text-center text-sm font-semibold text-primary-foreground">
        Sign waiver
      </div>
    </div>
  );
}

// ── Small pieces ─────────────────────────────────────────────────────────────

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div>
      <h2 className="text-lg font-bold">{title}</h2>
      {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

function AddChip({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-input px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    published: "bg-success/15 text-success",
    archived: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  };
  return <Badge className={cn("shrink-0", styles[status])}>{status}</Badge>;
}
