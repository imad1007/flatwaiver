"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  createApiKey,
  revokeApiKey,
  addWebhook,
  deleteWebhook,
  toggleWebhook,
} from "@/app/(app)/settings/developers/actions";

const inputClass =
  "rounded-md border border-input bg-card px-3 py-2 text-sm focus:border-ring focus:outline-none";

interface KeyRow {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}
interface WebhookRow {
  id: string;
  url: string;
  enabled: boolean;
  createdAt: string;
}
interface DeliveryRow {
  id: string;
  event: string;
  statusCode: number | null;
  ok: boolean;
  error: string | null;
  createdAt: string;
}

export function DevelopersManager({
  apiBaseUrl,
  keys,
  webhooks,
  deliveries,
}: {
  apiBaseUrl: string;
  keys: KeyRow[];
  webhooks: WebhookRow[];
  deliveries: DeliveryRow[];
}) {
  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-lg font-bold">Developers</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect FlatWaiver to your booking system, CRM, or Zapier with API keys
          and webhooks.
        </p>
      </div>

      <ApiKeys apiBaseUrl={apiBaseUrl} keys={keys} />
      <Webhooks webhooks={webhooks} deliveries={deliveries} />
      <AutoTagging />
    </div>
  );
}

function Secret({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
      <p className="text-xs font-semibold text-foreground">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Copy it now — you won&apos;t be able to see it again.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded bg-muted px-2 py-1.5 font-mono text-xs">
          {value}
        </code>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            navigator.clipboard.writeText(value).then(
              () => toast.success("Copied"),
              () => toast.error("Couldn't copy")
            );
          }}
        >
          Copy
        </Button>
      </div>
    </div>
  );
}

function ApiKeys({ apiBaseUrl, keys }: { apiBaseUrl: string; keys: KeyRow[] }) {
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function create(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      try {
        const res = await createApiKey(name);
        setNewKey(res.key);
        setName("");
        toast.success("API key created");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't create the key.");
      }
    });
  }
  function revoke(id: string) {
    if (!confirm("Revoke this key? Integrations using it will stop working.")) return;
    start(async () => {
      try {
        await revokeApiKey(id);
        toast.success("Key revoked");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't revoke the key.");
      }
    });
  }

  return (
    <section className="rounded-xl border border-border p-5">
      <h3 className="font-semibold">API keys</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Authenticate read-only requests with{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">
          Authorization: Bearer &lt;key&gt;
        </code>
        . Base URL:{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">{apiBaseUrl}</code>
      </p>

      <form onSubmit={create} className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Key name (e.g. Zapier)"
          aria-label="API key name"
          className={`${inputClass} min-w-52 flex-1`}
        />
        <Button type="submit" disabled={pending || !name.trim()}>
          {pending ? "Creating…" : "Create key"}
        </Button>
      </form>
      {newKey && <Secret label="Your new API key" value={newKey} />}

      <ul className="mt-4 divide-y divide-border">
        {keys.length === 0 && (
          <li className="py-2 text-sm text-muted-foreground">No keys yet.</li>
        )}
        {keys.map((k) => (
          <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium">{k.name}</p>
              <p className="font-mono text-xs text-muted-foreground">
                {k.prefix}… ·{" "}
                {k.lastUsedAt
                  ? `last used ${new Date(k.lastUsedAt).toLocaleDateString()}`
                  : "never used"}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => revoke(k.id)}>
              Revoke
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Webhooks({
  webhooks,
  deliveries,
}: {
  webhooks: WebhookRow[];
  deliveries: DeliveryRow[];
}) {
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function add(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      try {
        const res = await addWebhook(url);
        setSecret(res.secret);
        setUrl("");
        toast.success("Webhook added");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't add the webhook.");
      }
    });
  }
  function remove(id: string) {
    if (!confirm("Delete this webhook endpoint?")) return;
    start(async () => {
      try {
        await deleteWebhook(id);
        toast.success("Webhook deleted");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't delete the webhook.");
      }
    });
  }
  function toggle(id: string, enabled: boolean) {
    start(async () => {
      try {
        await toggleWebhook(id, enabled);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't update the webhook.");
      }
    });
  }

  return (
    <section className="rounded-xl border border-border p-5">
      <h3 className="font-semibold">Webhooks</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        We POST a JSON <code className="rounded bg-muted px-1 py-0.5 text-xs">signature.created</code>{" "}
        event to your URL on every new signature, signed with{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">X-FlatWaiver-Signature</code>{" "}
        (HMAC-SHA256).
      </p>

      <form onSubmit={add} className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://hooks.example.com/flatwaiver"
          aria-label="Webhook URL"
          className={`${inputClass} min-w-64 flex-1`}
        />
        <Button type="submit" disabled={pending || !url.trim()}>
          {pending ? "Adding…" : "Add webhook"}
        </Button>
      </form>
      {secret && <Secret label="Signing secret for this endpoint" value={secret} />}

      <ul className="mt-4 divide-y divide-border">
        {webhooks.length === 0 && (
          <li className="py-2 text-sm text-muted-foreground">No webhooks yet.</li>
        )}
        {webhooks.map((w) => (
          <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <div className="min-w-0">
              <p className="truncate font-mono text-xs">{w.url}</p>
              <Badge variant={w.enabled ? "default" : "secondary"}>
                {w.enabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => toggle(w.id, !w.enabled)}>
                {w.enabled ? "Disable" : "Enable"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => remove(w.id)}>
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {deliveries.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-semibold text-muted-foreground">Recent deliveries</p>
          <ul className="mt-2 space-y-1">
            {deliveries.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="font-mono">{d.event}</span>
                <span className={d.ok ? "text-success" : "text-destructive"}>
                  {d.ok ? `✓ ${d.statusCode ?? ""}` : `✗ ${d.statusCode ?? d.error ?? "failed"}`}
                </span>
                <time className="text-muted-foreground">
                  {new Date(d.createdAt).toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function AutoTagging() {
  return (
    <section className="rounded-xl border border-border p-5">
      <h3 className="font-semibold">Auto-tagging</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Append <code className="rounded bg-muted px-1 py-0.5 text-xs">?tag=YOUR_ID</code>{" "}
        to any signing link to stamp each signature with your own reference (a
        reservation or customer id). The tag appears on the signature, in webhook
        payloads, and in the API — so you can match a waiver back to the booking
        that produced it.
      </p>
      <code className="mt-3 block overflow-x-auto rounded bg-muted px-2 py-1.5 font-mono text-xs">
        /w/your-waiver?tag=RES-1234
      </code>
    </section>
  );
}
