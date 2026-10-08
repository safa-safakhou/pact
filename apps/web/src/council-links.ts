/** Navigation only: the authenticated approval page still checks and executes the exact decision. */
export function isCouncilHumanLink(url: URL, origin: string): boolean {
  if (url.origin !== origin) return false;
  return (
    /^\/approvals\//.test(url.pathname) ||
    (url.pathname === "/" &&
      /^\?approval=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(url.search)) ||
    (url.pathname === "/" && ["?envoy=edit", "?council=introductions"].includes(url.search))
  );
}
