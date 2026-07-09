// Minimal mirror of the main Packetflow site's nav/footer data, so the shared
// Header/Footer components (ported from the main site) render identically here.
// The scan tool is a single page, so every nav/footer destination points at the
// main site (absolute URLs via ../lib/url).

export const site = {
  legalName: "Packetflow",
  serviceArea: "West-Vlaanderen",
  phone: "0468 22 72 12",
  phoneHref: "tel:+32468227212",
  email: "louis@packetflow.be",
  vatId: "BE 1024.713.047",
  pillars: "Lokaal · Persoonlijk · Scherp geprijsd",
  address: {
    postalCode: "8490",
    city: "Jabbeke",
    region: "West-Vlaanderen",
  },
} as const;

export interface Sector {
  navTitle: string;
  slug: string;
  tagline: string;
  icon: string;
}

export const sectors: Sector[] = [
  {
    navTitle: "Medische & zorgpraktijken",
    slug: "medische-praktijken",
    tagline:
      "Betrouwbare IT voor een praktijk waar patiëntgegevens en de balie nooit mogen stilvallen.",
    icon: "stethoscope",
  },
  {
    navTitle: "Kantoren & vrije beroepen",
    slug: "kantoren-vrije-beroepen",
    tagline:
      "Discrete, betrouwbare IT voor kleine kantoren waar vertrouwen en dossiers centraal staan.",
    icon: "briefcase",
  },
  {
    navTitle: "Horeca & B&B's",
    slug: "horeca-bnb",
    tagline:
      "Een kassa die niet uitvalt en gasten-WiFi die werkt — ook op het drukste moment.",
    icon: "utensils",
  },
  {
    navTitle: "Verenigingen & VZW's",
    slug: "verenigingen-vzw",
    tagline:
      "Betaalbare, eenvoudige IT voor wie het met vrijwilligers en een klein budget moet doen.",
    icon: "users",
  },
];

export interface ServiceLocal {
  title: string;
  slug: string;
}
export interface Service {
  navTitle: string;
  slug: string;
  tagline: string;
  icon: string;
  locals: ServiceLocal[];
}

export const services: Service[] = [
  {
    navTitle: "IT-Beheer & Support",
    slug: "it-beheer-support",
    tagline:
      "Eén aanspreekpunt dat uw kantoor kent — geen wachtrij, geen wisselende technici.",
    icon: "headset",
    locals: [
      { title: "IT-partner Jabbeke", slug: "it-partner-jabbeke" },
      { title: "IT-support Oudenburg", slug: "it-support-oudenburg" },
      { title: "Managed IT West-Vlaanderen", slug: "managed-it-west-vlaanderen" },
    ],
  },
  {
    navTitle: "Zakelijke WiFi & Netwerken",
    slug: "zakelijke-wifi-netwerken",
    tagline: "Een stabiel, veilig netwerk dat altijd werkt — ook tijdens de piek.",
    icon: "wifi",
    locals: [
      { title: "WiFi-installatie horeca Jabbeke", slug: "wifi-installatie-horeca-jabbeke" },
      { title: "Gastennetwerk B&B Brugse Ommeland", slug: "gastennetwerk-bnb-brugse-ommeland" },
      { title: "Stabiel netwerk KMO Oostende", slug: "stabiel-netwerk-kmo-oostende" },
    ],
  },
  {
    navTitle: "Cloud, Backup & Beveiliging",
    slug: "cloud-backup-beveiliging",
    tagline:
      "Uw dossiers veilig, beschermd en altijd terug te halen — met AI die mee bewaakt.",
    icon: "shield-check",
    locals: [],
  },
];

export type NavItem =
  | { label: string; href: string }
  | { label: string; href: string; dropdown: "sectors" | "services" };

export const mainNav: NavItem[] = [
  { label: "Voor wie?", href: "/sectoren", dropdown: "sectors" },
  { label: "Diensten", href: "/diensten", dropdown: "services" },
  { label: "KMO-Pakket", href: "/pakket" },
  { label: "Blog", href: "/blog" },
  { label: "Over mij", href: "/over-mij" },
];
