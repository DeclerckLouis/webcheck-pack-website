/**
 * CyFun Basic — control model + NIS2 scope triage data.
 *
 * SINGLE SOURCE OF TRUTH for the 34 CyberFundamentals Basic controls, ported
 * VERBATIM from the reference prototype (`cyfun-basic-scan.html`). Source: CCB
 * CyberFundamentals 2025, assurance level BASIC. Do not re-derive controls from
 * the CyFun booklet — tune wording here and both the questionnaire and the
 * results follow.
 *
 * Convention mirrors `config/scoring.ts`: the *data + types* live here; the pure
 * scoring/triage *logic* lives in `lib/cyfun.ts`.
 *
 *   key: true   → "sleutelmaatregel" (Annex A, 13 total) — SHALL be met at Basic,
 *                 weighted 2× in scoring and flagged first in the gap list.
 *   scan: "..." → auto-informable by the domeinscan (confirm, don't assume).
 */

/** A single CyFun control (one questionnaire item). */
export interface Control {
  /** CyFun control code, e.g. "PR.AA-03.2". */
  id: string;
  /** Question shown to the visitor (nl-BE). */
  q: string;
  /** One-line "what this means" helper (nl-BE). */
  help: string;
  /** Sleutelmaatregel (Annex A key measure) — weighted 2× and required at Basic. */
  key?: boolean;
  /** Domeinscan hint: this control is partly informable by the scan. */
  scan?: "mail";
}

/** One of the six CyberFundamentals functions, with its controls. */
export interface Fn {
  /** Two-letter function code (GV, ID, PR, DE, RS, RC). */
  code: string;
  /** English function name (Govern, Identify, …). */
  name: string;
  /** Dutch label shown in the UI. */
  label: string;
  /** One-line description of the function. */
  sub: string;
  controls: Control[];
}

export const MODEL: Fn[] = [
  {
    code: "GV",
    name: "Govern",
    label: "Beleid & governance",
    sub: "Cybersecurity als strategische prioriteit — beleid, rollen en verplichtingen.",
    controls: [
      { id: "GV.OC-03", q: "Zijn de wettelijke en regelgevende eisen rond informatiebeveiliging in kaart gebracht en toegepast?", help: "Bv. GDPR, sectorregels, contractuele eisen van klanten/partners — geïdentificeerd én effectief opgevolgd." },
      { id: "GV.RM-03", q: "Is er een strategie om cyberrisico's te beheren, die wordt bijgewerkt bij belangrijke wijzigingen?", help: "Een concreet, actueel plan voor hoe risico's worden ingeschat en aangepakt — geen losse ad-hoc acties." },
      { id: "GV.RR-04", q: "Worden medewerkers met toegang tot de meest kritieke informatie of systemen sterk geauthenticeerd?", help: "Identiteit technisch bewijzen op het moment van toegang, idealiter met MFA — niet enkel bij indiensttreding." },
      { id: "GV.PO-01", q: "Bestaan er gedocumenteerde beleidsregels/procedures voor informatiebeveiliging die worden gecommuniceerd en afgedwongen?", help: "Opgesteld, goedgekeurd, minstens jaarlijks herzien, en gekend bij het personeel." },
    ],
  },
  {
    code: "ID",
    name: "Identify",
    label: "Inventaris & risico",
    sub: "Weten wat je hebt en wat het waard is — de basis voor elke beslissing.",
    controls: [
      { id: "ID.AM-01", q: "Houdt u een actuele inventaris bij van uw hardware?", help: "Servers, werkstations, netwerkapparatuur, opslag en cloudomgevingen — met eigenaar en status." },
      { id: "ID.AM-02", q: "Houdt u een actuele inventaris bij van software, diensten en systemen?", help: "Toepassingen, cloud/SaaS, ERP/CRM — met versie, eigenaar en doel." },
      { id: "ID.AM-05", q: "Zijn uw assets geprioriteerd op basis van kritikaliteit en bedrijfswaarde?", help: "U weet welke systemen/data bedrijfskritiek zijn en dus eerst bescherming verdienen." },
      { id: "ID.AM-07", q: "Zijn de gegevens die u opslaat en gebruikt geïdentificeerd en geclassificeerd?", help: "Bv. publiek / intern / vertrouwelijk / beperkt — en gekoppeld aan waar ze staan." },
      { id: "ID.AM-08", key: true, q: "Worden patches en beveiligingsupdates voor besturingssystemen en kritieke componenten tijdig geïnstalleerd?", help: "Centraal beheerd waar mogelijk; end-of-life software wordt uitgefaseerd." },
      { id: "ID.RA-01", q: "Worden dreigingen en kwetsbaarheden in uw assets geïdentificeerd en bijgehouden?", help: "Reageren op meldingen van leveranciers/overheid; een eenvoudig risicoregister volstaat op Basic-niveau." },
      { id: "ID.RA-05", q: "Voert u risicobeoordelingen uit die dreiging, kwetsbaarheid en bedrijfsimpact combineren?", help: "Gedocumenteerd en periodiek herzien." },
      { id: "ID.IM-03", q: "Voert u na een incident een evaluatie uit om lessen te trekken en te verbeteren?", help: "Wat gebeurde er, hoe is het aangepakt, wat verbeteren we — vastgelegd en gedeeld." },
    ],
  },
  {
    code: "PR",
    name: "Protect",
    label: "Bescherming",
    sub: "De maatregelen die de kans op — of de impact van — een incident verkleinen.",
    controls: [
      { id: "PR.AA-01", key: true, q: "Worden identiteiten en toegangsgegevens beheerd (geen gedeelde accounts, standaardwachtwoorden gewijzigd, ongebruikte accounts uitgeschakeld)?", help: "Individuele accounts, sterk wachtwoordbeleid, admin-accounts beperkt en beheerd." },
      { id: "PR.AA-03.1", q: "Zijn alle draadloze toegangspunten — inclusief gast-wifi — veilig geconfigureerd en beheerd?", help: "WPA2/WPA3, standaardcredentials gewijzigd, gastnetwerk gescheiden van interne systemen." },
      { id: "PR.AA-03.2", key: true, q: "Is MFA vereist voor álle externe toegang?", help: "E-mail, VPN, RDP, cloud en webportalen — ook voor externe leveranciers. SMS/e-mail-MFA best vermijden." },
      { id: "PR.AA-05.1", key: true, q: "Zijn toegangsrechten gedefinieerd, beheerd, afgedwongen én periodiek herzien?", help: "Rechten worden ingetrokken bij functiewijziging of vertrek." },
      { id: "PR.AA-05.2", key: true, q: "Is bepaald wie toegang nodig heeft tot bedrijfskritieke informatie/technologie en via welke veilige weg?", help: "Enkel wie het nodig heeft; toestellen voldoen aan minimumeisen voor ze verbinden." },
      { id: "PR.AA-05.3", key: true, q: "Worden rechten beperkt tot het strikt noodzakelijke (least privilege)?", help: "Accounts starten met lage rechten; verhoog enkel indien nodig en tijdelijk." },
      { id: "PR.AA-05.4", key: true, q: "Worden admin-rechten NIET gebruikt voor dagelijkse taken?", help: "Aparte admin-accounts enkel voor beheer; geen internetgebruik vanaf een admin-account." },
      { id: "PR.AA-06", q: "Wordt fysieke toegang tot assets en kritieke zones beheerd en gemonitord?", help: "Sleutels/badges beheerd, toegang ingetrokken bij vertrek, kritieke zones extra beveiligd." },
      { id: "PR.AT-01", q: "Is er een programma voor cybersecuritybewustwording en -opleiding voor alle personeel?", help: "Bij indiensttreding en minstens jaarlijks; phishing, zwakke wachtwoorden, social engineering." },
      { id: "PR.DS-01", q: "Worden bedrijfsmiddelen veilig afgevoerd (data gewist vóór afvoer, herstel of hergebruik)?", help: "Inclusief mobiele toestellen (remote wipe) en zorgvuldig beheer van vervallen domeinnamen." },
      { id: "PR.DS-11", key: true, q: "Worden back-ups van kritieke data gemaakt op een gescheiden systeem, met minstens één offline/air-gapped kopie, en getest?", help: "Back-up niet op hetzelfde toestel/netwerk; herstel effectief getest (RTO/RPO bepaald)." },
      { id: "PR.PS-04", key: true, q: "Worden logs bijgehouden, gedocumenteerd en gemonitord?", help: "Van besturingssystemen, toepassingen en beveiligingstools; beschermd en met bewaartermijn." },
      { id: "PR.PS-05", scan: "mail", q: "Zijn web- en e-mailfilters geïnstalleerd en actief?", help: "Blokkeren van spam, phishing en kwaadaardige bijlagen/links; regelmatig bijgewerkt." },
      { id: "PR.IR-01.1", key: true, q: "Zijn firewalls geïnstalleerd, geconfigureerd en actief onderhouden op alle netwerken?", help: "Perimeterfirewall met 'deny all by default'; ook softwarematige firewalls op endpoints." },
      { id: "PR.IR-01.2", key: true, q: "Is netwerksegmentatie/segregatie toegepast?", help: "Gescheiden zones (kantoor/gast/productie); vermijd een plat netwerk waar één inbraak alles blootstelt." },
    ],
  },
  {
    code: "DE",
    name: "Detect",
    label: "Detectie",
    sub: "Snel opmerken wanneer er iets misgaat.",
    controls: [
      { id: "DE.CM-01.1", q: "Zijn er firewalls op de netwerkgrenzen én endpoint-firewalls actief?", help: "Host-based firewalls op elk toestel, ook wanneer verbonden via VPN of cloud." },
      { id: "DE.CM-01.2", key: true, q: "Zijn antivirus/antimalware geïnstalleerd en up-to-date op alle toestellen?", help: "Alle IT-toestellen; centraal beheerd; alerts geïntegreerd in de bredere opvolging." },
      { id: "DE.CM-03", q: "Worden tools gebruikt om verdacht gebruikers- of netwerkgedrag te detecteren?", help: "Bv. EDR/NDR/IDPS — real-time zicht op afwijkend gedrag op toestellen en netwerk." },
      { id: "DE.AE-03", key: true, q: "Staat logging aan op beveiligingstools, worden logs bewaard én regelmatig nagekeken?", help: "Geautomatiseerde alerts bij verdachte activiteit; gedocumenteerde review-procedure." },
    ],
  },
  {
    code: "RS",
    name: "Respond",
    label: "Reactie",
    sub: "Weten wat te doen wanneer het misgaat.",
    controls: [
      { id: "RS.MA-01", q: "Bestaat er een incidentresponsplan met rollen en verantwoordelijkheden, dat wordt uitgevoerd bij incidenten?", help: "Wie doet wat, wie mag herstel starten, wie communiceert extern; getest via oefeningen." },
      { id: "RS.CO-02", q: "Wordt er bij een incident duidelijk en tijdig gecommuniceerd naar medewerkers en stakeholders?", help: "Vooraf opgestelde berichtsjablonen, duidelijke kanalen, begrijpelijke taal." },
    ],
  },
  {
    code: "RC",
    name: "Recover",
    label: "Herstel",
    sub: "Diensten en werking herstellen na een incident.",
    controls: [
      { id: "RC.RP-01", q: "Bestaat er een uitgewerkt en getest herstelproces voor rampen en cyberincidenten?", help: "Onderdeel van of afgestemd op het incidentresponsplan; rollen en contactlijsten gekend." },
    ],
  },
];

/** Number of "sleutelmaatregelen" (Annex A key measures) — 13 at Basic. */
export const KEY_TOTAL = MODEL.flatMap((f) => f.controls).filter((c) => c.key).length;

/** Total number of controls across all functions — 34 at Basic. */
export const TOTAL_CONTROLS = MODEL.reduce((n, f) => n + f.controls.length, 0);

// --- NIS2 scope triage (indicative — not the official CyFun Selection Tool) ---

export interface ScopeOption {
  v: string;
  t: string;
}

export const SECTORS: ScopeOption[] = [
  { v: "none", t: "Geen van onderstaande (bv. handel, horeca, vrij beroep, vastgoed)" },
  { v: "annex1", t: "Energie, transport, bank/financieel, gezondheidszorg, drinkwater/afvalwater, digitale infrastructuur, overheid" },
  { v: "annex2", t: "Post/koerier, afvalbeheer, chemie, voeding, productie/maakindustrie, digitale aanbieders, onderzoek" },
];

export const SIZES: ScopeOption[] = [
  { v: "micro", t: "Micro — minder dan 10 werknemers" },
  { v: "small", t: "Klein — 10 tot 49 werknemers" },
  { v: "medium", t: "Middelgroot — 50 tot 249 werknemers" },
  { v: "large", t: "Groot — 250+ werknemers" },
];
