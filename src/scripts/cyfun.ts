/**
 * CyFun Basic zelfevaluatie — client island (brief). A five-step state machine,
 * ported from the reference prototype:
 *
 *   domein → toepassingsgebied (scope) → domeinscan → vragenlijst → resultaat
 *
 * Vanilla TS, no framework, all state in memory (no localStorage/sessionStorage).
 * Two integration points are wired to the real backend:
 *   [A] the domeinscan reuses the existing scan Worker (POST /api/check);
 *   [B] the lead gate posts to /api/cyfun-lead → the shared Odoo crm.lead flow.
 */
import {
  MODEL,
  SECTORS,
  SIZES,
  KEY_TOTAL,
  TOTAL_CONTROLS,
} from "../config/cyfun";
import {
  classifyScope,
  scoreAssessment,
  type Answer,
  type ScopeResult,
} from "../lib/cyfun";
import { resolvePartner } from "./partner";

const API_BASE = document.body.dataset.apiBase || "/";
const api = (path: string) => `${API_BASE}${path}`.replace(/\/{2,}/g, "/");

/** Escape user-supplied strings (the domain) before injecting into innerHTML. */
function esc(s: string): string {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

// --- Turnstile (optional — only present when a sitekey is configured) --------
declare const turnstile:
  | { getResponse: (id?: string) => string | undefined; reset: (id?: string) => void }
  | undefined;

function turnstileToken(): string | undefined {
  if (typeof turnstile !== "undefined") {
    const t = turnstile.getResponse();
    if (t) return t;
  }
  const input = document.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]');
  return input?.value || undefined;
}
function resetTurnstile() {
  if (typeof turnstile !== "undefined") turnstile.reset();
}

// --- scan result shape (mapped from the Worker's category summary) -----------
type ScanState = "pass" | "warn" | "fail" | "unknown";
interface ScanResult {
  spf: ScanState;
  dmarc: ScanState;
  dnssec: ScanState;
  mx: ScanState;
  /** SPF + DMARC both present (green/orange) → seed the PR.PS-05 pre-fill. */
  mailAuthPresent: boolean;
  /** False when the Worker call failed/timed out → answer the rows manually. */
  reachable: boolean;
}

interface SummaryCategory {
  id: string;
  color: "green" | "orange" | "red" | "grey";
  notChecked?: boolean;
}

/**
 * [A] Domeinscan via the existing Worker. Maps the public category summary
 * (color per category) onto the four externally-observable CyFun rows. Never
 * throws: on any failure it returns `reachable:false` so the wizard continues
 * and the user answers the affected controls by hand (brief graceful degrade).
 */
async function runScan(domain: string): Promise<ScanResult> {
  const fail: ScanResult = {
    spf: "unknown",
    dmarc: "unknown",
    dnssec: "unknown",
    mx: "unknown",
    mailAuthPresent: false,
    reachable: false,
  };

  const map = (c?: SummaryCategory): ScanState => {
    if (!c || c.notChecked || c.color === "grey") return "unknown";
    if (c.color === "green") return "pass";
    if (c.color === "orange") return "warn";
    return "fail";
  };
  // "Present" = a record exists in some form (full or partial credit). We can't
  // distinguish a weak-but-present DMARC (p=none, scores red) from a missing one
  // with the public summary alone, so the pre-fill errs conservative — it only
  // fires on green/orange, and it's always labelled "bevestig" either way.
  const present = (c?: SummaryCategory) => !!c && (c.color === "green" || c.color === "orange");

  try {
    const res = await fetch(api("api/check"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ domain, mode: "general", turnstileToken: turnstileToken() }),
    });
    if (!res.ok) return fail;
    const data = (await res.json()) as { categories?: SummaryCategory[] };
    const by: Record<string, SummaryCategory> = {};
    for (const c of data.categories ?? []) by[c.id] = c;
    return {
      spf: map(by.spf),
      dmarc: map(by.dmarc),
      dnssec: map(by.dnssec),
      mx: map(by.mx),
      mailAuthPresent: present(by.spf) && present(by.dmarc),
      reachable: true,
    };
  } catch {
    return fail;
  } finally {
    resetTurnstile();
  }
}

// --- app state ---------------------------------------------------------------
interface AppState {
  step: (typeof STEPS)[number];
  domain: string;
  scope: ScopeResult | null;
  scan: ScanResult | null;
  answers: Record<string, Answer>;
}
const STEPS = ["domein", "scope", "scan", "vragen", "resultaat"] as const;
const S: AppState = { step: "domein", domain: "", scope: null, scan: null, answers: {} };

const app = document.getElementById("app")!;
const packet = document.getElementById("packet")!;

function paintPacket() {
  const i = STEPS.indexOf(S.step);
  [...packet.children].forEach((elm, n) => {
    (elm as HTMLElement).className = n < i ? "done" : n === i ? "now" : "";
  });
}
function go(step: AppState["step"]) {
  S.step = step;
  render();
  window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
}
function el(html: string): HTMLElement {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

function render() {
  paintPacket();
  if (S.step === "domein") return renderDomein();
  if (S.step === "scope") return renderScope();
  if (S.step === "scan") return renderScan();
  if (S.step === "vragen") return renderVragen();
  return renderResultaat();
}

// --- step: domein ------------------------------------------------------------
function renderDomein() {
  app.replaceChildren(
    el(`
  <section class="card fade">
    <p class="eyebrow">Gratis check · ± 6 minuten</p>
    <h1>Hoe cyberweerbaar is uw organisatie?</h1>
    <p class="lede">Deze zelfevaluatie loopt de 34 maatregelen van het CyberFundamentals-kader (niveau <b>Basic</b>) van het Centrum voor Cybersecurity België af, en scant uw domein op enkele objectieve beveiligingspunten. U krijgt meteen een score per domein — geen verplichting.</p>
    <div class="row">
      <label class="field" for="dom">Uw domeinnaam</label>
      <input type="text" id="dom" inputmode="url" placeholder="bedrijf.be" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(S.domain)}">
      <p class="hint">We gebruiken dit voor de domeinscan. Zonder http:// of www.</p>
    </div>
    <div class="actions"><button class="btn" id="next">Start de check</button></div>
    <p class="disclaimer">Dit is een <b>indicatieve zelfevaluatie</b>, geen officiële CyFun-verificatie. Een erkend CyFun Basic-attest wordt afgeleverd door een geaccrediteerde instantie (CAB). De uitkomst geeft uw <i>startpositie</i> weer, niet uw verzekerbaarheid of conformiteit.</p>
  </section>`),
  );
  const inp = app.querySelector<HTMLInputElement>("#dom")!;
  const btn = app.querySelector<HTMLButtonElement>("#next")!;
  const clean = (v: string) =>
    v.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  const valid = (v: string) => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(v);
  inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter") btn.click();
  });
  btn.addEventListener("click", () => {
    const d = clean(inp.value);
    if (!valid(d)) {
      inp.focus();
      inp.style.borderColor = "var(--bad)";
      return;
    }
    S.domain = d;
    go("scope");
  });
  inp.focus();
}

// --- step: scope triage ------------------------------------------------------
function renderScope() {
  app.replaceChildren(
    el(`
  <section class="card fade">
    <p class="eyebrow">Stap 1 · Toepassingsgebied</p>
    <h1>Moet ${esc(S.domain)} aan CyFun voldoen?</h1>
    <p class="lede">De NIS2-wetgeving verplicht sommige organisaties tot een cybersecurity-kader. We bepalen indicatief of <b>Basic</b> voor u het juiste niveau is.</p>
    <div class="row">
      <label class="field" for="sector">In welke sector bent u actief?</label>
      <select id="sector">${SECTORS.map((s) => `<option value="${s.v}">${s.t}</option>`).join("")}</select>
    </div>
    <div class="row">
      <label class="field" for="size">Hoe groot is uw organisatie?</label>
      <select id="size">${SIZES.map((s) => `<option value="${s.v}">${s.t}</option>`).join("")}</select>
    </div>
    <div class="row">
      <label class="field checkline"><input type="checkbox" id="supply">Grotere klanten of partners vragen bewijs van uw beveiliging</label>
      <p class="hint">Leveranciers van NIS2-bedrijven wordt aangeraden minstens CyFun Basic te halen.</p>
    </div>
    <div id="verdict"></div>
    <div class="actions">
      <button class="btn ghost" id="back">← Terug</button>
      <button class="btn" id="check">Bepaal niveau</button>
    </div>
    <p class="disclaimer">Indicatief, niet de officiële CyFun Selection Tool. Bepaal uw exacte verplichting via de scope-test op <a href="https://www.safeonweb.be/nl/nis2" target="_blank" rel="noopener">safeonweb.be/nl/nis2</a>.</p>
  </section>`),
  );
  app.querySelector<HTMLButtonElement>("#back")!.onclick = () => go("domein");
  const vd = app.querySelector<HTMLElement>("#verdict")!;
  app.querySelector<HTMLButtonElement>("#check")!.onclick = () => {
    const sector = app.querySelector<HTMLSelectElement>("#sector")!.value;
    const size = app.querySelector<HTMLSelectElement>("#size")!.value;
    const supply = app.querySelector<HTMLInputElement>("#supply")!.checked;
    const r = classifyScope(sector, size, supply);
    S.scope = r;
    if (!r.fit) {
      vd.innerHTML = `<div class="verdict stop">
        <h2>Waarschijnlijk een NIS2-${r.level === "Essential" ? "essentiële" : "belangrijke"} entiteit</h2>
        <p>Dan geldt voor u het niveau <b>CyFun ${r.level === "Essential" ? "Essential" : "Important"}</b> (132–217 maatregelen) mét verificatie door een geaccrediteerde instantie. Dat valt buiten deze Basic-zelfevaluatie. PacketFlow richt zich op Basic — voor Important/Essential verwijzen we u graag door naar een gespecialiseerde partner.</p>
      </div>
      <div class="actions"><button class="btn secondary" id="cont">Toch de Basic-check bekijken →</button></div>`;
      vd.querySelector<HTMLButtonElement>("#cont")!.onclick = () => go("scan");
    } else {
      vd.innerHTML = `<div class="verdict go">
        <h2>CyFun Basic is voor u het juiste niveau</h2>
        <p>${r.viaSupply ? "Als leverancier in een NIS2-keten is Basic sterk aangeraden. " : "U valt niet rechtstreeks onder de NIS2-verplichting, maar Basic is dé aangewezen startbasis. "}Deze check loopt de 34 Basic-maatregelen met u door.</p>
      </div><div class="actions"><button class="btn" id="cont">Verder naar de domeinscan →</button></div>`;
      vd.querySelector<HTMLButtonElement>("#cont")!.onclick = () => go("scan");
    }
  };
}

// --- step: domeinscan --------------------------------------------------------
function renderScan() {
  app.replaceChildren(
    el(`
  <section class="card fade">
    <p class="eyebrow">Stap 2 · Domeinscan</p>
    <h1>Objectieve controle van ${esc(S.domain)}</h1>
    <p class="lede">Enkele CyFun-punten zijn van buitenaf meetbaar. De rest van het kader gaat over interne processen en beantwoordt u zelf in de volgende stap.</p>
    <div id="scanbody"><p class="muted scanloading"><span class="spin" aria-hidden="true"></span> Domein wordt gescand…</p></div>
    <div class="actions hidden" id="scanact"><button class="btn" id="toq">Verder naar de vragenlijst →</button></div>
    <p class="disclaimer">De scan verifieert e-mailauthenticatie (SPF, DMARC), DNSSEC en mailconfiguratie. Blacklist- en DKIM-controles vergen extra context en gebeuren in het volledige rapport.</p>
  </section>`),
  );
  runScan(S.domain).then((res) => {
    S.scan = res;
    const rows: [string, string, keyof ScanResult, string][] = [
      ["SPF", "PR.PS-05", "spf", "E-mailvervalsing tegengaan (afzenderbeleid)"],
      ["DMARC", "PR.PS-05", "dmarc", "Beleid tegen phishing met uw domein"],
      ["DNSSEC", "PR.IR-01", "dnssec", "Beveiliging van DNS-antwoorden"],
      ["MX / mailconfiguratie", "ID.AM-02", "mx", "Aanwezigheid en opzet van mailservers"],
    ];
    const pill = (v: ScanState) =>
      v === "pass"
        ? `<span class="pill ok">In orde</span>`
        : v === "warn"
          ? `<span class="pill warn">Deels in orde</span>`
          : v === "fail"
            ? `<span class="pill bad">Ontbreekt</span>`
            : `<span class="pill na">Onbekend</span>`;
    const body = app.querySelector<HTMLElement>("#scanbody")!;
    body.innerHTML =
      (!res.reachable
        ? `<p class="autofill">De domeinscan kon nu niet worden uitgevoerd. Geen probleem — u beantwoordt de betrokken punten gewoon zelf in de vragenlijst.</p>`
        : "") +
      rows
        .map(
          ([n, c, k, d]) =>
            `<div class="scanrow"><div class="name">${n} <code>${c} · ${d}</code></div>${pill(res[k] as ScanState)}</div>`,
        )
        .join("");
    app.querySelector<HTMLButtonElement>("#scanact")!.classList.remove("hidden");
    app.querySelector<HTMLButtonElement>("#toq")!.onclick = () => go("vragen");
  });
}

// --- step: vragenlijst -------------------------------------------------------
function answeredCount() {
  return Object.keys(S.answers).length;
}

function renderVragen() {
  // Pre-fill suggestion from the scan (confirm, don't assume): SPF + DMARC
  // present → seed PR.PS-05 (web/e-mailfilters) as "Deels".
  const scanMailOk = !!S.scan && S.scan.mailAuthPresent;

  app.replaceChildren(
    el(`
  <section class="fade">
    <div class="card">
      <p class="eyebrow">Stap 3 · Vragenlijst</p>
      <h1>De 34 Basic-maatregelen</h1>
      <p class="lede">Antwoord eerlijk — een “ja” die niet klopt, helpt u niet. <b>Sleutelmaatregelen</b> zijn verplicht op Basic-niveau en wegen zwaarder.</p>
      <nav class="fn-nav" aria-label="Spring naar functie">
        ${MODEL.map((f) => `<a href="#fn-${f.code}" class="fn-chip">${f.code} · ${f.label}</a>`).join("")}
      </nav>
      ${MODEL.map((f) => sectionFor(f)).join("")}
    </div>
    <div class="sticky">
      <div class="bar">
        <span class="cnt"><b id="cnt">${answeredCount()}</b> / ${TOTAL_CONTROLS} beantwoord</span>
        <button class="btn" id="result" disabled>Bekijk resultaat →</button>
      </div>
    </div>
  </section>`),
  );

  // Register the pre-filled auto answers in state so they count and score.
  if (scanMailOk) {
    MODEL.flatMap((f) => f.controls).forEach((c) => {
      if (c.scan === "mail") S.answers[c.id] = "deels";
    });
  }

  const cnt = app.querySelector<HTMLElement>("#cnt")!;
  const btn = app.querySelector<HTMLButtonElement>("#result")!;
  const sync = () => {
    cnt.textContent = String(answeredCount());
    btn.disabled = answeredCount() < TOTAL_CONTROLS;
  };
  app.querySelectorAll<HTMLInputElement>('input[type=radio]').forEach((r) => {
    r.addEventListener("change", (e) => {
      const t = e.target as HTMLInputElement;
      S.answers[t.name] = t.value as Answer;
      sync();
    });
  });
  sync();
  btn.addEventListener("click", () => go("resultaat"));
}

/** Render one function's heading + its controls. */
function sectionFor(f: (typeof MODEL)[number]): string {
  const scanMailOk = !!S.scan && S.scan.mailAuthPresent;
  return `
    <div class="fn-head" id="fn-${f.code}"><span class="code">${f.code}</span><h2>${f.label}</h2></div>
    <p class="fn-sub">${f.sub}</p>
    ${f.controls
      .map((c) => {
        const auto = c.scan === "mail" && scanMailOk;
        const opts = (
          [
            ["ja", "Ja"],
            ["deels", "Deels"],
            ["nee", "Nee"],
            ["nvt", "N.v.t."],
          ] as const
        )
          .map(
            ([v, t]) =>
              `<label class="opt" data-v="${v}"><input type="radio" name="${c.id}" value="${v}" ${auto && v === "deels" ? "checked" : ""}><span>${t}</span></label>`,
          )
          .join("");
        return `<div class="q" data-id="${c.id}">
        <p class="qtext">${c.key ? '<span class="key">sleutel</span>' : ""}<span>${c.q}</span></p>
        <p class="qcode">${c.id}</p>
        <p class="qhelp">${c.help}</p>
        ${auto ? `<span class="autofill">Auto-gedetecteerd — SPF + DMARC aanwezig. Voorstel: “Deels”. Bevestig gerust.</span>` : ""}
        <div class="opts">${opts}</div>
      </div>`;
      })
      .join("")}
  `;
}

// --- results -----------------------------------------------------------------
const scoreColor = (p: number) => (p >= 80 ? "var(--ok)" : p >= 55 ? "var(--warn)" : "var(--bad)");

function renderResultaat() {
  const r = scoreAssessment(S.answers);
  const keyOk = r.keyMet === KEY_TOTAL;
  let verdict: string;
  if (!keyOk) {
    verdict = `Nog niet Basic-klaar — ${KEY_TOTAL - r.keyMet} sleutelmaatregel(en) ontbreken.`;
  } else if (r.overall >= 85) {
    verdict = "Sterke basis. U zit dicht bij CyFun Basic-niveau.";
  } else {
    verdict = "Goede aanzet, met nog enkele werkpunten.";
  }

  const fnbars = MODEL.map((f) => {
    const p = r.perFn[f.code].pct;
    return `<div class="fnbar">
      <div class="top"><span>${f.label} <code>${f.code}</code></span><span>${p === null ? "n.v.t." : p + "%"}</span></div>
      <div class="track"><i style="width:${p || 0}%;background:${scoreColor(p || 0)}"></i></div>
    </div>`;
  }).join("");

  const gapItems = r.gaps.length
    ? r.gaps
        .map(
          (g) => `
    <div class="gap">
      <span class="mark ${g.a}"></span>
      <div>
        <p class="g-t">${g.q}${g.key ? '<span class="key">sleutel</span>' : ""}</p>
        <p class="g-c">${g.id} · ${g.fn}</p>
        <p class="g-h">${g.help}</p>
      </div>
    </div>`,
        )
        .join("")
    : `<p class="muted">Geen openstaande punten — knap resultaat.</p>`;

  const canEngage = !!S.scope && S.scope.fit;

  app.replaceChildren(
    el(`
  <section class="fade">
    <div class="card">
      <p class="eyebrow">Resultaat · ${esc(S.domain)}</p>
      <div class="score-hero">
        <div class="ring" style="--p:${r.overall};--rc:${scoreColor(r.overall)}"><b>${r.overall}<small>/100</small></b></div>
        <div class="txt">
          <h1 style="margin-bottom:6px">${verdict}</h1>
          <div class="keymeas ${keyOk ? "ok" : "bad"}">${keyOk ? "✓" : "!"} Sleutelmaatregelen: ${r.keyMet}/${KEY_TOTAL} volledig in orde</div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <h2>Overzicht per functie</h2>
      <p class="fn-sub">De zes kernfuncties van het CyberFundamentals-kader.</p>
      ${fnbars}
    </div>

    <div class="card" style="margin-top:16px">
      <h2>Uw werkpunten (${r.gaps.length})</h2>
      <p class="fn-sub">Gerangschikt op prioriteit — sleutelmaatregelen eerst.</p>
      ${gapItems}
    </div>

    ${
      canEngage
        ? `
    <div class="gate">
      <h2>Ontvang het volledige rapport + stappenplan</h2>
      <p>We sturen u een gedetailleerd rapport met per werkpunt een concrete oplossing, plus een prioritair stappenplan richting CyFun Basic.</p>
      <div class="row"><input type="email" id="lead" placeholder="naam@bedrijf.be" autocomplete="email"></div>
      <label class="consent"><input type="checkbox" id="consent">
        Ik ga akkoord dat PacketFlow mijn e-mailadres gebruikt om mij dit rapport en gerelateerde informatie te bezorgen. Meer info in de <a href="https://www.packetflow.be/privacy" target="_blank" rel="noopener">privacyverklaring</a>.</label>
      <div class="actions"><button class="btn" id="send" disabled>Stuur mijn rapport</button></div>
      <p id="leadmsg" class="gate-msg" role="status"></p>
    </div>`
        : `
    <div class="card" style="margin-top:16px">
      <h2>Volgende stap</h2>
      <p class="fn-sub">Op basis van uw toepassingsgebied heeft u een hoger niveau nodig dan Basic. Neem contact op met een op NIS2 Important/Essential gespecialiseerde partner voor een verificatietraject.</p>
    </div>`
    }

    <div class="actions"><button class="btn ghost" id="restart">↺ Opnieuw beginnen</button></div>
    <p class="disclaimer">Indicatieve zelfevaluatie op basis van CCB CyberFundamentals 2025 (Basic). Geen officiële CyFun-verificatie en geen garantie op conformiteit of verzekerbaarheid. Een erkend attest vereist een geaccrediteerde instantie (CAB).</p>
  </section>`),
  );

  app.querySelector<HTMLButtonElement>("#restart")!.onclick = () => {
    S.answers = {};
    S.scan = null;
    S.scope = null;
    go("domein");
  };

  if (canEngage) {
    const email = app.querySelector<HTMLInputElement>("#lead")!;
    const consent = app.querySelector<HTMLInputElement>("#consent")!;
    const send = app.querySelector<HTMLButtonElement>("#send")!;
    const msg = app.querySelector<HTMLElement>("#leadmsg")!;
    const ok = () => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value) && consent.checked;
    const sync = () => (send.disabled = !ok());
    email.addEventListener("input", sync);
    consent.addEventListener("change", sync);
    send.addEventListener("click", () =>
      submitLead(
        {
          domain: S.domain,
          email: email.value.trim(),
          score: r.overall,
          keyMet: r.keyMet,
          keyTotal: KEY_TOTAL,
          scopeLevel: S.scope?.level ?? "Basic",
          scopeFit: S.scope?.fit ?? true,
          gaps: r.gaps.map((g) => g.id),
          consent: true,
          consentAt: new Date().toISOString(),
          via: resolvePartner()?.slug,
        },
        msg,
        send,
      ),
    );
  }
}

// --- [B] lead capture → /api/cyfun-lead → shared Odoo crm.lead flow ----------
interface LeadPayload {
  domain: string;
  email: string;
  score: number;
  keyMet: number;
  keyTotal: number;
  scopeLevel: string;
  scopeFit: boolean;
  gaps: string[];
  consent: boolean;
  consentAt: string;
  via?: string;
}

async function submitLead(payload: LeadPayload, msgEl: HTMLElement, btn: HTMLButtonElement) {
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = "Versturen…";
  msgEl.textContent = "";
  try {
    const res = await fetch(api("api/cyfun-lead"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, turnstileToken: turnstileToken() }),
    });
    const data = (await res.json()) as { error?: string; leadStored?: boolean; leadError?: string };
    if (!res.ok) {
      btn.disabled = false;
      btn.textContent = original;
      msgEl.textContent = data.error ?? "Er ging iets mis bij het versturen. Probeer het later opnieuw.";
      return;
    }
    if (data.leadStored === false) console.warn("CyFun lead not stored in Odoo:", data.leadError);
    msgEl.textContent = `Bedankt — we sturen het rapport naar ${payload.email}.`;
    btn.textContent = "Verzonden ✓";
  } catch {
    btn.disabled = false;
    btn.textContent = original;
    msgEl.textContent = "Kon geen verbinding maken. Probeer het later opnieuw.";
  } finally {
    resetTurnstile();
  }
}

render();
