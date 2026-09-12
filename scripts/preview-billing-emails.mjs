import nextEnv from '@next/env';
import { mkdir, writeFile } from 'node:fs/promises';
import { Resend } from 'resend';
import { billingExpiryEmail } from '../src/lib/billing-expiry-email.ts';
import { APP } from '../src/lib/config.ts';

nextEnv.loadEnvConfig(process.cwd());
const send = process.argv.includes('--send');
const to = process.argv.find(arg => arg.startsWith('--to='))?.slice(5);
if (send && (!to || !process.env.RESEND_API_KEY)) throw new Error('Sending requires --to=email and RESEND_API_KEY.');
await mkdir('output/emails', { recursive: true });
const resend = send ? new Resend(process.env.RESEND_API_KEY) : null;
for (const kind of ['trial-ended', 'subscription-ended']) {
  const message = billingExpiryEmail({ kind, orgName: 'Your demo workspace', appName: APP.name,
    monthlyUsd: APP.priceMonthlyUsd, billingUrl: `${APP.siteUrl}/settings/billing`, supportEmail: APP.supportEmail });
  await writeFile(`output/emails/${kind}.html`, message.html);
  console.log(`Rendered output/emails/${kind}.html`);
  if (resend) {
    const { data, error } = await resend.emails.send({
      from: `${APP.name} <notifications@${new URL(APP.siteUrl).hostname.replace(/^www\./, '')}>`,
      to, replyTo: APP.supportEmail, ...message, subject: `[Preview] ${message.subject}`,
    }, { idempotencyKey: `billing-preview-v1/${kind}/${to}` });
    if (error) throw new Error(`Preview rejected: ${error.message}`);
    console.log(JSON.stringify({ kind, emailId: data?.id, status: 'accepted' }));
  }
}
