import { z } from "zod";

export const adminNotificationSchema = z.object({
  title: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(2000),
  all: z.boolean(),
  recipients: z.array(z.string().uuid()).max(10000),
}).refine((value) => value.all || value.recipients.length > 0, "Select at least one user.");
