import 'server-only';
import { assertAdmin } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildAdminAnalytics, type AnalyticsSubscription } from '@/lib/admin-analytics';
import type { CustomerRow } from '@/lib/admin-data';
import { APP } from '@/lib/config';
export async function getAdminAnalytics(rows: CustomerRow[]) {
    await assertAdmin();
    const db = createAdminClient();
    async function subscriptions() {
        const rows: AnalyticsSubscription[] = [];
        for (let offset = 0;; offset += 1000) {
            const { data, error } = await db.from('subscriptions').select('org_id,stripe_subscription_id,creem_subscription_id,paddle_subscription_id').order('org_id').range(offset, offset + 999);
            if (error)
                throw error;
            rows.push(...data);
            if (data.length < 1000)
                return rows;
        }
    }
    async function profiles() {
        const dates: string[] = [];
        for (let offset = 0;; offset += 1000) {
            const { data, error } = await db.from('profiles').select('created_at').order('id').range(offset, offset + 999);
            if (error)
                throw error;
            dates.push(...data.map(r => r.created_at as string));
            if (data.length < 1000)
                return dates;
        }
    }
    const [subs, dates] = await Promise.all([subscriptions(), profiles()]);
    const now = Date.now();
    return { data: buildAdminAnalytics(rows, subs, dates, APP.priceMonthlyUsd, now), updatedAt: new Date(now).toISOString() };
}
