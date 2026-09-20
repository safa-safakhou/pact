import { Writable } from "node:stream";
import { Telemetry, type TelemetryEntry } from "@pact/telemetry";
import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { buildServer } from "./server.js";

describe("API telemetry boundary", () => {
  it("does not expose failed-request secrets in logs or the client response", async () => {
    let applicationLogs = "";
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        applicationLogs += chunk.toString();
        callback();
      },
    });
    const entries: TelemetryEntry[] = [];
    const telemetry = new Telemetry((entry) => entries.push(entry));
    const pool = { query: async () => ({ rows: [{ one: 1 }] }) } as unknown as Pool;
    const server = buildServer(pool, { level: "info", stream }, telemetry);
    server.post("/failure-fixture", async (request) => {
      const error = Object.assign(new Error("private-error-secret"), { code: "PROVIDER_FAILED" });
      request.log.error(
        {
          err: error,
          authorization: request.headers.authorization,
          email: "player@example.test",
          prompt: "private-prompt",
          messageBody: "private-message",
          body: request.body,
        },
        "synthetic provider failure",
      );
      throw error;
    });

    const response = await server.inject({
      method: "POST",
      url: "/failure-fixture",
      headers: { authorization: "Bearer credential-secret" },
      payload: { token: "payload-token", message: "payload-private-message" },
    });
    await server.close();

    const visible = `${applicationLogs}\n${response.body}\n${JSON.stringify(entries)}`;
    for (const forbidden of [
      "private-error-secret",
      "credential-secret",
      "player@example.test",
      "private-prompt",
      "private-message",
      "payload-token",
      "payload-private-message",
    ]) {
      expect(visible).not.toContain(forbidden);
    }
    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({
      error: { code: "INTERNAL_ERROR", message: "The request could not be completed." },
    });
    expect(response.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(entries.map((entry) => entry.event)).toEqual(["command.api.started", "command.api.failed"]);
  });
});
