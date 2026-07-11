/**
 * CyFun Basic — pure triage + scoring logic (framework-agnostic, unit-testable).
 * Data + copy live in `config/cyfun.ts`; this module only computes. Ported from
 * the reference prototype's `classifyScope()` and `score()`.
 */
import { MODEL, KEY_TOTAL, type Control } from "../config/cyfun";

/** A questionnaire answer. "nvt" (niet van toepassing) is excluded from scoring. */
export type Answer = "ja" | "deels" | "nee" | "nvt";

/** Assurance level the triage lands on. */
export type ScopeLevel = "Basic" | "Important" | "Essential";

export interface ScopeResult {
  level: ScopeLevel;
  /**
   * True when CyFun Basic is the right lane for this visitor. When false
   * (Important/Essential), the results page must NOT show the PacketFlow
   * engagement gate — it shows the "contact a specialist" card instead (brief §2).
   */
  fit: boolean;
  /** Basic reached via a supply-chain requirement rather than direct obligation. */
  viaSupply?: boolean;
}

/**
 * Indicative NIS2 triage. Micro/small orgs, or any org outside a NIS2 sector,
 * land on Basic (fit). Medium/large orgs inside a NIS2 sector fall outside
 * PacketFlow's Basic lane (Important, or Essential for large Annex-I entities).
 */
export function classifyScope(sector: string, size: string, supply: boolean): ScopeResult {
  const inSector = sector !== "none";
  const bigEnough = size === "medium" || size === "large";
  if (inSector && bigEnough) {
    const level: ScopeLevel = sector === "annex1" && size === "large" ? "Essential" : "Important";
    return { level, fit: false };
  }
  return { level: "Basic", fit: true, viaSupply: supply };
}

/** One unmet control, carried into the prioritised gap list. */
export interface Gap extends Control {
  /** The answer that made it a gap: "nee" (heavier) or "deels". */
  a: Answer;
  /** Dutch label of the function it belongs to. */
  fn: string;
}

export interface FunctionScore {
  label: string;
  /** Percentage met within this function, or null when every control was N.v.t. */
  pct: number | null;
}

export interface ScoreResult {
  /** Overall weighted score, 0–100 (key measures count 2×). */
  overall: number;
  /** How many of the KEY_TOTAL key measures are fully ("ja") met. */
  keyMet: number;
  /** Per-function breakdown, keyed by function code. */
  perFn: Record<string, FunctionScore>;
  /** Unmet controls, key measures first, then "nee" before "deels". */
  gaps: Gap[];
}

/**
 * Score an assessment. Ja=1, Deels=0.5, Nee=0, N.v.t.=excluded. Key measures are
 * weighted 2× in the overall total. The per-function percentages are unweighted
 * (a plain met/total within the function).
 */
export function scoreAssessment(answers: Record<string, Answer | undefined>): ScoreResult {
  const W_KEY = 2;
  const W = 1;
  let num = 0;
  let den = 0;
  let keyMet = 0;
  const perFn: Record<string, FunctionScore> = {};
  const gaps: Gap[] = [];

  MODEL.forEach((f) => {
    let fnum = 0;
    let fden = 0;
    f.controls.forEach((c) => {
      const a = answers[c.id];
      if (a === "nvt" || a === undefined) return;
      const val = a === "ja" ? 1 : a === "deels" ? 0.5 : 0;
      const w = c.key ? W_KEY : W;
      num += w * val;
      den += w;
      fnum += val;
      fden += 1;
      if (c.key && a === "ja") keyMet++;
      if (a === "nee" || a === "deels") gaps.push({ ...c, a, fn: f.label });
    });
    perFn[f.code] = { label: f.label, pct: fden ? Math.round((100 * fnum) / fden) : null };
  });

  const overall = den ? Math.round((100 * num) / den) : 0;
  // Key measures first; within the same key-ness, "nee" ranks above "deels".
  gaps.sort(
    (x, y) => (y.key ? 1 : 0) - (x.key ? 1 : 0) || (x.a === "nee" ? -1 : 1) - (y.a === "nee" ? -1 : 1),
  );
  return { overall, keyMet, perFn, gaps };
}

/** True when every key measure is fully met — required for "Basic-klaar". */
export function allKeyMeasuresMet(keyMet: number): boolean {
  return keyMet === KEY_TOTAL;
}
