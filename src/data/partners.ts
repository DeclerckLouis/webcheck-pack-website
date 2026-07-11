// Partner registry for referral attribution (brief part A). A broker links to
// scan.packetflow.be/?via=<slug>; a matching, active entry here attributes the
// resulting lead in Odoo and shows a subtle co-branding line on the scan page.
//
// Edited by hand — there is no dashboard or onboarding flow. Keep slugs
// lowercase and url-safe. Set `active: false` to retire a partner without
// deleting the record (so historical leads stay explainable).

export interface Partner {
  /** Lowercase, url-safe identifier used in the `?via=` param and the Odoo lead. */
  slug: string;
  /** Human-readable name shown in the "Op aanraden van …" line. */
  displayName: string;
  /** Inactive partners are ignored: no co-branding, no attribution. */
  active: boolean;
}

export const partners: Partner[] = [
  { slug: "test", displayName: "Testpartner", active: true },
  { slug: "seguro", displayName: "Seguro Verzekeringen", active: true },
];

/**
 * Look up an active partner by slug (case-insensitive). Returns null for
 * unknown, inactive, or empty input — the caller ignores it silently, so an
 * unrecognized `via` never surfaces an error or changes the page.
 *
 * Pure (no browser/runtime deps) so it's usable from both the client script and
 * the server-side unlock route.
 */
export function findPartner(slug: string | null | undefined): Partner | null {
  if (!slug) return null;
  const s = slug.trim().toLowerCase();
  return partners.find((p) => p.slug === s && p.active) ?? null;
}
