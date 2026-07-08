import { describe, it, expect } from "vitest";
import { trafficLight } from "../src/lib/scoring";
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
