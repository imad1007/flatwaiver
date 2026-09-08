import { assertAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { NotificationComposer } from "@/components/admin/notification-composer";

export default async function AdminNotificationsPage() {
  await assertAdmin();
  const admin = createAdminClient();
  const users: { id: string; email: string }[] = [];
  // Explicit paging avoids silently limiting the audience to Supabase's row cap.
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.from("profiles").select("id,email").order("id").range(offset, offset + 999);
    if (error) throw new Error("Could not load notification recipients.");
    users.push(...data);
    if (data.length < 1000) break;
  }
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold tracking-tight">Notifications</h1><p className="mt-1 text-sm text-muted-foreground">Send an in-app message to one user, a group, or everyone.</p></div><NotificationComposer users={users} /></div>;
}
