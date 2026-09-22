export function resolvePactOrigin(baseUrl: string, configuredOrigin: string | undefined, windowOrigin: string): URL {
  if (configuredOrigin) {
    const url = new URL(configuredOrigin, windowOrigin);
    return new URL(url.pathname.endsWith("/") ? url.toString() : `${url.toString()}/`);
  }

  return new URL("../", new URL(baseUrl, windowOrigin));
}

export function telegramConfirmationUrl(pactOrigin: URL, bootstrapToken: string): string {
  const url = new URL(pactOrigin);
  url.searchParams.set("telegram_bootstrap", bootstrapToken);
  return url.toString();
}
