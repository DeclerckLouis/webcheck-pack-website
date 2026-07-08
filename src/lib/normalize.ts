/**
 * Normalize any user input (full URL, www., bare host) to its root domain —
 * a faithful port of `strip_to_root()` from the reference script (Annex A):
 * drop scheme, path, query and port, lowercase, then keep the last two labels.
 *
 * KNOWN LIMITATION (documented in README): the last-two-labels rule is wrong for
 * compound TLDs like `example.co.uk` (would yield `co.uk`). It's correct for the
 * target audience's `.be` / `.com` / `.nl` domains. A public-suffix list is the
 * proper fix if compound TLDs ever matter — kept simple for v1, matching the
 * reference logic Louis already tested.
 */
export function normalizeDomain(input: string): string | null {
  let raw = (input ?? "").trim().toLowerCase();
  if (!raw) return null;

  // Strip scheme.
  raw = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  // Strip credentials (user:pass@).
  raw = raw.replace(/^[^/@]*@/, "");
  // Cut at first path / query / fragment.
  raw = raw.split(/[/?#]/, 1)[0];
  // Strip port.
  raw = raw.split(":", 1)[0];
  // Strip a trailing dot (fully-qualified form).
  raw = raw.replace(/\.$/, "");

  if (!raw || !raw.includes(".")) return null;
  // Reject anything with characters that can't appear in a hostname.
  if (!/^[a-z0-9.-]+$/.test(raw)) return null;

  const labels = raw.split(".").filter(Boolean);
  if (labels.length < 2) return null;

  // Keep the last two labels (root domain), matching the reference script.
  const root = labels.slice(-2).join(".");

  // Final sanity: each label 1–63 chars, no leading/trailing hyphen.
  for (const label of root.split(".")) {
    if (label.length < 1 || label.length > 63) return null;
    if (label.startsWith("-") || label.endsWith("-")) return null;
  }
  return root;
}
