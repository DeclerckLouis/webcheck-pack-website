import type { APIRoute } from "astro";
import { getResultByCheckId } from "../../lib/server/kv";
import { forwardLead } from "../../lib/server/odoo";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

// Reuse the same email validation posture as a simple, robust check. The main
// site relies on Odoo-side validation too; this is the front-line guard.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env;

  let payload: {
    checkId?: string;
    naam?: string;
    email?: string;
    telefoon?: string;
    bedrijf?: string;
  };
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Ongeldige aanvraag." }, 400);
  }

  const naam = (payload.naam ?? "").trim();
  const email = (payload.email ?? "").trim();
  if (!naam) return json({ error: "Vul uw naam in." }, 400);
  if (!EMAIL_RE.test(email)) return json({ error: "Vul een geldig e-mailadres in." }, 400);
  if (!payload.checkId) return json({ error: "Ontbrekende controle-referentie." }, 400);

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
    telefoon: payload.telefoon?.trim() || undefined,
    bedrijf: payload.bedrijf?.trim() || undefined,
    domain: full.domain,
    score: full.total,
    max: full.max,
    generatedAt: full.generatedAt,
  });
  if (!lead.ok) {
    console.error("Odoo lead forward failed:", lead.error);
  }

  return json({ report: full, leadStored: lead.ok });
};

export const GET: APIRoute = () => json({ error: "Gebruik POST." }, 405);
