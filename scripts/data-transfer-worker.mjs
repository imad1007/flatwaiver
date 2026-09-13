import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import {
  processNextTransfer,
  cleanupTransfers,
} from "./lib/data-transfer-worker.mjs";
import { workerFetch, runWorkerLoop } from "./lib/data-transfer-runtime.mjs";

nextEnv.loadEnvConfig(process.cwd());
if (
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY
)
  throw new Error("Worker needs Supabase URL and service role key");
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: workerFetch },
  },
);
const shutdown = new AbortController();
for (const event of ["SIGINT", "SIGTERM"])
  process.on(event, () =>
    shutdown.abort(
      new Error("Worker stopped; retry this transfer to resume safely."),
    ),
  );
await runWorkerLoop({
  db,
  signal: shutdown.signal,
  once: process.argv.includes("--once"),
  processJob: processNextTransfer,
  cleanup: cleanupTransfers,
});
