import { z } from "zod";

export const SUPPORT_TOPICS = [
  "Getting started",
  "Signing issue",
  "Billing",
  "Account",
  "Data export",
  "Other",
] as const;

export const supportRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().max(120).optional(),
  topic: z.enum(SUPPORT_TOPICS),
  message: z.string().trim().min(20).max(4_000),
  turnstileToken: z.string().min(1),
  website: z.string().max(200).optional(),
});
