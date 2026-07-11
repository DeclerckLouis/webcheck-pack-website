/**
 * "Cyberveilig in 2 minuten" — client island (brief + Louis' feedback: keep it
 * short, light and understandable, not a 34-question exam). A four-step flow:
 *
 *   domein → domeinscan → korte check (7 vragen, één scroll) → resultaat
 *
 * Vanilla TS, no framework, all state in memory (no localStorage/sessionStorage).
 * Two integration points reuse the real backend:
 *   [A] the domeinscan reuses the existing scan Worker (POST /api/check);
 *   [B] the lead gate posts to /api/cyfun-lead → the shared Odoo crm.lead flow.
 */
import { QUESTIONS, SCOPE_CHOICES, TOTAL_QUESTIONS } from "../config/cyfun";
import { classifyScope, scoreQuiz, type Answer, type ScopeResult } from "../lib/cyfun";
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

// --- scan result (mapped from the Worker's category summary) -----------------
type ScanState = "pass" | "warn" | "fail" | "unknown";
interface ScanResult {
  spf: ScanState;
  dmarc: ScanState;
  dnssec: ScanState;
  mx: ScanState;
  /** SPF + DMARC both present → e-mail is protected against spoofing. */
  mailProtected: boolean;
  /** False when the Worker call failed/timed out. */
  reachable: boolean;
}

interface SummaryCategory {
  id: string;
  color: "green" | "orange" | "red" | "grey";
  notChecked?: boolean;
}

/**
 * [A] Domeinscan via the existing Worker. Maps the public category summary onto
 * the four externally-observable rows. Never throws: on any failure it returns
 * `reachable:false` so the flow continues (brief: graceful degradation; a
 * Spamhaus error must never block).
 */
async function runScan(domain: string): Promise<ScanResult> {
  const fail: ScanResult = {
    spf: "unknown",
    dmarc: "unknown",
    dnssec: "unknown",
    mx: "unknown",
    mailProtected: false,
    reachable: false,
  };
  const map = (c?: SummaryCategory): ScanState => {
    if (!c || c.notChecked || c.color === "grey") return "unknown";
    if (c.color === "green") return "pass";
    if (c.color === "orange") return "warn";
    return "fail";
  };
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
      mailProtected: map(by.spf) === "pass" && map(by.dmarc) === "pass",
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
  scan: ScanResult | null;
  scope: ScopeResult;
  answers: Record<string, Answer>;
}
const STEPS = ["domein", "scan", "check", "resultaat"] as const;
const S: AppState = {
  step: "domein",
  domain: "",
  scan: null,
  scope: { choice: "", fit: true },
  answers: {},
};

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
  if (S.step === "scan") return renderScan();
  if (S.step === "check") return renderCheck();
  return renderResultaat();
}

// --- step: domein ------------------------------------------------------------
function renderDomein() {
  app.replaceChildren(
    el(`
  <section class="card fade">
    <p class="eyebrow">Gratis · klaar in 2 minuten</p>
    <h1>Hoe cyberveilig is uw zaak?</h1>
    <p class="lede">Doe de snelle check. We scannen eerst uw domein, daarna stellen we zeven korte vragen in gewone taal. U krijgt meteen een duidelijk beeld en concrete tips — geen jargon, geen verplichting.</p>
    <div class="row">
      <label class="field" for="dom">Uw domeinnaam</label>
      <input type="text" id="dom" inputmode="url" placeholder="bedrijf.be" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(S.domain)}">
      <p class="hint">Zonder http:// of www. — we gebruiken dit alleen voor de domeinscan.</p>
    </div>
    <div class="actions"><button class="btn" id="next">Start de check →</button></div>
    <p class="disclaimer">Dit is een <b>indicatieve zelfevaluatie</b> op basis van het CyberFundamentals-kader (niveau Basic) van het CCB — geen officiële CyFun-verificatie. De uitkomst toont uw <i>startpositie</i>, niet uw conformiteit of verzekerbaarheid. Een erkend attest komt van een geaccrediteerde instantie (CAB).</p>
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
    go("scan");
  });
  inp.focus();
}

// --- step: domeinscan --------------------------------------------------------
function renderScan() {
  app.replaceChildren(
    el(`
  <section class="card fade">
    <p class="eyebrow">Stap 1 · Domeinscan</p>
    <h1>We kijken even naar ${esc(S.domain)}</h1>
    <p class="lede">Enkele dingen kunnen we zelf al controleren, van buitenaf. De rest vragen we u zo meteen.</p>
    <div id="scanbody"><p class="muted scanloading"><span class="spin" aria-hidden="true"></span> Even kijken…</p></div>
    <div class="actions hidden" id="scanact"><button class="btn" id="toq">Verder naar de vragen →</button></div>
  </section>`),
  );
  runScan(S.domain).then((res) => {
    S.scan = res;
    const rows: [string, keyof ScanResult, string][] = [
      ["Bescherming tegen e-mailvervalsing", "spf", "Kan iemand mailen alsof hij u is? (SPF)"],
      ["Beleid tegen vervalste e-mail", "dmarc", "Wat gebeurt er met nep-mail uit uw naam? (DMARC)"],
      ["Beveiligde DNS", "dnssec", "Bescherming tegen omleiden van uw domein (DNSSEC)"],
      ["E-mail correct ingesteld", "mx", "Wijzen uw mailservers goed? (MX)"],
    ];
    const pill = (v: ScanState) =>
      v === "pass"
        ? `<span class="pill ok">In orde</span>`
        : v === "warn"
          ? `<span class="pill warn">Kan beter</span>`
          : v === "fail"
            ? `<span class="pill bad">Niet in orde</span>`
            : `<span class="pill na">Onbekend</span>`;
    const body = app.querySelector<HTMLElement>("#scanbody")!;
    body.innerHTML =
      (!res.reachable
        ? `<p class="autofill">De domeinscan lukte nu even niet — geen probleem, we gaan gewoon verder met de vragen.</p>`
        : "") +
      rows
        .map(
          ([n, k, d]) =>
            `<div class="scanrow"><div class="name">${n} <code>${d}</code></div>${pill(res[k] as ScanState)}</div>`,
        )
        .join("");
    app.querySelector<HTMLButtonElement>("#scanact")!.classList.remove("hidden");
    app.querySelector<HTMLButtonElement>("#toq")!.onclick = () => go("check");
  });
}

// --- step: korte check (één scroll) -----------------------------------------
function answeredCount() {
  return QUESTIONS.reduce((n, q) => n + (S.answers[q.id] ? 1 : 0), 0);
}

function renderCheck() {
  const opts = (
    [
      ["ja", "Ja"],
      ["nee", "Nee"],
      ["onbekend", "Weet ik niet"],
    ] as const
  );

  const questionCards = QUESTIONS.map(
    (q, i) => `
    <div class="q" data-id="${q.id}">
      <p class="qtext"><span class="qn">${i + 1}</span><span>${q.q}</span>${q.key ? '<span class="key">belangrijk</span>' : ""}</p>
      <div class="opts">
        ${opts.map(([v, t]) => `<label class="opt" data-v="${v}"><input type="radio" name="${q.id}" value="${v}"><span>${t}</span></label>`).join("")}
      </div>
      <p class="fb" id="fb-${q.id}" hidden></p>
    </div>`,
  ).join("");

  app.replaceChildren(
    el(`
  <section class="fade">
    <div class="card">
      <p class="eyebrow">Stap 2 · De check</p>
      <h1>Zeven korte vragen</h1>
      <p class="lede">Antwoord gerust eerlijk — “weet ik niet” is ook een antwoord. U ziet meteen per vraag wat het betekent.</p>

      <div class="scope">
        <p class="scope-q">Even kort: wat past het best bij u?</p>
        ${SCOPE_CHOICES.map((c) => `<label class="scope-opt"><input type="radio" name="scope" value="${c.v}"><span>${c.t}</span></label>`).join("")}
      </div>

      ${questionCards}
    </div>
    <div class="sticky">
      <div class="bar">
        <div class="meter"><div class="meter-fill" id="meter"></div></div>
        <span class="cnt"><b id="cnt">0</b>/${TOTAL_QUESTIONS} beantwoord</span>
        <button class="btn" id="result" disabled>Toon resultaat →</button>
      </div>
    </div>
  </section>`),
  );

  const cnt = app.querySelector<HTMLElement>("#cnt")!;
  const meter = app.querySelector<HTMLElement>("#meter")!;
  const btn = app.querySelector<HTMLButtonElement>("#result")!;
  const sync = () => {
    const done = answeredCount();
    cnt.textContent = String(done);
    meter.style.width = `${Math.round((100 * done) / TOTAL_QUESTIONS)}%`;
    btn.disabled = done < TOTAL_QUESTIONS;
  };

  // Per-question inline feedback (the "useful feedback" Louis missed).
  for (const q of QUESTIONS) {
    const fb = app.querySelector<HTMLElement>(`#fb-${q.id}`)!;
    app.querySelectorAll<HTMLInputElement>(`input[name="${q.id}"]`).forEach((r) => {
      r.addEventListener("change", () => {
        S.answers[q.id] = r.value as Answer;
        if (r.value === "ja") {
          fb.textContent = `✓ ${q.yes}`;
          fb.className = "fb good";
        } else {
          fb.textContent = `→ ${q.fix}`;
          fb.className = "fb work";
        }
        fb.hidden = false;
        sync();
      });
    });
  }

  app.querySelectorAll<HTMLInputElement>('input[name="scope"]').forEach((r) => {
    r.addEventListener("change", () => {
      S.scope = classifyScope(r.value);
    });
  });

  sync();
  btn.addEventListener("click", () => go("resultaat"));
}

// --- step: resultaat ---------------------------------------------------------
const toneColor = (t: "good" | "ok" | "work") =>
  t === "good" ? "var(--ok)" : t === "ok" ? "var(--warn)" : "var(--bad)";

function renderResultaat() {
  const r = scoreQuiz(S.answers);
  const canEngage = S.scope.fit;

  const winItems = r.quickWins.length
    ? r.quickWins
        .map(
          (w) => `
    <div class="win">
      <span class="mark ${w.a}"></span>
      <div>
        <p class="w-t">${w.fix}${w.key ? '<span class="key">belangrijk</span>' : ""}</p>
      </div>
    </div>`,
        )
        .join("")
    : `<p class="muted">Niets op te merken — knap werk. U staat er sterk voor.</p>`;

  // A single friendly line tying the up-front scan to the result.
  const scanLine =
    S.scan && S.scan.reachable
      ? `<p class="scan-note">${
          S.scan.mailProtected
            ? "➕ En uit onze scan: uw e-mail is goed beschermd tegen vervalsing."
            : "➕ En uit onze scan: uw e-mail is nog niet volledig beschermd tegen vervalsing — ook dat pakken we mee."
        }</p>`
      : "";

  app.replaceChildren(
    el(`
  <section class="fade">
    <div class="card">
      <p class="eyebrow">Resultaat · ${esc(S.domain)}</p>
      <div class="score-hero">
        <div class="ring" style="--p:${r.score};--rc:${toneColor(r.tone)}"><b>${r.yesCount}<small>/${r.total}</small></b></div>
        <div class="txt">
          <h1 style="margin-bottom:6px">${r.verdict}</h1>
          <p class="score-sub">${r.yesCount} van ${r.total} basispunten op orde.</p>
          ${scanLine}
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <h2>${r.quickWins.length ? `Uw snelle winsten (${r.quickWins.length})` : "Uw sterke punten"}</h2>
      <p class="fn-sub">${r.quickWins.length ? "Concreet en haalbaar — begin gerust bovenaan." : "Geen openstaande punten gevonden."}</p>
      ${winItems}
    </div>

    ${
      canEngage
        ? `
    <div class="gate">
      <h2>Zin om deze punten weg te werken?</h2>
      <p>Laat uw e-mail achter, dan sturen we u een korte actielijst op maat van uw resultaat — concreet en zonder verkooppraat. Wilt u het liever samen bekijken? Eén bericht en we plannen een kort gesprek.</p>
      <div class="row"><input type="email" id="lead" placeholder="naam@bedrijf.be" autocomplete="email"></div>
      <label class="consent"><input type="checkbox" id="consent">
        Ik ga akkoord dat PacketFlow mijn e-mailadres gebruikt om mij deze actielijst en gerelateerde info te bezorgen. Meer in de <a href="https://www.packetflow.be/privacy" target="_blank" rel="noopener">privacyverklaring</a>.</label>
      <div class="actions"><button class="btn" id="send" disabled>Stuur mij mijn actielijst</button></div>
      <p id="leadmsg" class="gate-msg" role="status"></p>
    </div>`
        : `
    <div class="card" style="margin-top:16px">
      <h2>Voor u ligt de lat wat hoger</h2>
      <p class="fn-sub">U valt waarschijnlijk onder NIS2 als belangrijke of essentiële entiteit — dan geldt een hoger niveau dan Basic, met verificatie door een geaccrediteerde instantie. Deze snelle check blijft nuttig als nulmeting, maar voor uw traject verwijzen we u graag door naar een gespecialiseerde partner. Neem gerust contact op, dan zetten we u op weg.</p>
      <div class="actions"><a class="btn" href="https://www.packetflow.be/contact" target="_blank" rel="noopener">Contacteer ons</a></div>
    </div>`
    }

    <div class="actions"><button class="btn ghost" id="restart">↺ Opnieuw beginnen</button></div>
    <p class="disclaimer">Indicatieve zelfevaluatie op basis van CCB CyberFundamentals 2025 (Basic). Geen officiële CyFun-verificatie en geen garantie op conformiteit of verzekerbaarheid. Een erkend attest vereist een geaccrediteerde instantie (CAB).</p>
  </section>`),
  );

  app.querySelector<HTMLButtonElement>("#restart")!.onclick = () => {
    S.answers = {};
    S.scan = null;
    S.scope = { choice: "", fit: true };
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
          score: r.score,
          yesCount: r.yesCount,
          total: r.total,
          scopeChoice: S.scope.choice,
          scopeFit: S.scope.fit,
          gaps: r.quickWins.map((w) => w.cyfun),
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
  yesCount: number;
  total: number;
  scopeChoice: string;
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
    msgEl.textContent = `Bedankt — we sturen uw actielijst naar ${payload.email}.`;
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
