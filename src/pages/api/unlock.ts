import type { APIRoute } from "astro";
import { getResultByCheckId, checkRateLimit } from "../../lib/server/kv";
import { forwardLead } from "../../lib/server/odoo";
import { verifyTurnstile } from "../../lib/server/turnstile";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

// Reuse the same email validation posture as a simple, robust check. The main
// site relies on Odoo-side validation too; this is the front-line guard.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Cap each field before it's forwarded to Odoo. Without this a bot could push
// multi-MB strings straight into a crm.lead. Generous but bounded.
const MAX_FIELD_LEN = 200;
const capped = (v: string | undefined) => (v ?? "").trim().slice(0, MAX_FIELD_LEN);

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  const env = locals.runtime?.env;

  let payload: {
    checkId?: string;
    naam?: string;
    email?: string;
    telefoon?: string;
    bedrijf?: string;
    turnstileToken?: string;
  };
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Ongeldige aanvraag." }, 400);
  }

  const naam = capped(payload.naam);
  const email = capped(payload.email);
  if (!naam) return json({ error: "Vul uw naam in." }, 400);
  if (!EMAIL_RE.test(email)) return json({ error: "Vul een geldig e-mailadres in." }, 400);
  if (!payload.checkId) return json({ error: "Ontbrekende controle-referentie." }, 400);

  const ip = request.headers.get("cf-connecting-ip") ?? clientAddress ?? "";

  // Same abuse guards as /api/check: this endpoint creates a CRM lead on every
  // success, so it must not be left open. Optional bot check (no-op unless
  // TURNSTILE_SECRET is configured), then the per-IP KV rate limit.
  const human = await verifyTurnstile(env?.TURNSTILE_SECRET, payload.turnstileToken, ip);
  if (!human) {
    return json({ error: "Verificatie mislukt. Probeer het opnieuw." }, 403);
  }

  const rate = await checkRateLimit(env?.RATE, ip);
  if (!rate.allowed) {
    return json(
      { error: "Te veel aanvragen. Probeer het over een uurtje opnieuw." },
      429,
    );
  }

  // No re-run: the full result was cached server-side at check time (brief §7).
  const full = await getResultByCheckId(env?.CACHE, payload.checkId);
  if (!full) {
    return json(
      { error: "Deze controle is verlopen. Voer het domein opnieuw in." },
      410,
    );
  }

  // Best-effort lead forward to Odoo. We DON'T block the report on a CRM hiccup —
  // the visitor already earned the report; a failed lead is logged, not fatal.
  const lead = await forwardLead(env?.PUBLIC_ODOO_URL, {
    naam,
    email,
    telefoon: capped(payload.telefoon) || undefined,
    bedrijf: capped(payload.bedrijf) || undefined,
    domain: full.domain,
    score: full.total,
    max: full.max,
    generatedAt: full.generatedAt,
  });
  if (!lead.ok) {
    console.error("Odoo lead forward failed:", lead.error);
  }

  // leadStored + leadError are returned so a CRM hiccup is diagnosable from the
  // browser Network tab (the report is delivered regardless — brief §7).
  return json({
    report: full,
    leadStored: lead.ok,
    leadId: lead.ok ? lead.id : undefined,
    leadError: lead.ok ? undefined : lead.error,
  });
};

export const GET: APIRoute = () => json({ error: "Gebruik POST." }, 405);
