import {
  API_VERSION,
  type CommandReceipt,
  CommandReceiptSchema,
  ProductScopeSchema,
  SCHEMA_VERSION,
} from "@pact/contracts";

export interface NativeTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly audience: "human" | "mcp";
}

export class NativeApiError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "NativeApiError";
  }
}

interface NativeApiOptions {
  readonly baseUrl: string;
  readonly clientId: string;
  readonly fetch: typeof globalThis.fetch;
}

function errorCode(body: unknown): string {
  if (typeof body !== "object" || body === null || !("error" in body)) return "REQUEST_FAILED";
  const error = body.error;
  if (typeof error === "object" && error !== null && "code" in error) return String(error.code);
  return typeof error === "string" ? error : "REQUEST_FAILED";
}

export function createNativeApi(options: NativeApiOptions) {
  const baseUrl = options.baseUrl.endsWith("/") ? options.baseUrl : `${options.baseUrl}/`;

  async function request(path: string, init: RequestInit = {}): Promise<unknown> {
    const response = await options.fetch(new URL(path.replace(/^\//, ""), baseUrl), init);
    const body = (await response.json()) as unknown;
    if (!response.ok) throw new NativeApiError(errorCode(body));
    return body;
  }

  function tokens(body: unknown): NativeTokens {
    if (
      typeof body !== "object" ||
      body === null ||
      !("access_token" in body) ||
      typeof body.access_token !== "string" ||
      !("refresh_token" in body) ||
      typeof body.refresh_token !== "string" ||
      !("audience" in body) ||
      (body.audience !== "human" && body.audience !== "mcp")
    ) {
      throw new NativeApiError("INVALID_TOKEN_RESPONSE");
    }
    return { accessToken: body.access_token, refreshToken: body.refresh_token, audience: body.audience };
  }

  const bearer = (accessToken: string) => ({
    authorization: `Bearer ${accessToken}`,
    "content-type": "application/json",
    "x-pact-api-version": API_VERSION,
  });

  return {
    async exchangeCode(input: { code: string; verifier: string; redirectUri: string }): Promise<NativeTokens> {
      return tokens(
        await request("oauth/token", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            grant_type: "authorization_code",
            client_id: options.clientId,
            code: input.code,
            redirect_uri: input.redirectUri,
            code_verifier: input.verifier,
            resource: `${options.baseUrl.replace(/\/$/, "")}/native`,
          }),
        }),
      );
    },

    async refresh(refreshToken: string): Promise<NativeTokens> {
      return tokens(
        await request("oauth/token", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            grant_type: "refresh_token",
            client_id: options.clientId,
            refresh_token: refreshToken,
            resource: `${options.baseUrl.replace(/\/$/, "")}/native`,
          }),
        }),
      );
    },

    async revoke(refreshToken: string): Promise<void> {
      await request("oauth/revoke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: refreshToken }),
      });
    },

    loadDraft(accessToken: string): Promise<unknown> {
      return request("v1/native/draft", { headers: bearer(accessToken) });
    },

    async submitSandboxEcho(accessToken: string, commandId: string, message: string): Promise<CommandReceipt> {
      const body = await request("v1/native/commands", {
        method: "POST",
        headers: bearer(accessToken),
        body: JSON.stringify({
          schemaVersion: SCHEMA_VERSION,
          commandId,
          actor: {
            principalId: "server-derived",
            productScope: ProductScopeSchema.parse("pact"),
            audience: "human",
            subject: { type: "account", id: "server-derived" },
          },
          action: { kind: "sandbox.echo", message },
          submittedAt: new Date().toISOString(),
        }),
      });
      return CommandReceiptSchema.parse(body);
    },

    reviewApproval(accessToken: string, approvalId: string): Promise<unknown> {
      return request(`v1/native/approvals/${encodeURIComponent(approvalId)}`, { headers: bearer(accessToken) });
    },

    approve(accessToken: string, approvalId: string): Promise<unknown> {
      return request(`v1/native/approvals/${encodeURIComponent(approvalId)}/approve`, {
        method: "POST",
        headers: bearer(accessToken),
      });
    },
  };
}
