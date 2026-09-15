export interface AnalyticsCustomer {
    orgId: string;
    createdAt: string;
    status: string | null;
    trialEndsAt: string | null;
}
export interface AnalyticsSubscription {
    org_id: string;
    stripe_subscription_id: string | null;
    creem_subscription_id: string | null;
    paddle_subscription_id: string | null;
}
export type AccountStage = 'subscribed' | 'trial' | 'expired' | 'pastDue' | 'canceled' | 'manual' | 'other';
export const stageLabels: Record<AccountStage, string> = {
    subscribed: 'Subscribers', trial: 'Live trials', expired: 'Trial ended · not subscribed',
    pastDue: 'Past due', canceled: 'Canceled subscriptions', manual: 'Manual active access', other: 'No subscription / other',
};
export function accountStage(row: AnalyticsCustomer, linked: boolean, now: number): AccountStage {
    if (row.status === 'active')
        return linked ? 'subscribed' : 'manual';
    if (row.status === 'past_due')
        return 'pastDue';
    if (row.status === 'canceled' && linked)
        return 'canceled';
    const end = row.trialEndsAt ? Date.parse(row.trialEndsAt) : NaN;
    if (row.status === 'trialing' && end > now)
        return 'trial';
    if (!linked && end <= now)
        return 'expired';
    return 'other';
}
export function buildAdminAnalytics(customers: AnalyticsCustomer[], subscriptions: AnalyticsSubscription[], userDates: string[], monthlyPrice: number, now: number) {
    const linked = new Set(subscriptions.filter(s => s.stripe_subscription_id || s.creem_subscription_id || s.paddle_subscription_id).map(s => s.org_id));
    const counts: Record<AccountStage, number> = { subscribed: 0, trial: 0, expired: 0, pastDue: 0, canceled: 0, manual: 0, other: 0 };
    const today = new Date(now).toISOString().slice(0, 10);
    const start = Date.parse(today) - 89 * 86400000;
    const days = Array.from({ length: 90 }, (_, i) => ({ date: new Date(start + i * 86400000).toISOString().slice(0, 10), users: 0, organizations: 0, trialsEnded: 0 }));
    const byDate = new Map(days.map(d => [d.date, d]));
    for (const date of userDates) {
        const d = byDate.get(date.slice(0, 10));
        if (d && Date.parse(date) <= now)
            d.users++;
    }
    let endingSoon = 0;
    for (const row of customers) {
        const stage = accountStage(row, linked.has(row.orgId), now);
        counts[stage]++;
        const day = byDate.get(row.createdAt.slice(0, 10));
        if (day && Date.parse(row.createdAt) <= now)
            day.organizations++;
        if (stage === 'expired' && row.trialEndsAt) {
            const d = byDate.get(row.trialEndsAt.slice(0, 10));
            if (d)
                d.trialsEnded++;
        }
        if (stage === 'trial' && Date.parse(row.trialEndsAt!) <= now + 7 * 86400000)
            endingSoon++;
    }
    return { counts, days, totalUsers: userDates.length, endingSoon, estimatedMrr: counts.subscribed * monthlyPrice, estimatedArr: counts.subscribed * monthlyPrice * 12 };
}
export type AdminAnalytics = ReturnType<typeof buildAdminAnalytics>;
