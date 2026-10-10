import { PactClientError, type PreparedCommand } from "@pact/client-sdk";
import { AcceptedCommandEnvelopeSchema } from "@pact/contracts";

const prefix = "pact_conversation_pending:";
export function definiteMessageRefusal(error: unknown) {
  return (
    error instanceof PactClientError &&
    [400, 403, 422].includes(error.status ?? 0) &&
    error.serverCode !== "IDEMPOTENCY_CONFLICT"
  );
}
export interface PrivateTabStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
/** Tab-private exact intent. Owner namespace prevents cross-account restoration; no credentials are stored. */
export class ConversationOutbox {
  constructor(private readonly storage: PrivateTabStorage) {}
  save(ownerId: string, command: PreparedCommand) {
    if (command.action.kind !== "game.message.send") throw Error("NOT_MESSAGE");
    this.storage.setItem(prefix + ownerId, JSON.stringify(command));
  }
  restore(ownerId: string): PreparedCommand | null {
    const raw = this.storage.getItem(prefix + ownerId);
    if (!raw) return null;
    try {
      const command = AcceptedCommandEnvelopeSchema.parse(JSON.parse(raw));
      if (command.action.kind !== "game.message.send" || command.actor.audience !== "human") return null;
      return command;
    } catch {
      return null;
    }
  }
  confirmed(ownerId: string) {
    this.storage.removeItem(prefix + ownerId);
  }
}
