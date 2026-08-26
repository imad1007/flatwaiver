-- Phase 4: Richer signing — photo / ID capture at signing.
-- Additive only.

-- Per-template photo policy: off (default, no change to today's flow), optional
-- (signer may add a photo), or required (a photo must be captured to sign).
alter table waiver_templates
  add column photo_mode text not null default 'off'
  check (photo_mode in ('off', 'optional', 'required'));

-- Captured signer photo (private storage path in the `signatures` bucket);
-- null when none was captured. signed_waivers stays append-only — this ALTER is
-- DDL and doesn't trip the row-level immutability trigger.
alter table signed_waivers add column photo_path text;
