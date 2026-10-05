import type { BaselineTools } from "./baseline-player.js";

/** JSON Streamable HTTP adapter for PACT's published MCP endpoint. Token stays in memory. */
export class BaselineMcpClient implements BaselineTools {
  private sessionId: string | undefined;
  private sequence = 0;
  private readonly origin: string;
  constructor(
    private readonly endpoint: string,
    private readonly token: string,
  ) {
    const url = new URL(endpoint);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.protocol !== "https:" &&
        !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
    )
      throw new Error("HTTPS_OR_LOCALHOST_ENDPOINT_REQUIRED");
    if (!token || /[\r\n]/.test(token)) throw new Error("ACCESS_TOKEN_REQUIRED");
    this.origin = url.origin;
  }
  private headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      Origin: this.origin,
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      ...(this.sessionId ? { "Mcp-Session-Id": this.sessionId, "MCP-Protocol-Version": "2025-11-25" } : {}),
    };
  }
  private async rpc(method: string, params: Record<string, unknown>) {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ jsonrpc: "2.0", id: ++this.sequence, method, params }),
      signal: AbortSignal.timeout(10000),
      redirect: "error",
    });
    if (!response.ok) throw new Error(`MCP_HTTP_${response.status}`);
    this.sessionId = response.headers.get("Mcp-Session-Id") ?? this.sessionId;
    const body = (await response.json()) as { result?: Record<string, unknown>; error?: unknown };
    if (body.error || !body.result) throw new Error("MCP_RPC_ERROR");
    return body.result;
  }
  async initialize() {
    if (this.sessionId) throw new Error("ALREADY_INITIALIZED");
    const result = await this.rpc("initialize", {
      protocolVersion: "2025-11-25",
      clientInfo: { name: "pact-script-baseline", version: "0.1.0" },
      capabilities: {},
    });
    if (result.protocolVersion !== "2025-11-25" || !this.sessionId) throw new Error("MCP_INITIALIZE_FAILED");
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
      signal: AbortSignal.timeout(10000),
      redirect: "error",
    });
    if (response.status !== 202) throw new Error("MCP_INITIALIZED_FAILED");
  }
  async call(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.sessionId) throw new Error("MCP_NOT_INITIALIZED");
    const result = await this.rpc("tools/call", { name, arguments: args });
    if (result.isError) throw new Error("MCP_TOOL_REJECTED");
    if (!result.structuredContent) throw new Error("MCP_STRUCTURED_RESULT_REQUIRED");
    return result.structuredContent;
  }
  async close() {
    if (!this.sessionId) return;
    const response = await fetch(this.endpoint, {
      method: "DELETE",
      headers: this.headers(),
      body: "{}",
      signal: AbortSignal.timeout(10000),
      redirect: "error",
    });
    if (!response.ok) throw new Error("MCP_CLOSE_FAILED");
    this.sessionId = undefined;
  }
}
