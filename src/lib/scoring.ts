import { COLOR_THRESHOLDS } from "../config/scoring";
import type { TrafficLight } from "./types";

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
