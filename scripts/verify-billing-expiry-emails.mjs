import assert from 'node:assert/strict';
import { billingExpiryEmail } from '../src/lib/billing-expiry-email.ts';
import { APP } from '../src/lib/config.ts';

for (const kind of ['trial-ended', 'subscription-ended']) {
  const message = billingExpiryEmail({ kind, orgName: '<img src=x onerror=bad> & Gym', appName: APP.name,
    monthlyUsd: APP.priceMonthlyUsd, billingUrl: `${APP.siteUrl}/settings/billing`, supportEmail: APP.supportEmail });
  assert(!message.html.includes('<img src=x'));
  assert(message.html.includes('&lt;img src=x onerror=bad&gt; &amp; Gym'));
  assert(message.html.includes('https://www.flatwaiver.com/settings/billing'));
  assert(message.text.includes('$19/month, flat'));
  for (const feature of ['Unlimited signed waivers', 'Unlimited waiver templates', 'Unlimited storage']) {
    assert(message.html.includes(feature)); assert(message.text.includes(feature));
  }
  assert.equal((message.html.match(/<h1 /g) ?? []).length, 1);
  assert(message.subject.includes(kind === 'trial-ended' ? 'trial has ended' : 'subscription has ended'));
  assert(!message.html.includes('payment successful'));
}
console.log('PASS: both billing templates, escaping, correct plan, billing CTA and plain-text alternatives.');
