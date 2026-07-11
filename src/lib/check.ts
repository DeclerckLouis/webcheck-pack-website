/**
 * Orchestrator: normalize → run all category checks in parallel → assemble the
 * result. Framework-agnostic (no Cloudflare/Astro imports) so it's unit-testable
 * and reusable. Caching/rate-limiting live in the API layer, not here.
 */
import { SCORING, type CategoryId, type Mode } from "../config/scoring";
import { trafficLight, aggregateScore } from "./scoring";
import type { CategoryResult, FullResult } from "./types";
import {
  checkSpf,
  checkDmarc,
  checkDkim,
  checkDnssec,
  checkMx,
  checkBlacklist,
  checkDomain,
  type CheckOutcome,
  type CheckOptions,
} from "./checks";

const RUNNERS: Record<CategoryId, (d: string, opts: CheckOptions) => Promise<CheckOutcome>> = {
  spf: checkSpf,
  dmarc: checkDmarc,
  dkim: checkDkim,
  dnssec: checkDnssec,
  mx: checkMx,
  blacklist: checkBlacklist,
  domain: checkDomain,
};

/** Generate a short, URL-safe check id (used to unlock the cached full report). */
function makeCheckId(): string {
  // crypto.randomUUID is available in Workers and modern Node.
  return crypto.randomUUID().replace(/-/g, "").slice(0, 20);
}

/**
 * Run a full check for an already-normalized domain. Returns the full result;
 * the API decides what to expose publicly vs. gate behind the email unlock.
 */
export async function runCheck(
  domain: string,
  mode: Mode = "general",
  opts: CheckOptions = {},
): Promise<FullResult> {
  const profile = SCORING[mode];
  const ids = Object.keys(profile.categories) as CategoryId[];

  const outcomes = await Promise.all(
    ids.map(async (id) => {
      try {
        return { id, outcome: await RUNNERS[id](domain, opts) };
      } catch {
        // A single failing check shouldn't sink the whole report.
        const outcome: CheckOutcome = {
          score: 0,
          status: "fout",
          detail: "Deze controle kon niet worden uitgevoerd. Probeer het later opnieuw.",
        };
        return { id, outcome };
      }
    }),
  );

  const categories: CategoryResult[] = outcomes.map(({ id, outcome }) => {
    const cfg = profile.categories[id];
    return {
      id,
      label: cfg.label,
      score: outcome.score,
      max: cfg.points,
      color: outcome.notChecked ? "grey" : trafficLight(outcome.score, cfg.points),
      status: outcome.status,
      detail: outcome.detail,
      records: outcome.records,
      caveat: outcome.caveat,
      notChecked: outcome.notChecked,
    };
  });

  // "Niet gecontroleerd" categories are excluded from the denominator and the
  // remainder is rescaled to /100, so the headline score stays honest — never
  // silently awarding or docking the excluded category's points (brief §1).
  const { total, max } = aggregateScore(categories);

  return {
    domain,
    mode,
    total,
    max,
    color: trafficLight(total, max),
    categories,
    checkId: makeCheckId(),
    cached: false,
    generatedAt: new Date().toISOString(),
  };
}

/** Strip the full result down to the public teaser (numbers + colors only). */
export function toPublicSummary(full: FullResult) {
  return {
    domain: full.domain,
    mode: full.mode,
    total: full.total,
    max: full.max,
    color: full.color,
    categories: full.categories.map((c) => ({
      id: c.id,
      label: c.label,
      score: c.score,
      max: c.max,
      color: c.color,
      notChecked: c.notChecked,
    })),
    checkId: full.checkId,
    cached: full.cached,
    generatedAt: full.generatedAt,
  };
}
