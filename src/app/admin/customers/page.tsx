import { getAdminOverview } from "@/lib/admin-data";
import { AdminSetupNotice } from "@/components/admin-setup-notice";
import { CustomersTable } from "@/components/admin/customers-table";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage() {
  const { ready, rows } = await getAdminOverview();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every organization, its plan, and its waiver usage. Suspend blocks
          login without touching records; delete is only offered for empty
          accounts (no signed waivers).
        </p>
      </div>

      {!ready ? <AdminSetupNotice /> : <CustomersTable rows={rows} />}
    </div>
  );
}
