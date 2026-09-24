import { API_VERSION, type CommandReceipt } from "@pact/contracts";
import { describe, expect, it } from "vitest";
import { PactClient, PactClientError } from "./client.js";
import type { ClientRequest, ClientResponse, ClientTransport } from "./types.js";

const commandId = "00000000-0000-4000-8000-000000000083";
const eventId = "00000000-0000-4000-8000-000000000084";
const receipt: CommandReceipt = {
  schemaVersion: "pact.command.v1",
  commandId,
  code: "COMMITTED",
  committedEventIds: [eventId],
  recordVersions: { "sandbox.counter:shared": 1 },
  charged: [],
  committedAt: "2026-09-20T21:00:00.000Z",
};

class UncertainTransport implements ClientTransport {
  readonly requests: ClientRequest[] = [];

  async send(request: ClientRequest): Promise<ClientResponse> {
    this.requests.push(request);
    if (this.requests.length === 1) throw new Error("response lost after commit");
    return { status: 200, body: receipt };
  }
}

function client(transport: ClientTransport): PactClient<"human"> {
  return new PactClient({
    audience: "human",
    transport,
    commandIds: { create: () => commandId },
    clock: { now: () => new Date("2026-09-20T21:00:00.000Z") },
  });
}

describe("platform-independent client SDK", () => {
  it("preserves the exact command id and payload after an uncertain response", async () => {
    const transport = new UncertainTransport();
    const sdk = client(transport);
    const prepared = sdk.prepareCommand({ kind: "sandbox.counter.increment", counterId: "shared", amount: 1 });

    await expect(sdk.submitCommand(prepared)).rejects.toMatchObject({ code: "NETWORK_UNCERTAIN" });
    await expect(sdk.retryCommand(prepared)).resolves.toEqual(receipt);

    expect(transport.requests).toHaveLength(2);
    expect(transport.requests[0]?.body).toBe(prepared);
    expect(transport.requests[1]?.body).toBe(prepared);
    expect(transport.requests[1]?.headers["x-pact-api-version"]).toBe(API_VERSION);
    expect(prepared.commandId).toBe(commandId);
  });

  it("rejects human clients with agent scopes and never manufactures human scopes for agents", async () => {
    expect(
      () =>
        new PactClient({
          audience: "human",
          transport: new UncertainTransport(),
          commandIds: { create: () => commandId },
          clock: { now: () => new Date() },
          agentScopes: ["game:act"],
        }),
    ).toThrow(PactClientError);

    const agent = new PactClient({
      audience: "agent",
      transport: new UncertainTransport(),
      commandIds: { create: () => commandId },
      clock: { now: () => new Date() },
      agentScopes: ["world:read"],
    });
    expect(agent.agentScopes).toEqual(["world:read"]);
    expect(agent.audience).toBe("agent");
    const prepared = agent.prepareCommand({ kind: "sandbox.echo", message: "read only" });
    await expect(agent.submitCommand(prepared)).rejects.toMatchObject({
      code: "FORBIDDEN",
      serverCode: "MISSING_GAME_ACT_SCOPE",
    });
  });

  it("reads a bounded kingdom view through the versioned client request", async () => {
    const transport: ClientTransport = {
      send: async (request) => {
        expect(request.method).toBe("GET");
        expect(request.path).toBe("/v1/world/kingdoms/00000000-0000-4000-8000-000000000001?forecastMinutes=3");
        expect(request.headers["x-pact-api-version"]).toBe(API_VERSION);
        return { status: 200, body: { audience: "public" } };
      },
    };
    await expect(client(transport).readKingdomView("00000000-0000-4000-8000-000000000001", 3)).resolves.toEqual({
      audience: "public",
    });
  });

  it("reads a typed report through the same authenticated transport", async () => {
    const transport: ClientTransport = {
      send: async (request) => {
        expect(request.method).toBe("GET");
        expect(request.path).toBe("/v1/reports/raid_participant/00000000-0000-4000-8000-000000000001");
        expect(request.headers["x-pact-api-version"]).toBe(API_VERSION);
        return { status: 200, body: { winner: "defender" } };
      },
    };
    await expect(
      client(transport).readReport("raid_participant", "00000000-0000-4000-8000-000000000001"),
    ).resolves.toEqual({ winner: "defender" });
  });
});
