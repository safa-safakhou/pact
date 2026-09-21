import { describe, expect, it, vi } from "vitest";
import {
  type NativeApiPort,
  NativeSessionController,
  nativeSecureStoreKeys,
  type SecureStorePort,
} from "./session-controller.js";

class MemorySecureStore implements SecureStorePort {
  readonly values = new Map<string, string>();
  async getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  async setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  async deleteItem(key: string) {
    this.values.delete(key);
  }
}

function fixture(audience: "human" | "mcp" = "human") {
  const store = new MemorySecureStore();
  const calls: string[] = [];
  let approvalResolve: ((value: { receiptId: string }) => void) | undefined;
  const api: NativeApiPort<{ version: number }, { receiptId: string }> = {
    exchangeCode: vi.fn(async () => ({ accessToken: "access-secret", refreshToken: "refresh-secret", audience })),
    refresh: vi.fn(async (refresh) => {
      if (refresh === "revoked") throw new Error("REVOKED");
      return { accessToken: "restored-access", refreshToken: "rotated-refresh", audience: "human" as const };
    }),
    revoke: vi.fn(async () => undefined),
    loadServerState: vi.fn(async () => ({ version: 7 })),
    approve: vi.fn(
      () =>
        new Promise<{ receiptId: string }>((resolve) => {
          approvalResolve = resolve;
        }),
    ),
  };
  const controller = new NativeSessionController({
    authorizationEndpoint: "https://pact.example/oauth/authorize",
    clientId: "pact-native",
    redirectUri: "https://pact.example/native/callback",
    secureStore: store,
    api,
    pkce: { create: async () => ({ verifier: "verifier", challenge: "challenge", state: "state-1" }) },
    now: () => Date.parse("2026-09-21T12:00:00Z"),
    log: (event) => calls.push(event),
  });
  return { controller, store, api, calls, resolveApproval: () => approvalResolve?.({ receiptId: "receipt-1" }) };
}

describe("NativeSessionController", () => {
  it("rejects malicious, replayed, stale, and wrong-audience callbacks", async () => {
    const malicious = fixture();
    await malicious.controller.beginLogin();
    await expect(
      malicious.controller.completeCallback("https://evil.example/native/callback?code=x&state=state-1"),
    ).rejects.toThrow("INVALID_CALLBACK");

    const wrongState = fixture();
    await wrongState.controller.beginLogin();
    await expect(
      wrongState.controller.completeCallback("https://pact.example/native/callback?code=x&state=wrong"),
    ).rejects.toThrow("INVALID_STATE");
    await expect(
      wrongState.controller.completeCallback("https://pact.example/native/callback?code=x&state=state-1"),
    ).rejects.toThrow("INVALID_CALLBACK");

    const wrongAudience = fixture("mcp");
    await wrongAudience.controller.beginLogin();
    await expect(
      wrongAudience.controller.completeCallback("https://pact.example/native/callback?code=x&state=state-1"),
    ).rejects.toThrow("WRONG_AUDIENCE");
    expect(wrongAudience.store.values.has(nativeSecureStoreKeys.refresh)).toBe(false);
  });

  it("stores only refresh/PKCE material, restores server state, and never logs credentials", async () => {
    const item = fixture();
    const authorizeUrl = await item.controller.beginLogin();
    expect(authorizeUrl).toContain("code_challenge_method=S256");
    await item.controller.completeCallback("https://pact.example/native/callback?code=code-1&state=state-1");
    expect([...item.store.values.keys()]).toEqual([nativeSecureStoreKeys.refresh]);
    expect([...item.store.values.values()].join(" ")).not.toContain("access-secret");
    expect(item.calls.join(" ")).not.toMatch(/access|refresh|verifier/);
    await expect(item.controller.reloadServerState()).resolves.toEqual({ version: 7 });
    expect(item.api.loadServerState).toHaveBeenCalledTimes(1);
  });

  it("coalesces duplicate approval taps and preserves the server receipt", async () => {
    const item = fixture();
    await item.controller.beginLogin();
    await item.controller.completeCallback("https://pact.example/native/callback?code=code-1&state=state-1");
    const first = item.controller.approveOnce("approval-1");
    const second = item.controller.approveOnce("approval-1");
    expect(item.api.approve).toHaveBeenCalledTimes(1);
    item.resolveApproval();
    await expect(Promise.all([first, second])).resolves.toEqual([
      { receiptId: "receipt-1" },
      { receiptId: "receipt-1" },
    ]);
  });

  it("deletes revoked refresh state and leaves no usable access token", async () => {
    const item = fixture();
    item.store.values.set(nativeSecureStoreKeys.refresh, "revoked");
    await expect(item.controller.restore()).rejects.toThrow("REVOKED");
    expect(item.store.values.has(nativeSecureStoreKeys.refresh)).toBe(false);
    await expect(item.controller.reloadServerState()).rejects.toThrow("UNAUTHENTICATED");
  });
});
