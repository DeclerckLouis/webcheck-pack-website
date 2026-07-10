import type { CategoryId, Mode } from "../config/scoring";

export type TrafficLight = "green" | "orange" | "red" | "grey";

/** One category's outcome. `detail`/`records` are only shown after unlock. */
export interface CategoryResult {
  id: CategoryId;
  label: string;
  score: number;
  max: number;
  color: TrafficLight;
  /** Short status word for the public view (e.g. "reject", "ontbreekt"). */
  status: string;
  /** Full-report explanation in plain Dutch (shown after email unlock). */
  detail: string;
  /** Raw record values in plain language (shown after unlock). Never DNS dumps. */
  records?: string[];
  /** True when the result is best-effort / may be a false negative (e.g. DKIM). */
  caveat?: string;
  /**
   * True when this category could not be checked reliably (e.g. blacklists that
   * refuse queries via public resolvers). Rendered neutral/grey, never red, and
   * excluded from the score denominator so the tool never invents or docks points.
   */
  notChecked?: boolean;
}

/** The teaser (pre-unlock): numbers + colors only, no explanations. */
export interface PublicSummary {
  domain: string;
  mode: Mode;
  total: number;
  max: number;
  color: TrafficLight;
  categories: {
    id: CategoryId;
    label: string;
    score: number;
    max: number;
    color: TrafficLight;
    notChecked?: boolean;
  }[];
  checkId: string;
  cached: boolean;
  generatedAt: string;
}

/** The full result held server-side and revealed on unlock. */
export interface FullResult extends Omit<PublicSummary, "categories"> {
  categories: CategoryResult[];
}
