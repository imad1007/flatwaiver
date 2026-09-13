import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import JSZip from "jszip";
import * as core from "../src/lib/data-transfer-core.mjs";
import { testDatabase } from "./lib/data-transfer-test-db.mjs";
import {
  processNextTransfer,
  cleanupTransfers,
} from "./lib/data-transfer-worker.mjs";
import {
  runWorkerLoop,
  withTransferSignal,
  workerFetch,
} from "./lib/data-transfer-runtime.mjs";
import {
  boundedStream,
  extractZip,
  makeZip,
  checkDocument,
} from "./lib/data-transfer-io.mjs";
import { Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { storagePathBelongsToOrg } from "../src/lib/storage-path.ts";

const fixture = await testDatabase();
const { pg, db, objects } = fixture;
const directory = await mkdtemp(join(tmpdir(), "flatwaiver-audit-test-"));
const a = randomUUID(),
  b = randomUUID(),
  ownerA = randomUUID(),
  ownerB = randomUUID();
const pdf = Buffer.from("%PDF-1.4\nOriginal evidence\n%%EOF");
const jobs = async (direction = "export", format = "csv") => {
  const result = await db
    .from("data_jobs")
    .insert({
      org_id: a,
      user_id: ownerA,
      direction,
      format,
      status: "queued",
      options: core.optionsSchema.parse({}),
    })
    .select()
    .single();
  assert.ifError(result.error);
  return result.data;
};
const get = async (id) =>
  (await pg.query("select * from data_jobs where id=$1", [id])).rows[0];
try {
  await pg.query("insert into organizations values($1,'A'),($2,'B')", [a, b]);
  await pg.query(
    "insert into profiles values($1,$2,'owner','a@test.test'),($3,$4,'owner','b@test.test')",
    [ownerA, a, ownerB, b],
  );
  const leased = await jobs();
  const claims = await Promise.all([
    db.rpc("claim_data_job"),
    db.rpc("claim_data_job"),
  ]);
  assert.equal(
    claims.flatMap((r) => r.data).length,
    1,
    "Two claimers receive only one lease",
  );
  const oldLease = (await get(leased.id)).lease_token;
  await pg.query(
    "update data_jobs set leased_until=now()-interval '1 second' where id=$1",
    [leased.id],
  );
  const recovered = await db.rpc("claim_data_job");
  assert.ifError(recovered.error);
  assert.notEqual(recovered.data[0].lease_token, oldLease);
  await assert.rejects(
    pg.query("select commit_data_import($1,$2,'[]')", [leased.id, oldLease]),
    /Invalid job lease/,
  );
  await pg.query(
    "update data_jobs set attempts=5,leased_until=null where id=$1",
    [leased.id],
  );
  await processNextTransfer(db);
  assert.equal((await get(leased.id)).status, "failed");
  assert.match((await get(leased.id)).error, /attempts exhausted/);
  assert.equal((await db.rpc("claim_data_job")).data.length, 0);

  // Shutdown interrupts work, persists an error and leaves a retryable job.
  const interrupted = await jobs();
  const stop = new AbortController();
  const shutdownDb = {
    ...db,
    rpc: async (name, args) => {
      const result = await db.rpc(name, args);
      if (name === "claim_data_job")
        stop.abort(new Error("Worker stopped safely"));
      return result;
    },
  };
  await processNextTransfer(shutdownDb, { signal: stop.signal });
  assert.equal((await get(interrupted.id)).status, "failed");
  assert.match((await get(interrupted.id)).error, /stopped safely/);
  await pg.query(
    "update data_jobs set status='queued',attempts=0 where id=$1",
    [interrupted.id],
  );
  await processNextTransfer(db);
  assert.equal((await get(interrupted.id)).status, "completed");

  const timed = await jobs();
  const timeoutDb = {
    ...db,
    from: (table) => {
      const query = db.from(table);
      if (table !== "profiles") return query;
      const delayed = new Proxy(query, {
        get(target, key) {
          if (key === "then")
            return async (yes) => {
              await new Promise((r) => setTimeout(r, 20));
              yes(await target);
            };
          const value = target[key];
          return typeof value === "function"
            ? (...args) => {
                value.apply(target, args);
                return delayed;
              }
            : value;
        },
      });
      return delayed;
    },
  };
  await processNextTransfer(timeoutDb, { timeoutMs: 1 });
  assert.equal((await get(timed.id)).status, "failed");
  assert.match((await get(timed.id)).error, /timeout/i);

  const partial = await jobs("import", "csv");
  const input = Buffer.from(
    "ID,Name\n" +
      Array.from({ length: 205 }, (_, i) => `PART${i},Person ${i}`).join("\n"),
  );
  const inputPath = `${a}/transfers/${partial.id}/input/data.csv`;
  await pg.query(
    "update data_jobs set status='uploading',options=$2 where id=$1",
    [
      partial.id,
      core.optionsSchema.parse({
        mapping: { ID: "external_id", Name: "participant_name" },
      }),
    ],
  );
  objects.set(`uploads/${inputPath}`, input);
  assert.ifError(
    (
      await db.from("data_job_files").insert({
        job_id: partial.id,
        filename: "data.csv",
        path: inputPath,
        size: input.length,
      })
    ).error,
  );
  await pg.query("update data_jobs set status='queued' where id=$1", [
    partial.id,
  ]);
  await processNextTransfer(db);
  assert.equal((await get(partial.id)).status, "preview");
  await pg.query(
    "update data_jobs set status='ready',confirmed_at=now(),attempts=0 where id=$1",
    [partial.id],
  );
  let commits = 0;
  const interruptedDb = {
    ...db,
    rpc: async (name, args) =>
      name === "commit_data_import" && ++commits === 2
        ? { error: new Error("Connection lost after first committed batch") }
        : db.rpc(name, args),
  };
  await processNextTransfer(interruptedDb);
  assert.equal((await get(partial.id)).status, "failed");
  assert.equal(
    (
      await pg.query(
        "select count(*) n from imported_waivers where import_job_id=$1",
        [partial.id],
      )
    ).rows[0].n,
    100,
  );
  await pg.query("update data_jobs set status='ready',attempts=0 where id=$1", [
    partial.id,
  ]);
  await processNextTransfer(db);
  assert.equal((await get(partial.id)).status, "completed");
  assert.equal(
    (
      await pg.query(
        "select count(*) n from imported_waivers where import_job_id=$1",
        [partial.id],
      )
    ).rows[0].n,
    205,
  );

  // Neither a cleanup error nor a transient poll error kills the worker loop.
  const loopStop = new AbortController();
  let polls = 0,
    errors = 0;
  await runWorkerLoop({
    db,
    signal: loopStop.signal,
    cleanup: async () => {
      throw new Error("offline");
    },
    processJob: async () => {
      if (++polls === 1) throw new Error("offline");
      loopStop.abort();
      return false;
    },
    wait: async () => {},
    log: () => errors++,
  });
  assert.equal(polls, 2);
  assert.equal(errors, 2);
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(
    withTransferSignal(abort.signal, () => workerFetch("http://127.0.0.1:1")),
    /abort/i,
  );

  // Cleanup cannot race a live lease. Once expired, it fences stale commits.
  const cleaning = await jobs();
  await pg.query(
    "update data_jobs set expires_at=now()-interval '1 day',leased_until=now()+interval '1 minute',lease_token=$2,status='processing' where id=$1",
    [cleaning.id, randomUUID()],
  );
  const tempPath = `uploads/${a}/transfers/${cleaning.id}/output/test.csv`;
  objects.set(tempPath, Buffer.from("data"));
  await cleanupTransfers(db);
  assert(objects.has(tempPath));
  await pg.query(
    "update data_jobs set leased_until=now()-interval '1 minute' where id=$1",
    [cleaning.id],
  );
  await cleanupTransfers(db);
  assert.equal((await get(cleaning.id)).status, "expired");
  assert(!objects.has(tempPath));

  const exportPath = (await get(interrupted.id)).output_path;
  await pg.query(
    "update data_jobs set expires_at=now()-interval '1 day' where id=$1",
    [interrupted.id],
  );
  let failedRemove = false;
  const cleanupDb = {
    ...db,
    storage: {
      from: (bucket) => ({
        ...db.storage.from(bucket),
        remove: async (paths) => {
          if (!failedRemove) {
            failedRemove = true;
            return { error: new Error("Temporary storage outage") };
          }
          return db.storage.from(bucket).remove(paths);
        },
      }),
    },
  };
  await assert.rejects(cleanupTransfers(cleanupDb), /storage outage/);
  assert.equal((await get(interrupted.id)).status, "expired");
  assert(objects.has(`uploads/${exportPath}`));
  await cleanupTransfers(db);
  assert.equal((await get(interrupted.id)).output_path, "cleaned");
  assert(
    !objects.has(`uploads/${exportPath}`),
    "Interrupted cleanup is retried even with an existing output path",
  );

  // Concurrent registration uses a job row lock, and rejects foreign paths.
  const uploadJob = await jobs("import", "historical");
  await pg.query("update data_jobs set status='uploading' where id=$1", [
    uploadJob.id,
  ]);
  const fileRow = (name, size, org = a) => ({
    job_id: uploadJob.id,
    filename: name,
    size,
    path: `${org}/transfers/${uploadJob.id}/input/${randomUUID()}.zip`,
  });
  assert(
    (await db.from("data_job_files").insert(fileRow("foreign.zip", 1, b)))
      .error,
  );
  const registration = await Promise.all([
    db.from("data_job_files").insert(fileRow("one.zip", 3 * 1024 ** 3)),
    db.from("data_job_files").insert(fileRow("two.zip", 3 * 1024 ** 3)),
  ]);
  assert.equal(registration.filter((r) => !r.error).length, 1);
  assert(
    (
      await db
        .from("data_job_files")
        .insert(fileRow("oversized.csv", 21 * 1024 ** 2))
    ).error,
  );

  const recordId = randomUUID();
  const record = {
    id: recordId,
    org_id: a,
    import_job_id: uploadJob.id,
    imported_by: ownerA,
    source_provider: "smartwaiver",
    dedupe_key: "id:SOURCE1",
    pdf_path: `${a}/imported/${recordId}.pdf`,
    pdf_sha256: core.hash(pdf),
  };
  for (const invalid of [
    { pdf_sha256: null },
    { pdf_path: null },
    { pdf_sha256: "x".repeat(64) },
    { pdf_path: `${b}/imported/${recordId}.pdf` },
  ])
    assert(
      (await db.from("imported_waivers").insert({ ...record, ...invalid }))
        .error,
      "SQL rejects missing/invalid evidence hashes and foreign paths",
    );
  assert.ifError((await db.from("imported_waivers").insert(record)).error);
  objects.set(`signed-pdfs/${record.pdf_path}`, pdf);

  // Execute the real route handlers and auth helper with a local authenticated
  // PostgreSQL session. Only network/auth adapters are fixtures, not handlers.
  let actor = { userId: ownerB, orgId: b, role: "owner" };
  const scopedDb = {
    auth: { getUser: async () => ({ data: { user: { id: actor.userId } } }) },
    from: (table) => {
      const query = db.from(table);
      const proxy = new Proxy(query, {
        get(target, key) {
          if (key === "then")
            return async (yes, no) => {
              try {
                await pg.exec(
                  `set role authenticated;set "test.uid"='${actor.userId}';`,
                );
                const result = await target;
                await pg.exec("reset role");
                yes(result);
              } catch (error) {
                await pg.exec("reset role");
                no(error);
              }
            };
          const value = target[key];
          return typeof value === "function"
            ? (...args) => {
                value.apply(target, args);
                return proxy;
              }
            : value;
        },
      });
      return proxy;
    },
  };
  const loadTs = async (path, imports) => {
    const source = await readFile(path, "utf8");
    const js = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    const exports = {};
    runInNewContext(js, {
      exports,
      require: (key) => {
        assert(key in imports, `Unknown import ${key}`);
        return imports[key];
      },
      Request,
      Response,
      URL,
      ReadableStream,
      TextEncoder,
      Buffer,
      crypto: globalThis.crypto,
      console,
    });
    return exports;
  };
  const auth = await loadTs("src/lib/data-transfer-auth.ts", {
    "server-only": {},
    "@/lib/auth": { getOrgCaller: async () => actor },
    "@/lib/supabase/admin": { createAdminClient: () => db },
    "@/lib/supabase/server": { createClient: async () => scopedDb },
  });
  const imports = {
    zod: { z },
    "@/lib/data-transfer-auth": auth,
    "@/lib/data-transfer-core.mjs": core,
  };
  const route = await loadTs("src/app/api/data/jobs/[id]/route.ts", imports);
  const listRoute = await loadTs("src/app/api/data/jobs/route.ts", imports);
  const context = { params: Promise.resolve({ id: uploadJob.id }) };
  for (const suffix of ["", "?download=1", "?errors=1", "?page=1"])
    assert.equal(
      (
        await route.GET(
          new Request(
            `https://app.test/api/data/jobs/${uploadJob.id}${suffix}`,
          ),
          context,
        )
      ).status,
      404,
    );
  for (const action of ["upload", "preview", "confirm", "retry", "cancel"])
    assert.equal(
      (
        await route.POST(
          new Request(`https://app.test/api/data/jobs/${uploadJob.id}`, {
            method: "POST",
            body: JSON.stringify({ action, files: [fileRow("test.zip", 1)] }),
          }),
          context,
        )
      ).status,
      404,
    );
  const list = await (
    await listRoute.GET(new Request("https://app.test/api/data/jobs"))
  ).json();
  assert.equal(list.jobs.length, 0);
  const forged = await listRoute.POST(
    new Request("https://app.test/api/data/jobs", {
      method: "POST",
      body: JSON.stringify({
        direction: "export",
        format: "csv",
        org_id: a,
        organization_id: a,
        options: {},
      }),
    }),
  );
  assert.equal(forged.status, 200);
  assert.equal(
    (await get((await forged.json()).id)).org_id,
    b,
    "Browser organization ID cannot select another tenant",
  );
  await pg.exec(`set role authenticated;set "test.uid"='${ownerB}';`);
  assert.equal(
    (await pg.query("select * from imported_waivers where id=$1", [recordId]))
      .rows.length,
    0,
  );
  for (const sql of [
    "delete from data_job_files",
    "update imported_waivers set participant_name='x'",
    "select recover_data_jobs()",
    `select begin_data_cleanup('${uploadJob.id}')`,
    `select stage_data_import('${uploadJob.id}','${randomUUID()}','[]',false)`,
    `select commit_data_import('${uploadJob.id}','${randomUUID()}','[]')`,
  ])
    await assert.rejects(pg.query(sql), /permission denied/);
  await pg.exec("reset role");
  // Existing download endpoint is also used by imported documents: foreign
  // organization prefixes must fail before the service-role signer is called.
  const fileRoute = await loadTs("src/app/api/files/sign-url/route.ts", {
    "next/server": { NextResponse: Response },
    zod: { z },
    "@/lib/storage-path": { storagePathBelongsToOrg },
    "@/lib/supabase/admin": { createAdminClient: () => db },
    "@/lib/supabase/server": { createClient: async () => scopedDb },
  });
  for (const bucket of ["uploads", "signed-pdfs", "signatures"])
    assert.equal(
      (
        await fileRoute.POST(
          new Request("https://app.test/api/files/sign-url", {
            method: "POST",
            body: JSON.stringify({
              bucket,
              path: `${a}/imported/${recordId}.pdf`,
            }),
          }),
        )
      ).status,
      404,
    );
  for (const escape of [
    "..",
    "%2e%2e",
    "%252e%252e",
    ".%2e",
    "..\\",
    "?path=",
    "#",
  ]) {
    const path = `${b}/${escape}/${a}/imported/${recordId}.pdf`;
    assert(!storagePathBelongsToOrg(path, b));
    assert.equal(
      (
        await fileRoute.POST(
          new Request("https://app.test/api/files/sign-url", {
            method: "POST",
            body: JSON.stringify({ bucket: "signed-pdfs", path }),
          }),
        )
      ).status,
      404,
    );
  }
  actor = { ...actor, role: "viewer" };
  assert.equal(
    (await listRoute.GET(new Request("https://app.test/api/data/jobs"))).status,
    403,
  );

  // Hard stream bounds, entry counts, cumulative expansion and nested archives.
  await assert.rejects(
    pipeline(
      Readable.from([Buffer.alloc(6), Buffer.alloc(6)]),
      boundedStream(10),
      new Writable({
        write(c, e, cb) {
          cb();
        },
      }),
    ),
    /size limit/,
  );
  const pdfFile = join(directory, "record.pdf");
  await writeFile(pdfFile, pdf);
  await checkDocument({ local: pdfFile }, "record.pdf");
  const zipFile = join(directory, "records.zip");
  await makeZip(
    new Map([
      ["one.pdf", pdfFile],
      ["two.pdf", pdfFile],
    ]),
    zipFile,
  );
  await assert.rejects(
    extractZip(zipFile, directory, { files: 1 }),
    /too many/,
  );
  await assert.rejects(
    extractZip(zipFile, directory, { expanded: pdf.length }),
    /expansion/,
  );
  const nested = new JSZip();
  nested.file("nested.zip", await readFile(zipFile));
  const nestedFile = join(directory, "nested.zip");
  await writeFile(
    nestedFile,
    await nested.generateAsync({ type: "nodebuffer" }),
  );
  await assert.rejects(
    extractZip(nestedFile, directory),
    /Unsupported archive entry/,
  );
  console.log(
    "PASS: concurrent claims, expired leases, bounded attempts, shutdown/retry, polling recovery, cleanup fencing, atomic upload limits, hash constraints, real API tenant boundaries, private file access, RPC denial, stream limits and nested archives.",
  );
} finally {
  await fixture.close();
  const target = resolve(directory),
    root = resolve(tmpdir()) + sep;
  if (
    target.startsWith(root) &&
    target.slice(root.length).startsWith("flatwaiver-audit-test-")
  )
    await rm(target, { recursive: true, force: true });
}
