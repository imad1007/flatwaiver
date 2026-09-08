"use server";

import { assertAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminNotificationSchema } from "@/lib/admin-notification-input";

export async function sendAdminNotification(input: unknown) {
  const sender = await assertAdmin();
  const parsed = adminNotificationSchema.safeParse(input);
  if (!parsed.success) return { error: "Enter a title, message, and at least one recipient." };
  const { title, message, all, recipients } = parsed.data;
  const { data, error } = await createAdminClient().rpc("send_admin_notification", {
    p_sender: sender.id, p_title: title, p_message: message,
    p_all: all, p_recipients: [...new Set(recipients)],
  });
  if (error) {
    console.error("Admin notification delivery failed", error.code);
    return { error: "Could not send the notification. Check that the notifications migration has been applied." };
  }
  return { count: Number(data) };
}
