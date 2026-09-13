import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import JSZip from "jszip";
import {
  parseCsv,
  mapCsvRow,
  csvLine,
  csvRecord,
  filtersSchema,
  parseTemplate,
  safeArchiveName,
  validateMagic,
  dateTime,
  hash,
  optionsSchema,
} from "../src/lib/data-transfer-core.mjs";
import {
  extractZip,
  makeZip,
  download,
  recordLines,
} from "./lib/data-transfer-io.mjs";
import {
  processNextTransfer,
  cleanupTransfers,
  matchFile,
} from "./lib/data-transfer-worker.mjs";
import { testDatabase } from "./lib/data-transfer-test-db.mjs";

const tmp = await mkdtemp(join(tmpdir(), "flatwaiver-data-test-"));
const fixture = await testDatabase();
const { db, pg, objects } = fixture;
const org = randomUUID(),
  otherOrg = randomUUID(),
  owner = randomUUID(),
  otherOwner = randomUUID(),
  viewer = randomUUID(),
  tpl = randomUUID();
try {
  await assert.rejects(
    download(db, "signed-pdfs", `${otherOrg}/secret.pdf`, org, tmp),
    /ownership/,
  );
  const longRecord = join(tmp, "too-long.ndjson");
  await writeFile(longRecord, "x".repeat(600000));
  await assert.rejects(async () => {
    for await (const line of recordLines(longRecord)) void line;
  }, /512 KB/);
  const csv =
    '\uFEFFName,Email,Emergency Contact,ID,Date\r\n"A, B",a@example.com,"Line 1\n""quoted""",EXT1,2026-09-12\r\n';
  const parsed = parseCsv(csv);
  assert.equal(parsed.rows[0][2], 'Line 1\n"quoted"');
  const row = mapCsvRow(parsed.headers, parsed.rows[0], {
    Name: "participant_name",
    Email: "participant_email",
    "Emergency Contact": "custom:emergency",
    ID: "external_id",
    Date: "original_signed_at",
  });
  assert.equal(row.field_values.emergency, 'Line 1\n"quoted"');
  assert.equal(row.original_signed_at, "2026-09-12T00:00:00.000Z");
  assert.throws(() => parseCsv("a,a\n1,2"));
  assert.throws(() => parseCsv('a\n"unclosed'));
  assert.throws(() =>
    mapCsvRow(["Email"], ["bad"], { Email: "participant_email" }),
  );
  assert.throws(() => dateTime("09/12/2026"));
  assert.throws(() => dateTime("2026-02-30"));
  assert.throws(() =>
    filtersSchema.parse({ from: "2026-09-12", to: "2026-09-01" }),
  );
  for (const value of ["=SUM(1,2)", " +42", "-1", "@x", "\t=1"])
    assert(csvLine([value]).includes("'"));
  assert.equal(parseCsv("one;two\n1;2", ";").rows[0][1], "2");
  assert(
    csvRecord({ field_values: { emergency: "=cmd" }, source_evidence: {} }, [
      "emergency",
    ]).includes("'=cmd"),
  );
  for (const name of [
    "../a.pdf",
    "/a.pdf",
    "C:/a.pdf",
    "dir\\a.pdf",
    "a\0.pdf",
  ])
    assert.throws(() => safeArchiveName(name));
  assert.throws(() => validateMagic(Buffer.from("MZ executable"), "fake.pdf"));
  assert.throws(() =>
    matchFile(
      new Map([
        ["a/ID.pdf", {}],
        ["b/ID.pdf", {}],
      ]),
      "ID.pdf",
    ),
  );
  const pkg = {
    format: "flatwaiver-template",
    version: 1,
    exported_id: tpl,
    name: "Training waiver",
    content: {
      title: "Training waiver",
      blocks: [{ type: "paragraph", text: "Original terms" }],
      fields: [
        {
          key: "emergency",
          type: "text",
          label: "Emergency contact",
          required: false,
        },
      ],
      consent_text: "I agree to sign electronically.",
      minor_mode: "allowed",
    },
    settings: { photo_mode: "optional", expiry_months: 12 },
  };
  assert.equal(parseTemplate(pkg).name, "Training waiver");
  assert.throws(() => parseTemplate({ ...pkg, version: 99 }));
  await pg.query("insert into organizations values($1,$2),($3,$4)", [
    org,
    "Test gym",
    otherOrg,
    "Other gym",
  ]);
  await pg.query(
    "insert into profiles values($1,$2,$3,$4),($5,$6,$3,$7),($8,$2,$9,$10)",
    [
      owner,
      org,
      "owner",
      "a@test.test",
      otherOwner,
      otherOrg,
      "b@test.test",
      viewer,
      "viewer",
      "v@test.test",
    ],
  );
  await pg.query("insert into subscriptions values($1,'active',null)", [org]);
  await pg.query(
    "insert into waiver_templates(id,org_id,name,slug,status,draft_content,expiry_months,photo_mode)values($1,$2,'Training waiver','test','draft',$3,12,'optional')",
    [tpl, org, pkg.content],
  );
  const newJob = async (direction, format, options = {}) => {
    const result = await db
      .from("data_jobs")
      .insert({
        org_id: org,
        user_id: owner,
        direction,
        format,
        options: optionsSchema.parse(options),
        status: "queued",
      })
      .select()
      .single();
    assert.ifError(result.error);
    return result.data.id;
  };
  const addInput = async (job, name, bytes, uploadOrg = org) => {
    await pg.query("update data_jobs set status='uploading' where id=$1", [
      job,
    ]);
    const path = `${uploadOrg}/transfers/${job}/input/${randomUUID()}.${name.split(".").at(-1)}`;
    objects.set("uploads/" + path, Buffer.from(bytes));
    const r = await db.from("data_job_files").insert({
      job_id: job,
      filename: name,
      path,
      size: Buffer.byteLength(bytes),
    });
    assert.ifError(r.error);
    await pg.query("update data_jobs set status='queued' where id=$1", [job]);
  };
  const jobById = async (id) =>
    (await pg.query("select * from data_jobs where id=$1", [id])).rows[0];
  const confirm = async (id) => {
    await pg.query(
      "update data_jobs set status='ready',confirmed_at=now(),attempts=0 where id=$1",
      [id],
    );
    await processNextTransfer(db);
  };
  const pdf = Buffer.from("%PDF-1.4\nOriginal source fixture\n%%EOF");
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
  const job = await newJob("import", "csv", {
    provider: "smartwaiver",
    mapping: {
      Name: "participant_name",
      Email: "participant_email",
      "Emergency Contact": "custom:emergency",
      ID: "external_id",
      Date: "original_signed_at",
    },
  });
  await addInput(
    job,
    "export.csv",
    csv + "Bad,invalid,none,EXT2,2026-09-12\r\n",
  );
  await addInput(job, "EXT1.pdf", pdf);
  await processNextTransfer(db);
  assert.equal((await jobById(job)).status, "preview");
  assert.equal((await jobById(job)).summary.valid, 1);
  assert.equal((await jobById(job)).summary.invalid, 1);
  assert.equal(
    (await pg.query("select count(*) n from imported_waivers")).rows[0].n,
    0,
    "Preview must not create archive records",
  );
  await confirm(job);
  assert.equal((await jobById(job)).status, "completed");
  const imported = (await pg.query("select * from imported_waivers")).rows[0];
  assert.equal(imported.record_origin, "imported");
  assert.equal(imported.source_provider, "smartwaiver");
  assert.equal(imported.pdf_sha256, hash(pdf));
  assert(!("ip" in imported));
  assert.deepEqual(objects.get("signed-pdfs/" + imported.pdf_path), pdf);
  assert.equal(
    (await pg.query("select count(*) n from signed_waivers")).rows[0].n,
    0,
    "Import never fabricates a native signature",
  );
  await assert.rejects(
    pg.query("update imported_waivers set participant_name=$1 where id=$2", [
      "changed",
      imported.id,
    ]),
    /immutable/,
  );
  const dup = await newJob("import", "csv", {
    provider: "smartwaiver",
    mapping: {
      Name: "participant_name",
      Email: "participant_email",
      "Emergency Contact": "custom:emergency",
      ID: "external_id",
      Date: "original_signed_at",
    },
  });
  await addInput(dup, "export.csv", csv);
  await addInput(dup, "EXT1.pdf", pdf);
  await processNextTransfer(db);
  assert.equal((await jobById(dup)).summary.skipped, 1);
  const copy = await newJob("import", "historical", {
    provider: "other",
    duplicates: "copy",
  });
  await addInput(copy, "another.pdf", pdf);
  await processNextTransfer(db);
  await confirm(copy);
  assert.equal((await jobById(copy)).summary.imported, 1);
  // SQL policies: a different organization and a non-owner see zero records.
  for (const uid of [otherOwner, viewer]) {
    await pg.exec(`set role authenticated;set "test.uid"='${uid}';`);
    assert.equal(
      (await pg.query("select * from imported_waivers")).rows.length,
      0,
    );
    assert.equal((await pg.query("select * from data_jobs")).rows.length, 0);
    assert.equal(
      (await pg.query("select * from data_job_files")).rows.length,
      0,
    );
    assert.equal(
      (await pg.query("select * from data_import_items")).rows.length,
      0,
    );
    await assert.rejects(
      pg.query("select * from claim_data_job()"),
      /permission denied/,
    );
    await pg.exec("reset role;");
  }
  await pg.exec(`set role authenticated;set "test.uid"='${owner}';`);
  assert.equal(
    (await pg.query("select * from imported_waivers")).rows.length,
    2,
  );
  await assert.rejects(
    pg.query("delete from imported_waivers"),
    /permission denied/,
  );
  await pg.exec("reset role;");
  // 500 native records across a month, plus boundary and other-org fixtures.
  for (let i = 0; i < 502; i++) {
    const id = randomUUID();
    const path = `${org}/${id}.pdf`;
    objects.set("signed-pdfs/" + path, pdf);
    const date = i < 500 ? "2026-09-30T23:59:59.999Z" : "2026-10-01T00:00:00Z";
    await pg.query(
      "insert into signed_waivers(id,org_id,template_id,signer_name,signer_email,field_values,pdf_path,pdf_sha256,signed_at,created_at,flagged) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false)",
      [
        id,
        org,
        tpl,
        `Signer ${i}`,
        "test@example.com",
        { emergency: "=unsafe", membership: "123" },
        path,
        hash(pdf),
        date,
        "2026-09-01T00:00:00Z",
      ],
    );
  }
  // A future snapshot timestamp is explicit for deterministic fixtures.
  const csvJob = await newJob("export", "csv", {
    filters: {
      from: "2026-09-01",
      to: "2026-09-30",
      origin: "native",
      template: tpl,
    },
  });
  await pg.query("update data_jobs set created_at='2026-10-02' where id=$1", [
    csvJob,
  ]);
  await processNextTransfer(db);
  const csvResult = await jobById(csvJob);
  assert.equal(csvResult.status, "completed");
  const exported = parseCsv(
    objects.get("uploads/" + csvResult.output_path).toString(),
  );
  assert.equal(exported.rows.length, 500);
  assert(exported.headers.includes("custom:emergency"));
  assert(exported.rows[0].includes("'=unsafe"));
  const zipJob = await newJob("export", "pdfs", {
    filters: { from: "2026-09-01", to: "2026-09-30", origin: "native" },
  });
  await pg.query("update data_jobs set created_at='2026-10-02' where id=$1", [
    zipJob,
  ]);
  await processNextTransfer(db);
  const zipped = await JSZip.loadAsync(
    objects.get("uploads/" + (await jobById(zipJob)).output_path),
  );
  assert.equal(Object.values(zipped.files).filter((f) => !f.dir).length, 500);
  assert.deepEqual(
    await Object.values(zipped.files)
      .find((f) => !f.dir)
      .async("nodebuffer"),
    pdf,
  );
  const empty = await newJob("export", "csv", {
    filters: { q: "No such participant" },
  });
  await processNextTransfer(db);
  assert.equal(
    parseCsv(
      objects.get("uploads/" + (await jobById(empty)).output_path).toString(),
    ).rows.length,
    0,
  );
  const backup = await newJob("export", "backup");
  const signedImageId = (
    await pg.query("select id from signed_waivers where org_id=$1 limit 1", [
      org,
    ])
  ).rows[0].id;
  const signedImagePath = `${org}/${signedImageId}.png`;
  objects.set("signatures/" + signedImagePath, png);
  await pg.query("update signed_waivers set signature_path=$1 where id=$2", [
    signedImagePath,
    signedImageId,
  ]);
  const foreignId = randomUUID();
  const foreignOrg = randomUUID();
  await pg.query("insert into organizations values($1,'Unrelated tenant')", [
    foreignOrg,
  ]);
  await pg.query(
    "insert into signed_waivers(id,org_id,signer_name,created_at)values($1,$2,'OTHER ORGANIZATION SECRET',now())",
    [foreignId, foreignOrg],
  );
  await pg.query("update data_jobs set created_at='2099-01-01' where id=$1", [
    backup,
  ]);
  await processNextTransfer(db);
  assert.equal((await jobById(backup)).status, "completed");
  const archive = objects.get("uploads/" + (await jobById(backup)).output_path);
  const backupZip = await JSZip.loadAsync(archive);
  assert(backupZip.file("manifest.json"));
  assert(backupZip.file("submissions.csv"));
  assert(backupZip.file("records.ndjson"));
  const originals = (await backupZip.file("records.ndjson").async("string"))
    .trim()
    .split("\n")
    .map(JSON.parse);
  assert.equal(originals.length, 504);
  assert(!originals.some((r) => r.id === foreignId));
  const missingFile = await JSZip.loadAsync(archive);
  const templateFilename = Object.keys(missingFile.files).find(
    (name) => name.startsWith("templates/") && name.endsWith(".json"),
  );
  missingFile.remove(templateFilename);
  const missingRestore = await newJob("import", "restore");
  await addInput(
    missingRestore,
    "missing.zip",
    await missingFile.generateAsync({ type: "nodebuffer" }),
  );
  await processNextTransfer(db);
  assert.equal((await jobById(missingRestore)).status, "failed");
  assert.match((await jobById(missingRestore)).error, /checksum mismatch/);
  const restore = await newJob("import", "restore");
  await addInput(restore, "backup.zip", archive);
  await processNextTransfer(db);
  assert.equal((await jobById(restore)).status, "preview");
  assert((await jobById(restore)).summary.skipped >= 502);
  assert.equal(
    (await jobById(restore)).summary.valid,
    0,
    "Same-account restore skips both native and already imported IDs",
  );
  const otherRestore = await newJob("import", "restore");
  await pg.query("update data_jobs set org_id=$1,user_id=$2 where id=$3", [
    otherOrg,
    otherOwner,
    otherRestore,
  ]);
  await pg.query("insert into subscriptions values($1,'active',null)", [
    otherOrg,
  ]);
  await addInput(otherRestore, "backup.zip", archive, otherOrg);
  await processNextTransfer(db);
  assert.equal((await jobById(otherRestore)).status, "preview");
  await confirm(otherRestore);
  assert.equal((await jobById(otherRestore)).status, "completed");
  assert.equal(
    (
      await pg.query(
        "select count(*) n from imported_waivers where org_id=$1",
        [otherOrg],
      )
    ).rows[0].n,
    504,
  );
  const associated = (
    await pg.query(
      "select template_id from imported_waivers where org_id=$1 and template_id is not null limit 1",
      [otherOrg],
    )
  ).rows[0];
  assert(associated?.template_id);
  assert.notEqual(associated.template_id, tpl);
  const restoredRows = (
    await pg.query("select * from imported_waivers where org_id=$1", [otherOrg])
  ).rows;
  for (const original of originals) {
    const restored = restoredRows.find((r) => r.external_id === original.id);
    assert(restored, `Restored record ${original.id}`);
    assert.equal(restored.record_origin, "imported");
    assert.equal(restored.source_provider, "flatwaiver_backup");
    assert.deepEqual(restored.field_values, original.field_values ?? {});
    assert.equal(
      restored.original_signed_at
        ? new Date(restored.original_signed_at).toISOString()
        : null,
      original.original_signed_at
        ? new Date(original.original_signed_at).toISOString()
        : null,
    );
    assert.deepEqual(
      restored.source_evidence.backup_exported_record,
      original,
      "All prior metadata and timestamps are retained as source evidence",
    );
    assert(restored.imported_at);
    assert.equal(restored.pdf_sha256, original.pdf_sha256);
    if (original.pdf_filename)
      assert.deepEqual(
        objects.get("signed-pdfs/" + restored.pdf_path),
        await backupZip.file(original.pdf_filename).async("nodebuffer"),
      );
    if (original.signature_filename)
      assert.deepEqual(
        objects.get("signatures/" + restored.signature_path),
        png,
      );
  }
  const restoredTemplate = (
    await pg.query("select * from waiver_templates where org_id=$1", [otherOrg])
  ).rows[0];
  assert.equal(restoredTemplate.status, "draft");
  assert.deepEqual(restoredTemplate.draft_content.fields, pkg.content.fields);
  assert.deepEqual(restoredTemplate.draft_content.blocks, pkg.content.blocks);
  assert.equal(restoredTemplate.expiry_months, pkg.settings.expiry_months);
  assert.equal(restoredTemplate.photo_mode, pkg.settings.photo_mode);
  assert.equal(
    (
      await pg.query("select count(*) n from signed_waivers where org_id=$1", [
        otherOrg,
      ])
    ).rows[0].n,
    0,
    "Restore does not create native signatures",
  );
  // A source image is copied unchanged and remains imported evidence.
  const imageJob = await newJob("import", "csv", {
    mapping: { ID: "external_id", Signature: "signature_filename" },
  });
  await addInput(imageJob, "data.csv", "ID,Signature\nIMG1,source.png\n");
  await addInput(imageJob, "source.png", png);
  await processNextTransfer(db);
  await confirm(imageJob);
  const imageRow = (
    await pg.query("select * from imported_waivers where external_id='IMG1'")
  ).rows[0];
  assert.deepEqual(objects.get("signatures/" + imageRow.signature_path), png);
  assert.equal(imageRow.signature_sha256, hash(png));
  const templateJob = await newJob("import", "template", {
    duplicates: "copy",
    name: "Imported training",
  });
  await addInput(templateJob, "template.json", JSON.stringify(pkg));
  await processNextTransfer(db);
  await confirm(templateJob);
  assert.equal((await jobById(templateJob)).summary.imported, 1);
  assert.equal(
    (
      await pg.query(
        "select status from waiver_templates where name='Imported training'",
      )
    ).rows[0].status,
    "draft",
  );
  // ZIP traversal and expansion guards exercise the actual streaming extractor.
  const simple = join(tmp, "one.pdf");
  await writeFile(simple, pdf);
  const zipPath = join(tmp, "valid.zip");
  await makeZip(new Map([["folder/one.pdf", simple]]), zipPath);
  assert.equal((await extractZip(zipPath, tmp)).size, 1);
  const bomb = new JSZip();
  bomb.file("huge.pdf", "0".repeat(2000000));
  const bombPath = join(tmp, "bomb.zip");
  await writeFile(
    bombPath,
    await bomb.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }),
  );
  await assert.rejects(extractZip(bombPath, tmp), /expansion/);
  const unsafe = new JSZip();
  unsafe.file("aa/x.pdf", pdf);
  const zipBytes = await unsafe.generateAsync({ type: "nodebuffer" });
  const pathString = Buffer.from("aa/x.pdf");
  for (
    let at = zipBytes.indexOf(pathString);
    at >= 0;
    at = zipBytes.indexOf(pathString, at + 1)
  )
    zipBytes.write("../x.pdf", at);
  const unsafePath = join(tmp, "unsafe.zip");
  await writeFile(unsafePath, zipBytes);
  await assert.rejects(extractZip(unsafePath, tmp));
  // 10,005 metadata rows verify page/batch boundaries and idempotent resume.
  const large = await newJob("import", "csv", {
    mapping: { ID: "external_id", Name: "participant_name" },
  });
  await addInput(
    large,
    "large.csv",
    "ID,Name\n" +
      Array.from({ length: 10005 }, (_, i) => `L${i},Participant ${i}`).join(
        "\n",
      ),
  );
  await processNextTransfer(db);
  assert.equal((await jobById(large)).summary.valid, 10005);
  await confirm(large);
  assert.equal((await jobById(large)).summary.imported, 10005);
  await pg.query("update data_jobs set status='ready',attempts=0 where id=$1", [
    large,
  ]);
  await processNextTransfer(db);
  assert.equal((await jobById(large)).summary.imported, 10005);
  const leased = await newJob("export", "csv");
  const claimed = await db.rpc("claim_data_job");
  assert.ifError(claimed.error);
  assert.equal(claimed.data[0].id, leased);
  assert.equal((await db.rpc("claim_data_job")).data.length, 0);
  await assert.rejects(
    pg.query("select stage_data_import($1,$2,$3,false)", [
      leased,
      randomUUID(),
      [],
    ]),
    /Invalid preview lease/,
  );
  await pg.query(
    "update data_jobs set status='failed',lease_token=null,leased_until=null where id=$1",
    [leased],
  );
  // Expired transfer files disappear; immutable original archive files survive.
  await pg.query(
    "update data_jobs set expires_at=now()-interval '1 day' where id=$1",
    [job],
  );
  await cleanupTransfers(db);
  assert(objects.has("signed-pdfs/" + imported.pdf_path));
  assert(![...objects.keys()].some((k) => k.includes(`/transfers/${job}/`)));
  console.log(
    "PASS: CSV safety/custom fields; preview/confirmation; provenance/duplicates; original PDFs/images; 500-record CSV and 500-PDF ZIP; empty exports; full backup restore into another org; template drafts; ZIP security; owner/tenant RLS; 10,005-row import and idempotent resume; exclusive leases; cleanup.",
  );
} finally {
  await fixture.close();
  const path = resolve(tmp),
    root = resolve(tmpdir()) + sep;
  if (
    path.startsWith(root) &&
    path.slice(root.length).startsWith("flatwaiver-data-test-")
  )
    await rm(path, { recursive: true, force: true });
}
