/**
 * DNS-over-HTTPS client (brief §4). Cloudflare Workers/Pages Functions can't
 * open raw UDP/53 sockets, so all DNS goes over HTTPS via Cloudflare's JSON API.
 * Works natively over fetch(), no dependency.
 */

const DOH_ENDPOINT = "https://cloudflare-dns.com/dns-query";

/** DNS record type numbers we care about. */
export const RRTYPE = {
  A: 1,
  NS: 2,
  TXT: 16,
  MX: 15,
  AAAA: 28,
  SOA: 6,
} as const;

export interface DohAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

export interface DohResult {
  /** DNS response code: 0 = NOERROR, 3 = NXDOMAIN, etc. */
  status: number;
  /** Authenticated Data flag — true when the resolver DNSSEC-validated (brief §4). */
  ad: boolean;
  answers: DohAnswer[];
}

/**
 * Query a name/type over DoH. Never throws for DNS-level failures (returns an
 * empty result with the status code); only network/parse errors reject.
 */
export async function dohQuery(
  name: string,
  type: keyof typeof RRTYPE,
  opts: { signal?: AbortSignal } = {},
): Promise<DohResult> {
  const url = `${DOH_ENDPOINT}?name=${encodeURIComponent(name)}&type=${type}&do=1`;
  const res = await fetch(url, {
    headers: { accept: "application/dns-json" },
    signal: opts.signal,
  });
  if (!res.ok) {
    return { status: -1, ad: false, answers: [] };
  }
  const json = (await res.json()) as {
    Status?: number;
    AD?: boolean;
    Answer?: DohAnswer[];
  };
  return {
    status: json.Status ?? -1,
    ad: json.AD === true,
    // Keep only answers of the requested type (DoH includes CNAME chains etc.).
    answers: (json.Answer ?? []).filter((a) => a.type === RRTYPE[type]),
  };
}

/** TXT records come quoted and can be split into chunks — join and unquote. */
export function parseTxt(answers: DohAnswer[]): string[] {
  return answers.map((a) =>
    a.data
      // A multi-string TXT looks like `"chunk1" "chunk2"`.
      .replace(/"\s+"/g, "")
      .replace(/^"|"$/g, ""),
  );
}
