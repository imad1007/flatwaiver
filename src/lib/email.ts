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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
