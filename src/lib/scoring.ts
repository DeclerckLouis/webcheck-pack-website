import { COLOR_THRESHOLDS } from "../config/scoring";
import type { CategoryResult, TrafficLight } from "./types";

/**
 * Map a score to a traffic light by its percentage of the max. Used for both the
 * overall score and each category. Thresholds come from the config (tunable).
 */
export function trafficLight(score: number, max: number): TrafficLight {
  const pct = max <= 0 ? 0 : (score / max) * 100;
  if (pct >= COLOR_THRESHOLDS.green) return "green";
  if (pct >= COLOR_THRESHOLDS.orange) return "orange";
  return "red";
}

/**
 * Aggregate category results into the headline score out of 100. Categories
 * flagged `notChecked` (e.g. blacklists we couldn't reach) are excluded from the
 * denominator and the remainder is rescaled, so an excluded category never
 * silently awards or docks its points (brief §1). With every category scored the
 * weights already sum to 100, so this is a no-op for the normal case.
 */
export function aggregateScore(categories: Pick<CategoryResult, "score" | "max" | "notChecked">[]): {
  total: number;
  max: number;
} {
  const scored = categories.filter((c) => !c.notChecked);
  const scoredTotal = scored.reduce((sum, c) => sum + c.score, 0);
  const scoredMax = scored.reduce((sum, c) => sum + c.max, 0);
  const max = 100;
  const total = scoredMax > 0 ? Math.round((scoredTotal / scoredMax) * max) : 0;
  return { total, max };
}
