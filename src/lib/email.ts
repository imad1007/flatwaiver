import "server-only";

import { Resend } from "resend";
import { APP } from "@/lib/config";

const FROM = `${APP.name} <notifications@${emailDomain()}>`;

function emailDomain(): string {
  try {
    return new URL(APP.url).hostname.replace(/^www\./, "");
  } catch {
    return "example.com";
  }
}

function resendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

/** Signer copy: link to their signed PDF (7-day signed URL). */
export async function sendSignerCopyEmail(opts: {
  to: string;
  signerName: string;
  waiverName: string;
  orgName: string;
  pdfUrl: string;
}) {
  const resend = resendClient();
  if (!resend) return;
  try {
    await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: `Your signed waiver — ${opts.waiverName}`,
      html: `
        <p>Hi ${escapeHtml(opts.signerName)},</p>
        <p>You signed <strong>${escapeHtml(opts.waiverName)}</strong> for ${escapeHtml(opts.orgName)}.</p>
        <p><a href="${opts.pdfUrl}">Download your signed copy (PDF)</a></p>
        <p>This link expires in 7 days. Keep the PDF for your records.</p>
        <p>— ${APP.name}</p>
      `,
    });
  } catch (err) {
    console.error("sendSignerCopyEmail failed", err);
  }
}

/** Owner notification: someone signed a waiver. */
export async function sendOwnerNotificationEmail(opts: {
  to: string;
  signerName: string;
  waiverName: string;
  signedAtIso: string;
  detailUrl: string;
}) {
  const resend = resendClient();
  if (!resend) return;
  try {
    await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: `New signature: ${opts.signerName} — ${opts.waiverName}`,
      html: `
        <p><strong>${escapeHtml(opts.signerName)}</strong> signed <strong>${escapeHtml(opts.waiverName)}</strong> at ${opts.signedAtIso} (UTC).</p>
        <p><a href="${opts.detailUrl}">View the signature record</a></p>
        <p>— ${APP.name}</p>
      `,
    });
  } catch (err) {
    console.error("sendOwnerNotificationEmail failed", err);
  }
}

/** Re-sign reminder: a signer's waiver is expiring/expired — ask them to renew. */
export async function sendResignReminderEmail(opts: {
  to: string;
  signerName: string;
  waiverName: string;
  orgName: string;
  signingUrl: string;
  expired: boolean;
}) {
  const resend = resendClient();
  if (!resend) throw new Error("Email isn't configured (missing RESEND_API_KEY).");
  const lead = opts.expired
    ? `your signed waiver has expired`
    : `your signed waiver is about to expire`;
  await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: `Time to renew your waiver — ${opts.waiverName}`,
    html: `
      <p>Hi ${escapeHtml(opts.signerName)},</p>
      <p>${escapeHtml(opts.orgName)} asks that you keep a current waiver on file, and
      ${lead} for <strong>${escapeHtml(opts.waiverName)}</strong>.</p>
      <p><a href="${opts.signingUrl}">Re-sign the waiver</a> — it takes about a minute
      on any phone or computer.</p>
      <p>— ${escapeHtml(opts.orgName)}, via ${APP.name}</p>
    `,
  });
}

/** Team invite: an admin invites a teammate to join the org's account. */
export async function sendTeamInviteEmail(opts: {
  to: string;
  orgName: string;
  inviterEmail: string;
  roleLabel: string;
  acceptUrl: string;
}) {
  const resend = resendClient();
  if (!resend) throw new Error("Email isn't configured (missing RESEND_API_KEY).");
  await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: `You're invited to ${opts.orgName} on ${APP.name}`,
    html: `
      <p>Hi,</p>
      <p><strong>${escapeHtml(opts.inviterEmail)}</strong> invited you to join
      <strong>${escapeHtml(opts.orgName)}</strong> on ${APP.name} as
      <strong>${escapeHtml(opts.roleLabel)}</strong>.</p>
      <p><a href="${opts.acceptUrl}">Accept the invitation</a> — create your account
      with this email address (${escapeHtml(opts.to)}) and you'll join the team
      automatically.</p>
      <p>This invitation expires in 14 days.</p>
      <p>— ${APP.name}</p>
    `,
  });
}

/** Flagged-signature alert: a screening answer matched a configured flag. */
export async function sendFlaggedSignatureEmail(opts: {
  to: string;
  signerName: string;
  waiverName: string;
  signedAtIso: string;
  detailUrl: string;
}) {
  const resend = resendClient();
  if (!resend) return;
  try {
    await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: `⚠️ Flagged signature: ${opts.signerName} — ${opts.waiverName}`,
      html: `
        <p><strong>${escapeHtml(opts.signerName)}</strong> signed
        <strong>${escapeHtml(opts.waiverName)}</strong> at ${opts.signedAtIso} (UTC),
        and one of their answers matched a flag you configured.</p>
        <p><a href="${opts.detailUrl}">Review the responses</a> before admitting the participant.</p>
        <p>— ${APP.name}</p>
      `,
    });
  } catch (err) {
    console.error("sendFlaggedSignatureEmail failed", err);
  }
}

/** Signing invite: the owner sends a customer a link to sign a waiver. */
export async function sendSigningInviteEmail(opts: {
  to: string;
  waiverName: string;
  orgName: string;
  signingUrl: string;
}) {
  const resend = resendClient();
  if (!resend) throw new Error("Email isn't configured (missing RESEND_API_KEY).");
  await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: `${opts.orgName} needs your signature — ${opts.waiverName}`,
    html: `
      <p>Hi,</p>
      <p><strong>${escapeHtml(opts.orgName)}</strong> has asked you to sign
      <strong>${escapeHtml(opts.waiverName)}</strong> before your visit.</p>
      <p><a href="${opts.signingUrl}">Read and sign the waiver</a> — it takes about a minute
      and works on any phone or computer.</p>
      <p>After signing you can request a copy of the signed document for your records.</p>
      <p>— ${escapeHtml(opts.orgName)}, via ${APP.name}</p>
    `,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
