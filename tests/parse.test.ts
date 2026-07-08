import { describe, it, expect } from "vitest";
import {
  countSpfLookups,
  parseDmarc,
  classifyMx,
  reverseIpv4,
} from "../src/lib/parse";

describe("countSpfLookups (port of count_spf_lookups)", () => {
  it("counts include/redirect/exists and a/mx/ptr mechanisms", () => {
    expect(countSpfLookups("v=spf1 include:_spf.google.com ~all")).toBe(1);
    expect(
      countSpfLookups("v=spf1 include:a.com include:b.com mx a ~all"),
    ).toBe(4);
    expect(countSpfLookups("v=spf1 -all")).toBe(0);
  });

  it("flags records over the RFC 7208 limit of 10", () => {
    const spf =
      "v=spf1 " +
      Array.from({ length: 11 }, (_, i) => `include:s${i}.com`).join(" ") +
      " ~all";
    expect(countSpfLookups(spf)).toBeGreaterThan(10);
  });
});

describe("parseDmarc (port of check_dmarc)", () => {
  it("detects missing records", () => {
    expect(parseDmarc([]).present).toBe(false);
    expect(parseDmarc(["v=spf1 -all"]).present).toBe(false);
  });

  it("extracts policy and pct", () => {
    const r = parseDmarc(["v=DMARC1; p=reject; pct=100; rua=mailto:x@y.be"]);
    expect(r.present).toBe(true);
    expect(r.policy).toBe("reject");
    expect(r.pct).toBe(100);
  });

  it("handles quarantine and none", () => {
    expect(parseDmarc(["v=DMARC1; p=quarantine"]).policy).toBe("quarantine");
    expect(parseDmarc(["v=DMARC1; p=none"]).policy).toBe("none");
  });
});

describe("classifyMx (port of classify_mx)", () => {
  it("recognizes major providers", () => {
    expect(classifyMx(["alt1.aspmx.l.google.com"])).toBe("Google Workspace");
    expect(classifyMx(["example-be.mail.protection.outlook.com"])).toBe("Microsoft 365");
    expect(classifyMx(["mx.one.com"])).toBe("one.com");
  });

  it("falls back to the first host and handles empty", () => {
    expect(classifyMx(["mx.custom.be"])).toBe("mx.custom.be");
    expect(classifyMx([])).toBeNull();
  });
});

describe("reverseIpv4", () => {
  it("reverses valid IPv4 for RBL queries", () => {
    expect(reverseIpv4("1.2.3.4")).toBe("4.3.2.1");
  });
  it("rejects invalid input", () => {
    expect(reverseIpv4("999.1.1.1")).toBeNull();
    expect(reverseIpv4("1.2.3")).toBeNull();
    expect(reverseIpv4("::1")).toBeNull();
  });
});
