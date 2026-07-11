/**
 * Short self-check — pure scoring + scope logic (framework-agnostic, testable).
 * Data + copy live in `config/cyfun.ts`; this module only computes.
 */
import { QUESTIONS, SCOPE_CHOICES, TOTAL_QUESTIONS, type Question } from "../config/cyfun";

/** A yes/no/"don't know" answer. "onbekend" counts as a gap (it's a finding too). */
export type Answer = "ja" | "nee" | "onbekend";

export interface ScopeResult {
  /** The chosen option value, or "" when unanswered. */
  choice: string;
  /**
   * True when CyFun Basic is the right lane → show the engagement CTA. Unknown
   * (unanswered) defaults to true: we only suppress the CTA when the visitor
   * clearly identifies as an Important/Essential (50+ regulated) entity.
   */
  fit: boolean;
}

/** Resolve the scope choice to a fit flag (defaults to fit:true when unknown). */
export function classifyScope(choice: string | undefined): ScopeResult {
  const opt = SCOPE_CHOICES.find((c) => c.v === choice);
  return { choice: opt?.v ?? "", fit: opt ? opt.fit : true };
}

/** One thing to improve, carried into the result's quick-win list. */
export interface QuickWin extends Question {
  /** The answer that flagged it: "nee" or "onbekend". */
  a: Answer;
}

export interface QuizResult {
  /** How many of the questions are answered "Ja". */
  yesCount: number;
  total: number;
  /** yesCount as a 0–100 percentage, for the ring/meter fill. */
  score: number;
  /** Not-yet-"Ja" items, key measures first. The reason-to-contact list. */
  quickWins: QuickWin[];
  /** Friendly verdict headline, tuned to how many are in order. */
  verdict: string;
  /** Tone band for styling the verdict (good / ok / work). */
  tone: "good" | "ok" | "work";
}

/**
 * Score the short check. Simple and honest: each "Ja" is a point, everything
 * else is a quick win. No weighting, no jargon — a KMO owner should read
 * "5 van 7 op orde" and instantly get it.
 */
export function scoreQuiz(answers: Record<string, Answer | undefined>): QuizResult {
  let yesCount = 0;
  const quickWins: QuickWin[] = [];
  for (const q of QUESTIONS) {
    const a = answers[q.id];
    if (a === "ja") yesCount++;
    else if (a === "nee" || a === "onbekend") quickWins.push({ ...q, a });
  }
  // Key measures first; within that, a flat "nee" ranks above an "onbekend".
  quickWins.sort(
    (x, y) =>
      (y.key ? 1 : 0) - (x.key ? 1 : 0) || (x.a === "nee" ? -1 : 1) - (y.a === "nee" ? -1 : 1),
  );

  const total = TOTAL_QUESTIONS;
  const score = total ? Math.round((100 * yesCount) / total) : 0;

  let verdict: string;
  let tone: QuizResult["tone"];
  if (yesCount === total) {
    verdict = "Sterke basis — dit staat netjes voor elkaar.";
    tone = "good";
  } else if (yesCount >= total - 2) {
    verdict = "Goed bezig, met een paar snelle winsten.";
    tone = "ok";
  } else if (yesCount >= Math.ceil(total / 2)) {
    verdict = "Een aantal punten verdienen aandacht — en het zijn quick wins.";
    tone = "ok";
  } else {
    verdict = "Hier valt veel te winnen. Geen paniek — we helpen u op weg.";
    tone = "work";
  }

  return { yesCount, total, score, quickWins, verdict, tone };
}
