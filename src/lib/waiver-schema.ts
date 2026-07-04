import { z } from "zod";

export const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("heading"), text: z.string() }),
  z.object({ type: z.literal("paragraph"), text: z.string() }),
  z.object({ type: z.literal("list"), items: z.array(z.string()) }),
]);

export const fieldSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9_]*$/, "keys must be snake_case"),
  type: z.enum([
    "name",
    "email",
    "phone",
    "date_of_birth",
    "text",
    "checkbox",
    "initials",
  ]),
  label: z.string().min(1).max(200),
  required: z.boolean(),
});

export const draftContentSchema = z.object({
  title: z.string().min(1).max(200),
  blocks: z.array(blockSchema).min(1),
  fields: z.array(fieldSchema),
  consent_text: z.string().min(10),
  minor_mode: z.enum(["allowed", "disallowed"]),
  warnings: z.array(z.string()).optional(),
});
