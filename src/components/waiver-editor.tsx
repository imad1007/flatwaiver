"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  AlertTriangle,
  CalendarDays,
  CheckSquare,
  Copy,
  Eye,
  Flag,
  GripVertical,
  Heading2,
  List,
  ListChecks,
  Mail,
  Monitor,
  Pilcrow,
  Phone,
  Plus,
  Rocket,
  Settings,
  Smartphone,
  TextCursorInput,
  Trash2,
  UserRoundCheck,
} from "lucide-react";
import {
  archiveTemplate,
  publishTemplate,
  saveDraft,
  unarchiveTemplate,
} from "@/app/(app)/waivers/actions";
import { BlockView, FieldInput } from "@/components/waiver-render";
import { ShareLinks } from "@/components/share-panel";
import { FileDownloadButton } from "@/components/file-download-button";
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
import { trackProductEvent } from "@/lib/product-analytics";
import { draftContentSchema } from "@/lib/waiver-schema";
import { SIGNER_LANGUAGES, signerLanguage, signerDirection, signerText } from "@/lib/signer-language";
import { FRENCH_DEFAULT_CONSENT } from "@/lib/signer-consent";

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

interface DraftRecovery {
  draft: DraftContent;
  name: string;
  savedAt: string;
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

function moveItem<T extends { id: string }>(items: T[], id: string, direction: -1 | 1) {
  const from = items.findIndex((item) => item.id === id);
  const to = from + direction;
  return from < 0 || to < 0 || to >= items.length ? items : arrayMove(items, from, to);
}

function toItems(draft: DraftContent): { blocks: BlockItem[]; fields: FieldItem[] } {
  return {
    blocks: draft.blocks.map((block) => ({ id: uid(), block })),
    fields: draft.fields.map((field) => ({ id: uid(), field })),
  };
}

export function WaiverEditor({
  template,
  versions,
  settings,
}: {
  template: WaiverTemplate;
  versions: VersionSummary[];
  settings: React.ReactNode;
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
  const [groupSigning, setGroupSigning] = useState(initial.group_signing_enabled ?? false);
  const [language, setLanguage] = useState(signerLanguage(initial.signer_language));
  const [translateContent, setTranslateContent] = useState(initial.translate_content ?? false);
  const [translating, setTranslating] = useState(false);
  const [translationPreview, setTranslationPreview] = useState<{ draft: DraftContent; source: string } | null>(null);
  const [translationUndo, setTranslationUndo] = useState<DraftContent | null>(null);
  const [warnings, setWarnings] = useState(initial.warnings ?? []);
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [publishOpen, setPublishOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [publishedVersion, setPublishedVersion] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [recovery, setRecovery] = useState<DraftRecovery | null>(null);
  const recoveryChecked = useRef(false);
  const recoveryKey = `flatwaiver:draft:${template.id}`;
  const currentDraft = useMemo<DraftContent>(
    () => ({
      title: name.trim() || template.name,
      blocks: blocks.map((b) => b.block),
      fields: fields.map((f) => f.field),
      consent_text: consentText,
      minor_mode: minorMode,
      group_signing_enabled: groupSigning,
      signer_language: language,
      translate_content: translateContent,
      warnings: warnings.length ? warnings : undefined,
    }),
    [blocks, consentText, fields, minorMode, groupSigning, language, translateContent, name, template.name, warnings]
  );
  const currentFingerprint = JSON.stringify(currentDraft);
  const [savedFingerprint, setSavedFingerprint] = useState(() =>
    JSON.stringify({
      ...initial,
      group_signing_enabled: initial.group_signing_enabled ?? false,
      signer_language: signerLanguage(initial.signer_language),
      translate_content: initial.translate_content ?? false,
      title: template.name.trim() || initial.title,
      warnings: warnings.length ? warnings : undefined,
    })
  );
  const hasUnsavedChanges = currentFingerprint !== savedFingerprint;

  useEffect(() => {
    let timeout: number | undefined;
    try {
      const raw = window.sessionStorage.getItem(recoveryKey);
      if (raw) {
        const candidate = JSON.parse(raw) as Partial<DraftRecovery>;
        const parsedDraft = draftContentSchema.safeParse(candidate.draft);
        if (
          parsedDraft.success &&
          typeof candidate.name === "string" &&
          typeof candidate.savedAt === "string" &&
          JSON.stringify(parsedDraft.data) !== savedFingerprint
        ) {
          timeout = window.setTimeout(
            () =>
              setRecovery({
                draft: parsedDraft.data,
                name: candidate.name as string,
                savedAt: candidate.savedAt as string,
              }),
            0,
          );
        } else {
          window.sessionStorage.removeItem(recoveryKey);
        }
      }
    } catch {
      // Ignore malformed or unavailable tab storage.
    } finally {
      recoveryChecked.current = true;
    }
    return () => window.clearTimeout(timeout);
  }, [recoveryKey, savedFingerprint]);

  useEffect(() => {
    if (!recoveryChecked.current || !hasUnsavedChanges) return;
    const timeout = window.setTimeout(() => {
      const backup: DraftRecovery = {
        draft: currentDraft,
        name,
        savedAt: new Date().toISOString(),
      };
      try {
        window.sessionStorage.setItem(recoveryKey, JSON.stringify(backup));
      } catch {
        // Server persistence remains available when tab storage is unavailable.
      }
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [currentDraft, hasUnsavedChanges, name, recoveryKey]);

  useEffect(() => {
    function warnBeforeUnload(event: BeforeUnloadEvent) {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
    }
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasUnsavedChanges]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const setBlocks = (updater: (prev: BlockItem[]) => BlockItem[]) =>
    setItems((s) => ({ ...s, blocks: updater(s.blocks) }));
  const setFields = (updater: (prev: FieldItem[]) => FieldItem[]) =>
    setItems((s) => ({ ...s, fields: updater(s.fields) }));

  function addBlock(type: WaiverBlock["type"]) {
    const block: WaiverBlock =
      type === "list"
        ? { type: "list", items: [""] }
        : { type, text: "" };
    setBlocks((prev) => [...prev, { id: uid(), block }]);
  }

  function uniqueFieldKey(base: string, items = fields) {
    const normalized = base.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    const keys = new Set(items.map(({ field }) => field.key));
    if (!keys.has(normalized)) return normalized;
    let suffix = 2;
    while (keys.has(`${normalized}_${suffix}`)) suffix += 1;
    return `${normalized}_${suffix}`;
  }

  function addField(type: FieldType = "text", label = "") {
    const base = label ? label.toLowerCase().replace(/[^a-z0-9]+/g, "_") : `field_${fields.length + 1}`;
    setFields((prev) => [
      ...prev,
      {
        id: uid(),
        field: {
          key: uniqueFieldKey(base, prev),
          type,
          label,
          required: false,
          ...(type === "select" ? { options: ["Yes", "No"] } : {}),
        },
      },
    ]);
  }

  function moveBlock(id: string, direction: -1 | 1) {
    setBlocks((prev) => moveItem(prev, id, direction));
  }

  function moveField(id: string, direction: -1 | 1) {
    setFields((prev) => moveItem(prev, id, direction));
  }

  function buildDraft(): DraftContent {
    return currentDraft;
  }

  function loadTranslatedDraft(draft: DraftContent) {
    setName(draft.title);
    setItems(toItems(draft));
    setConsentText(draft.consent_text);
    setGroupSigning(draft.group_signing_enabled ?? false);
    setLanguage(signerLanguage(draft.signer_language));
    setTranslationPreview(null);
  }

  async function translateEntireWaiver() {
    if (translating) return;
    setTranslating(true);
    setTranslationPreview(null);
    const source = JSON.stringify(currentDraft);
    try {
      const response = await fetch("/api/waivers/translate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: template.id, draft: currentDraft }),
        signal: AbortSignal.timeout(115000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Translation failed.");
      setTranslationPreview({ draft: draftContentSchema.parse(result.draft), source });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Translation failed. Your original draft is unchanged.");
    } finally { setTranslating(false); }
  }

  function clearRecovery() {
    try {
      window.sessionStorage.removeItem(recoveryKey);
    } catch {
      // Nothing else is required when tab storage is unavailable.
    }
    setRecovery(null);
  }

  function restoreRecovery() {
    if (!recovery) return;
    setName(recovery.name);
    setItems(toItems(recovery.draft));
    setConsentText(recovery.draft.consent_text);
    setMinorMode(recovery.draft.minor_mode);
    setGroupSigning(recovery.draft.group_signing_enabled ?? false);
    setLanguage(signerLanguage(recovery.draft.signer_language));
    setTranslateContent(recovery.draft.translate_content ?? false);
    setWarnings(recovery.draft.warnings ?? []);
    setRecovery(null);
    toast.success("Recovered your unsaved changes");
  }

  function confirmDiscard(event: React.MouseEvent<HTMLAnchorElement>) {
    if (
      hasUnsavedChanges &&
      !window.confirm("Leave without saving your changes?")
    ) {
      event.preventDefault();
    }
  }

  function handleSave() {
    startTransition(async () => {
      try {
        const draft = buildDraft();
        await saveDraft(template.id, draft, name);
        setSavedFingerprint(JSON.stringify(draft));
        clearRecovery();
        trackProductEvent("waiver_draft_saved", {
          block_count: draft.blocks.length,
          field_count: draft.fields.length,
        });
        toast.success("Draft saved");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't save the draft.");
      }
    });
  }

  function handlePublish() {
    startTransition(async () => {
      try {
        const draft = buildDraft();
        const result = await publishTemplate(template.id, draft, name);
        setSavedFingerprint(JSON.stringify(draft));
        clearRecovery();
        trackProductEvent("waiver_published", {
          version_number: result.versionNumber,
          block_count: draft.blocks.length,
          field_count: draft.fields.length,
        });
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
  const liveVersion = versions.find((v) => v.id === template.current_version_id)?.version_number;
  const currentVersionLabel = liveVersion ? `v${liveVersion}` : "Draft";
  const baseUrl = (APP.url ?? "").replace(/\/$/, "");

  return (
    <div className="pb-4">
      {/* Header */}
      <header className="sticky top-14 z-20 -mx-4 flex flex-wrap items-center justify-between gap-3 border-y border-border bg-background/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/waivers"
            onClick={confirmDiscard}
            aria-label="Back to waivers"
            title="Back to waivers"
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Waiver name"
              className="w-full max-w-sm truncate rounded border border-transparent bg-transparent px-1 text-sm font-semibold transition-colors hover:border-input focus:border-ring focus:outline-none sm:text-base"
            />
            <p className="px-1 text-[11px] text-muted-foreground">{currentVersionLabel}</p>
          </div>
          <StatusBadge status={template.status} />
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
          <span aria-live="polite" className={cn("mr-1 hidden text-xs sm:inline", hasUnsavedChanges ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground")}>
            {isPending ? "Saving…" : hasUnsavedChanges ? "Unsaved changes" : "Saved ✓"}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setToolsOpen(true)} className="xl:hidden">
            <Plus className="size-4" /> Add
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings className="size-4" />
            <span className="hidden sm:inline">Settings</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setPreviewOpen(true)}>
            <Eye className="size-4" /> Preview
          </Button>
          {template.status === "published" && (
            <Button
              variant="ghost"
              size="sm"
              render={
                <Link
                  href={`/waivers/${template.id}/share`}
                  onClick={confirmDiscard}
                />
              }
            >
              Share
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleSave} disabled={isPending || !hasUnsavedChanges}>
            Save
          </Button>
          <Button onClick={() => setPublishOpen(true)} disabled={isPending}>
            <Rocket className="size-4" />
            Publish
          </Button>
        </div>
      </header>

      {recovery && (
        <div
          role="status"
          className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-2.5"
        >
          <div>
            <p className="text-sm font-semibold">Resume your previous edits</p>
            <p className="text-xs text-muted-foreground">
              This tab kept a backup from {new Date(recovery.savedAt).toLocaleString()}.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={clearRecovery}>
              Discard backup
            </Button>
            <Button size="sm" onClick={restoreRecovery}>
              Restore changes
            </Button>
          </div>
        </div>
      )}

      {/* Import diagnostics stay available without competing with the document. */}
      {(warnings.length > 0 || template.source_pdf_path) && (
      <div className="mt-3 flex flex-wrap items-start gap-3 rounded-xl border border-border bg-card px-3 py-2">
      {warnings.length > 0 && (
        <details className="group min-w-0 flex-1 text-sm">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-2 py-2 font-medium text-amber-800 dark:text-amber-300">
            <AlertTriangle className="size-4" />
            {warnings.length} import issue{warnings.length === 1 ? "" : "s"}
            <span className="ml-auto text-xs font-normal text-muted-foreground group-open:hidden">Review</span>
          </summary>
          <ul className="list-disc space-y-1 border-t border-amber-500/20 px-8 py-3 text-muted-foreground">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}
      {template.source_pdf_path && (
        <div className="ml-auto shrink-0">
          <FileDownloadButton
            bucket="uploads"
            path={template.source_pdf_path}
            label="Compare with original"
            variant="outline"
          />
        </div>
      )}
      </div>
      )}

      {/* Builder workspace */}
      <div className="mt-4 grid items-start gap-5 xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden max-h-[calc(100vh-6.5rem)] overflow-y-auto rounded-2xl border border-border bg-card p-3 shadow-card xl:sticky xl:top-20 xl:block">
          <div className="mb-3 border-b border-border px-2 pb-3">
            <p className="text-sm font-semibold">Build your waiver</p>
            <p className="mt-1 text-xs text-muted-foreground">Choose a block to add it.</p>
          </div>
          <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Document blocks</p>
          <div className="space-y-1.5">
            <PaletteButton icon={Heading2} label="Heading" onClick={() => addBlock("heading")} />
            <PaletteButton icon={Pilcrow} label="Rich text" onClick={() => addBlock("paragraph")} />
            <PaletteButton icon={List} label="List" onClick={() => addBlock("list")} />
          </div>
          <div className="my-3 border-t border-border" />
          <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Signer input</p>
          <div className="space-y-1.5">
            <PaletteButton icon={TextCursorInput} label="Short answer" onClick={() => addField("text", "Question")} />
            <PaletteButton icon={Pilcrow} label="Long answer" onClick={() => addField("multiline", "Question")} />
            <PaletteButton icon={Mail} label="Email" onClick={() => addField("email", "Email address")} />
            <PaletteButton icon={Phone} label="Phone" onClick={() => addField("phone", "Phone number")} />
            <PaletteButton icon={CalendarDays} label="Date" onClick={() => addField("date", "Date")} />
            <PaletteButton icon={CalendarDays} label="Date of birth" onClick={() => addField("date_of_birth", "Date of birth")} />
            <PaletteButton icon={ListChecks} label="Dropdown" onClick={() => addField("select", "Choose an option")} />
            <PaletteButton icon={CheckSquare} label="Checkbox" onClick={() => addField("checkbox", "I agree")} />
            <PaletteButton icon={UserRoundCheck} label="Initials" onClick={() => addField("initials", "Initials")} />
          </div>
          <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">Full legal name, e-sign consent, and signature capture are included automatically.</p>
        </aside>

        {/* Editor pane */}
        <main className="min-w-0 w-full max-w-4xl justify-self-center">
          {/* Blocks */}
          <section id="waiver-content" className="scroll-mt-24 rounded-t-2xl border border-border bg-card px-6 pt-5 pb-4 shadow-sm sm:px-10 sm:pt-6">
            <SectionTitle
              title="Waiver document"
              sub="Click any text to edit. Drag blocks to change their order."
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
                <div className="mt-6 space-y-1">
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
                      onDuplicate={() => setBlocks((prev) => {
                        const index = prev.findIndex((block) => block.id === item.id);
                        if (index < 0) return prev;
                        const copy: BlockItem = { id: uid(), block: structuredClone(prev[index].block) };
                        return [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)];
                      })}
                      onMoveUp={() => moveBlock(item.id, -1)}
                      onMoveDown={() => moveBlock(item.id, 1)}
                      first={item.id === blocks[0]?.id}
                      last={item.id === blocks.at(-1)?.id}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <div className="mt-5 flex flex-wrap gap-2 border-t border-dashed border-border pt-4 xl:hidden">
              <AddChip
                icon={Heading2}
                label="Heading"
                onClick={() => addBlock("heading")}
              />
              <AddChip
                icon={Pilcrow}
                label="Paragraph"
                onClick={() => addBlock("paragraph")}
              />
              <AddChip
                icon={List}
                label="List"
                onClick={() => addBlock("list")}
              />
            </div>
          </section>

          {/* Fields */}
          <section id="signer-fields" className="scroll-mt-24 border-x border-border bg-card px-6 py-6 sm:px-10">
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
                <div className="mt-4 space-y-3">
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
                      onDuplicate={() => setFields((prev) => {
                        const index = prev.findIndex((field) => field.id === item.id);
                        if (index < 0) return prev;
                        const source = prev[index].field;
                        const copy: FieldItem = {
                          id: uid(),
                          field: {
                            ...structuredClone(source),
                            key: uniqueFieldKey(`${source.key}_copy`, prev),
                            label: `${source.label || "Untitled field"} copy`,
                          },
                        };
                        return [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)];
                      })}
                      onMoveUp={() => moveField(item.id, -1)}
                      onMoveDown={() => moveField(item.id, 1)}
                      first={item.id === fields[0]?.id}
                      last={item.id === fields.at(-1)?.id}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <div className="mt-4 xl:hidden">
              <AddChip
                icon={Plus}
                label="Add field"
                onClick={() => addField()}
              />
            </div>
          </section>

          {/* Consent */}
          <section className="rounded-b-2xl border border-border bg-card px-6 pt-5 pb-8 shadow-card sm:px-10 sm:pb-10">
            <SectionTitle
              title="E-sign consent text"
              sub="Shown next to the consent checkbox and stored with every signature."
            />
            <textarea
              value={consentText}
              dir="auto"
              onChange={(e) => setConsentText(e.target.value)}
              rows={3}
              className="mt-3 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:border-ring focus:outline-none"
            />
            {language === "fr" && consentText === DEFAULT_CONSENT_TEXT && (
              <button type="button" onClick={() => setConsentText(FRENCH_DEFAULT_CONSENT)} className="mt-3 rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-muted">
                Use French translation of default consent
              </button>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Review consent wording before publishing. Custom consent is never overwritten automatically.</p>
          </section>

        </main>

      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="flex max-h-[92vh] flex-col sm:max-w-5xl">
          <DialogHeader>
            <div className="flex items-center justify-between gap-4 pr-8">
              <div><DialogTitle>Signer preview</DialogTitle><DialogDescription>Review the current draft as a signer will see it.</DialogDescription></div>
              <div className="flex rounded-lg border border-border p-1">
                <Button variant={device === "mobile" ? "secondary" : "ghost"} size="icon-sm" onClick={() => setDevice("mobile")} aria-label="Mobile preview"><Smartphone className="size-4" /></Button>
                <Button variant={device === "desktop" ? "secondary" : "ghost"} size="icon-sm" onClick={() => setDevice("desktop")} aria-label="Desktop preview"><Monitor className="size-4" /></Button>
              </div>
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-xl bg-muted/40 p-4 sm:p-6">
            <div className={cn("mx-auto bg-background shadow-card transition-[max-width]", device === "mobile" ? "max-w-[390px] rounded-[1.75rem] border-4 border-foreground/70 p-5 dark:border-foreground/30" : "max-w-3xl rounded-xl border border-border p-8")}>
              <SignerPreview name={name} blocks={blocks.map((b) => b.block)} fields={fields.map((f) => f.field)} consentText={consentText} language={language} minorMode={minorMode} groupSigningEnabled={groupSigning} />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={toolsOpen} onOpenChange={setToolsOpen}>
        <SheetContent side="left" className="w-72 p-5">
          <SheetHeader><SheetTitle>Add to waiver</SheetTitle><SheetDescription>Choose content or a signer field.</SheetDescription></SheetHeader>
          <div className="mt-5 space-y-1.5">
            <PaletteButton icon={Heading2} label="Heading" onClick={() => { addBlock("heading"); setToolsOpen(false); }} />
            <PaletteButton icon={Pilcrow} label="Text" onClick={() => { addBlock("paragraph"); setToolsOpen(false); }} />
            <PaletteButton icon={List} label="List" onClick={() => { addBlock("list"); setToolsOpen(false); }} />
          </div>
          <div className="my-4 border-t border-border" />
          <div className="space-y-1.5">
            <PaletteButton icon={TextCursorInput} label="Short answer" onClick={() => { addField("text", "Question"); setToolsOpen(false); }} />
            <PaletteButton icon={Pilcrow} label="Long answer" onClick={() => { addField("multiline", "Question"); setToolsOpen(false); }} />
            <PaletteButton icon={Mail} label="Email" onClick={() => { addField("email", "Email address"); setToolsOpen(false); }} />
            <PaletteButton icon={Phone} label="Phone" onClick={() => { addField("phone", "Phone number"); setToolsOpen(false); }} />
            <PaletteButton icon={CalendarDays} label="Date" onClick={() => { addField("date", "Date"); setToolsOpen(false); }} />
            <PaletteButton icon={CalendarDays} label="Date of birth" onClick={() => { addField("date_of_birth", "Date of birth"); setToolsOpen(false); }} />
            <PaletteButton icon={ListChecks} label="Dropdown" onClick={() => { addField("select", "Choose an option"); setToolsOpen(false); }} />
            <PaletteButton icon={CheckSquare} label="Checkbox" onClick={() => { addField("checkbox", "I agree"); setToolsOpen(false); }} />
            <PaletteButton icon={UserRoundCheck} label="Initials" onClick={() => { addField("initials", "Initials"); setToolsOpen(false); }} />
          </div>
          <p className="mt-4 rounded-lg bg-muted/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">Full legal name, e-sign consent, and signature capture are included automatically.</p>
        </SheetContent>
      </Sheet>

      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto p-5 sm:max-w-xl sm:p-6">
          <SheetHeader><SheetTitle>Waiver settings</SheetTitle><SheetDescription>Signing behavior, evidence capture, versions, and availability.</SheetDescription></SheetHeader>
          <div className="mt-6 space-y-6">
            <SettingsSection title="Signer language">
              <select aria-label="Default signer language" value={language} onChange={(event) => setLanguage(signerLanguage(event.target.value))} className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm">
                {SIGNER_LANGUAGES.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
              </select>
              <label className="mt-3 flex items-start gap-3 text-sm"><input type="checkbox" checked={translateContent} onChange={(event) => { setTranslateContent(event.target.checked); setTranslationPreview(null); }} className="mt-0.5 size-4 accent-primary" /><span><strong className="block">Translate document content</strong><span className="text-muted-foreground">Translate the title, legal text, custom fields, choices, and consent.</span></span></label>
              {translateContent && <div className="mt-4 space-y-3"><Button type="button" disabled={translating || isPending || language === "ar" || language === "ur"} onClick={translateEntireWaiver}>{translating ? "Translating…" : "Generate translation"}</Button>{translationPreview && <div className="rounded-lg border border-border p-3"><p className="text-sm font-semibold">Translation ready for review</p><p className="mt-1 text-xs text-muted-foreground">Nothing changes until you apply it.</p><div className="mt-3 flex gap-2"><Button size="sm" disabled={translationPreview.source !== currentFingerprint} onClick={() => { setTranslationUndo(currentDraft); loadTranslatedDraft(translationPreview.draft); }}>Use translation</Button><Button size="sm" variant="outline" onClick={() => setTranslationPreview(null)}>Discard</Button></div></div>}{translationUndo && <Button type="button" variant="outline" onClick={() => { loadTranslatedDraft(translationUndo); setTranslationUndo(null); }}>Restore original draft</Button>}</div>}
              {translateContent && (language === "ar" || language === "ur") && <p className="mt-3 text-xs text-muted-foreground">Automatic document translation is not available for this language yet. The signer interface will still use the selected language.</p>}
            </SettingsSection>
            <SettingsSection title="Group / multiple participant signing"><label className="flex items-center gap-3 text-sm"><Switch checked={groupSigning} onCheckedChange={setGroupSigning} />Enable 1-10 participants on one waiver</label><p className="mt-2 text-xs text-muted-foreground">Publish a new version to apply this setting. Custom fields and photo apply to the primary participant/contact.</p></SettingsSection>
            <SettingsSection title="Minor participants"><label className="flex items-center gap-3 text-sm"><Switch checked={minorMode === "allowed"} onCheckedChange={(checked) => setMinorMode(checked ? "allowed" : "disallowed")} />Allow signing for minors and collect guardian details</label></SettingsSection>
            {settings}
            <SettingsSection title="Publishing responsibility">
              <p className="text-sm leading-relaxed text-muted-foreground">{APP.name} doesn&apos;t review waiver content for legal enforceability. You&apos;re responsible for the language and lawfulness of what you publish. Review every clause and have a lawyer check it for your state.</p>
            </SettingsSection>
            <SettingsSection title="Version history">
              {versions.length === 0 ? <p className="text-sm text-muted-foreground">Not published yet. Publishing creates version 1.</p> : <ul className="divide-y divide-border text-sm">{versions.map((version) => <li key={version.id} className="flex items-center gap-3 py-2.5"><strong>v{version.version_number}</strong>{template.current_version_id === version.id && <Badge className="bg-success/15 text-success">live</Badge>}<span className="ml-auto text-xs text-muted-foreground">{new Date(version.created_at).toLocaleDateString()}</span></li>)}</ul>}
              <p className="mt-2 text-xs text-muted-foreground">Published versions and signed records remain immutable.</p>
            </SettingsSection>
            <SettingsSection title={template.status === "archived" ? "Restore waiver" : "Archive waiver"} danger>
              <p className="text-sm text-muted-foreground">{template.status === "archived" ? "Restore the public signing link." : "Archiving turns off the public signing link. Existing signed waivers remain accessible."}</p>
              <Button className="mt-3" variant={template.status === "archived" ? "outline" : "destructive"} disabled={isPending} onClick={() => {
                if (template.status !== "archived" && !confirm("Archive this waiver? The public signing link will stop working. Existing signed waivers are unaffected.")) return;
                startTransition(async () => { try { if (template.status === "archived") { await unarchiveTemplate(template.id); toast.success("Waiver restored"); } else { await archiveTemplate(template.id); toast.success("Waiver archived"); } setSettingsOpen(false); router.refresh(); } catch (error) { toast.error(error instanceof Error ? error.message : "Couldn't update the waiver."); } });
              }}>{template.status === "archived" ? "Restore waiver" : "Archive waiver"}</Button>
            </SettingsSection>
          </div>
        </SheetContent>
      </Sheet>

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
  onDuplicate,
  onMoveUp,
  onMoveDown,
  first,
  last,
}: {
  item: BlockItem;
  onChange: (block: WaiverBlock) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  first: boolean;
  last: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const block = item.block;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group/block relative -mx-4 rounded-md border border-transparent px-4 py-1 transition-colors hover:bg-muted/20 focus-within:border-primary/20 focus-within:bg-muted/20",
        isDragging && "z-10 border-primary/40 bg-card opacity-80 shadow-pop"
      )}
    >
      <div className="flex h-8 items-center gap-1 text-muted-foreground">
        <button
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="cursor-grab touch-none text-muted-foreground/50 transition-colors hover:text-muted-foreground active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {block.type}
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          <EditorIconButton label="Move block up" onClick={onMoveUp} disabled={first}><ArrowUp className="size-3.5" /></EditorIconButton>
          <EditorIconButton label="Move block down" onClick={onMoveDown} disabled={last}><ArrowDown className="size-3.5" /></EditorIconButton>
          <EditorIconButton label="Duplicate block" onClick={onDuplicate}><Copy className="size-3.5" /></EditorIconButton>
          <EditorIconButton label="Remove block" onClick={onRemove} destructive><Trash2 className="size-3.5" /></EditorIconButton>
        </div>
      </div>

      <div className="pb-2">
        {block.type === "heading" && (
          <input
            value={block.text}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            placeholder="Heading text"
            className="w-full rounded border border-transparent bg-transparent px-1 py-1 text-xl font-bold leading-tight focus:border-primary/20 focus:bg-background focus:outline-none"
          />
        )}
        {block.type === "paragraph" && (
          <textarea
            value={block.text}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            placeholder="Paragraph text"
            rows={Math.min(14, Math.max(1, Math.ceil(block.text.length / 85)))}
            className="w-full resize-y rounded border border-transparent bg-transparent px-1 py-1 text-[15px] leading-7 focus:border-primary/20 focus:bg-background focus:outline-none"
          />
        )}
        {block.type === "list" && (
          <div className="space-y-1 pl-1">
            {block.items.map((listItem, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-foreground/70">•</span>
                <input
                  value={listItem}
                  onChange={(e) =>
                    onChange({
                      ...block,
                      items: block.items.map((x, j) => (j === i ? e.target.value : x)),
                    })
                  }
                  className="w-full rounded border border-transparent bg-transparent px-1 py-1 text-[15px] leading-6 focus:border-primary/20 focus:bg-background focus:outline-none"
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
  onDuplicate,
  onMoveUp,
  onMoveDown,
  first,
  last,
}: {
  item: FieldItem;
  onChange: (field: WaiverField) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  first: boolean;
  last: boolean;
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
        "group/field rounded-xl border border-primary/15 bg-primary/[0.025] p-3 transition-colors hover:border-primary/25",
        isDragging && "z-10 border-primary/50 bg-card opacity-80 shadow-pop"
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
              option_labels: type === "select" ? field.option_labels : undefined,
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
        <div className="ml-auto flex items-center gap-0.5 opacity-60 transition-opacity sm:opacity-0 sm:group-hover/field:opacity-100 sm:group-focus-within/field:opacity-100">
          <EditorIconButton label="Move field up" onClick={onMoveUp} disabled={first}><ArrowUp className="size-3.5" /></EditorIconButton>
          <EditorIconButton label="Move field down" onClick={onMoveDown} disabled={last}><ArrowDown className="size-3.5" /></EditorIconButton>
          <EditorIconButton label="Duplicate field" onClick={onDuplicate}><Copy className="size-3.5" /></EditorIconButton>
          <EditorIconButton label="Remove field" onClick={onRemove} destructive><Trash2 className="size-3.5" /></EditorIconButton>
        </div>
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
                value={field.option_labels?.[i] ?? option}
                onChange={(e) => {
                  if (field.option_labels) {
                    const labels = [...field.option_labels];
                    labels[i] = e.target.value;
                    onChange({ ...field, option_labels: labels });
                    return;
                  }
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
                    option_labels: field.option_labels?.filter((_, j) => j !== i),
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
                option_labels: field.option_labels ? [...field.option_labels, `Option ${(field.options?.length ?? 0) + 1}`] : undefined,
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
  groupSigningEnabled,
  language,
}: {
  name: string;
  blocks: WaiverBlock[];
  fields: WaiverField[];
  consentText: string;
  minorMode: "allowed" | "disallowed";
  groupSigningEnabled: boolean;
  language: import("@/lib/signer-language").SignerLanguage;
}) {
  const t = (text: string) => signerText(text, language);
  return (
    <div lang={language} dir={signerDirection(language)} className="pointer-events-none min-w-0 space-y-4 overflow-x-hidden text-start" aria-hidden>
      <div>
        <h2 className="text-lg font-bold">{name || "Untitled waiver"}</h2>
        <p className="text-xs text-muted-foreground">
          {t("Please read the waiver below, fill in your details, and sign.")}
        </p>
      </div>

      <div className="min-w-0 space-y-3 overflow-x-hidden rounded-lg border border-border bg-card p-3">
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
              language={language}
              key={i}
              field={{ ...field, label: field.label || "Untitled field" }}
              value={field.type === "checkbox" ? false : ""}
              onChange={() => {}}
              disabled
            />
          ))}
        </div>
      )}

      {groupSigningEnabled && <div className="space-y-2 rounded-lg border border-border p-3"><p className="font-medium">{t("Group participants")}</p><label>{t("Number of participants")}<select disabled className="ml-3 rounded border px-3 py-2"><option>1</option></select></label><p>{t("Participant")} 1</p><p className="text-xs text-muted-foreground">{t("Custom fields and photo apply to the primary participant/contact (Participant 1).")}</p></div>}
      {minorMode === "allowed" && (
        <div className="rounded-lg border border-border bg-card p-3 text-sm">
          <label className="flex items-center gap-2.5">
            <input type="checkbox" disabled className="size-4" />
            <span className="font-medium">{t("The participant is under 18")}</span>
          </label>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-3">
        <label className="flex items-start gap-2.5">
          <input type="checkbox" disabled className="mt-0.5 size-4" />
          <span dir="auto" className="text-xs leading-relaxed">{consentText}</span>
        </label>
      </div>

      <div className="space-y-2">
        <div>
          <span className="mb-1 block text-sm font-medium text-foreground/90">
            {t("Full legal name")}
          </span>
          <div className="h-10 rounded-md border border-input bg-card" />
        </div>
        <div>
          <span className="mb-1 block text-sm font-medium text-foreground/90">
            {t("Your signature")}
          </span>
          <div className="flex h-24 items-center justify-center rounded-md border border-input bg-card text-xs text-muted-foreground/60">
            {t("drawing area")}
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-primary py-3 text-center text-sm font-semibold text-primary-foreground">
        {t("Sign waiver")}
      </div>
    </div>
  );
}

// ── Small pieces ─────────────────────────────────────────────────────────────

function PaletteButton({ icon: Icon, label, onClick }: { icon: typeof Heading2; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2 py-1 text-left text-sm font-medium text-muted-foreground transition-colors hover:border-primary/20 hover:bg-primary/5 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
        <Icon className="size-4" />
      </span>
      {label}
      <Plus className="ml-auto size-3.5 opacity-0 transition-opacity group-hover:opacity-70" />
    </button>
  );
}

function EditorIconButton({
  label,
  onClick,
  disabled = false,
  destructive = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-25",
        destructive && "hover:bg-destructive/10 hover:text-destructive",
      )}
    >
      {children}
    </button>
  );
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div>
      <h2 className="text-lg font-bold">{title}</h2>
      {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

function SettingsSection({
  title,
  danger = false,
  children,
}: {
  title: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card p-4",
        danger && "border-destructive/25 bg-destructive/[0.025]",
      )}
    >
      <h3 className={cn("text-sm font-semibold", danger && "text-destructive")}>{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
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
