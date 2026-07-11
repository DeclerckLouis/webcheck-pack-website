import { describe, it, expect } from "vitest";
import { trafficLight, aggregateScore } from "../src/lib/scoring";
import { SCORING } from "../src/config/scoring";

describe("trafficLight thresholds", () => {
  it("maps by percentage of max", () => {
    expect(trafficLight(100, 100)).toBe("green");
    expect(trafficLight(80, 100)).toBe("green");
    expect(trafficLight(79, 100)).toBe("orange");
    expect(trafficLight(50, 100)).toBe("orange");
    expect(trafficLight(49, 100)).toBe("red");
    expect(trafficLight(0, 100)).toBe("red");
  });

  it("handles a zero max safely", () => {
    expect(trafficLight(0, 0)).toBe("red");
  });
});

describe("scoring config invariants", () => {
  it("general profile category weights sum to 100", () => {
    const total = Object.values(SCORING.general.categories).reduce(
      (sum, c) => sum + c.points,
      0,
    );
    expect(total).toBe(100);
  });
});

describe("aggregateScore (rescale with excluded categories — brief §1)", () => {
  // Mirror of the general profile: weights that sum to 100.
  const full = [
    { score: 20, max: 20 }, // spf
    { score: 20, max: 20 }, // dmarc
    { score: 15, max: 15 }, // dkim
    { score: 15, max: 15 }, // dnssec
    { score: 10, max: 10 }, // mx
    { score: 15, max: 15 }, // blacklist
    { score: 5, max: 5 }, // domain
  ];

  it("is a no-op when every category is scored (clean domain → 100)", () => {
    expect(aggregateScore(full)).toEqual({ total: 100, max: 100 });
  });

  it("lets a clean domain reach 100 when blacklist is not checked (no DQS key)", () => {
    const withExcluded = full.map((c, i) =>
      i === 5 ? { ...c, score: 0, notChecked: true } : c,
    );
    // 85/85 earned, rescaled to /100 → 100, NOT 85.
    expect(aggregateScore(withExcluded)).toEqual({ total: 100, max: 100 });
  });

  it("rescales honestly when an excluded category coexists with a real miss", () => {
    // dmarc scores 0, blacklist excluded → 65 earned of 85 → 76.
    const mixed = full.map((c, i) => {
      if (i === 1) return { ...c, score: 0 }; // dmarc missing
      if (i === 5) return { ...c, score: 0, notChecked: true }; // blacklist excluded
      return c;
    });
    expect(aggregateScore(mixed)).toEqual({ total: 76, max: 100 });
  });

  it("returns 0 when nothing could be scored", () => {
    expect(aggregateScore([{ score: 0, max: 15, notChecked: true }])).toEqual({
      total: 0,
      max: 100,
    });
  });
});
