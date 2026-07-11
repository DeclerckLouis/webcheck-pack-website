/**
 * Browser-side partner attribution (brief part A). Reads the `via` param, keeps
 * a valid partner for the whole session, and hands the slug to the unlock call
 * so the Odoo lead is attributable. Unknown/inactive slugs resolve to null and
 * change nothing about the page.
 */
import { findPartner, type Partner } from "../data/partners";

// sessionStorage so the slug survives the scan-and-gate flow (including a second
// domain) and a hop from the /cyberverzekering landing page, but not a new tab
// or a later visit without the param.
const STORAGE_KEY = "pf_partner";

/**
 * Resolve the active partner for this session. A valid `via` in the current URL
 * wins and is persisted; otherwise fall back to a slug stored earlier this
 * session. Returns null when there's nothing valid to attribute to.
 */
export function resolvePartner(): Partner | null {
  let fromUrl: Partner | null = null;
  try {
    fromUrl = findPartner(new URLSearchParams(window.location.search).get("via"));
  } catch {
    /* malformed query string — treat as no partner */
  }

  if (fromUrl) {
    try {
      sessionStorage.setItem(STORAGE_KEY, fromUrl.slug);
    } catch {
      /* storage unavailable (private mode) — attribution just won't persist */
    }
    return fromUrl;
  }

  try {
    return findPartner(sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}
