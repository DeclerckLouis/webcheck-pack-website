/**
 * Scoring configuration — the SINGLE source of truth for weights, thresholds
 * and tunables (brief §3). Louis tunes the tool here without touching engine
 * code. Everything is keyed by *mode* so a second profile (`security`, brief
 * §6b) can be added later as another entry, not a rewrite.
 *
 * PLACEHOLDER VALUES flagged inline with TODO(louis) are meant to be confirmed
 * before launch (brief open questions §8).
 */

export type Mode = "general";

export type CategoryId =
  | "spf"
  | "dmarc"
  | "dkim"
  | "dnssec"
  | "mx"
  | "blacklist"
  | "domain";

export interface CategoryConfig {
  /** Max points this category contributes to the /100 total. */
  points: number;
  /** Dutch label shown in the UI. */
  label: string;
  /** One-line "what this means for you" shown in the unlocked report. */
  plain: string;
}

export interface ScoringProfile {
  label: string;
  categories: Record<CategoryId, CategoryConfig>;
}

export const SCORING: Record<Mode, ScoringProfile> = {
  general: {
    label: "Algemene domeincheck",
    categories: {
      // Weights front-loaded toward phishing/spoofing risk (brief §3).
      spf: {
        points: 20,
        label: "SPF",
        plain:
          "SPF vertelt de wereld welke servers namens uw domein e-mail mogen versturen. Zonder (of met een kapotte) SPF kunnen oplichters makkelijker mailen alsof ze u zijn.",
      },
      dmarc: {
        points: 20,
        label: "DMARC",
        plain:
          "DMARC bepaalt wat er gebeurt met vervalste e-mail uit uw naam. Op 'reject' wordt spoofing actief geweigerd; ontbreekt het, dan komt vervalste post gewoon aan.",
      },
      dkim: {
        points: 15,
        label: "DKIM",
        plain:
          "DKIM ondertekent uw uitgaande e-mail digitaal zodat ontvangers zien dat ze echt is.",
      },
      dnssec: {
        points: 15,
        label: "DNSSEC",
        plain:
          "DNSSEC beschermt tegen het omleiden van uw domein naar een valse server.",
      },
      mx: {
        points: 10,
        label: "Mail (MX)",
        plain:
          "De MX-records bepalen waar uw e-mail binnenkomt. Ze moeten naar bereikbare mailservers wijzen.",
      },
      blacklist: {
        points: 15,
        label: "Blacklists",
        plain:
          "Staat het IP-adres van uw domein op een spam-blacklist, dan belandt uw e-mail bij anderen sneller in de spam of wordt ze geweigerd.",
      },
      domain: {
        points: 5,
        label: "Domein & DNS",
        plain:
          "Basishygiëne: uw domein mag niet bijna vervallen en de nameservers moeten netjes resolven.",
      },
    },
  },
};

/**
 * Traffic-light thresholds for the overall score AND per-category (applied to
 * the category's own percentage of its max).
 * TODO(louis): confirm exact thresholds before launch (brief open Q2). Placeholder.
 */
export const COLOR_THRESHOLDS = {
  /** score ≥ green → green */
  green: 80,
  /** score ≥ orange (and < green) → orange; below → red */
  orange: 50,
} as const;

/** How long a computed result is cached per domain+mode (brief §5: 6–24h). */
export const CACHE_TTL_SECONDS = 12 * 60 * 60;

/** Per-IP rate limit (brief §5). KV-counter fallback for Cloudflare's own rules. */
export const RATE_LIMIT = {
  maxRequests: 20,
  windowSeconds: 60 * 60,
} as const;

/**
 * DKIM: best-effort selector guessing (brief §3 — known limitation, surfaced in
 * the UI). Add provider selectors here as they come up.
 */
export const DKIM_SELECTORS = [
  "default",
  "selector1",
  "selector2",
  "google",
  "k1",
  "s1",
  "mail",
] as const;

/**
 * Blacklists — short, high-signal list (brief §3), NOT an exhaustive 100+ list.
 * `kind: "ip"` reverses the A-record IP; `kind: "domain"` appends the domain.
 *
 * Spamhaus refuses queries that arrive via large public resolvers (incl.
 * Cloudflare DoH), answering with a 127.255.255.x error code rather than real
 * data. Their Data Query Service (DQS) fixes this: with a per-account key the
 * query name becomes `<name>.<key>.<dqsZone>`, which works through any resolver.
 * When a `dqsZone` entry has no key configured we fall back to marking the whole
 * category "niet gecontroleerd" rather than trusting a possibly-blocked answer.
 */
export interface Rbl {
  zone: string;
  label: string;
  kind: "ip" | "domain";
  /** DQS zone used when SPAMHAUS_DQS_KEY is set: `<name>.<key>.<dqsZone>`. */
  dqsZone?: string;
}

export const RBLS: Rbl[] = [
  { zone: "zen.spamhaus.org", label: "Spamhaus ZEN", kind: "ip", dqsZone: "zen.dq.spamhaus.net" },
  { zone: "dbl.spamhaus.org", label: "Spamhaus DBL", kind: "domain", dqsZone: "dbl.dq.spamhaus.net" },
  { zone: "b.barracudacentral.org", label: "Barracuda", kind: "ip" },
];

/** Domain considered "expiring soon" within this many days (brief §3, 30d). */
export const DOMAIN_EXPIRY_WARNING_DAYS = 30;
