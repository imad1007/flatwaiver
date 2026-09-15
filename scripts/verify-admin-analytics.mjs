import assert from 'node:assert/strict';
import { accountStage, buildAdminAnalytics, registrationComparisons } from '../src/lib/admin-analytics.ts';
const now=Date.parse('2026-09-14T12:00:00Z');
const row=(id,status,end='2026-09-14T12:00:00Z',created='2026-09-14T01:00:00Z')=>({orgId:id,status,trialEndsAt:end,createdAt:created});
assert.equal(accountStage(row('1','trialing'),false,now),'expired');
assert.equal(accountStage(row('1','trialing','2026-09-14T12:00:01Z'),false,now),'trial');
assert.equal(accountStage(row('1','active'),false,now),'manual');
assert.equal(accountStage(row('1','active'),true,now),'subscribed');
assert.equal(accountStage(row('1','canceled'),true,now),'canceled');
assert.equal(accountStage(row('1','past_due'),true,now),'pastDue');
assert.equal(accountStage(row('1','trialing',null),false,now),'other');
const rows=[row('paid','active'),row('manual','active'),row('expired','trialing'),row('trial','trialing','2026-09-16T00:00:00Z'),row('cancel','canceled')];
const subs=['paid','cancel'].map(org_id=>({org_id,creem_subscription_id:'sub',stripe_subscription_id:null,paddle_subscription_id:null}));
const result=buildAdminAnalytics(rows,subs,['2026-09-14T01:00:00Z','2026-01-01T00:00:00Z'],19,now);
assert.equal(result.estimatedMrr,19);assert.equal(result.estimatedArr,228);
assert.equal(result.counts.expired,1);assert.equal(result.counts.manual,1);
assert.equal(result.endingSoon,1);assert.equal(result.totalUsers,2);
assert.equal(result.days.length,90);assert.equal(result.days.at(-1).users,1);
assert.equal(result.days.at(-1).trialsEnded,1);assert.equal(result.days.at(-1).organizations,5);
assert.equal(Object.values(result.counts).reduce((a,b)=>a+b,0),rows.length);
const empty=buildAdminAnalytics([],[],[],19,now);assert.equal(empty.estimatedMrr,0);assert.ok(empty.days.every(d=>d.users===0));
const boundary=buildAdminAnalytics([row('start','trialing','2026-01-01T00:00:00Z',result.days[0].date+'T00:00:00Z')],[],[],19,now);assert.equal(boundary.days[0].organizations,1);
console.log('PASS: trial cutoff, paid/manual distinction, canceled and past-due classification, MRR/ARR, UTC date bounds, cohort counts, empty states.');

const at=Date.parse('2026-09-15T12:00:00Z');
const daily=registrationComparisons(['2026-09-15T00:00:00Z','2026-09-15T10:00:00Z','2026-09-14T10:00:00Z','2026-09-14T15:00:00Z','2026-09-16T00:00:00Z','bad'],at)[0];
assert.equal(daily.current,2);assert.equal(daily.previous,1);assert.equal(daily.percent,100);
assert.equal(registrationComparisons(['2026-09-14T10:00:00Z'],at)[0].percent,-100);
assert.equal(registrationComparisons([],at)[0].percent,0);
assert.equal(registrationComparisons(['2026-09-15T10:00:00Z'],at)[0].percent,null);
for(const [index,days] of [[1,7],[2,30]]) {
 const start=at-days*86400000;
 const comparison=registrationComparisons([new Date(start).toISOString(),new Date(start-1).toISOString(),new Date(start-days*86400000).toISOString(),new Date(at).toISOString()],at)[index];
 assert.equal(comparison.current,1);assert.equal(comparison.previous,2);assert.equal(comparison.percent,-50);
}
assert.equal(registrationComparisons(['2026-09-14T00:00:00Z'],Date.parse('2026-09-15T00:00:00Z'))[0].previous,0);
console.log('PASS: percentage increases/decreases, zero baseline, matched daily cutoff, rolling week/month boundaries, invalid and future dates.');
