import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import mammoth from "mammoth";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_CONSENT_TEXT,
  subscriptionIsUsable,
  type DraftContent,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const AI_MODEL = "claude-sonnet-4-6";

/**
 * Accepted upload types → how we hand them to Claude.
 * - pdf/image: sent natively (document / image content block).
 * - docx: text is extracted server-side (Claude has no native .docx block).
 */
const ACCEPTED_TYPES: Record<string, { kind: "pdf" | "image" | "docx"; ext: string }> = {
  "application/pdf": { kind: "pdf", ext: "pdf" },
  "image/png": { kind: "image", ext: "png" },
  "image/jpeg": { kind: "image", ext: "jpg" },
  "image/webp": { kind: "image", ext: "webp" },
  "image/gif": { kind: "image", ext: "gif" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    kind: "docx",
    ext: "docx",
  },
};

/** Resolve the upload's type from its MIME, falling back to file extension. */
function resolveType(file: File): { mime: string; kind: "pdf" | "image" | "docx"; ext: string } | null {
  if (file.type && ACCEPTED_TYPES[file.type]) {
    return { mime: file.type, ...ACCEPTED_TYPES[file.type] };
  }
  const ext = file.name.split(".").pop()?.toLowerCase();
  const byExt: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  const mime = ext ? byExt[ext] : undefined;
  return mime ? { mime, ...ACCEPTED_TYPES[mime] } : null;
}

const SYSTEM_PROMPT = `You convert liability waiver documents into structured JSON for a digital signing system. The source may be a PDF, a photo or scan of a paper waiver, or text exported from a Word document.

Rules:
1. PRESERVE ALL LEGAL LANGUAGE EXACTLY. Never paraphrase, summarize, shorten, or "improve" any clause. Copy wording character-for-character, including capitalized sections.
2. Segment the document into ordered blocks: headings, paragraphs, and lists.
3. Identify signer input fields the document expects (name, email, phone, date of birth, emergency contact, initials boxes, checkboxes). Give each a snake_case key.
4. Detect whether the document contains minor/guardian provisions.
5. If any part of the document is unreadable or ambiguous, add a warning — never guess content.

Return ONLY valid JSON matching this schema, no markdown fences, no commentary:

{
  "title": string,
  "blocks": [
    {"type": "heading", "text": string} |
    {"type": "paragraph", "text": string} |
    {"type": "list", "items": string[]}
  ],
  "fields": [
    {"key": string, "type": "name"|"email"|"phone"|"date_of_birth"|"text"|"checkbox"|"initials", "label": string, "required": boolean}
  ],
  "has_minor_provisions": boolean,
  "warnings": string[]
}`;

const aiResultSchema = z.object({
  title: z.string().min(1),
  blocks: z
    .array(
      z.discriminatedUnion("type", [
        z.object({ type: z.literal("heading"), text: z.string() }),
        z.object({ type: z.literal("paragraph"), text: z.string() }),
        z.object({ type: z.literal("list"), items: z.array(z.string()) }),
      ])
    )
    .min(1),
  fields: z.array(
    z.object({
      key: z.string().min(1),
      type: z.enum([
        "name",
        "email",
        "phone",
        "date_of_birth",
        "text",
        "checkbox",
        "initials",
      ]),
      label: z.string(),
      required: z.boolean(),
    })
  ),
  has_minor_provisions: z.boolean(),
  warnings: z.array(z.string()),
});

export async function POST(request: Request) {
  // Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "No profile." }, { status: 403 });
  }

  // Gating: creating templates requires a usable subscription.
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status")
    .maybeSingle();
  if (!subscriptionIsUsable(sub?.status)) {
    return NextResponse.json(
      { error: "Your subscription is inactive. Subscribe to create new waivers." },
      { status: 403 }
    );
  }

  // File
  const formData = await request.formData();
  const file = formData.get("file");
  const name = String(formData.get("name") ?? "").trim();
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File must be 10 MB or smaller." }, { status: 400 });
  }
  const type = resolveType(file);
  if (!type) {
    return NextResponse.json(
      {
        error:
          "Unsupported file. Upload a PDF, an image (PNG, JPG, WebP, GIF), or a Word .docx. (Old .doc files aren't supported — save as .docx or PDF.)",
      },
      { status: 400 }
    );
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());

  // Build the Claude content block for this file type. .docx has no native
  // block, so extract its text first; if that yields nothing, bail early.
  let userContent: Anthropic.ContentBlockParam[];
  if (type.kind === "docx") {
    let text = "";
    try {
      text = (await mammoth.extractRawText({ buffer: fileBuffer })).value.trim();
    } catch {
      return NextResponse.json(
        { error: "Couldn't read that Word file. Save it as PDF and try again." },
        { status: 422 }
      );
    }
    if (text.length < 20) {
      return NextResponse.json(
        {
          error:
            "That Word file has no extractable text (it may be scanned images). Export it as a PDF and try again.",
        },
        { status: 422 }
      );
    }
    userContent = [{ type: "text", text: `Waiver document text:\n\n${text}` }];
  } else if (type.kind === "image") {
    userContent = [
      {
        type: "image",
        source: {
          type: "base64",
          media_type: type.mime as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
          data: fileBuffer.toString("base64"),
        },
      },
    ];
  } else {
    userContent = [
      {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: fileBuffer.toString("base64") },
      },
    ];
  }

  // Store the original upload (uploads bucket, service role — buckets private).
  const admin = createAdminClient();
  const sourcePath = `${profile.org_id}/${crypto.randomUUID()}.${type.ext}`;
  const { error: uploadError } = await admin.storage
    .from("uploads")
    .upload(sourcePath, fileBuffer, { contentType: type.mime });
  if (uploadError) {
    return NextResponse.json({ error: "Failed to store the uploaded file." }, { status: 500 });
  }

  // Convert with Claude (retry once on malformed JSON).
  let result: z.infer<typeof aiResultSchema> | null = null;
  try {
    result = await convertDocument(userContent, false);
  } catch {
    try {
      result = await convertDocument(userContent, true);
    } catch {
      return NextResponse.json(
        {
          error:
            "AI conversion failed after two attempts. Use “Start from scratch” and paste your waiver instead.",
        },
        { status: 422 }
      );
    }
  }

  // Build the draft. The system always supplies the legal-name field and the
  // signature block on the signing page, so drop AI-suggested name fields.
  const draft: DraftContent = {
    title: name || result.title,
    blocks: result.blocks,
    fields: result.fields.filter((f) => f.type !== "name"),
    consent_text: DEFAULT_CONSENT_TEXT,
    minor_mode: result.has_minor_provisions ? "allowed" : "disallowed",
    warnings: result.warnings,
  };

  const { data: template, error: insertError } = await supabase
    .from("waiver_templates")
    .insert({
      org_id: profile.org_id,
      slug: makeSlug(draft.title),
      name: draft.title,
      status: "draft",
      source_pdf_path: sourcePath,
      draft_content: draft,
    })
    .select("id")
    .single();
  if (insertError) {
    return NextResponse.json({ error: "Failed to create draft." }, { status: 500 });
  }

  return NextResponse.json({ templateId: template.id, warnings: result.warnings });
}

async function convertDocument(
  userContent: Anthropic.ContentBlockParam[],
  retryReminder: boolean
): Promise<z.infer<typeof aiResultSchema>> {
  const anthropic = new Anthropic();

  const instruction: Anthropic.ContentBlockParam = {
    type: "text",
    text:
      "Convert this waiver document." +
      (retryReminder ? " Return only valid JSON — no markdown fences, no commentary." : ""),
  };

  const response = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 8000,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [...userContent, instruction],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text in response");
  }

  // Strip accidental markdown fences before parsing.
  const raw = textBlock.text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  return aiResultSchema.parse(JSON.parse(raw));
}

function makeSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 8);
  return base ? `${base}-${suffix}` : suffix;
}
