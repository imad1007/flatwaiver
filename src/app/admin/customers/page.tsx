import { getAdminOverview } from "@/lib/admin-data";
import { AdminSetupNotice } from "@/components/admin-setup-notice";
import { CustomersTable } from "@/components/admin/customers-table";

export const dynamic = "force-dynamic";

async function loadCustomerSnapshot() {
  const overview = await getAdminOverview();
  return { ...overview, now: Date.now() };
}

export default async function AdminCustomersPage() {
  const { ready, rows, now } = await loadCustomerSnapshot();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Find customers, follow up on ended trials, and see who is using their workspace.
        </p>
      </div>

      {!ready ? <AdminSetupNotice /> : <CustomersTable rows={rows} now={now} />}
    </div>
  );
}
