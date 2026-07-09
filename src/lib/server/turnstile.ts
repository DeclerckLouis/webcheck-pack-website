/**
 * Cloudflare Turnstile verification (brief §5). Disabled unless TURNSTILE_SECRET
 * is set — this is the "leave the hook in, don't over-build" path. When no secret
 * is configured we return `ok: true` so the tool works without Turnstile.
 *
 * On failure we pass back Cloudflare's `error-codes` so the caller can tell a
 * config problem (`invalid-input-secret` = wrong secret; hostname mismatch) from
 * a client problem (`missing-input-response` = no token reached us;
 * `timeout-or-duplicate` = token reused/expired) instead of a blind 403.
 */
export interface TurnstileResult {
  ok: boolean;
  errorCodes?: string[];
}

export async function verifyTurnstile(
  secret: string | undefined,
  token: string | undefined,
  ip?: string,
): Promise<TurnstileResult> {
  if (!secret) return { ok: true }; // Turnstile not configured → skip.
  if (!token) return { ok: false, errorCodes: ["missing-input-response"] };

  try {
    const body = new FormData();
    body.append("secret", secret);
    body.append("response", token);
    if (ip) body.append("remoteip", ip);
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body },
    );
    const data = (await res.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };
    return { ok: data.success === true, errorCodes: data["error-codes"] };
  } catch {
    return { ok: false, errorCodes: ["verify-request-failed"] };
  }
}
