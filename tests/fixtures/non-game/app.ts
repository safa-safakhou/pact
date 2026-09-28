import { randomUUID } from "node:crypto";
import { ExactApprovals } from "@pact/approvals/portable";
import { AesGcmSecretBox, type ScopedPrincipal, ScopedSessions, TokenDigester } from "@pact/identity/portable";
import { ScopedNotifications } from "@pact/inbox/portable";
import { DeterministicFakeProvider, fakeProviderModel, ProviderRouter } from "@pact/model-provider";
import { BoundedRun } from "@pact/runs/portable";
import { MemoryApprovals, MemoryLeases, MemoryNotifications, MemorySessions } from "./memory.js";

export interface NoteAction {
  readonly type: "note.publish.v1";
  readonly text: string;
  readonly expectedVersion: number;
}
export interface NoteReceipt {
  readonly commandId: string;
  readonly version: number;
}
export function normalizeNote(raw: unknown): NoteAction {
  if (!raw || typeof raw !== "object") throw new Error("INVALID_ACTION");
  const value = raw as Record<string, unknown>;
  if (
    Object.keys(value).sort().join(",") !== "expectedVersion,text,type" ||
    value.type !== "note.publish.v1" ||
    typeof value.text !== "string" ||
    value.text.length < 1 ||
    value.text.length > 80 ||
    !Number.isSafeInteger(value.expectedVersion) ||
    (value.expectedVersion as number) < 0
  )
    throw new Error("INVALID_ACTION");
  return { type: "note.publish.v1", text: value.text, expectedVersion: value.expectedVersion as number };
}
/** All products intentionally share adapter objects, account IDs and encryption keys in this isolation test. */
export function sharedMemory(now: () => number) {
  const documents = new Map<string, { version: number; text: string }>();
  return {
    documents,
    sessions: new MemorySessions(),
    leases: new MemoryLeases(now),
    events: new MemoryNotifications(),
    approvals: new MemoryApprovals<NoteAction, NoteReceipt>(() => {
      const snapshot = structuredClone(documents);
      return () => {
        documents.clear();
        for (const [key, value] of snapshot) documents.set(key, value);
      };
    }),
    credentials: new Map<string, string>(),
  };
}
export class NotesApp {
  readonly sessions: ScopedSessions;
  readonly approvals: ExactApprovals<NoteAction, NoteReceipt>;
  readonly notifications: ScopedNotifications;
  readonly router: ProviderRouter;
  private readonly box = new AesGcmSecretBox(Buffer.alloc(32, 11));
  providerCalls = 0;
  constructor(
    readonly scope: string,
    private readonly memory: ReturnType<typeof sharedMemory>,
    private readonly now: () => number,
  ) {
    this.sessions = new ScopedSessions(scope, memory.sessions, new TokenDigester(Buffer.alloc(32, 17)), now);
    this.approvals = new ExactApprovals(scope, memory.approvals, normalizeNote, now);
    this.notifications = new ScopedNotifications(scope, memory.events);
    const fake = new DeterministicFakeProvider({
      scenario: "success",
      toolName: "note_propose_v1",
      toolArguments: { type: "note.publish.v1", text: "Synthetic notice", expectedVersion: 0 },
    });
    this.router = new ProviderRouter([
      {
        provider: fake.provider,
        listModels: (signal) => fake.listModels(signal),
        invoke: (request) => {
          this.providerCalls++;
          return fake.invoke(request);
        },
      },
    ]);
  }
  connectFixture(accountId: string, audience: ScopedPrincipal["audience"]) {
    return this.sessions.issue({ productScope: this.scope, accountId, audience });
  }
  private credentialKey(accountId: string) {
    return JSON.stringify([this.scope, accountId]);
  }
  storeFixtureCredential(token: string, credential: Uint8Array) {
    const principal = this.sessions.authenticate(token);
    if (principal.audience !== "human") throw new Error("FORBIDDEN");
    this.memory.credentials.set(this.credentialKey(principal.accountId), this.box.seal(credential));
  }
  credential(token: string) {
    const principal = this.sessions.authenticate(token),
      sealed = this.memory.credentials.get(this.credentialKey(principal.accountId));
    if (!sealed) throw new Error("NOT_FOUND");
    return this.box.open(sealed);
  }
  start(token: string, maxCalls = 1, maxTokens = 4000) {
    const principal = this.sessions.authenticate(token);
    return new BoundedRun(principal, randomUUID(), this.memory.leases, this.now, {
      maxCalls,
      maxTokens,
      durationMs: 900000,
    });
  }
  async proposeFromModel(token: string, run: BoundedRun) {
    const principal = this.sessions.authenticate(token);
    run.assertOwner(principal);
    // Fake inference returns a proposal, never an autonomous publication or human approval.
    const action = await run.step(500, async (outputCeiling) => {
      const prepared = await this.router.prepare(
        { provider: "fixture", model: fakeProviderModel.id, credentialId: "synthetic" },
        500,
        outputCeiling,
        new AbortController().signal,
      );
      const result = await this.router.run(prepared, {
        requestId: randomUUID(),
        messages: [{ role: "user", content: "Draft a notice; request human approval." }],
        tools: [
          {
            name: "note_propose_v1",
            description: "Draft a synthetic notice only",
            inputSchema: { type: "object" },
            parseArguments: normalizeNote,
          },
        ],
        credential: this.credential(token),
        signal: new AbortController().signal,
      });
      const call = result.response.toolCalls[0];
      if (!call) throw new Error("MISSING_PROPOSAL");
      return {
        value: normalizeNote(call.arguments),
        ...("inputTokens" in result.usage ? { tokens: result.usage.inputTokens + result.usage.outputTokens } : {}),
      };
    });
    this.sessions.authenticate(token); // Revocation during inference must prevent a new proposal.
    return this.approvals.propose(principal, randomUUID(), action);
  }
  approve(token: string, commandId: string, raw: unknown) {
    const principal = this.sessions.authenticate(token);
    const receipt = this.approvals.approve(principal, commandId, raw, (action) => {
      if (action.expectedVersion !== this.published.version) throw new Error("STALE_VERSION");
      // All potentially failing validation precedes this synchronous synthetic commit.
      const version = this.published.version + 1;
      this.memory.documents.set(this.scope, { text: action.text, version });
      return { commandId, version };
    });
    // Notification delivery is post-commit and idempotent; a replay can repair missed delivery.
    this.notifications.publish({
      productScope: this.scope,
      accountId: principal.accountId,
      eventId: commandId,
      type: "note.published.v1",
    });
    return receipt;
  }
  get published() {
    return { ...(this.memory.documents.get(this.scope) ?? { version: 0, text: "" }) };
  }
}
