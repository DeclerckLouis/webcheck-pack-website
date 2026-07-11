/**
 * Browser-side partner attribution (brief part A). Reads the `via` param from
 * the current URL and matches it against the registry. Attribution is driven
 * purely by the URL: the scan flow is a single page that keeps the param, and
 * the /cyberverzekering CTA carries it across to the scan. A missing param or an
 * unknown/inactive slug resolves to null and changes nothing about the page.
 */
import { findPartner, type Partner } from "../data/partners";

/** Resolve the partner named by the current URL's `via` param, or null. */
export function resolvePartner(): Partner | null {
  try {
    return findPartner(new URLSearchParams(window.location.search).get("via"));
  } catch {
    /* malformed query string — treat as no partner */
    return null;
  }
}
