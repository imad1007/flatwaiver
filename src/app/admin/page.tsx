import { getAdminActivationFunnel, getAdminOverview } from "@/lib/admin-data";
import { getAdminAnalytics } from "@/lib/admin-analytics-data";
import { assertAdmin } from "@/lib/admin";
import { AdminSetupNotice } from "@/components/admin-setup-notice";
import { AdminAnalyticsDashboard } from "@/components/admin-analytics-dashboard";
export const dynamic = "force-dynamic";
export default async function AdminOverviewPage() {
    await assertAdmin();
    const [overview, activation] = await Promise.all([getAdminOverview(), getAdminActivationFunnel()]);
    if (!overview.ready)
        return <AdminSetupNotice />;
    const { data, updatedAt } = await getAdminAnalytics(overview.rows);
    const top = [...overview.rows].filter(r => r.signatureCount > 0).sort((a, b) => b.signatureCount - a.signatureCount).slice(0, 5)
        .map(({ orgId, name, signatureCount, signaturesThisMonth }) => ({ orgId, name, signatureCount, signaturesThisMonth }));
    return <AdminAnalyticsDashboard data={data} activation={activation} updatedAt={updatedAt} totalOrgs={overview.rows.length} signatures={overview.stats.totalSignatures} monthlySignatures={overview.stats.signaturesThisMonth} suspended={overview.stats.suspended} top={top}/>;
}
