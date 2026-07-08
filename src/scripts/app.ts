/**
 * Client state machine for the domain scan:
 *   idle → loading → summary (teaser) → [email gate] → full report
 *
 * Keeps everything the server already computed: the summary carries a checkId,
 * and unlocking just POSTs the email + checkId to /api/unlock, which returns the
 * full report from cache (no re-run — brief §7). Vanilla TS, no framework, so the
 * results view stays snappy on a phone at a networking breakfast (brief §7).
 */
type Light = "green" | "orange" | "red";

interface SummaryCategory {
  id: string;
  label: string;
  score: number;
  max: number;
  color: Light;
}
interface Summary {
  domain: string;
  total: number;
  max: number;
  color: Light;
  categories: SummaryCategory[];
  checkId: string;
  cached: boolean;
  generatedAt: string;
}
interface ReportCategory extends SummaryCategory {
  status: string;
  detail: string;
  records?: string[];
  caveat?: string;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T | null;

const API_BASE = document.body.dataset.apiBase || "/";
const api = (path: string) => `${API_BASE}${path}`.replace(/\/{2,}/g, "/");

const COLOR_VAR: Record<Light, string> = {
  green: "var(--color-score-green)",
  orange: "var(--color-score-orange)",
  red: "var(--color-score-red)",
};
const COLOR_SOFT: Record<Light, string> = {
  green: "var(--color-score-green-soft)",
  orange: "var(--color-score-orange-soft)",
  red: "var(--color-score-red-soft)",
};
const HEADLINE: Record<Light, string> = {
  green: "Goed bezig — uw domein is grotendeels in orde.",
  orange: "Er is ruimte voor verbetering.",
  red: "Er zijn belangrijke problemen die aandacht vragen.",
};

const RING_CIRCUMFERENCE = 2 * Math.PI * 58;

function esc(s: string): string {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function setError(el: HTMLElement | null, msg: string) {
  if (el) el.textContent = msg;
}

function drawRing(total: number, max: number, color: Light) {
  const arc = $("score-arc") as unknown as SVGCircleElement | null;
  if (!arc) return;
  const pct = max > 0 ? total / max : 0;
  arc.style.stroke = COLOR_VAR[color];
  arc.setAttribute("stroke-dasharray", String(RING_CIRCUMFERENCE));
  arc.setAttribute(
    "stroke-dashoffset",
    String(RING_CIRCUMFERENCE * (1 - pct)),
  );

  // Center number (added once).
  let label = $("score-number");
  if (!label) {
    const svg = $("score-ring");
    const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.setAttribute("id", "score-number");
    t.setAttribute("x", "66");
    t.setAttribute("y", "66");
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("dominant-baseline", "central");
    t.setAttribute("font-size", "30");
    t.setAttribute("font-weight", "700");
    t.setAttribute("class", "tabular");
    svg?.appendChild(t);
    label = t as unknown as HTMLElement;
  }
  label.textContent = String(total);
  (label as unknown as SVGTextElement).style.fill = COLOR_VAR[color];
}

function renderCategoryBar(c: SummaryCategory): string {
  const pct = c.max > 0 ? Math.round((c.score / c.max) * 100) : 0;
  return `
    <div class="bg-white rounded-xl border border-[color:var(--color-line)] p-4">
      <div class="flex items-center justify-between gap-3">
        <span class="font-medium">${esc(c.label)}</span>
        <span class="tabular text-sm text-[color:var(--color-muted)]">${c.score}/${c.max}</span>
      </div>
      <div class="mt-2 h-2.5 rounded-full overflow-hidden" style="background:${COLOR_SOFT[c.color]}">
        <div class="h-full rounded-full" style="width:${pct}%;background:${COLOR_VAR[c.color]}"></div>
      </div>
    </div>`;
}

function renderSummary(s: Summary) {
  ($("result-domain") as HTMLElement).textContent = s.domain;
  ($("result-headline") as HTMLElement).textContent = HEADLINE[s.color];

  const cachedEl = $("result-cached");
  if (cachedEl) {
    if (s.cached) {
      cachedEl.textContent = "Recent resultaat (uit cache).";
      cachedEl.classList.remove("hidden");
    } else {
      cachedEl.classList.add("hidden");
    }
  }

  drawRing(s.total, s.max, s.color);

  const cats = $("categories");
  if (cats) cats.innerHTML = s.categories.map(renderCategoryBar).join("");

  ($("check-id") as HTMLInputElement).value = s.checkId;

  $("results")?.classList.remove("hidden");
  $("report")?.classList.add("hidden");
  $("report")!.innerHTML = "";
  $("gate")?.classList.remove("hidden");
}

function renderReport(categories: ReportCategory[]) {
  const report = $("report");
  if (!report) return;
  report.innerHTML = categories
    .map((c) => {
      const records = c.records?.length
        ? `<ul class="mt-2 text-sm text-[color:var(--color-muted)] list-disc pl-5 space-y-0.5">${c.records
            .map((r) => `<li>${esc(r)}</li>`)
            .join("")}</ul>`
        : "";
      const caveat = c.caveat
        ? `<p class="mt-2 text-sm rounded-lg px-3 py-2" style="background:var(--color-score-orange-soft);color:var(--color-accent-deep)">ⓘ ${esc(
            c.caveat,
          )}</p>`
        : "";
      return `
      <div class="bg-white rounded-xl border border-[color:var(--color-line)] p-4">
        <div class="flex items-center justify-between gap-3">
          <span class="font-medium">${esc(c.label)}</span>
          <span class="text-sm font-medium" style="color:${COLOR_VAR[c.color]}">${esc(c.status)} · ${c.score}/${c.max}</span>
        </div>
        <p class="mt-1.5 text-[color:var(--color-muted)]">${esc(c.detail)}</p>
        ${records}
        ${caveat}
      </div>`;
    })
    .join("");
  report.classList.remove("hidden");
  $("gate")?.classList.add("hidden");
}

function show(el: string, on: boolean) {
  $(el)?.classList.toggle("hidden", !on);
}

function reset() {
  $("results")?.classList.add("hidden");
  show("loading", false);
  setError($("form-error"), "");
  setError($("gate-error"), "");
  const input = $("domain-input") as HTMLInputElement | null;
  if (input) {
    input.value = "";
    input.focus();
  }
}

async function runScan(domain: string) {
  setError($("form-error"), "");
  $("results")?.classList.add("hidden");
  show("loading", true);
  const submit = $("scan-submit") as HTMLButtonElement | null;
  if (submit) submit.disabled = true;

  try {
    const res = await fetch(api("api/check"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ domain, mode: "general" }),
    });
    const data = (await res.json()) as Summary & { error?: string };
    if (!res.ok) {
      setError($("form-error"), data.error ?? "Er ging iets mis. Probeer opnieuw.");
      return;
    }
    renderSummary(data);
    $("results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch {
    setError($("form-error"), "Kon geen verbinding maken. Probeer het later opnieuw.");
  } finally {
    show("loading", false);
    if (submit) submit.disabled = false;
  }
}

async function unlock(checkId: string) {
  const btn = $("gate-submit") as HTMLButtonElement | null;
  setError($("gate-error"), "");
  if (btn) btn.disabled = true;
  try {
    const payload = {
      checkId,
      naam: ($("naam") as HTMLInputElement).value,
      email: ($("email") as HTMLInputElement).value,
      bedrijf: ($("bedrijf") as HTMLInputElement).value,
      telefoon: ($("telefoon") as HTMLInputElement).value,
    };
    const res = await fetch(api("api/unlock"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as {
      error?: string;
      report?: { categories?: ReportCategory[] };
    };
    if (!res.ok) {
      setError($("gate-error"), data.error ?? "Er ging iets mis. Probeer opnieuw.");
      return;
    }
    renderReport(data.report?.categories ?? []);
    $("report")?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch {
    setError($("gate-error"), "Kon geen verbinding maken. Probeer het later opnieuw.");
  } finally {
    if (btn) btn.disabled = false;
  }
}

// --- wire up ----------------------------------------------------------------
$("scan-form")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const value = ($("domain-input") as HTMLInputElement).value.trim();
  if (!value) {
    setError($("form-error"), "Voer een domein in.");
    return;
  }
  runScan(value);
});

$("gate-form")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const checkId = ($("check-id") as HTMLInputElement).value;
  unlock(checkId);
});

$("reset")?.addEventListener("click", (e) => {
  e.preventDefault();
  reset();
  window.scrollTo({ top: 0, behavior: "smooth" });
});
