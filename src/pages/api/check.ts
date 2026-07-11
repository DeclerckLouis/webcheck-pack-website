import type { APIRoute } from "astro";
import { normalizeDomain } from "../../lib/normalize";
import { runCheck, toPublicSummary } from "../../lib/check";
import type { Mode } from "../../config/scoring";
import {
  getCachedResult,
  putResult,
  checkRateLimit,
} from "../../lib/server/kv";
import { verifyTurnstile } from "../../lib/server/turnstile";

// Runs as a Cloudflare Pages Function (edge), not prerendered.
export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  const env = locals.runtime?.env;

  let payload: { domain?: string; mode?: string; turnstileToken?: string };
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Ongeldige aanvraag." }, 400);
  }

  const domain = normalizeDomain(payload.domain ?? "");
  if (!domain) {
    return json({ error: "Voer een geldig domein in (bv. voorbeeld.be)." }, 400);
  }
  // v1 only runs "general"; the mode field is accepted (and ignored) now so the
  // UI/API don't need a rewrite when the security profile lands (brief §6b).
  const mode: Mode = "general";
  void payload.mode;

  const ip = request.headers.get("cf-connecting-ip") ?? clientAddress ?? "";

  // Optional bot check (no-op unless TURNSTILE_SECRET is configured). On failure
  // we surface the Turnstile error-codes so a misconfiguration is diagnosable
  // from the response rather than an opaque 403.
  const verdict = await verifyTurnstile(env?.TURNSTILE_SECRET, payload.turnstileToken, ip);
  if (!verdict.ok) {
    return json(
      { error: "Verificatie mislukt. Probeer het opnieuw.", turnstile: verdict.errorCodes },
      403,
    );
  }

  const rate = await checkRateLimit(env?.RATE, ip);
  if (!rate.allowed) {
    return json(
      { error: "Te veel aanvragen. Probeer het over een uurtje opnieuw." },
      429,
    );
  }

  // Serve from cache when we have a fresh result (brief §5).
  const cached = await getCachedResult(env?.CACHE, mode, domain);
  if (cached) {
    return json(toPublicSummary({ ...cached, cached: true }));
  }

  try {
    // Spamhaus DQS key (optional): when set, RBL lookups work through DoH;
    // when absent, the blacklist category degrades to "niet gecontroleerd".
    const result = await runCheck(domain, mode, { dqsKey: env?.SPAMHAUS_DQS_KEY });
    // Cache full result + index by checkId so the unlock needs no re-run (§7).
    await putResult(env?.CACHE, result);
    return json(toPublicSummary(result));
  } catch {
    return json(
      { error: "De controle kon niet worden voltooid. Probeer het later opnieuw." },
      502,
    );
  }
};

// Reject non-POST cleanly.
export const GET: APIRoute = () => json({ error: "Gebruik POST." }, 405);
