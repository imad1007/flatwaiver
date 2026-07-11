-- Paddle billing identifiers. Forward-only: the stripe_* columns stay for a
-- possible future switch back — the two providers' ids live side by side and
-- `status` remains the single source of truth for gating.

alter table subscriptions
  add column paddle_customer_id text,
  add column paddle_subscription_id text;

create index idx_subscriptions_paddle_sub
  on subscriptions (paddle_subscription_id)
  where paddle_subscription_id is not null;
