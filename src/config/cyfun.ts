/**
 * "Cyberveilig in 2 minuten" — the short self-check behind /cyfun-basic.
 *
 * SINGLE SOURCE OF TRUTH for the seven plain-language questions and the one
 * friendly scope question. Deliberately light: this is an approachable check for
 * a KMO owner, not the full 34-control CyFun questionnaire. Each question is a
 * CyberFundamentals Basic measure in disguise (the `cyfun` code keeps it honest
 * and lets us upsell the full traject), phrased in everyday nl-BE.
 *
 * Convention mirrors `config/scoring.ts`: the *data + types* live here; the pure
 * scoring/triage *logic* lives in `lib/cyfun.ts`.
 */

/** One self-check question. */
export interface Question {
  /** Internal id (used as the radio group name + answer key). */
  id: string;
  /** Underlying CyFun Basic control code — credibility + full-check mapping. */
  cyfun: string;
  /** The plain-language question (nl-BE). */
  q: string;
  /** Short reassuring line shown when the answer is "Ja". */
  yes: string;
  /** The concrete quick win — shown inline when not "Ja", and in the result. */
  fix: string;
  /** A core measure: labelled "belangrijk" and it leads the quick-win list. */
  key?: boolean;
}

export const QUESTIONS: Question[] = [
  {
    id: "backup",
    cyfun: "PR.DS-11",
    key: true,
    q: "Worden er automatisch back-ups gemaakt van uw belangrijke bestanden?",
    yes: "Top — een back-up is uw redding als er iets misloopt.",
    fix: "Zet automatische back-ups op van uw belangrijke bestanden. Eén ransomware of een kapotte laptop, en zonder back-up bent u alles kwijt.",
  },
  {
    id: "backup-test",
    cyfun: "PR.DS-11",
    key: true,
    q: "Heeft u al eens getest of u een back-up écht kunt terugzetten?",
    yes: "Sterk — een geteste back-up is pas een echte back-up.",
    fix: "Test één keer of u een bestand echt kunt terugzetten. Een back-up die u nooit probeerde, is een gok op het slechtste moment.",
  },
  {
    id: "mfa",
    cyfun: "PR.AA-03.2",
    key: true,
    q: "Moet u naast uw wachtwoord ook een code of app gebruiken om in te loggen (e-mail, cloud…)?",
    yes: "Goed bezig — die extra stap houdt de meeste inbraken tegen.",
    fix: "Zet tweestapsverificatie (2FA) aan op e-mail en cloud. Ja, die app is soms lastig — maar ze blokkeert de overgrote meerderheid van gehackte accounts.",
  },
  {
    id: "updates",
    cyfun: "ID.AM-08",
    key: true,
    q: "Worden updates voor Windows, software en toestellen vlot geïnstalleerd?",
    yes: "Prima — updates dichten net de gaten waar aanvallers door binnenkomen.",
    fix: "Installeer updates tijdig, of laat ze automatisch lopen. Veel aanvallen misbruiken een lek waar al lang een update voor bestaat.",
  },
  {
    id: "antivirus",
    cyfun: "DE.CM-01.2",
    key: true,
    q: "Draait er op alle computers beveiliging (antivirus) die ook echt aanstaat?",
    yes: "Mooi — dat vangt de meeste bekende bedreigingen automatisch af.",
    fix: "Zorg dat op élke computer antivirus of beveiliging draait én aanstaat. Eén onbeschermd toestel is vaak de zwakke schakel.",
  },
  {
    id: "logins",
    cyfun: "PR.AA-01",
    key: true,
    q: "Heeft iedereen een eigen login — dus geen gedeelde accounts of wachtwoorden?",
    yes: "Goed — zo weet u wie wat doet en trekt u toegang makkelijk weer in.",
    fix: "Geef iedereen een eigen login en vermijd gedeelde wachtwoorden. Anders weet niemand wie wat deed, en blijft toegang openstaan als iemand vertrekt.",
  },
  {
    id: "plan",
    cyfun: "RS.MA-01",
    q: "Weet u wat u moet doen als u morgen gehackt wordt of alles plots stilligt?",
    yes: "Sterk — wie vooraf nadenkt, verliest bij een incident geen kostbare uren.",
    fix: "Leg kort vast wie u belt en wat u doet als het misgaat. In paniek improviseren kost bij een incident net het meeste tijd en geld.",
  },
];

export const TOTAL_QUESTIONS = QUESTIONS.length;

/**
 * The one friendly scope question. Only purpose: don't pitch a Basic-lane
 * engagement to an organisation that clearly falls under NIS2 as an
 * Important/Essential entity (50+ in a regulated sector). Everyone else is the
 * Basic audience and sees the normal call-to-action. `fit:false` → the result
 * shows the "praat met een specialist" card instead of the engagement CTA.
 */
export interface ScopeChoice {
  v: string;
  t: string;
  /** True when CyFun Basic is the right lane (→ show the engagement CTA). */
  fit: boolean;
}

export const SCOPE_CHOICES: ScopeChoice[] = [
  { v: "kmo", t: "Klein team of KMO — minder dan 50 medewerkers", fit: true },
  {
    v: "big-regulated",
    t: "50+ medewerkers, in een gereguleerde sector (energie, zorg, transport, financieel, overheid, productie, digitaal…)",
    fit: false,
  },
  { v: "big-other", t: "50+ medewerkers, in een andere sector", fit: true },
];
