import { createHash, randomBytes, randomUUID } from "node:crypto";
export class PublicClient {
  constructor(base, actor, save = () => {}) {
    this.base = base;
    this.actor = actor;
    this.save = save;
    this.origin = new URL(base).origin;
  }
  async http(path, body, extra = {}) {
    const a = this.actor;
    const response = await fetch(this.base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: this.origin,
        ...(a.cookie ? { Cookie: a.cookie, "x-csrf-token": a.csrfToken } : {}),
        ...extra,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(20000),
      redirect: "error",
    });
    const cookie = response.headers.get("set-cookie");
    if (cookie) {
      a.cookie = cookie.split(";")[0];
      this.save();
    }
    const data = await response.json();
    if (!response.ok) {
      const e = Error(`HTTP_${response.status}_${data.error?.code ?? data.code ?? "UNKNOWN"}`);
      if (response.status >= 400 && response.status < 500)
        e.serverCode = data.error?.code ?? data.code ?? `HTTP_${response.status}`;
      throw e;
    }
    return data;
  }
  async provision() {
    const a = this.actor;
    if (!a.kingdomId) {
      for (let n = 0; ; n++)
        try {
          Object.assign(a, await this.http("/v1/play/join", { entryKey: a.entryKey, nickname: a.nickname }));
          this.save();
          break;
        } catch (e) {
          if (n >= 4) throw e;
          await new Promise((r) => setTimeout(r, 1500 * (n + 1)));
        }
    }
    if (!a.mandateReady) {
      const mandate = await this.http("/v1/mandate");
      await this.http("/v1/mandate", {
        allowedActions: [
          "world.read",
          "inbox.read",
          "message.send.contact",
          "contact.request",
          "building.queue",
          "supply.sign",
        ],
        resourceLimits: { iron: "300000", silver: "300000", grain: "300000" },
        reserveFloors: { grain: "12000" },
        troopLimit: 0,
        sessionLimit: 1,
        expectedVersion: mandate.version,
      });
      a.mandateReady = true;
      this.save();
    }
    if (!a.tokens) {
      const redirect_uri = "http://127.0.0.1:38491/callback";
      const registration = await this.http("/oauth/register", {
        client_name: `PACT population ${a.nickname}`,
        redirect_uris: [redirect_uri],
        audience: "mcp",
      });
      a.clientId = registration.client_id;
      this.save();
      const verifier = randomBytes(32).toString("base64url");
      const authorization = await this.http("/oauth/authorize", {
        client_id: a.clientId,
        redirect_uri,
        scope: "world:read messages:write game:act",
        code_challenge: createHash("sha256").update(verifier).digest("base64url"),
        code_challenge_method: "S256",
        resource: `${this.base}/mcp`,
        subject_label: `${a.nickname} envoy`,
        audience: "mcp",
      });
      a.tokens = await this.http("/oauth/token", {
        grant_type: "authorization_code",
        client_id: a.clientId,
        code: authorization.code,
        redirect_uri,
        code_verifier: verifier,
        resource: `${this.base}/mcp`,
      });
      a.tokenExpires = Date.now() + a.tokens.expires_in * 1000;
      this.save();
    }
  }
  async mcp() {
    const a = this.actor;
    if (Date.now() > a.tokenExpires - 60000) {
      a.tokens = await this.http("/oauth/token", {
        grant_type: "refresh_token",
        client_id: a.clientId,
        refresh_token: a.tokens.refresh_token,
        resource: `${this.base}/mcp`,
      });
      a.tokenExpires = Date.now() + a.tokens.expires_in * 1000;
      this.save();
    }
    const client = new Mcp(`${this.base}/mcp`, a.tokens.access_token);
    await client.init();
    return client;
  }
  async humanCommand(action, commandId = randomUUID()) {
    return this.http("/v1/commands", {
      schemaVersion: "pact.command.v1",
      commandId,
      actor: {
        principalId: "server-derived",
        productScope: "pact",
        audience: "human",
        subject: { type: "account", id: "server-derived" },
      },
      action,
      submittedAt: new Date().toISOString(),
    });
  }
}
export class Mcp {
  constructor(endpoint, token) {
    this.endpoint = endpoint;
    this.token = token;
    this.seq = 0;
  }
  headers() {
    return {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${this.token}`,
      Origin: new URL(this.endpoint).origin,
      ...(this.session ? { "Mcp-Session-Id": this.session, "MCP-Protocol-Version": "2025-11-25" } : {}),
    };
  }
  async rpc(method, params) {
    const r = await fetch(this.endpoint, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ jsonrpc: "2.0", id: ++this.seq, method, params }),
      signal: AbortSignal.timeout(20000),
      redirect: "error",
    });
    this.session = r.headers.get("Mcp-Session-Id") ?? this.session;
    const b = await r.json();
    if (!r.ok) {
      const e = Error(`MCP_HTTP_${r.status}_${b.error?.code ?? "UNKNOWN"}`);
      if (r.status >= 400 && r.status < 500) e.serverCode = b.error?.code ?? `HTTP_${r.status}`;
      throw e;
    }
    if (b.error) throw Error(`MCP_RPC_${b.error.message}`);
    return b.result;
  }
  async init() {
    await this.rpc("initialize", {
      protocolVersion: "2025-11-25",
      clientInfo: { name: "pact-population-experiment", version: "1" },
      capabilities: {},
    });
    const r = await fetch(this.endpoint, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
      signal: AbortSignal.timeout(10000),
    });
    if (r.status !== 202) throw Error("MCP_INIT_FAILED");
  }
  async call(name, args = {}) {
    const r = await this.rpc("tools/call", { name, arguments: args });
    if (!r.structuredContent) {
      let detail;
      try {
        detail = JSON.parse(r.content?.find((c) => c.type === "text")?.text ?? "{}");
      } catch {}
      const e = Error(`MCP_TOOL_${name}_${detail?.error?.code ?? "RESULT_MISSING"}`);
      if (r.isError && detail?.error?.code) e.serverCode = detail.error.code;
      throw e;
    }
    return r.structuredContent;
  }
  async close() {
    if (this.session) {
      const r = await fetch(this.endpoint, {
        method: "DELETE",
        headers: this.headers(),
        body: "{}",
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) throw Error(`MCP_CLOSE_${r.status}`);
      this.session = undefined;
    }
  }
}
