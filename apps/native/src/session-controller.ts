const REFRESH_KEY = "pact.native.refresh.v1";
const PENDING_KEY = "pact.native.pkce.v1";

export interface SecureStorePort {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
}

export interface TokenResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly audience: "human" | "mcp";
}

export interface NativeApiPort<State, Receipt> {
  exchangeCode(input: { code: string; verifier: string; redirectUri: string }): Promise<TokenResponse>;
  refresh(refreshToken: string): Promise<TokenResponse>;
  revoke(refreshToken: string): Promise<void>;
  loadServerState(accessToken: string): Promise<State>;
  approve(accessToken: string, approvalId: string): Promise<Receipt>;
}

export interface PkcePort {
  create(): Promise<{ verifier: string; challenge: string; state: string }>;
}

interface PendingLogin {
  verifier: string;
  state: string;
  createdAt: number;
}

export class NativeSessionController<State, Receipt> {
  #accessToken: string | undefined;
  readonly #approvals = new Map<string, Promise<Receipt>>();

  constructor(
    private readonly options: {
      authorizationEndpoint: string;
      clientId: string;
      redirectUri: string;
      secureStore: SecureStorePort;
      api: NativeApiPort<State, Receipt>;
      pkce: PkcePort;
      now: () => number;
      log: (event: "login_started" | "login_completed" | "session_revoked") => void;
    },
  ) {}

  async beginLogin(): Promise<string> {
    const pending = await this.options.pkce.create();
    await this.options.secureStore.setItem(
      PENDING_KEY,
      JSON.stringify({ verifier: pending.verifier, state: pending.state, createdAt: this.options.now() }),
    );
    const url = new URL(this.options.authorizationEndpoint);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", this.options.clientId);
    url.searchParams.set("redirect_uri", this.options.redirectUri);
    url.searchParams.set("code_challenge", pending.challenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("state", pending.state);
    url.searchParams.set("audience", "human");
    this.options.log("login_started");
    return url.toString();
  }

  async completeCallback(callbackUrl: string): Promise<void> {
    const callback = new URL(callbackUrl);
    const expected = new URL(this.options.redirectUri);
    if (callback.origin !== expected.origin || callback.pathname !== expected.pathname)
      throw new Error("INVALID_CALLBACK");
    const encoded = await this.options.secureStore.getItem(PENDING_KEY);
    await this.options.secureStore.deleteItem(PENDING_KEY);
    if (!encoded) throw new Error("INVALID_CALLBACK");
    const pending = JSON.parse(encoded) as PendingLogin;
    if (this.options.now() - pending.createdAt > 10 * 60_000) throw new Error("STALE_CALLBACK");
    if (callback.searchParams.get("state") !== pending.state) throw new Error("INVALID_STATE");
    const code = callback.searchParams.get("code");
    if (!code) throw new Error("INVALID_CALLBACK");
    await this.acceptTokens(
      await this.options.api.exchangeCode({ code, verifier: pending.verifier, redirectUri: this.options.redirectUri }),
    );
    this.options.log("login_completed");
  }

  async restore(): Promise<boolean> {
    const refreshToken = await this.options.secureStore.getItem(REFRESH_KEY);
    if (!refreshToken) return false;
    try {
      await this.acceptTokens(await this.options.api.refresh(refreshToken));
      return true;
    } catch (error) {
      this.#accessToken = undefined;
      await this.options.secureStore.deleteItem(REFRESH_KEY);
      throw error;
    }
  }

  async reloadServerState(): Promise<State> {
    if (!this.#accessToken) throw new Error("UNAUTHENTICATED");
    return this.options.api.loadServerState(this.#accessToken);
  }

  async approveOnce(approvalId: string): Promise<Receipt> {
    if (!this.#accessToken) throw new Error("UNAUTHENTICATED");
    const existing = this.#approvals.get(approvalId);
    if (existing) return existing;
    const request = this.options.api.approve(this.#accessToken, approvalId).finally(() => {
      this.#approvals.delete(approvalId);
    });
    this.#approvals.set(approvalId, request);
    return request;
  }

  async revoke(): Promise<void> {
    const refreshToken = await this.options.secureStore.getItem(REFRESH_KEY);
    try {
      if (refreshToken) await this.options.api.revoke(refreshToken);
    } finally {
      this.#accessToken = undefined;
      await this.options.secureStore.deleteItem(REFRESH_KEY);
      await this.options.secureStore.deleteItem(PENDING_KEY);
      this.options.log("session_revoked");
    }
  }

  private async acceptTokens(tokens: TokenResponse): Promise<void> {
    if (tokens.audience !== "human") throw new Error("WRONG_AUDIENCE");
    await this.options.secureStore.setItem(REFRESH_KEY, tokens.refreshToken);
    this.#accessToken = tokens.accessToken;
  }
}

export const nativeSecureStoreKeys = { refresh: REFRESH_KEY, pendingPkce: PENDING_KEY } as const;
