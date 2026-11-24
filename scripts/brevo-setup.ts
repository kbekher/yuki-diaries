/**
 * One-command Brevo setup: creates (or updates, matched by name) the blog's email templates and prints
 * the values to put into Vercel.
 *
 *   pnpm brevo:setup -- --sender you@example.com [--name "Yuki"] [--list YUKI_DIARIES_NEWSLETTER]
 *
 * Needs BREVO_API_KEY (from the shell or .env.local). Safe to run repeatedly.
 *
 * Templates (HTML in emails/):
 *  - "Подтверждение подписки — Yuki Diaries"  → double opt-in (tag "optin", contains {{ doubleoptin }})
 *  - "Новая запись — Yuki Diaries"            → reusable base for new-post campaigns
 * Templates created under the old «… — Блог Сары» names are renamed in place (same IDs, nothing to change in Vercel).
 */
import "./load-env";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const API = (process.env.BREVO_API_URL || "https://api.brevo.com/v3").replace(/\/+$/, "");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const apiKey = process.env.BREVO_API_KEY?.trim();
const senderEmail = arg("sender") ?? process.env.BREVO_SENDER_EMAIL;
const senderName = arg("name") ?? process.env.BREVO_SENDER_NAME ?? "Yuki";
const listName = arg("list") ?? "YUKI_DIARIES_NEWSLETTER";
/** Names the list had before the rename — still recognised so the ID is found either way. */
const LEGACY_LIST_NAMES = ["SARAS_BLOG_NEWSLETTER"];

type Template = { id: number; name: string; isActive: boolean; tag?: string };
type Sender = { id: number; name: string; email: string; active: boolean };
type List = { id: number; name: string; totalSubscribers?: number };

async function brevo<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "api-key": apiKey!, accept: "application/json", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    let message = text;
    try {
      message = (JSON.parse(text) as { message?: string }).message ?? text;
    } catch {}
    if (res.status === 401) throw new Error(`Brevo rejected the API key (401). Check BREVO_API_KEY (starts with xkeysib-). ${message}`);
    if (res.status === 403 && /ip/i.test(message)) {
      throw new Error(`Brevo blocked this IP (403). Disable "Authorized IPs" in Brevo → Security, or add your IP. ${message}`);
    }
    throw new Error(`Brevo ${method} ${path} → ${res.status}: ${message}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

async function allTemplates(): Promise<Template[]> {
  const out: Template[] = [];
  for (let offset = 0; ; offset += 50) {
    const page = await brevo<{ templates?: Template[]; count?: number }>("GET", `/smtp/templates?limit=50&offset=${offset}`);
    out.push(...(page.templates ?? []));
    if (!page.templates || page.templates.length < 50) return out;
  }
}

async function upsertTemplate(
  def: { name: string; legacyNames?: string[]; subject: string; file: string; tag?: string },
  existing: Template[],
) {
  const htmlContent = readFileSync(join(process.cwd(), "emails", def.file), "utf8");
  const payload = {
    templateName: def.name,
    subject: def.subject,
    htmlContent,
    sender: { name: senderName, email: senderEmail },
    isActive: true,
    ...(def.tag ? { tag: def.tag } : {}),
  };
  // Same template under its current or a previous name → update (and rename) it in place, keeping its ID.
  const found =
    existing.find((t) => t.name === def.name) ?? existing.find((t) => def.legacyNames?.includes(t.name));
  if (found) {
    await brevo("PUT", `/smtp/templates/${found.id}`, payload);
    return { id: found.id, action: found.name === def.name ? "updated" : `renamed from «${found.name}» and updated` };
  }
  const created = await brevo<{ id: number }>("POST", "/smtp/templates", payload);
  return { id: created.id, action: "created" };
}

async function main() {
  if (!apiKey) throw new Error("BREVO_API_KEY is not set. Run: BREVO_API_KEY=xkeysib-... pnpm brevo:setup -- --sender you@example.com");
  if (!senderEmail) throw new Error('Pass the verified sender email: pnpm brevo:setup -- --sender you@example.com [--name "Yuki"]');

  // 1. Sender must exist & be verified, otherwise Brevo won't send.
  const { senders = [] } = await brevo<{ senders?: Sender[] }>("GET", "/senders");
  const sender = senders.find((s) => s.email.toLowerCase() === senderEmail.toLowerCase());
  if (!sender) {
    throw new Error(
      `Sender ${senderEmail} is not in Brevo. Add & verify it: Brevo → Settings → Senders, Domains & Dedicated IPs → Senders.\n` +
        `Existing senders: ${senders.map((s) => `${s.email}${s.active ? "" : " (not verified)"}`).join(", ") || "none"}`,
    );
  }
  if (!sender.active) console.warn(`⚠ Sender ${senderEmail} is not verified yet — confirm the code Brevo emailed, or emails won't send.`);

  // 2. Templates.
  const existing = await allTemplates();
  const doi = await upsertTemplate(
    {
      name: "Подтверждение подписки — Yuki Diaries",
      legacyNames: ["Подтверждение подписки — Блог Сары"],
      subject: "Подтвердите подписку на Yuki Diaries",
      file: "double-opt-in.html",
      tag: "optin",
    },
    existing,
  );
  const post = await upsertTemplate(
    {
      name: "Новая запись — Yuki Diaries",
      legacyNames: ["Новая запись — Блог Сары"],
      subject: "Новая запись в Yuki Diaries",
      file: "new-post.html",
    },
    existing,
  );
  console.log(`✔ Double opt-in template ${doi.action}: #${doi.id}`);
  console.log(`✔ New-post template ${post.action}: #${post.id}`);

  // 3. Newsletter list id.
  const { lists = [] } = await brevo<{ lists?: List[] }>("GET", "/contacts/lists?limit=50&offset=0");
  const list =
    lists.find((l) => l.name === listName) ??
    lists.find((l) => LEGACY_LIST_NAMES.includes(l.name)) ??
    lists.find((l) => /yuki|sara/i.test(l.name));

  const old = existing.find((t) => /TEMPORARY_DOUBLE_OPT-IN/i.test(t.name));

  console.log("\n── Put these into Vercel → Settings → Environment Variables, then Redeploy ──");
  console.log(`BREVO_DOI_TEMPLATE_ID=${doi.id}`);
  if (list) console.log(`BREVO_LIST_ID=${list.id}        # list "${list.name}"`);
  else console.log(`BREVO_LIST_ID=?   # no list named "${listName}". Lists: ${lists.map((l) => `${l.name} (#${l.id})`).join(", ") || "none"}`);
  if (old) console.log(`\nYou can delete the old template "${old.name}" (#${old.id}) in Brevo once this works.`);
}

main().catch((error: unknown) => {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
