/**
 * Lead forwarding — REUSES the main Packetflow site's Odoo integration (brief §2,
 * odoo/README.md): POST multipart/form-data to {PUBLIC_ODOO_URL}/website/form/crm.lead
 * to create a crm.lead. No separate lead pipeline, no KV/D1 lead table.
 *
 * Because this runs server-side (a Pages Function, not the browser), we can read
 * Odoo's response and report real success/failure — the browser's CORS read-block
 * that forces the main site into `no-cors` doesn't apply here.
 *
 * Field mapping mirrors odoo/README.md. The scan context (domain + score +
 * timestamp) is appended to `description` since crm.lead has no dedicated field
 * for it (brief §2 fallback: put it in a notes/description field).
 */
const DEFAULT_ODOO_URL = "https://louisdeclerck.odoo.com";

export interface LeadInput {
  naam: string;
  email: string;
  telefoon?: string;
  bedrijf?: string;
  domain: string;
  score: number;
  max: number;
  generatedAt: string;
  /** GDPR consent given at the gate (brief §3). Always true when a lead is created. */
  consent: boolean;
  /** ISO timestamp of when consent was given. */
  consentAt: string;
  /**
   * Referring partner slug from `?via=` (brief part A), already validated against
   * the registry. Attribution only — nothing about the visitor is shared with the
   * partner. Absent for direct visits, which keep the existing default source.
   */
  partnerSlug?: string;
}

export async function forwardLead(
  odooBaseUrl: string | undefined,
  lead: LeadInput,
): Promise<{ ok: boolean; id?: number; error?: string }> {
  const base = (odooBaseUrl || DEFAULT_ODOO_URL).replace(/\/$/, "");

  const context = [
    "— Domeinscan —",
    `Domein: ${lead.domain}`,
    `Score: ${lead.score}/${lead.max}`,
    `Uitgevoerd: ${lead.generatedAt}`,
    // GDPR: record that consent was given and when, so the lawful basis for
    // contacting this lead is auditable from the CRM record itself (brief §3).
    `Toestemming: ${lead.consent ? "ja" : "nee"} (${lead.consentAt})`,
    // Partner attribution (brief part A): duplicated in the description so it's
    // human-readable in the CRM even if `referred` isn't natively mapped.
    ...(lead.partnerSlug ? [`Partner: ${lead.partnerSlug}`] : []),
  ].join("\n");
  const description = `Aanvraag volledig rapport.\n\n${context}`;

  const form = new FormData();
  form.append("contact_name", lead.naam);
  form.append("email_from", lead.email);
  if (lead.telefoon) form.append("phone", lead.telefoon);
  if (lead.bedrijf) form.append("partner_name", lead.bedrijf);
  form.append("description", description);
  form.append("name", `Domeinscan-aanvraag — ${lead.naam} (${lead.domain})`);
  // Attribution field: crm.lead's native "Referred By" (`referred`, char). When
  // absent the lead keeps the existing default source (no referred set).
  if (lead.partnerSlug) form.append("referred", lead.partnerSlug);

  try {
    const res = await fetch(`${base}/website/form/crm.lead`, {
      method: "POST",
      body: form,
    });
    const body = await res.text();
    if (!res.ok) {
      return { ok: false, error: `Odoo HTTP ${res.status}: ${body.slice(0, 300)}` };
    }
    // website_form answers HTTP 200 even for validation failures (body
    // `{"id": false}` or `{"error": ...}`, or an HTML error page when crm.lead
    // isn't form-enabled). A genuine success carries a numeric record id — treat
    // anything else as a failure so `leadStored` never lies.
    let data: { id?: unknown; error?: unknown } = {};
    try {
      data = JSON.parse(body);
    } catch {
      return { ok: false, error: `Odoo gaf geen JSON terug: ${body.slice(0, 300)}` };
    }
    if (typeof data.id !== "number") {
      return { ok: false, error: `Odoo 200 zonder lead-id: ${body.slice(0, 300)}` };
    }
    return { ok: true, id: data.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "onbekend" };
  }
}
