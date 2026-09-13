// Local integration adapter: production always uses Supabase. This adapter runs
// the same worker against PostgreSQL and a loopback-only private object store.
import { PGlite } from "@electric-sql/pglite";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

export async function testDatabase() {
  const pg = new PGlite();
  await pg.exec(`create role anon;create role authenticated;create role service_role;
    create schema auth;create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    create table organizations(id uuid primary key,name text);
    create table profiles(id uuid primary key,org_id uuid references organizations(id),role text,email text);
    create table subscriptions(org_id uuid,status text,trial_ends_at timestamptz);
    create table waiver_templates(id uuid primary key default gen_random_uuid(),org_id uuid references organizations(id),name text,
      slug text,status text,draft_content jsonb,current_version_id uuid,expiry_months integer,photo_mode text);
    create table template_versions(id uuid primary key,template_id uuid,version_number integer,body jsonb,fields jsonb,consent_text text,minor_mode text);
    create table signed_waivers(id uuid primary key,org_id uuid,template_id uuid,template_version_id uuid,signer_name text,signer_email text,
      signer_dob date,field_values jsonb,pdf_path text,pdf_sha256 text,signature_path text,signed_at timestamptz,created_at timestamptz,flagged boolean);
    create function public.forbid_change() returns trigger language plpgsql as $$begin raise exception 'immutable';end$$;
    grant usage on schema public,auth to authenticated;
    grant select on profiles to authenticated;
  `);
  await pg.exec(
    await readFile("supabase/migrations/0018_data_transfers.sql", "utf8"),
  );
  const objects = new Map();
  const server = createServer((req, res) => {
    const key = decodeURIComponent(req.url.slice(1));
    const value = objects.get(key);
    if (!value) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.end(value);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const ident = (v) => {
    if (!/^[a-z_][a-z_0-9]*$/i.test(v))
      throw new Error("Invalid test identifier");
    return `"${v}"`;
  };
  class Query {
    constructor(table) {
      this.table = table;
      this.mode = "select";
      this.conditions = [];
      this.args = [];
      this.orders = [];
      this.columns = "*";
    }
    arg(v) {
      this.args.push(v);
      return "$" + this.args.length;
    }
    select(columns = "*", opts = {}) {
      this.columns = columns;
      this.count = opts.count;
      this.head = opts.head;
      return this;
    }
    eq(k, v) {
      this.conditions.push(`${ident(k)} = ${this.arg(v)}`);
      return this;
    }
    neq(k, v) {
      this.conditions.push(`${ident(k)} <> ${this.arg(v)}`);
      return this;
    }
    is(k, v) {
      this.conditions.push(
        `${ident(k)} is ${v === null ? "null" : v ? "true" : "false"}`,
      );
      return this;
    }
    in(k, values) {
      this.conditions.push(
        values.length
          ? `${ident(k)} in (${values.map((v) => this.arg(v)).join(",")})`
          : "false",
      );
      return this;
    }
    gt(k, v) {
      this.conditions.push(`${ident(k)} > ${this.arg(v)}`);
      return this;
    }
    gte(k, v) {
      this.conditions.push(`${ident(k)} >= ${this.arg(v)}`);
      return this;
    }
    lt(k, v) {
      this.conditions.push(`${ident(k)} < ${this.arg(v)}`);
      return this;
    }
    lte(k, v) {
      this.conditions.push(`${ident(k)} <= ${this.arg(v)}`);
      return this;
    }
    ilike(k, v) {
      this.conditions.push(`${ident(k)} ilike ${this.arg(v)}`);
      return this;
    }
    order(k, options = {}) {
      this.orders.push(
        `${ident(k)} ${options.ascending === false ? "desc" : "asc"}`,
      );
      return this;
    }
    limit(n) {
      this.take = n;
      return this;
    }
    range(a, b) {
      this.offset = a;
      this.take = b - a + 1;
      return this;
    }
    insert(rows) {
      this.mode = "insert";
      this.rows = Array.isArray(rows) ? rows : [rows];
      return this;
    }
    update(values) {
      this.mode = "update";
      this.values = values;
      return this;
    }
    delete() {
      this.mode = "delete";
      return this;
    }
    maybeSingle() {
      this.singleRow = true;
      return this;
    }
    single() {
      this.singleRow = true;
      return this;
    }
    async then(resolve, reject) {
      try {
        let sql;
        const where = this.conditions.length
          ? " where " + this.conditions.join(" and ")
          : "";
        let count;
        if (this.mode === "select") {
          if (this.count)
            count = Number(
              (
                await pg.query(
                  `select count(*) n from ${ident(this.table)}${where}`,
                  this.args,
                )
              ).rows[0].n,
            );
          sql = `select * from ${ident(this.table)}${where}${this.orders.length ? " order by " + this.orders.join(",") : ""}${this.take != null ? " limit " + this.take : ""}${this.offset ? " offset " + this.offset : ""}`;
        } else if (this.mode === "delete")
          sql = `delete from ${ident(this.table)}${where} returning *`;
        else if (this.mode === "update")
          sql = `update ${ident(this.table)} set ${Object.entries(this.values)
            .map(([k, v]) => `${ident(k)} = ${this.arg(v)}`)
            .join(",")}${where} returning *`;
        else {
          const keys = [...new Set(this.rows.flatMap((r) => Object.keys(r)))];
          sql = `insert into ${ident(this.table)} (${keys.map(ident).join(",")}) values ${this.rows.map((r) => "(" + keys.map((k) => this.arg(r[k] ?? null)).join(",") + ")").join(",")} returning *`;
        }
        const result = await pg.query(sql, this.args);
        const rows = JSON.parse(JSON.stringify(result.rows));
        resolve({
          data: this.singleRow ? (rows[0] ?? null) : rows,
          count,
          error: null,
        });
      } catch (error) {
        if (resolve) resolve({ data: null, error });
        else reject(error);
      }
    }
  }
  const db = {
    from: (table) => new Query(table),
    rpc: async (name, args = {}) => {
      try {
        const values = Object.values(args);
        const result = await pg.query(
          `select * from ${ident(name)}(${Object.keys(args)
            .map((k, i) => `${ident(k)} => $${i + 1}`)
            .join(",")})`,
          values,
        );
        const rows = JSON.parse(JSON.stringify(result.rows));
        return {
          data: ["data_import_summary", "begin_data_cleanup"].includes(name)
            ? rows[0][name]
            : rows,
          error: null,
        };
      } catch (error) {
        return { data: null, error };
      }
    },
    storage: {
      from: (bucket) => ({
        createSignedUrl: async (path) => ({
          data: { signedUrl: base + encodeURIComponent(bucket + "/" + path) },
          error: null,
        }),
        upload: async (path, stream) => {
          const key = bucket + "/" + path;
          if (objects.has(key)) {
            stream.destroy?.();
            return { error: new Error("Already exists") };
          }
          const chunks = [];
          for await (const c of stream) chunks.push(Buffer.from(c));
          objects.set(key, Buffer.concat(chunks));
          return { data: { path }, error: null };
        },
        remove: async (paths) => {
          for (const p of paths) objects.delete(bucket + "/" + p);
          return { data: [], error: null };
        },
        list: async (path) => {
          const prefix = bucket + "/" + path + "/";
          const rows = new Map();
          for (const k of objects.keys())
            if (k.startsWith(prefix)) {
              const part = k.slice(prefix.length).split("/");
              rows.set(part[0], {
                name: part[0],
                id: part.length === 1 ? "file" : null,
              });
            }
          return { data: [...rows.values()].slice(0, 100), error: null };
        },
      }),
    },
  };
  return {
    db,
    pg,
    objects,
    close: async () => {
      await new Promise((r) => server.close(r));
      await pg.close();
    },
  };
}
