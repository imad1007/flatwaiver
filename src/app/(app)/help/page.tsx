import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SupportCenter } from "@/components/support-center";

export const metadata: Metadata = { title: "Support" };

export default async function HelpPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <SupportCenter
      email={user?.email ?? ""}
      formConfigured={Boolean(process.env.RESEND_API_KEY && process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)}
    />
  );
}
