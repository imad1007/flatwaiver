# Billing expiry emails

Account owners receive a trial-ended or subscription-ended email, with a link to
Settings > Billing. Templates include the current flat plan from `APP` config.

## Enable after preview approval

1. Apply `supabase/migrations/0017_billing_expiry_emails.sql`.
2. Configure `RESEND_API_KEY` and a strong `CRON_SECRET` in Vercel production.
   The sender domain for `NEXT_PUBLIC_APP_URL` must be verified in Resend.
3. Deploy. Vercel calls `/api/cron/billing-expiry` daily at 09:15 UTC.

The daily check processes up to 20 owner notices per run, including previously
expired accounts that have not received this notice. It uses the owner's current
Auth email. Active accounts, future trials, future cancellation dates and
past-due accounts are excluded. A scheduled cancellation remains active until
the provider reports that the subscription ended.

## Delivery tracking

`billing_expiry_emails` is accessible only to the server service role. A unique
owner/org/expiry key prevents repeated notices for the same expiry. A five-minute
claim lease prevents concurrent workers from sending the same job. The worker
rechecks eligibility before sending, so renewed accounts are skipped.

Resend idempotency keys protect retries within the provider's 24-hour window.
Uncertain attempts older than 23 hours are marked `review`, not automatically
resent. Check these records and their Resend logs after a failed cron run; the
next daily run does not blindly retry them. `sent` means Resend accepted the
email, not that it reached the recipient's inbox.

Do not reset a `review` record without checking delivery first. A support retry
within the window can call the authenticated cron endpoint after the lease
expires. Production cron requests require `Authorization: Bearer CRON_SECRET`.

## Local previews and checks

Render without sending:

```sh
node --experimental-strip-types scripts/preview-billing-emails.mjs
node --experimental-strip-types scripts/verify-billing-expiry-emails.mjs
```

Rendered previews are in `output/emails/`. Sending requires explicit `--send`
and `--to=recipient@example.com` arguments. The preview script uses the same
renderer, adds `[Preview]` to subjects and uses a demo workspace name.
