import { describe, it, expect } from "vitest";
import { normalizeDomain } from "../src/lib/normalize";

describe("normalizeDomain (port of strip_to_root)", () => {
  it("normalizes full URLs, www, and bare domains to the same root", () => {
    expect(normalizeDomain("https://example.be/")).toBe("example.be");
    expect(normalizeDomain("www.example.be")).toBe("example.be");
    expect(normalizeDomain("example.be")).toBe("example.be");
    expect(normalizeDomain("http://www.example.be/path?q=1#x")).toBe("example.be");
  });

  it("strips scheme, port, credentials and trailing dot", () => {
    expect(normalizeDomain("https://user:pass@example.be:8443/x")).toBe("example.be");
    expect(normalizeDomain("example.be.")).toBe("example.be");
  });

  it("lowercases and trims", () => {
    expect(normalizeDomain("  EXAMPLE.BE  ")).toBe("example.be");
  });

  it("keeps only the last two labels", () => {
    expect(normalizeDomain("mail.sub.example.com")).toBe("example.com");
  });

  it("rejects junk and single-label input", () => {
    expect(normalizeDomain("")).toBeNull();
    expect(normalizeDomain("localhost")).toBeNull();
    expect(normalizeDomain("not a domain")).toBeNull();
    expect(normalizeDomain("http://")).toBeNull();
  });
});
