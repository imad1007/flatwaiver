import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { AdminNav } from "@/components/admin-nav";

// The admin panel is never indexed.
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Hard gate: platform admins only. Non-admins (including logged-in customers)
  // are bounced to their dashboard; unauthenticated users never reach here
  // (proxy redirects to /login first). Every admin action re-checks with
  // assertAdmin() — this layout is not the only line of defense.
  const user = await getAdminUser();
  if (!user) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-background">
      <AdminNav email={user.email ?? ""} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
