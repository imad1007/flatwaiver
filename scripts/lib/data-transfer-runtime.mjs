import { AsyncLocalStorage } from "node:async_hooks";

const execution = new AsyncLocalStorage();
export const JOB_TIMEOUT_MS = 4 * 60 * 60 * 1000;
export function transferSignal() {
  return execution.getStore();
}
export function checkTransfer() {
  transferSignal()?.throwIfAborted();
}
export function withTransferSignal(signal, action) {
  return execution.run(signal, action);
}
// Bound SDK database and storage requests too, including response-body reads.
// Large object requests get an hour; ordinary metadata requests get a minute.
export function workerFetch(input, init = {}) {
  const url = String(input instanceof Request ? input.url : input);
  const timeout = url.includes("/storage/v1/object/") ? 3600000 : 60000;
  const signals = [
    transferSignal(),
    init.signal,
    AbortSignal.timeout(timeout),
  ].filter(Boolean);
  return fetch(input, { ...init, signal: AbortSignal.any(signals) });
}

export async function runWorkerLoop({
  db,
  signal,
  once = false,
  processJob,
  cleanup,
  wait = (ms) => new Promise((r) => setTimeout(r, ms)),
  log = console.error,
}) {
  let nextCleanup = 0;
  while (!signal.aborted) {
    if (Date.now() >= nextCleanup) {
      try {
        await withTransferSignal(signal, () => cleanup(db));
        nextCleanup = Date.now() + 3600000;
      } catch {
        log("Transfer cleanup failed; will retry in one minute");
        nextCleanup = Date.now() + 60000;
      }
    }
    if (signal.aborted) break;
    let worked = false;
    try {
      worked = await processJob(db, { signal });
    } catch {
      log("Transfer polling failed; will retry in five seconds");
    }
    if (once || signal.aborted) break;
    if (!worked) await wait(5000);
  }
}
