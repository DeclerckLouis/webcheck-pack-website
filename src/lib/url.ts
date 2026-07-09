// The shared Header/Footer come from the main site, where url() resolves
// internal routes. Here the scan tool is a standalone single page, so every
// nav/footer destination lives on the main site — url() makes them absolute.
const MAIN_SITE = "https://www.packetflow.be";

export function url(href: string): string {
  if (/^([a-z]+:|\/\/|#)/i.test(href)) return href; // already absolute / mailto / tel / #
  return `${MAIN_SITE}${href.startsWith("/") ? href : `/${href}`}`;
}

// Header calls this on the current pathname for active-state matching. Nothing
// on the scan page matches a main-site route, so no nav item is highlighted.
export function cleanPath(pathname: string): string {
  return pathname;
}
