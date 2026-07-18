import { Database } from "lucide-react";

/**
 * Shown on admin pages when migration 0008 (blog_posts + admin_org_overview)
 * hasn't been applied yet. Keeps the panel from erroring on a fresh database.
 */
export function AdminSetupNotice() {
  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-amber-900 dark:text-amber-200">
      <div className="flex items-start gap-3">
        <Database className="mt-0.5 size-5 shrink-0" />
        <div className="text-sm leading-relaxed">
          <p className="font-semibold">One-time setup needed</p>
          <p className="mt-1">
            Apply migration{" "}
            <code className="rounded bg-black/10 px-1.5 py-0.5 font-mono text-xs dark:bg-white/10">
              supabase/migrations/0008_admin_blog.sql
            </code>{" "}
            in the Supabase SQL editor to create the admin overview and blog
            tables. This page will populate automatically once it runs.
          </p>
        </div>
      </div>
    </div>
  );
}
