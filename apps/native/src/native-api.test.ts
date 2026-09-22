import { describe, expect, it, vi } from "vitest";
import { createNativeApi, NativeApiError } from "./native-api.js";

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("native API adapter", () => {
  it("uses the prefixed VPS base URL and bearer credentials", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => response({ version: 7 }));
    const api = createNativeApi({ baseUrl: "https://safa.dedyn.io/pact", clientId: "pact-native", fetch });

    await expect(api.loadDraft("access-secret")).resolves.toEqual({ version: 7 });
    expect(fetch).toHaveBeenCalledWith(
      new URL("https://safa.dedyn.io/pact/v1/native/draft"),
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer access-secret" }),
      }),
    );
  });

  it("rotates refresh credentials", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      response({ access_token: "next-access", refresh_token: "next-refresh", audience: "human" }),
    );
    const api = createNativeApi({ baseUrl: "https://safa.dedyn.io/pact", clientId: "pact-native", fetch });

    await expect(api.refresh("old-refresh")).resolves.toEqual({
      accessToken: "next-access",
      refreshToken: "next-refresh",
      audience: "human",
    });
    expect(String(fetch.mock.calls[0]?.[1]?.body)).toContain("old-refresh");
  });

  it("submits an idempotent shared command envelope and preserves its command ID", async () => {
    const receipt = {
      schemaVersion: "pact.command.v1",
      commandId: "7613c1c5-baf5-4950-9488-66af5156bf6e",
      code: "COMMITTED",
      committedEventIds: [],
      recordVersions: {},
      charged: [],
    };
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => response(receipt));
    const api = createNativeApi({ baseUrl: "https://safa.dedyn.io/pact", clientId: "pact-native", fetch });

    await expect(api.submitSandboxEcho("access", receipt.commandId, "native proof")).resolves.toEqual(receipt);
    const submitted = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(submitted).toMatchObject({ commandId: receipt.commandId, action: { kind: "sandbox.echo" } });
  });

  it("returns only a server error code", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      response({ error: { code: "FORBIDDEN", detail: "secret detail" } }, 403),
    );
    const api = createNativeApi({ baseUrl: "https://safa.dedyn.io/pact", clientId: "pact-native", fetch });

    const error = await api.loadDraft("revoked").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(NativeApiError);
    expect((error as Error).message).toBe("FORBIDDEN");
    expect((error as Error).message).not.toContain("secret detail");
  });
});
