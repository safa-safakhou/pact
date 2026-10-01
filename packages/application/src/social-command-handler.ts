import type { CourtCommand, PoliticsCommand, SealCommand, SocialCommand } from "@pact/contracts";
import type { CourtService, InvitationService, PoliticsService, SealService } from "@pact/kingdom";
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
  ) {}
  async execute(
    client: PoolClient,
    principal: AuthenticatedPrincipal,
    command: SocialCommand | CourtCommand | PoliticsCommand | SealCommand,
    gameTimeMs: number,
  ): Promise<{ recordVersions: Record<string, number>; result: unknown }> {
    if (principal.audience !== "human") throw new DispatcherError("FORBIDDEN");
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
