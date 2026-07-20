-- 0009 — Creem billing. Forward-only (never edits 0001–0008). Creem replaces
-- Paddle as the active provider. The paddle_*/stripe_* columns are left in place
-- but DORMANT (like stripe_* was when Paddle went live) — droppable later once
-- no legacy subscriptions remain. `status` stays the single source of truth for
-- access gating; the id columns are only used to reconcile/cancel with Creem.

alter table subscriptions
  add column if not exists creem_customer_id text,
  add column if not exists creem_subscription_id text;

create index if not exists idx_subscriptions_creem_sub
  on subscriptions (creem_subscription_id)
  where creem_subscription_id is not null;

-- Webhook idempotency: Creem (like every provider) can redeliver events. The
-- webhook claims each event id here before applying it, so a redelivery is a
-- no-op. Provider-scoped so future providers can share the table.
create table if not exists webhook_events (
  provider text not null,
  event_id text not null,
  received_at timestamptz not null default now(),
  primary key (provider, event_id)
);

alter table webhook_events enable row level security;
-- No policies: only the service role (webhook handler) touches this table.
-- anon/authenticated get zero access, consistent with the rest of the schema.
