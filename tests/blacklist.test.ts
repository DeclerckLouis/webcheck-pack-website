import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the DoH client so we can drive checkBlacklist through the three response
// classes without any network. Only dohQuery is used by the blacklist check.
const doh = vi.hoisted(() => ({ dohQuery: vi.fn() }));
vi.mock("../src/lib/doh", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/doh")>();
  return { ...actual, dohQuery: doh.dohQuery };
});

import { checkBlacklist } from "../src/lib/checks";

type Ans = { status: number; ad: boolean; answers: { name: string; type: number; TTL: number; data: string }[] };
const nx = (): Ans => ({ status: 3, ad: false, answers: [] });
const a = (...ips: string[]): Ans => ({
  status: 0,
  ad: false,
  answers: ips.map((data) => ({ name: "x", type: 1, TTL: 60, data })),
});

/**
 * Build a dohQuery mock. `mx`/`aRecords` feed resolveMailIps; `rbl` maps an RBL
 * query name to its answer (keyed by a substring match on the zone).
 */
function mockDoh(rblAnswer: (query: string) => Ans) {
  doh.dohQuery.mockImplementation(async (name: string, type: string) => {
    if (type === "MX") return { status: 0, ad: false, answers: [{ name, type: 15, TTL: 60, data: "10 mail.example.com" }] };
    if (type === "A" && name === "mail.example.com") return a("192.0.2.10");
    if (type === "A") return rblAnswer(name); // RBL lookups
    return nx();
  });
}

beforeEach(() => doh.dohQuery.mockReset());

describe("checkBlacklist — response classes and modes (brief §1)", () => {
  it("marks 'niet gecontroleerd' when Spamhaus is blocked via public resolver (no DQS key)", async () => {
    // zen/dbl (spamhaus.org) refuse with 127.255.255.254; barracuda answers clean.
    mockDoh((q) =>
      q.includes("spamhaus.org") ? a("127.255.255.254") : nx(),
    );
    const r = await checkBlacklist("example.com");
    expect(r.notChecked).toBe(true);
    expect(r.score).toBe(0); // excluded from denominator, never rendered as red
    expect(r.status).toBe("niet gecontroleerd");
  });

  it("scores full marks when every list answers NXDOMAIN (clean) — e.g. via DQS", async () => {
    mockDoh(() => nx()); // NXDOMAIN everywhere
    const r = await checkBlacklist("example.com", { dqsKey: "testkey" });
    expect(r.notChecked).toBeFalsy();
    expect(r.score).toBe(15);
    expect(r.status).toBe("schoon");
  });

  it("uses the keyed DQS zone when a key is configured", async () => {
    mockDoh(() => nx());
    await checkBlacklist("example.com", { dqsKey: "abc123" });
    const zenQuery = doh.dohQuery.mock.calls
      .map((c) => c[0] as string)
      .find((n) => n.includes("zen.dq.spamhaus.net"));
    expect(zenQuery).toBe("10.2.0.192.abc123.zen.dq.spamhaus.net");
  });

  it("reports a genuine listing as red 0 (not excluded)", async () => {
    mockDoh((q) => (q.includes("zen.dq.spamhaus.net") ? a("127.0.0.2") : nx()));
    const r = await checkBlacklist("example.com", { dqsKey: "testkey" });
    expect(r.notChecked).toBeFalsy();
    expect(r.score).toBe(0);
    expect(r.status).toContain("vermeld");
    expect(r.records).toContain("Spamhaus ZEN");
  });
});
