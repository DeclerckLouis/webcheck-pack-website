import type { APIRoute } from "astro";
import { checkRateLimit } from "../../lib/server/kv";
import { forwardCyfunLead } from "../../lib/server/odoo";
import { verifyTurnstile } from "../../lib/server/turnstile";
import { findPartner } from "../../data/partners";
import { normalizeDomain } from "../../lib/normalize";

// Runs as a Cloudflare Pages Function (edge), not prerendered.
export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

// Same front-line e-mail guard as /api/unlock. Odoo validates again server-side.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Cap each free-text field before it reaches Odoo, so a bot can't push multi-MB
// strings into a crm.lead. Generous but bounded.
const MAX_FIELD_LEN = 200;
const capped = (v: string | undefined) => (v ?? "").trim().slice(0, MAX_FIELD_LEN);

/**
 * Lead capture for the CyFun Basic zelfevaluatie (brief integration point B).
 * Reuses the same Odoo `crm.lead` pipeline as the domain scan; the payload is
 * the assessment result rather than a cached checkId, so this is a thin sibling
 * of /api/unlock — no report to return, just the lead + a confirmation.
 */
export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  const env = locals.runtime?.env;

  let payload: {
    domain?: string;
    email?: string;
    score?: number;
    keyMet?: number;
    keyTotal?: number;
    scopeLevel?: string;
    scopeFit?: boolean;
    gaps?: unknown;
    consent?: boolean;
    consentAt?: string;
    turnstileToken?: string;
    via?: string;
  };
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Ongeldige aanvraag." }, 400);
  }

  const email = capped(payload.email);
  if (!EMAIL_RE.test(email)) return json({ error: "Vul een geldig e-mailadres in." }, 400);

  const domain = normalizeDomain(payload.domain ?? "");
  if (!domain) return json({ error: "Ontbrekend of ongeldig domein." }, 400);

  // Scope gate (brief §2 non-negotiable): an Important/Essential outcome must
  // never reach the engagement gate, so the server refuses to create a lead for
  // it even if the client is scripted past the UI card.
  if (payload.scopeFit === false) {
    return json(
      { error: "Voor uw toepassingsgebied is een hoger niveau dan Basic vereist; dit rapport is niet van toepassing." },
      403,
    );
  }

  // GDPR: never create a lead without explicit consent. Enforced server-side so
  // it can't be bypassed by scripting past the client checkbox (brief §3).
  if (payload.consent !== true) {
    return json(
      { error: "U moet akkoord gaan met de verwerking van uw gegevens om het rapport te ontvangen." },
      400,
    );
  }
  const consentAt =
    typeof payload.consentAt === "string" && !Number.isNaN(Date.parse(payload.consentAt))
      ? payload.consentAt
      : new Date().toISOString();

  // Sanitise the numeric/array assessment context defensively (client-supplied).
  const clamp = (n: unknown, lo: number, hi: number) =>
    typeof n === "number" && Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : 0;
  const keyTotal = clamp(payload.keyTotal, 0, 100) || 13;
  const gaps = Array.isArray(payload.gaps)
    ? payload.gaps.filter((g): g is string => typeof g === "string").map((g) => capped(g)).slice(0, 40)
    : [];

  const ip = request.headers.get("cf-connecting-ip") ?? clientAddress ?? "";

  // Same abuse guards as /api/unlock: this endpoint creates a CRM lead on every
  // success. Optional bot check (no-op unless TURNSTILE_SECRET is set), then the
  // per-IP KV rate limit.
  const human = await verifyTurnstile(env?.TURNSTILE_SECRET, payload.turnstileToken, ip);
  if (!human.ok) {
    return json({ error: "Verificatie mislukt. Probeer het opnieuw.", turnstile: human.errorCodes }, 403);
  }

  const rate = await checkRateLimit(env?.RATE, ip);
  if (!rate.allowed) {
    return json({ error: "Te veel aanvragen. Probeer het over een uurtje opnieuw." }, 429);
  }

  // Partner attribution (brief part A): re-validate the client slug server-side.
  const partner = findPartner(payload.via);

  const lead = await forwardCyfunLead(env?.PUBLIC_ODOO_URL, {
    email,
    domain,
    score: clamp(payload.score, 0, 100),
    keyMet: clamp(payload.keyMet, 0, keyTotal),
    keyTotal,
    scopeLevel: capped(payload.scopeLevel) || "Basic",
    gaps,
    consent: true,
    consentAt,
    partnerSlug: partner?.slug,
  });
  if (!lead.ok) {
    console.error("Odoo CyFun lead forward failed:", lead.error);
  }

  // leadStored + leadError surface a CRM hiccup in the browser Network tab; the
  // confirmation is shown regardless (report generation is a separate ticket).
  return json({
    leadStored: lead.ok,
    leadId: lead.ok ? lead.id : undefined,
    leadError: lead.ok ? undefined : lead.error,
  });
};

export const GET: APIRoute = () => json({ error: "Gebruik POST." }, 405);
