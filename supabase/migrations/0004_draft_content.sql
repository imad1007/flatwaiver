-- Editor working copy on the mutable template shell. Published legal content
-- still lives ONLY in immutable template_versions; this column is the
-- pre-publish draft the owner reviews/edits (AI import output or pasted text).

alter table waiver_templates
  add column draft_content jsonb;
