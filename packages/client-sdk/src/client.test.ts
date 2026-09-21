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

  it("rejects human clients with agent scopes and never manufactures human scopes for agents", () => {
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
  });
});
