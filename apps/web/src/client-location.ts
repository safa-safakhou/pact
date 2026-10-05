/** The host sets a canonical API/asset root before mounting the shared game. */
let configuredBase: string | undefined;
export function configureClientBase(url: URL): void {
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))
    throw new Error("PACT_REQUIRES_SECURE_ORIGIN");
  configuredBase = url.href.endsWith("/") ? url.href : url.href + "/";
}
export function pactBaseUrl(): string {
  return configuredBase ?? import.meta.env.BASE_URL;
}
