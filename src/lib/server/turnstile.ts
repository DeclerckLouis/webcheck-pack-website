/**
 * Cloudflare Turnstile verification (brief §5). Disabled unless TURNSTILE_SECRET
 * is set — this is the "leave the hook in, don't over-build" path. When no secret
 * is configured we return `true` so the tool works without Turnstile.
 */
export async function verifyTurnstile(
  secret: string | undefined,
  token: string | undefined,
  ip?: string,
): Promise<boolean> {
  if (!secret) return true; // Turnstile not configured → skip.
  if (!token) return false;

  try {
    const body = new FormData();
    body.append("secret", secret);
    body.append("response", token);
    if (ip) body.append("remoteip", ip);
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body },
    );
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
