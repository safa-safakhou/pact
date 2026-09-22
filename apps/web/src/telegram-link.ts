export interface TelegramLinkCredentials {
  readonly email: string;
  readonly password: string;
}

export type TelegramLinkFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

interface ErrorEnvelope {
  readonly error?: { readonly code?: unknown };
}

interface LoginEnvelope extends ErrorEnvelope {
  readonly csrfToken?: unknown;
}

export class TelegramLinkError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "TelegramLinkError";
  }
}

function errorCode(body: unknown, fallback: string): string {
  if (typeof body !== "object" || body === null) return fallback;
  const code = (body as ErrorEnvelope).error?.code;
  return typeof code === "string" ? code : fallback;
}

async function responseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

export function readTelegramBootstrap(search: string): string | undefined {
  const token = new URLSearchParams(search).get("telegram_bootstrap") ?? "";
  return token.length >= 32 && token.length <= 128 ? token : undefined;
}

export async function confirmTelegramLink(
  fetchImplementation: TelegramLinkFetch,
  apiOrigin: URL,
  bootstrapToken: string,
  credentials: TelegramLinkCredentials,
): Promise<void> {
  const loginResponse = await fetchImplementation(new URL("v1/auth/login", apiOrigin), {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...credentials, label: "Telegram link confirmation" }),
  });
  const loginBody = (await responseBody(loginResponse)) as LoginEnvelope | undefined;
  if (!loginResponse.ok) throw new TelegramLinkError(errorCode(loginBody, "SIGN_IN_FAILED"));
  if (typeof loginBody?.csrfToken !== "string") throw new TelegramLinkError("INVALID_LOGIN_RESPONSE");

  const confirmationResponse = await fetchImplementation(new URL("v1/telegram/link/confirm", apiOrigin), {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", "x-csrf-token": loginBody.csrfToken },
    body: JSON.stringify({ bootstrapToken }),
  });
  const confirmationBody = await responseBody(confirmationResponse);
  if (!confirmationResponse.ok) {
    throw new TelegramLinkError(errorCode(confirmationBody, "TELEGRAM_LINK_FAILED"));
  }
}
