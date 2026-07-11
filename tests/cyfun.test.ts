import { describe, it, expect } from "vitest";
import { classifyScope, scoreAssessment, type Answer } from "../src/lib/cyfun";
import { MODEL, KEY_TOTAL, TOTAL_CONTROLS } from "../src/config/cyfun";

describe("CyFun model invariants (CCB CyberFundamentals 2025, Basic)", () => {
  it("has 34 controls across 6 functions", () => {
    expect(TOTAL_CONTROLS).toBe(34);
    expect(MODEL.length).toBe(6);
  });

  it("has 13 sleutelmaatregelen", () => {
    expect(KEY_TOTAL).toBe(13);
  });

  it("has unique control ids", () => {
    const ids = MODEL.flatMap((f) => f.controls).map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("classifyScope — indicative NIS2 triage", () => {
  it("micro/small orgs land on Basic regardless of sector", () => {
    expect(classifyScope("annex1", "micro", false)).toEqual({
      level: "Basic",
      fit: true,
      viaSupply: false,
    });
    expect(classifyScope("annex2", "small", false).fit).toBe(true);
  });

  it("non-NIS2 sectors land on Basic even when large", () => {
    const r = classifyScope("none", "large", false);
    expect(r).toMatchObject({ level: "Basic", fit: true });
  });

  it("medium/large in a NIS2 sector fall outside the Basic lane", () => {
    expect(classifyScope("annex2", "medium", false)).toEqual({ level: "Important", fit: false });
    expect(classifyScope("annex1", "medium", false)).toEqual({ level: "Important", fit: false });
    expect(classifyScope("annex2", "large", false)).toEqual({ level: "Important", fit: false });
  });

  it("large Annex-I entities are Essential", () => {
    expect(classifyScope("annex1", "large", false)).toEqual({ level: "Essential", fit: false });
  });

  it("records a supply-chain-driven Basic", () => {
    expect(classifyScope("none", "micro", true).viaSupply).toBe(true);
  });
});

// Helpers to build answer maps for the scoring tests.
const allControls = MODEL.flatMap((f) => f.controls);
const answerAll = (v: Answer): Record<string, Answer> =>
  Object.fromEntries(allControls.map((c) => [c.id, v]));

describe("scoreAssessment — weighting & verdict rules", () => {
  it("scores 100 and all key measures met when everything is Ja", () => {
    const r = scoreAssessment(answerAll("ja"));
    expect(r.overall).toBe(100);
    expect(r.keyMet).toBe(KEY_TOTAL);
    expect(r.gaps).toHaveLength(0);
  });

  it("scores 0 when everything is Nee, and lists every control as a gap", () => {
    const r = scoreAssessment(answerAll("nee"));
    expect(r.overall).toBe(0);
    expect(r.keyMet).toBe(0);
    expect(r.gaps).toHaveLength(TOTAL_CONTROLS);
  });

  it("scores 50 when everything is Deels", () => {
    expect(scoreAssessment(answerAll("deels")).overall).toBe(50);
  });

  it("excludes N.v.t. from the score (all N.v.t. → 0/none applicable)", () => {
    const r = scoreAssessment(answerAll("nvt"));
    expect(r.overall).toBe(0);
    expect(r.gaps).toHaveLength(0);
    for (const f of MODEL) expect(r.perFn[f.code].pct).toBeNull();
  });

  it("weights a key measure 2× versus a non-key control", () => {
    // Answer exactly one non-key control Nee, everything else Ja.
    const nonKey = allControls.find((c) => !c.key)!;
    const key = allControls.find((c) => c.key)!;

    const missNonKey = { ...answerAll("ja"), [nonKey.id]: "nee" as Answer };
    const missKey = { ...answerAll("ja"), [key.id]: "nee" as Answer };

    // Missing a key measure must cost more than missing a non-key one.
    expect(scoreAssessment(missKey).overall).toBeLessThan(scoreAssessment(missNonKey).overall);
  });

  it("flags 'nog niet Basic-klaar' when a single key measure is unmet, even at a high score", () => {
    const key = allControls.find((c) => c.key)!;
    const r = scoreAssessment({ ...answerAll("ja"), [key.id]: "deels" as Answer });
    expect(r.keyMet).toBe(KEY_TOTAL - 1);
    expect(r.overall).toBeGreaterThan(85); // still a high overall…
    expect(r.keyMet).not.toBe(KEY_TOTAL); // …but the verdict gate must trip
  });

  it("orders gaps: key measures first, then Nee before Deels", () => {
    const key = allControls.find((c) => c.key)!;
    const nonKeyA = allControls.find((c) => !c.key)!;
    const nonKeyB = allControls.find((c) => !c.key && c.id !== nonKeyA.id)!;
    const answers: Record<string, Answer> = {
      [key.id]: "deels", // key + deels
      [nonKeyA.id]: "nee", // non-key + nee
      [nonKeyB.id]: "deels", // non-key + deels
    };
    const gaps = scoreAssessment(answers).gaps;
    expect(gaps[0].id).toBe(key.id); // key measure first
    // Among non-key gaps, "nee" ranks above "deels".
    const idx = (id: string) => gaps.findIndex((g) => g.id === id);
    expect(idx(nonKeyA.id)).toBeLessThan(idx(nonKeyB.id));
  });
});
