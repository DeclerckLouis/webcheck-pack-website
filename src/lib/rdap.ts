/**
 * RDAP lookup (brief §4) — the IETF replacement for WHOIS. rdap.org redirects to
 * the correct per-TLD RDAP server; it's HTTP/JSON over fetch(), so it avoids the
 * per-registry WHOIS format quirks the reference script had to special-case
 * (e.g. .be's nested Registrar/Name block).
 *
 * Expiry isn't present for every TLD — we return `null` and the caller shows
 * "onbekend" rather than a wrong date (brief open Q4).
 */

export interface RdapInfo {
  registrar: string | null;
  /** ISO date string, or null when the registry doesn't expose it. */
  expiry: string | null;
  created: string | null;
  nameservers: string[];
  /** True when RDAP itself was unreachable / errored (distinct from "no data"). */
  unavailable: boolean;
}

interface RdapEvent {
  eventAction?: string;
  eventDate?: string;
}
interface RdapEntity {
  roles?: string[];
  vcardArray?: unknown;
}
interface RdapNameserver {
  ldhName?: string;
}
interface RdapResponse {
  events?: RdapEvent[];
  entities?: RdapEntity[];
  nameservers?: RdapNameserver[];
}

function extractRegistrarName(entity: RdapEntity): string | null {
  // vcardArray is ["vcard", [ ["fn", {}, "text", "Registrar Name"], ... ]]
  const arr = entity.vcardArray;
  if (!Array.isArray(arr) || arr.length < 2 || !Array.isArray(arr[1])) return null;
  for (const field of arr[1] as unknown[]) {
    if (Array.isArray(field) && field[0] === "fn" && typeof field[3] === "string") {
      return field[3];
    }
  }
  return null;
}

export async function rdapLookup(
  domain: string,
  opts: { signal?: AbortSignal } = {},
): Promise<RdapInfo> {
  const empty: RdapInfo = {
    registrar: null,
    expiry: null,
    created: null,
    nameservers: [],
    unavailable: true,
  };
  try {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      headers: { accept: "application/rdap+json, application/json" },
      redirect: "follow",
      signal: opts.signal,
    });
    if (!res.ok) return empty;
    const data = (await res.json()) as RdapResponse;

    const eventOf = (action: string) =>
      data.events?.find((e) => e.eventAction === action)?.eventDate ?? null;

    const registrarEntity = data.entities?.find((e) =>
      e.roles?.includes("registrar"),
    );

    return {
      registrar: registrarEntity ? extractRegistrarName(registrarEntity) : null,
      expiry: eventOf("expiration"),
      created: eventOf("registration"),
      nameservers: (data.nameservers ?? [])
        .map((n) => n.ldhName?.toLowerCase())
        .filter((n): n is string => Boolean(n)),
      unavailable: false,
    };
  } catch {
    return empty;
  }
}
