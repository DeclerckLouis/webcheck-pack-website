/**
 * KV-backed result cache + per-IP rate limiter (brief §5). Cloudflare's own rate
 * limiting rules are the first line; this KV counter is the portable fallback the
 * brief calls for. Both degrade gracefully if the KV binding is missing (local
 * `astro dev` without platformProxy, or a misconfigured deploy) so the tool still
 * works — just without caching / limiting.
 */
import { CACHE_TTL_SECONDS, RATE_LIMIT, type Mode } from "../../config/scoring";
import type { FullResult } from "../types";

// Bump when the check logic changes in a way that should invalidate cached
// results. The version is part of the cache key, so old entries are simply
// never read again (they expire on their own TTL) instead of masking a fix for
// up to CACHE_TTL_SECONDS. v2: blacklist now checks mail-server IPs, not the
// domain's (CDN-fronted) A record.
const CACHE_VERSION = "v2";

const resultKey = (mode: Mode, domain: string) =>
  `result:${CACHE_VERSION}:${mode}:${domain}`;
const checkKey = (checkId: string) => `check:${CACHE_VERSION}:${checkId}`;

/** Look up a previously computed result for this domain+mode. */
export async function getCachedResult(
  kv: KVNamespace | undefined,
  mode: Mode,
  domain: string,
): Promise<FullResult | null> {
  if (!kv) return null;
  const raw = await kv.get(resultKey(mode, domain));
  return raw ? (JSON.parse(raw) as FullResult) : null;
}

/** Store a result both by domain+mode (cache) and by checkId (unlock lookup). */
export async function putResult(
  kv: KVNamespace | undefined,
  result: FullResult,
): Promise<void> {
  if (!kv) return;
  const payload = JSON.stringify(result);
  const opts = { expirationTtl: CACHE_TTL_SECONDS };
  await Promise.all([
    kv.put(resultKey(result.mode, result.domain), payload, opts),
    kv.put(checkKey(result.checkId), payload, opts),
  ]);
}

/** Fetch a stored full result by its checkId (used by the email unlock). */
export async function getResultByCheckId(
  kv: KVNamespace | undefined,
  checkId: string,
): Promise<FullResult | null> {
  if (!kv) return null;
  const raw = await kv.get(checkKey(checkId));
  return raw ? (JSON.parse(raw) as FullResult) : null;
}

/**
 * Increment and test the per-IP counter. Returns whether the request is allowed.
 * KV has no atomic increment; a read-modify-write is fine for abuse prevention.
 */
export async function checkRateLimit(
  kv: KVNamespace | undefined,
  ip: string,
): Promise<{ allowed: boolean; remaining: number }> {
  if (!kv || !ip) return { allowed: true, remaining: RATE_LIMIT.maxRequests };
  const key = `rl:${ip}`;
  const current = Number((await kv.get(key)) ?? "0");
  if (current >= RATE_LIMIT.maxRequests) {
    return { allowed: false, remaining: 0 };
  }
  await kv.put(key, String(current + 1), {
    expirationTtl: RATE_LIMIT.windowSeconds,
  });
  return { allowed: true, remaining: RATE_LIMIT.maxRequests - current - 1 };
}
