import { describe, it, expect } from "vitest";
import { classifyScope, scoreQuiz, type Answer } from "../src/lib/cyfun";
import { QUESTIONS, SCOPE_CHOICES, TOTAL_QUESTIONS } from "../src/config/cyfun";

describe("self-check content invariants", () => {
  it("has a short, non-empty question set", () => {
    expect(TOTAL_QUESTIONS).toBe(QUESTIONS.length);
    expect(TOTAL_QUESTIONS).toBeGreaterThanOrEqual(5);
    expect(TOTAL_QUESTIONS).toBeLessThanOrEqual(9);
  });

  it("gives every question a plain question, a yes-line, a fix, and a CyFun code", () => {
    for (const q of QUESTIONS) {
      expect(q.q.length).toBeGreaterThan(0);
      expect(q.yes.length).toBeGreaterThan(0);
      expect(q.fix.length).toBeGreaterThan(0);
      expect(q.cyfun).toMatch(/^[A-Z]{2}\./);
    }
  });

  it("has unique question ids", () => {
    const ids = QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("classifyScope — one friendly question, only gates the CTA", () => {
  it("KMO and non-regulated large orgs are Basic-fit (CTA shown)", () => {
    expect(classifyScope("kmo").fit).toBe(true);
    expect(classifyScope("big-other").fit).toBe(true);
  });

  it("large + regulated is NOT Basic-fit (CTA suppressed)", () => {
    expect(classifyScope("big-regulated").fit).toBe(false);
  });

  it("defaults to fit:true when unanswered or unknown", () => {
    expect(classifyScope(undefined).fit).toBe(true);
    expect(classifyScope("").fit).toBe(true);
    expect(classifyScope("bogus").fit).toBe(true);
  });

  it("every scope option resolves to itself", () => {
    for (const c of SCOPE_CHOICES) {
      expect(classifyScope(c.v)).toEqual({ choice: c.v, fit: c.fit });
    }
  });
});

const answerAll = (v: Answer): Record<string, Answer> =>
  Object.fromEntries(QUESTIONS.map((q) => [q.id, v]));

describe("scoreQuiz — simple, honest scoring", () => {
  it("all Ja → full score, no quick wins, good tone", () => {
    const r = scoreQuiz(answerAll("ja"));
    expect(r.yesCount).toBe(TOTAL_QUESTIONS);
    expect(r.score).toBe(100);
    expect(r.quickWins).toHaveLength(0);
    expect(r.tone).toBe("good");
  });

  it("all Nee → zero score, every item a quick win, work tone", () => {
    const r = scoreQuiz(answerAll("nee"));
    expect(r.yesCount).toBe(0);
    expect(r.score).toBe(0);
    expect(r.quickWins).toHaveLength(TOTAL_QUESTIONS);
    expect(r.tone).toBe("work");
  });

  it("counts 'onbekend' as a quick win, not a point", () => {
    const r = scoreQuiz(answerAll("onbekend"));
    expect(r.yesCount).toBe(0);
    expect(r.quickWins).toHaveLength(TOTAL_QUESTIONS);
  });

  it("scores the yes-fraction as a 0-100 percentage", () => {
    // Answer exactly one question Nee, the rest Ja.
    const answers = { ...answerAll("ja"), [QUESTIONS[0].id]: "nee" as Answer };
    const r = scoreQuiz(answers);
    expect(r.yesCount).toBe(TOTAL_QUESTIONS - 1);
    expect(r.score).toBe(Math.round((100 * (TOTAL_QUESTIONS - 1)) / TOTAL_QUESTIONS));
  });

  it("orders quick wins: key measures first, then Nee before Onbekend", () => {
    const key = QUESTIONS.find((q) => q.key)!;
    const nonKey = QUESTIONS.find((q) => !q.key)!;
    // key answered 'onbekend', a non-key answered 'nee'
    const answers: Record<string, Answer> = { [key.id]: "onbekend", [nonKey.id]: "nee" };
    const wins = scoreQuiz(answers).quickWins;
    expect(wins[0].id).toBe(key.id); // key measure leads despite being 'onbekend'
  });

  it("ranks Nee above Onbekend within the same key-ness", () => {
    const nonKeys = QUESTIONS.filter((q) => !q.key);
    // Fallback: if there aren't two non-key questions, use any two.
    const [a, b] = nonKeys.length >= 2 ? nonKeys : QUESTIONS;
    const answers: Record<string, Answer> = { [a.id]: "onbekend", [b.id]: "nee" };
    const wins = scoreQuiz(answers).quickWins;
    const idx = (id: string) => wins.findIndex((w) => w.id === id);
    // Same key-ness assumed for the non-key pair; "nee" should come first.
    if (!a.key && !b.key) expect(idx(b.id)).toBeLessThan(idx(a.id));
  });
});
