/**
 * The seven category checks (brief §3). Each is an async function that takes the
 * root domain and returns a CheckOutcome (score + plain-language detail). The
 * orchestrator (check.ts) attaches id/label/color from the scoring config.
 *
 * All DNS goes over DoH; WHOIS-equivalent data over RDAP. No shells, no sockets
 * (brief §4). Partial-credit fractions live here with comments; the headline
 * point weights and thresholds live in src/config/scoring.ts.
 */
import { dohQuery, parseTxt, type DohAnswer } from "./doh";
import { rdapLookup } from "./rdap";
import {
  countSpfLookups,
  parseDmarc,
  classifyMx,
  reverseIpv4,
  classifyRblAnswer,
} from "./parse";
import {
  DKIM_SELECTORS,
  RBLS,
  DOMAIN_EXPIRY_WARNING_DAYS,
  SCORING,
  type CategoryId,
} from "../config/scoring";

export interface CheckOutcome {
  score: number;
  status: string;
  detail: string;
  records?: string[];
  caveat?: string;
}

const points = (id: CategoryId) => SCORING.general.categories[id].points;

// --- SPF -------------------------------------------------------------------
export async function checkSpf(domain: string): Promise<CheckOutcome> {
  const max = points("spf");
  const { answers } = await dohQuery(domain, "TXT");
  const spf = parseTxt(answers).find((r) => /^v=spf1/i.test(r.trim()));

  if (!spf) {
    return {
      score: 0,
      status: "ontbreekt",
      detail:
        "Er is geen SPF-record gevonden. Voeg er een toe zodat ontvangers weten welke servers namens u mogen mailen.",
    };
  }
  const lookups = countSpfLookups(spf);
  if (lookups > 10) {
    // Over the RFC 7208 limit can permerror and hard-fail all mail → partial only.
    return {
      score: Math.round(max * 0.5),
      status: `${lookups} lookups (te veel)`,
      detail:
        `Uw SPF-record doet naar schatting ${lookups} DNS-lookups. Boven de RFC-limiet van 10 kan SPF volledig falen — laat dit nakijken en vereenvoudigen.`,
      records: [spf],
    };
  }
  return {
    score: max,
    status: "geldig",
    detail: `SPF is aanwezig en binnen de lookup-limiet (±${lookups}).`,
    records: [spf],
  };
}

// --- DMARC -----------------------------------------------------------------
export async function checkDmarc(domain: string): Promise<CheckOutcome> {
  const max = points("dmarc");
  const { answers } = await dohQuery(`_dmarc.${domain}`, "TXT");
  const parsed = parseDmarc(parseTxt(answers));

  if (!parsed.present) {
    return {
      score: 0,
      status: "ontbreekt",
      detail:
        "Geen DMARC-record. Zonder DMARC kan vervalste e-mail uit uw naam gewoon aankomen. Begin met p=none (monitoring) en werk toe naar p=reject.",
    };
  }
  const records = parsed.record ? [parsed.record] : undefined;
  // Policy strength: reject (full) > quarantine (partial) > none (low).
  if (parsed.policy === "reject") {
    return { score: max, status: "p=reject", detail: "Sterkste beleid actief: vervalste e-mail wordt geweigerd.", records };
  }
  if (parsed.policy === "quarantine") {
    return {
      score: Math.round(max * 0.6),
      status: "p=quarantine",
      detail: "Redelijk beleid: verdachte e-mail gaat naar spam. Zet door naar p=reject voor volledige bescherming.",
      records,
    };
  }
  // p=none (or unparsable policy present)
  return {
    score: Math.round(max * 0.25),
    status: "p=none",
    detail: "DMARC staat op alleen-monitoren (p=none): het beschermt nog niet actief. Verhoog naar quarantine of reject.",
    records,
  };
}

// --- DKIM (best-effort selector guessing) ----------------------------------
export async function checkDkim(domain: string): Promise<CheckOutcome> {
  const max = points("dkim");
  const caveat =
    "We controleren enkel veelgebruikte selectors. Gebruikt u een eigen selector, dan kan DKIM hier als ontbrekend tonen terwijl het wél is ingesteld — laat het ons weten, dan controleren we het manueel.";

  const results = await Promise.all(
    DKIM_SELECTORS.map(async (sel) => {
      const { answers } = await dohQuery(`${sel}._domainkey.${domain}`, "TXT");
      const txt = parseTxt(answers).find(
        (r) => /v=DKIM1/i.test(r) || /(^|;)\s*[pk]=/.test(r),
      );
      return txt ? sel : null;
    }),
  );
  const found = results.filter((s): s is NonNullable<typeof s> => s !== null);

  if (found.length > 0) {
    return {
      score: max,
      status: "gevonden",
      detail: `DKIM gevonden op selector(s): ${found.join(", ")}.`,
      records: found.map((s) => `${s}._domainkey.${domain}`),
      caveat,
    };
  }
  return {
    score: 0,
    status: "niet gevonden",
    detail:
      "Geen DKIM gevonden op de gangbare selectors. Mogelijk is er wél DKIM met een eigen selector — zie de opmerking hieronder.",
    caveat,
  };
}

// --- DNSSEC (AD flag, brief §4 simplification) -----------------------------
export async function checkDnssec(domain: string): Promise<CheckOutcome> {
  const max = points("dnssec");
  // SOA exists for every zone; the AD flag tells us the resolver DNSSEC-validated.
  const { ad, status } = await dohQuery(domain, "SOA");
  if (status !== 0) {
    return {
      score: 0,
      status: "onbekend",
      detail: "Kon DNSSEC niet vaststellen (geen geldig antwoord van de zone).",
    };
  }
  if (ad) {
    return { score: max, status: "actief", detail: "De zone is ondertekend en wordt gevalideerd (DNSSEC actief)." };
  }
  return {
    score: 0,
    status: "niet actief",
    detail:
      "DNSSEC is niet actief. Dit beschermt tegen het omleiden van uw domein — vraag uw registrar om het in te schakelen.",
  };
}

// --- Mail / MX sanity ------------------------------------------------------
function mxHostsFrom(answers: DohAnswer[]): string[] {
  // MX data looks like "10 mail.example.com."
  return answers
    .map((a) => a.data.trim().split(/\s+/).pop() ?? "")
    .map((h) => h.replace(/\.$/, ""))
    .filter(Boolean);
}

/**
 * Resolve the IPv4 addresses of a domain's mail servers (MX → A). Deduplicated
 * and capped so a domain with many MX hosts can't blow the Worker subrequest
 * budget. Used by the blacklist check, which must judge mail-server IPs rather
 * than the domain's (possibly CDN-fronted) website A record.
 */
async function resolveMailIps(domain: string): Promise<string[]> {
  const mx = await dohQuery(domain, "MX");
  const hosts = mxHostsFrom(mx.answers).slice(0, 4);
  const ips: string[] = [];
  for (const host of hosts) {
    const a = await dohQuery(host, "A");
    for (const ans of a.answers) {
      if (!ips.includes(ans.data)) ips.push(ans.data);
    }
  }
  return ips;
}

export async function checkMx(domain: string): Promise<CheckOutcome> {
  const max = points("mx");
  const { answers } = await dohQuery(domain, "MX");
  const hosts = mxHostsFrom(answers);

  if (hosts.length === 0) {
    return {
      score: 0,
      status: "geen MX",
      detail: "Geen MX-records gevonden — dit domein kan geen e-mail ontvangen.",
    };
  }
  // Do the MX hosts actually resolve? (Port of classify_mx + a reachability nod.)
  const resolves = await Promise.all(
    hosts.map(async (h) => {
      const a = await dohQuery(h, "A");
      if (a.answers.length > 0) return true;
      const aaaa = await dohQuery(h, "AAAA");
      return aaaa.answers.length > 0;
    }),
  );
  const provider = classifyMx(hosts) ?? hosts[0];
  const anyResolves = resolves.some(Boolean);
  const records = [`Provider: ${provider}`, ...hosts.map((h) => `MX: ${h}`)];

  if (!anyResolves) {
    return {
      score: Math.round(max * 0.5),
      status: "onbereikbaar",
      detail: "Er zijn MX-records, maar geen enkele mailserver resolvet — e-mail komt mogelijk niet aan.",
      records,
    };
  }
  return {
    score: max,
    status: provider,
    detail: `E-mail loopt via ${provider} en de mailservers zijn bereikbaar.`,
    records,
  };
}

// --- Blacklist status ------------------------------------------------------
export async function checkBlacklist(domain: string): Promise<CheckOutcome> {
  const max = points("blacklist");

  // Email blacklists judge the *sending mail server's* IP, so IP-based RBLs must
  // be run against the IPs behind the domain's MX records — NOT the domain's own
  // A record. For a domain whose website sits behind a CDN/proxy (e.g.
  // Cloudflare), that A record is a shared IP that has nothing to do with email
  // and is itself frequently listed, which would falsely mark the domain as
  // blacklisted. Domain-based lists (DBL) are still queried against the domain.
  const mailIps = await resolveMailIps(domain);

  const listings: string[] = [];
  let couldCheck = false; // got at least one definitive listed/not-listed answer
  let refusedAny = false; // at least one RBL refused (e.g. Spamhaus via public DoH)

  for (const rbl of RBLS) {
    // IP RBLs fan out over every mail-server IP; domain RBLs hit the domain once.
    const queries: string[] = [];
    if (rbl.kind === "ip") {
      for (const ip of mailIps) {
        const rev = reverseIpv4(ip);
        if (rev) queries.push(`${rev}.${rbl.zone}`);
      }
    } else {
      queries.push(`${domain}.${rbl.zone}`);
    }

    for (const query of queries) {
      const res = await dohQuery(query, "A");
      // Read the RBL return code, not just "an answer exists": the 127.255.255.x
      // range is a status/refusal code (Spamhaus returns it for queries via public
      // resolvers), NOT a real listing. See classifyRblAnswer.
      switch (classifyRblAnswer(res.answers.map((ans) => ans.data))) {
        case "listed":
          if (!listings.includes(rbl.label)) listings.push(rbl.label);
          couldCheck = true;
          break;
        case "refused":
          refusedAny = true;
          break;
        case "clean":
          if (res.status === 0 || res.status === 3) couldCheck = true;
          break;
      }
    }
  }

  // When a high-signal RBL refused the query, say so rather than implying a
  // confidently-clean result (matches the README's documented limitation).
  const refusalCaveat =
    "Sommige blacklists (o.a. Spamhaus) beantwoorden geen opvragingen via publieke DNS-resolvers, dus deze uitslag is indicatief.";

  if (listings.length > 0) {
    return {
      score: 0,
      status: `vermeld (${listings.length})`,
      detail: `Vermeld op: ${listings.join(", ")}. Dit schaadt uw e-mailaflevering sterk — laat de vermelding onderzoeken en aanvragen tot verwijdering.`,
      records: listings,
    };
  }
  if (!couldCheck) {
    return {
      score: max,
      status: "niet te bepalen",
      detail: "De blacklists konden niet betrouwbaar bevraagd worden.",
      caveat: refusalCaveat,
    };
  }
  return {
    score: max,
    status: "schoon",
    detail: "Niet aangetroffen op de gecontroleerde blacklists.",
    caveat: refusedAny ? refusalCaveat : undefined,
  };
}

// --- Domain / NS health ----------------------------------------------------
export async function checkDomain(domain: string): Promise<CheckOutcome> {
  const max = points("domain");
  const [rdap, nsRes] = await Promise.all([
    rdapLookup(domain),
    dohQuery(domain, "NS"),
  ]);

  const nsHosts = nsRes.answers.map((a) => a.data.replace(/\.$/, "")).filter(Boolean);
  const nsResolve = await Promise.all(
    nsHosts.map(async (h) => (await dohQuery(h, "A")).answers.length > 0),
  );
  const nsOk = nsHosts.length > 0 && nsResolve.some(Boolean);

  // Expiry: only penalize when we actually know it (brief open Q4 → "onbekend").
  let expirySoon = false;
  let expiryLabel = "onbekend";
  if (rdap.expiry) {
    const days = (new Date(rdap.expiry).getTime() - Date.now()) / 86_400_000;
    expiryLabel = `${new Date(rdap.expiry).toLocaleDateString("nl-BE")} (${Math.round(days)} dagen)`;
    expirySoon = days < DOMAIN_EXPIRY_WARNING_DAYS;
  }

  let score = max;
  const problems: string[] = [];
  if (!nsOk) {
    score -= Math.round(max * 0.5);
    problems.push("nameservers resolven niet");
  }
  if (expirySoon) {
    score -= Math.round(max * 0.5);
    problems.push("domein verloopt binnenkort");
  }
  score = Math.max(0, score);

  const records = [
    `Registrar: ${rdap.registrar ?? "onbekend"}`,
    `Vervaldatum: ${expiryLabel}`,
    ...(nsHosts.length ? [`Nameservers: ${nsHosts.join(", ")}`] : []),
  ];

  return {
    score,
    status: problems.length ? problems[0] : "in orde",
    detail: problems.length
      ? `Aandachtspunt: ${problems.join(" en ")}.`
      : "Domein en nameservers zijn in orde.",
    records,
    caveat: rdap.unavailable
      ? "Registratiegegevens (RDAP) waren niet bereikbaar; verval- en registrarinfo kan ontbreken."
      : undefined,
  };
}
