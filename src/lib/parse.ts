/**
 * Pure parsing helpers ported from the reference script (Annex A). Kept separate
 * and dependency-free so they're unit-tested directly (see tests/).
 */

/**
 * Rough SPF DNS-lookup count — port of `count_spf_lookups`. RFC 7208 permerrors
 * above 10. Counts the lookup-causing mechanisms in the domain's OWN record only;
 * it does NOT recursively resolve nested includes, so the real number can be
 * higher (same caveat as the reference script).
 */
export function countSpfLookups(spf: string): number {
  const count = (re: RegExp) => (spf.match(re) ?? []).length;
  let n = 0;
  n += count(/include:/g);
  n += count(/redirect=/g);
  n += count(/exists:/g);
  n += count(/(^|\s)a([\s:]|$)/g);
  n += count(/(^|\s)mx([\s:]|$)/g);
  n += count(/(^|\s)ptr([\s:]|$)/g);
  return n;
}

export type DmarcPolicy = "reject" | "quarantine" | "none";

export interface DmarcParsed {
  present: boolean;
  policy: DmarcPolicy | null;
  pct: number | null;
  record: string | null;
}

/** Parse a DMARC record — port of `check_dmarc`'s policy/pct extraction. */
export function parseDmarc(records: string[]): DmarcParsed {
  const record = records.find((r) => /^v=DMARC1/i.test(r.trim())) ?? null;
  if (!record) return { present: false, policy: null, pct: null, record: null };

  const policyMatch = record.match(/\bp=([a-zA-Z]+)/);
  const raw = policyMatch?.[1]?.toLowerCase();
  const policy: DmarcPolicy | null =
    raw === "reject" || raw === "quarantine" || raw === "none" ? raw : null;

  const pctMatch = record.match(/\bpct=(\d+)/);
  const pct = pctMatch ? Number(pctMatch[1]) : null;

  return { present: true, policy, pct, record };
}

/**
 * Classify the mail provider from MX hostnames — port of `classify_mx`.
 * Returns a friendly provider name, or the first MX host as a fallback.
 */
export function classifyMx(mxHosts: string[]): string | null {
  if (mxHosts.length === 0) return null;
  const blob = mxHosts.join(" ").toLowerCase();
  if (/outlook|protection\.outlook/.test(blob)) return "Microsoft 365";
  if (/google|gmail|aspmx/.test(blob)) return "Google Workspace";
  if (/mailprotect/.test(blob)) return "Mailprotect";
  if (/one\.com/.test(blob)) return "one.com";
  // Fallback: first host, host portion only.
  return mxHosts[0].replace(/\.$/, "");
}

/** Reverse an IPv4 address for RBL queries: 1.2.3.4 -> 4.3.2.1 (brief §4). */
export function reverseIpv4(ip: string): string | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  if (!parts.every((p) => /^\d+$/.test(p) && Number(p) >= 0 && Number(p) <= 255))
    return null;
  return parts.reverse().join(".");
}

export type RblVerdict = "listed" | "refused" | "clean";

/**
 * Classify an RBL's A-record answer set. RBLs encode their result in 127.0.0.0/8:
 * a real listing is a code like 127.0.0.x / 127.0.1.x, while the 127.255.255.x
 * range is a *status/error* code — most importantly 127.255.255.254, which
 * Spamhaus returns when the query arrived via a large public resolver (e.g.
 * Cloudflare's DoH). Treating that sentinel as a listing marks every domain as
 * blacklisted, so it must be read as "refused / couldn't check", not "listed".
 */
export function classifyRblAnswer(ips: string[]): RblVerdict {
  const isError = (ip: string) => ip.startsWith("127.255.255.");
  if (ips.some((ip) => ip.startsWith("127.") && !isError(ip))) return "listed";
  if (ips.some(isError)) return "refused";
  return "clean";
}

export type RblResponse = "listed" | "clean" | "blocked";

/**
 * Classify a full RBL DoH response — the three response classes the tool must
 * tell apart (brief §1):
 *   - NXDOMAIN (status 3) → not listed → "clean" (the healthy case)
 *   - NOERROR (status 0) with a real 127.0.0.x listing code → "listed"
 *   - NOERROR with a 127.255.255.x status code (Spamhaus via public resolver) →
 *     "blocked" (couldn't check)
 *   - anything else (SERVFAIL 2, network/timeout status < 0) → "blocked"
 *
 * `status` is the DNS RCODE; `ips` are the A-record answers. Kept pure so the
 * three classes are unit-tested directly.
 */
export function classifyRblResponse(status: number, ips: string[]): RblResponse {
  if (status === 3) return "clean"; // NXDOMAIN — not listed
  if (status === 0) {
    const verdict = classifyRblAnswer(ips);
    if (verdict === "listed") return "listed";
    if (verdict === "refused") return "blocked";
    return "clean"; // NOERROR/NODATA — treat as not listed
  }
  return "blocked"; // SERVFAIL / network error / timeout — couldn't check
}
