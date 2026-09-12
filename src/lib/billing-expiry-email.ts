export type BillingExpiryKind = "trial-ended" | "subscription-ended";

function escape(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Pure renderer shared by production delivery and the review-email script. */
export function billingExpiryEmail(opts: {
  kind: BillingExpiryKind;
  orgName: string;
  appName: string;
  monthlyUsd: number;
  billingUrl: string;
  supportEmail: string;
}) {
  const trial = opts.kind === "trial-ended";
  const subject = trial ? `Your ${opts.appName} trial has ended` : `Your ${opts.appName} subscription has ended`;
  const title = trial ? "Your trial has ended." : "Let’s get you back up and running.";
  const label = trial ? "FREE TRIAL ENDED" : "SUBSCRIPTION ENDED";
  const intro = trial
    ? `The free trial for ${opts.orgName} has ended. Choose a plan to continue using your workspace and collecting signed waivers.`
    : `The subscription for ${opts.orgName} has ended. Resubscribe to restore access to your workspace and resume collecting signed waivers.`;
  const cta = trial ? "Choose your plan" : "Resume your subscription";
  const reassurance = "Your existing waivers and signed records stay stored in your account. You can manage your subscription from the billing page.";
  const text = `${subject}\n\n${intro}\n\n${reassurance}\n\n$${opts.monthlyUsd}/month, flat\nUnlimited signed waivers\nUnlimited waiver templates\nUnlimited storage\n\n${cta}: ${opts.billingUrl}\n\nAlready renewed? Your billing page shows your latest status.\nNeed a hand? Reply to this email or contact ${opts.supportEmail}.\n\n${opts.appName}`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(subject)}</title></head>
<body style="margin:0;padding:0;background:#f5f4fa;color:#202034;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escape(intro)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4fa;"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">
<tr><td style="padding:0 12px 24px;font-size:23px;font-weight:800;letter-spacing:-1px;color:#5540ed;">${escape(opts.appName)}<span style="display:block;margin-top:7px;font-size:12px;font-weight:400;letter-spacing:0;color:#68677c;">Less paperwork. More possibility.</span></td></tr>
<tr><td style="background:#ffffff;border:1px solid #e7e5f1;border-radius:20px;overflow:hidden;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="height:6px;background:#6048ff;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:32px 24px 12px;"><span style="display:inline-block;padding:8px 12px;border-radius:20px;background:${trial ? "#fff3e4" : "#fff0f1"};color:${trial ? "#985516" : "#ae394c"};font-size:11px;font-weight:700;letter-spacing:1px;">${label}</span>
<h1 style="margin:22px 0 16px;font-size:30px;line-height:1.2;letter-spacing:-0.8px;">${title}</h1>
<p style="margin:0;font-size:16px;line-height:1.7;color:#56556b;">${escape(intro)}</p></td></tr>
<tr><td style="padding:12px 24px 24px;"><p style="margin:0;font-size:14px;line-height:1.7;color:#68677c;">${reassurance}</p></td></tr>
<tr><td style="padding:0 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ff;border:1px solid #e8e2ff;border-radius:14px;"><tr><td style="padding:24px;">
<p style="margin:0 0 12px;font-size:12px;font-weight:700;color:#6659a5;letter-spacing:1px;">ONE SIMPLE PLAN</p>
<p style="margin:0 0 18px;"><strong style="font-size:36px;letter-spacing:-1px;">$${opts.monthlyUsd}</strong><span style="font-size:15px;color:#68677c;"> / month, flat</span></p>
<p style="margin:8px 0;font-size:14px;color:#35324a;">&#10003;&nbsp; Unlimited signed waivers</p>
<p style="margin:8px 0;font-size:14px;color:#35324a;">&#10003;&nbsp; Unlimited waiver templates</p>
<p style="margin:8px 0 0;font-size:14px;color:#35324a;">&#10003;&nbsp; Unlimited storage</p>
</td></tr></table></td></tr>
<tr><td align="center" style="padding:28px 24px 10px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="#6048ff" style="border-radius:10px;"><a href="${escape(opts.billingUrl)}" style="display:inline-block;padding:16px 24px;border:1px solid #6048ff;border-radius:10px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">${cta} &rarr;</a></td></tr></table></td></tr>
<tr><td align="center" style="padding:4px 24px 28px;"><p style="margin:0;font-size:12px;line-height:1.6;color:#77758b;">Already renewed? Your billing page shows your latest status.</p></td></tr>
<tr><td style="border-top:1px solid #eeedf5;padding:24px;"><p style="margin:0;font-size:14px;line-height:1.7;color:#56556b;"><strong style="color:#242238;">Need a hand?</strong><br>Reply to this email or <a href="mailto:${escape(opts.supportEmail)}" style="color:#5540ed;text-decoration:underline;">contact our team</a>. We’re here to help.</p></td></tr>
</table></td></tr>
<tr><td align="center" style="padding:24px 12px;font-size:12px;line-height:1.7;color:#888599;">${escape(opts.appName)} &middot; Digital waivers, made simple.<br>You’re receiving this service notice as an account owner.</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html, text };
}
