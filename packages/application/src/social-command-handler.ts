import type { ChronicleCommand, CourtCommand, PoliticsCommand, SealCommand, SocialCommand } from "@pact/contracts";
import type {
  ChronicleService,
  CourtService,
  InvitationService,
  PoliticsService,
  SealService,
  SocialService,
} from "@pact/kingdom";
import type { PoolClient } from "pg";
import type { SocialCommandPort } from "./dispatcher.js";
import { type AuthenticatedPrincipal, DispatcherError } from "./types.js";

/** All invitation writes are explicit authenticated human decisions, never an agent's implied consent. */
export class SocialCommandHandler implements SocialCommandPort {
  constructor(
    private readonly invitations: InvitationService,
    private readonly courts?: CourtService,
    private readonly politics?: PoliticsService,
    private readonly seals?: SealService,
    private readonly chronicle?: ChronicleService,
    private readonly social?: SocialService,
  ) {}
  async execute(
    client: PoolClient,
    principal: AuthenticatedPrincipal,
    command: SocialCommand | CourtCommand | PoliticsCommand | SealCommand | ChronicleCommand,
    gameTimeMs: number,
  ): Promise<{ recordVersions: Record<string, number>; result: unknown }> {
    if (principal.audience !== "human") throw new DispatcherError("FORBIDDEN");
    if (command.schemaVersion === "pact.chronicle-command.v1") {
      if (!this.chronicle) throw new DispatcherError("INVALID_COMMAND");
      return this.chronicle.execute(client, principal.accountId, command, gameTimeMs);
    }
    if (command.schemaVersion === "pact.seal-command.v1") {
      if (!this.seals) throw new DispatcherError("INVALID_COMMAND");
      return this.seals.execute(client, principal.accountId, command, gameTimeMs);
    }
    if (command.schemaVersion === "pact.politics-command.v1") {
      if (!this.politics) throw new DispatcherError("INVALID_COMMAND");
      return this.politics.execute(client, principal.accountId, command, gameTimeMs);
    }
    if (command.schemaVersion === "pact.court-command.v1") {
      if (!this.courts) throw new DispatcherError("INVALID_COMMAND");
      return this.courts.execute(client, principal.accountId, command, gameTimeMs);
    }
    const action = command.action;
    switch (action.kind) {
      case "conversation.observation": {
        if (!this.social) throw new DispatcherError("INVALID_COMMAND");
        const result = await this.social.configureObservation(client, principal.accountId, action, gameTimeMs);
        return {
          recordVersions: { [`observation:${action.peerKingdomId}:${action.observerKingdomId}`]: result.version },
          result,
        };
      }
      case "contact.delegation": {
        if (!this.social) throw new DispatcherError("INVALID_COMMAND");
        const result = await this.social.configureDelegation(client, principal.accountId, action, gameTimeMs);
        return { recordVersions: { [`social-delegation:${principal.accountId}`]: result.version }, result };
      }
      case "invitation.issue": {
        const result = await this.invitations.issue(
          client,
          principal.accountId,
          {
            destinationType: action.destinationType,
            destinationId: action.destinationId,
            ...(action.redemptionLimit === undefined ? {} : { redemptionLimit: action.redemptionLimit }),
          },
          gameTimeMs,
        );
        return { recordVersions: { [`invitation:${result.invitationId}`]: 1 }, result };
      }
      case "invitation.revoke": {
        const version = await this.invitations.revoke(client, principal.accountId, action.invitationId);
        return { recordVersions: { [`invitation:${action.invitationId}`]: version }, result: null };
      }
      case "invitation.remember": {
        const result = await this.invitations.remember(client, principal.accountId, action.token, gameTimeMs);
        return { recordVersions: { [`invitation:${result.invitationId}`]: result.version ?? 1 }, result };
      }
      case "invitation.accept":
      case "invitation.accept-remembered": {
        const result = await this.invitations.accept(
          client,
          principal.accountId,
          action.kind === "invitation.accept" ? { token: action.token } : { remembered: true },
          gameTimeMs,
        );
        return { recordVersions: { [`invitation:${result.invitationId}`]: result.version ?? 1 }, result };
      }
    }
  }
}
