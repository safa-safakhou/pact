import { createHash, randomBytes, randomUUID } from "node:crypto";
import { appendOutbox } from "@pact/db";
import { rulesCatalog, wholeResources } from "@pact/domain";
import type { ResourceLedger } from "@pact/ledger";
import type { PoolClient } from "pg";
import type { ActionLimitService } from "./action-limits.js";
import type { ImmediateAuthorityPort } from "./exposure-adapters.js";

type Resource = "iron" | "silver" | "grain";

interface RequestRow {
  id: string;
  sender_kingdom_id: string;
  recipient_kingdom_id: string;
  note: string;
  expires_game_time_ms: string;
  status: string;
}

interface MessageRow {
  id: string;
  sender_kingdom_id: string;
  recipient_kingdom_id: string;
  body: string;
  agent_originated: boolean;
  sent_game_time_ms: string;
  read_game_time_ms: string | null;
}

interface TransferRow {
  id: string;
  recipient_kingdom_id: string;
  resource: Resource;
  requested_units: string;
  credited_units: string;
  overflow_units: string;
}

interface InvitationRow {
  id: string;
  issuer_kingdom_id: string;
  expires_at: Date;
  redeemed_by_kingdom_id: string | null;
  revoked_at: Date | null;
}

export class SocialError extends Error {
  constructor(
    readonly code:
      | "KINGDOM_NOT_FOUND"
      | "SELF_CONTACT"
      | "BLOCKED"
      | "NOT_CONTACT"
      | "ALREADY_CONTACT"
      | "REQUEST_EXISTS"
      | "REQUEST_NOT_FOUND"
      | "REQUEST_EXPIRED"
      | "CONTACT_QUEUE_FULL"
      | "MESSAGE_QUEUE_FULL"
      | "MESSAGE_TOO_LONG"
      | "INVALID_NOTE"
      | "INVALID_AMOUNT"
      | "OPERATION_CONFLICT"
      | "INVITATION_FULL"
      | "INVITATION_INVALID",
  ) {
    super(code);
    this.name = "SocialError";
  }
}

function pair(left: string, right: string): [string, string] {
  if (left === right) throw new SocialError("SELF_CONTACT");
  return left < right ? [left, right] : [right, left];
}

function validText(value: string, maximum: number, code: SocialError["code"]): void {
  const count = [...value].length;
  if (count === 0 || count > maximum || value.includes("\u0000")) throw new SocialError(code);
}

/** PACT-owned social state. All writes receive the caller's game transaction. */
export class SocialService {
  constructor(
    private readonly productScope: string,
    private readonly ledger: ResourceLedger,
    private readonly limits: ActionLimitService,
    private readonly clock: { now(): Date },
    private readonly authority?: ImmediateAuthorityPort,
  ) {}

  private async ownerKingdom(client: PoolClient, accountId: string): Promise<string> {
    const result = await client.query<{ id: string }>(
      "SELECT id FROM kingdoms WHERE product_scope = $1 AND account_id = $2 AND status = 'ranked'",
      [this.productScope, accountId],
    );
    if (!result.rows[0]) throw new SocialError("KINGDOM_NOT_FOUND");
    return result.rows[0].id;
  }

  private async lockPair(client: PoolClient, left: string, right: string): Promise<[string, string]> {
    const [a, b] = pair(left, right);
    const rows = await client.query<{ id: string }>(
      "SELECT id FROM kingdoms WHERE product_scope = $1 AND status = 'ranked' AND id IN ($2, $3) ORDER BY id FOR UPDATE",
      [this.productScope, a, b],
    );
    if (rows.rowCount !== 2) throw new SocialError("KINGDOM_NOT_FOUND");
    return [a, b];
  }

  async isBlocked(client: PoolClient, left: string, right: string): Promise<boolean> {
    const result = await client.query(
      `SELECT 1 FROM social_blocks WHERE product_scope = $1
       AND ((blocker_kingdom_id = $2 AND blocked_kingdom_id = $3)
         OR (blocker_kingdom_id = $3 AND blocked_kingdom_id = $2))`,
      [this.productScope, left, right],
    );
    return Boolean(result.rowCount);
  }

  async assertDirectCommunicationAllowed(client: PoolClient, left: string, right: string): Promise<void> {
    pair(left, right);
    if (await this.isBlocked(client, left, right)) throw new SocialError("BLOCKED");
  }

  private async isContact(client: PoolClient, left: string, right: string): Promise<boolean> {
    const [a, b] = pair(left, right);
    const result = await client.query(
      "SELECT 1 FROM social_contacts WHERE product_scope = $1 AND kingdom_a = $2 AND kingdom_b = $3",
      [this.productScope, a, b],
    );
    return Boolean(result.rowCount);
  }

  async requestContact(
    client: PoolClient,
    input: {
      accountId: string;
      recipientKingdomId: string;
      note: string;
      operationKey: string;
      gameTimeMs: number;
      actorKind?: "human" | "agent";
      mandateVersion?: number;
    },
  ): Promise<string> {
    validText(input.note, rulesCatalog.actionLimits.messageCodePoints, "INVALID_NOTE");
    const sender = await this.ownerKingdom(client, input.accountId);
    const old = await client.query<RequestRow>(
      "SELECT * FROM cold_contact_requests WHERE product_scope = $1 AND sender_kingdom_id = $2 AND operation_key = $3",
      [this.productScope, sender, input.operationKey],
    );
    if (old.rows[0]) {
      if (old.rows[0].recipient_kingdom_id !== input.recipientKingdomId || old.rows[0].note !== input.note)
        throw new SocialError("OPERATION_CONFLICT");
      return old.rows[0].id;
    }
    await this.lockPair(client, sender, input.recipientKingdomId);
    const concurrent = await client.query<RequestRow>(
      "SELECT * FROM cold_contact_requests WHERE product_scope = $1 AND sender_kingdom_id = $2 AND operation_key = $3",
      [this.productScope, sender, input.operationKey],
    );
    if (concurrent.rows[0]) {
      if (
        concurrent.rows[0].recipient_kingdom_id !== input.recipientKingdomId ||
        concurrent.rows[0].note !== input.note
      )
        throw new SocialError("OPERATION_CONFLICT");
      return concurrent.rows[0].id;
    }
    await this.assertDirectCommunicationAllowed(client, sender, input.recipientKingdomId);
    if (await this.isContact(client, sender, input.recipientKingdomId)) throw new SocialError("ALREADY_CONTACT");
    const pending = await client.query<{ sender_kingdom_id: string }>(
      `SELECT sender_kingdom_id FROM cold_contact_requests WHERE product_scope = $1
       AND recipient_kingdom_id = $2 AND status = 'pending' AND expires_game_time_ms > $3`,
      [this.productScope, input.recipientKingdomId, input.gameTimeMs],
    );
    if ((pending.rowCount ?? 0) >= 8) throw new SocialError("CONTACT_QUEUE_FULL");
    const duplicate = await client.query(
      `SELECT 1 FROM cold_contact_requests WHERE product_scope = $1 AND status = 'pending'
       AND expires_game_time_ms > $4
       AND ((sender_kingdom_id = $2 AND recipient_kingdom_id = $3)
         OR (sender_kingdom_id = $3 AND recipient_kingdom_id = $2))`,
      [this.productScope, sender, input.recipientKingdomId, input.gameTimeMs],
    );
    if (duplicate.rowCount) throw new SocialError("REQUEST_EXISTS");
    await this.limits.recordSuccessfulAction(client, {
      kingdomId: sender,
      kind: "cold_contact",
      operationKey: input.operationKey,
      gameTimeMs: input.gameTimeMs,
    });
    if (input.actorKind === "agent") {
      if (!this.authority) throw new Error("IMMEDIATE_AUTHORITY_NOT_CONFIGURED");
      await this.authority.spend(client, {
        accountId: input.accountId,
        asset: "silver",
        units: wholeResources(rulesCatalog.actionLimits.coldContactSilver),
        action: "contact.request",
        operationKey: `cold-contact:${input.operationKey}`,
        ...(input.mandateVersion === undefined ? {} : { mandateVersion: input.mandateVersion }),
        gameTimeMs: input.gameTimeMs,
      });
    }
    await this.ledger.debit(client, {
      kingdomId: sender,
      resource: "silver",
      amount: wholeResources(rulesCatalog.actionLimits.coldContactSilver),
      purpose: "trade",
      operationKey: `cold-contact:${input.operationKey}`,
      gameTimeMs: input.gameTimeMs,
    });
    const requestId = randomUUID();
    await client.query(
      `INSERT INTO cold_contact_requests(id, product_scope, sender_kingdom_id, recipient_kingdom_id,
         note, operation_key, created_game_time_ms, expires_game_time_ms, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')`,
      [
        requestId,
        this.productScope,
        sender,
        input.recipientKingdomId,
        input.note,
        input.operationKey,
        input.gameTimeMs,
        input.gameTimeMs + 7 * 86_400_000,
      ],
    );
    await this.emit(client, "contact.requested.v1", {
      requestId,
      senderKingdomId: sender,
      recipientKingdomId: input.recipientKingdomId,
    });
    return requestId;
  }

  async answerRequest(
    client: PoolClient,
    input: { accountId: string; requestId: string; accept: boolean; gameTimeMs: number },
  ): Promise<void> {
    const recipient = await this.ownerKingdom(client, input.accountId);
    const found = await client.query<RequestRow>(
      "SELECT * FROM cold_contact_requests WHERE product_scope = $1 AND id = $2",
      [this.productScope, input.requestId],
    );
    const request = found.rows[0];
    if (!request || request.recipient_kingdom_id !== recipient) throw new SocialError("REQUEST_NOT_FOUND");
    await this.lockPair(client, request.sender_kingdom_id, recipient);
    const locked = await client.query<RequestRow>(
      "SELECT * FROM cold_contact_requests WHERE product_scope = $1 AND id = $2 FOR UPDATE",
      [this.productScope, input.requestId],
    );
    if (locked.rows[0]?.status === (input.accept ? "accepted" : "declined")) return;
    if (locked.rows[0]?.status !== "pending") throw new SocialError("REQUEST_NOT_FOUND");
    if (Number(request.expires_game_time_ms) <= input.gameTimeMs) throw new SocialError("REQUEST_EXPIRED");
    if (input.accept) {
      await this.assertDirectCommunicationAllowed(client, request.sender_kingdom_id, recipient);
      await this.createContact(client, request.sender_kingdom_id, recipient, input.gameTimeMs);
    }
    await client.query("UPDATE cold_contact_requests SET status = $2 WHERE id = $1", [
      input.requestId,
      input.accept ? "accepted" : "declined",
    ]);
    await this.emit(client, input.accept ? "contact.accepted.v1" : "contact.declined.v1", {
      requestId: input.requestId,
    });
  }

  private async createContact(client: PoolClient, left: string, right: string, gameTimeMs: number): Promise<void> {
    const [a, b] = pair(left, right);
    await client.query(
      `INSERT INTO social_contacts(product_scope, kingdom_a, kingdom_b, accepted_game_time_ms)
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [this.productScope, a, b, gameTimeMs],
    );
  }

  async endContact(client: PoolClient, accountId: string, otherKingdomId: string): Promise<void> {
    const kingdomId = await this.ownerKingdom(client, accountId);
    const [a, b] = await this.lockPair(client, kingdomId, otherKingdomId);
    await client.query("DELETE FROM social_contacts WHERE product_scope = $1 AND kingdom_a = $2 AND kingdom_b = $3", [
      this.productScope,
      a,
      b,
    ]);
  }

  async setBlock(
    client: PoolClient,
    accountId: string,
    otherKingdomId: string,
    blocked: boolean,
    gameTimeMs: number,
  ): Promise<void> {
    const kingdomId = await this.ownerKingdom(client, accountId);
    await this.lockPair(client, kingdomId, otherKingdomId);
    if (blocked) {
      await client.query(
        `INSERT INTO social_blocks(product_scope, blocker_kingdom_id, blocked_kingdom_id, created_game_time_ms)
         VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
        [this.productScope, kingdomId, otherKingdomId, gameTimeMs],
      );
      await client.query(
        `UPDATE cold_contact_requests SET status = 'canceled' WHERE product_scope = $1 AND status = 'pending'
         AND ((sender_kingdom_id = $2 AND recipient_kingdom_id = $3)
           OR (sender_kingdom_id = $3 AND recipient_kingdom_id = $2))`,
        [this.productScope, kingdomId, otherKingdomId],
      );
    } else {
      await client.query(
        "DELETE FROM social_blocks WHERE product_scope = $1 AND blocker_kingdom_id = $2 AND blocked_kingdom_id = $3",
        [this.productScope, kingdomId, otherKingdomId],
      );
    }
  }

  async setMute(client: PoolClient, accountId: string, otherKingdomId: string, muted: boolean): Promise<void> {
    const kingdomId = await this.ownerKingdom(client, accountId);
    await this.lockPair(client, kingdomId, otherKingdomId);
    if (muted) {
      await client.query(
        "INSERT INTO social_mutes(product_scope, muter_kingdom_id, muted_kingdom_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
        [this.productScope, kingdomId, otherKingdomId],
      );
    } else {
      await client.query(
        "DELETE FROM social_mutes WHERE product_scope = $1 AND muter_kingdom_id = $2 AND muted_kingdom_id = $3",
        [this.productScope, kingdomId, otherKingdomId],
      );
    }
  }

  async sendMessage(
    client: PoolClient,
    input: {
      accountId: string;
      recipientKingdomId: string;
      body: string;
      agentOriginated: boolean;
      operationKey: string;
      gameTimeMs: number;
    },
  ): Promise<string> {
    validText(input.body, rulesCatalog.actionLimits.messageCodePoints, "MESSAGE_TOO_LONG");
    const sender = await this.ownerKingdom(client, input.accountId);
    const existing = await client.query<MessageRow>(
      "SELECT * FROM direct_messages WHERE product_scope = $1 AND sender_kingdom_id = $2 AND operation_key = $3",
      [this.productScope, sender, input.operationKey],
    );
    if (existing.rows[0]) {
      if (
        existing.rows[0].recipient_kingdom_id !== input.recipientKingdomId ||
        existing.rows[0].body !== input.body ||
        existing.rows[0].agent_originated !== input.agentOriginated
      )
        throw new SocialError("OPERATION_CONFLICT");
      return existing.rows[0].id;
    }
    await this.lockPair(client, sender, input.recipientKingdomId);
    const concurrent = await client.query<MessageRow>(
      "SELECT * FROM direct_messages WHERE product_scope = $1 AND sender_kingdom_id = $2 AND operation_key = $3",
      [this.productScope, sender, input.operationKey],
    );
    if (concurrent.rows[0]) {
      if (
        concurrent.rows[0].recipient_kingdom_id !== input.recipientKingdomId ||
        concurrent.rows[0].body !== input.body ||
        concurrent.rows[0].agent_originated !== input.agentOriginated
      )
        throw new SocialError("OPERATION_CONFLICT");
      return concurrent.rows[0].id;
    }
    await this.assertDirectCommunicationAllowed(client, sender, input.recipientKingdomId);
    if (!(await this.isContact(client, sender, input.recipientKingdomId))) throw new SocialError("NOT_CONTACT");
    const unread = await client.query<{ count: number }>(
      `SELECT count(*)::integer AS count FROM direct_messages WHERE product_scope = $1
       AND sender_kingdom_id = $2 AND recipient_kingdom_id = $3 AND read_game_time_ms IS NULL`,
      [this.productScope, sender, input.recipientKingdomId],
    );
    if ((unread.rows[0]?.count ?? 0) >= 4) throw new SocialError("MESSAGE_QUEUE_FULL");
    if (input.agentOriginated) {
      const queued = await client.query<{ count: number }>(
        `SELECT count(*)::integer AS count FROM direct_messages WHERE product_scope = $1
         AND recipient_kingdom_id = $2 AND agent_originated AND read_game_time_ms IS NULL`,
        [this.productScope, input.recipientKingdomId],
      );
      if ((queued.rows[0]?.count ?? 0) >= 48) throw new SocialError("MESSAGE_QUEUE_FULL");
    }
    await this.limits.recordSuccessfulAction(client, {
      kingdomId: sender,
      kind: "outgoing_message",
      operationKey: input.operationKey,
      gameTimeMs: input.gameTimeMs,
    });
    const id = randomUUID();
    await client.query(
      `INSERT INTO direct_messages(id, product_scope, sender_kingdom_id, recipient_kingdom_id,
         body, agent_originated, operation_key, sent_game_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        this.productScope,
        sender,
        input.recipientKingdomId,
        input.body,
        input.agentOriginated,
        input.operationKey,
        input.gameTimeMs,
      ],
    );
    const muted = await client.query(
      "SELECT 1 FROM social_mutes WHERE product_scope = $1 AND muter_kingdom_id = $2 AND muted_kingdom_id = $3",
      [this.productScope, input.recipientKingdomId, sender],
    );
    await this.emit(client, "message.sent.v1", {
      messageId: id,
      senderKingdomId: sender,
      recipientKingdomId: input.recipientKingdomId,
      alert: !muted.rowCount,
    });
    return id;
  }

  async listMessages(client: PoolClient, accountId: string, otherKingdomId: string, limit = 50): Promise<MessageRow[]> {
    const kingdomId = await this.ownerKingdom(client, accountId);
    pair(kingdomId, otherKingdomId);
    const result = await client.query<MessageRow>(
      `SELECT id, sender_kingdom_id, recipient_kingdom_id, body, agent_originated,
         sent_game_time_ms, read_game_time_ms FROM direct_messages
       WHERE product_scope = $1 AND ((sender_kingdom_id = $2 AND recipient_kingdom_id = $3)
         OR (sender_kingdom_id = $3 AND recipient_kingdom_id = $2))
       ORDER BY sent_game_time_ms DESC, id DESC LIMIT $4`,
      [this.productScope, kingdomId, otherKingdomId, Math.min(Math.max(limit, 1), 100)],
    );
    return result.rows;
  }

  async markRead(client: PoolClient, accountId: string, otherKingdomId: string, gameTimeMs: number): Promise<number> {
    const recipient = await this.ownerKingdom(client, accountId);
    await this.lockPair(client, recipient, otherKingdomId);
    const result = await client.query(
      `UPDATE direct_messages SET read_game_time_ms = $4
       WHERE product_scope = $1 AND recipient_kingdom_id = $2 AND sender_kingdom_id = $3
         AND read_game_time_ms IS NULL`,
      [this.productScope, recipient, otherKingdomId, gameTimeMs],
    );
    return result.rowCount ?? 0;
  }

  async transfer(
    client: PoolClient,
    input: {
      accountId: string;
      recipientKingdomId: string;
      resource: Resource;
      wholeAmount: number;
      operationKey: string;
      gameTimeMs: number;
      actorKind?: "human" | "agent";
      mandateVersion?: number;
    },
  ): Promise<{ id: string; credited: bigint; overflow: bigint }> {
    if (!Number.isSafeInteger(input.wholeAmount) || input.wholeAmount <= 0) throw new SocialError("INVALID_AMOUNT");
    const sender = await this.ownerKingdom(client, input.accountId);
    const existing = await client.query<TransferRow>(
      "SELECT * FROM direct_transfers WHERE product_scope = $1 AND sender_kingdom_id = $2 AND operation_key = $3",
      [this.productScope, sender, input.operationKey],
    );
    const amount = wholeResources(input.wholeAmount);
    if (existing.rows[0]) {
      const old = existing.rows[0];
      if (
        old.recipient_kingdom_id !== input.recipientKingdomId ||
        old.resource !== input.resource ||
        BigInt(old.requested_units) !== amount
      )
        throw new SocialError("OPERATION_CONFLICT");
      return { id: old.id, credited: BigInt(old.credited_units), overflow: BigInt(old.overflow_units) };
    }
    await this.lockPair(client, sender, input.recipientKingdomId);
    const concurrent = await client.query<TransferRow>(
      "SELECT * FROM direct_transfers WHERE product_scope = $1 AND sender_kingdom_id = $2 AND operation_key = $3",
      [this.productScope, sender, input.operationKey],
    );
    if (concurrent.rows[0]) {
      const old = concurrent.rows[0];
      if (
        old.recipient_kingdom_id !== input.recipientKingdomId ||
        old.resource !== input.resource ||
        BigInt(old.requested_units) !== amount
      )
        throw new SocialError("OPERATION_CONFLICT");
      return { id: old.id, credited: BigInt(old.credited_units), overflow: BigInt(old.overflow_units) };
    }
    await this.assertDirectCommunicationAllowed(client, sender, input.recipientKingdomId);
    if (!(await this.isContact(client, sender, input.recipientKingdomId))) throw new SocialError("NOT_CONTACT");
    await this.limits.recordSuccessfulAction(client, {
      kingdomId: sender,
      kind: "transfer",
      operationKey: input.operationKey,
      gameTimeMs: input.gameTimeMs,
    });
    if (input.actorKind === "agent") {
      if (!this.authority) throw new Error("IMMEDIATE_AUTHORITY_NOT_CONFIGURED");
      await this.authority.spend(client, {
        accountId: input.accountId,
        asset: input.resource,
        units: amount,
        action: "transfer",
        operationKey: `transfer:${input.operationKey}`,
        ...(input.mandateVersion === undefined ? {} : { mandateVersion: input.mandateVersion }),
        gameTimeMs: input.gameTimeMs,
      });
    }
    await this.ledger.debit(client, {
      kingdomId: sender,
      resource: input.resource,
      amount,
      purpose: "transfer",
      operationKey: `transfer-out:${input.operationKey}`,
      gameTimeMs: input.gameTimeMs,
    });
    const credit = await this.ledger.creditOrdinary(client, {
      kingdomId: input.recipientKingdomId,
      resource: input.resource,
      amount,
      operationKey: `transfer-in:${input.operationKey}`,
      reason: "transfer",
      gameTimeMs: input.gameTimeMs,
    });
    const id = randomUUID();
    await client.query(
      `INSERT INTO direct_transfers(id, product_scope, sender_kingdom_id, recipient_kingdom_id,
         resource, requested_units, credited_units, overflow_units, operation_key, game_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        this.productScope,
        sender,
        input.recipientKingdomId,
        input.resource,
        amount.toString(),
        credit.ordinaryDelta.toString(),
        credit.overflow.toString(),
        input.operationKey,
        input.gameTimeMs,
      ],
    );
    await this.emit(client, "transfer.completed.v1", {
      transferId: id,
      senderKingdomId: sender,
      recipientKingdomId: input.recipientKingdomId,
    });
    return { id, credited: credit.ordinaryDelta, overflow: credit.overflow };
  }

  async issueDirectInvitation(client: PoolClient, accountId: string, gameTimeMs: number): Promise<string> {
    const issuer = await this.ownerKingdom(client, accountId);
    await client.query("SELECT id FROM kingdoms WHERE product_scope = $1 AND id = $2 FOR UPDATE", [
      this.productScope,
      issuer,
    ]);
    const now = this.clock.now();
    const active = await client.query<{ count: number }>(
      `SELECT count(*)::integer AS count FROM direct_contact_invitations
       WHERE product_scope = $1 AND issuer_kingdom_id = $2 AND expires_at > $3
         AND redeemed_at IS NULL AND revoked_at IS NULL`,
      [this.productScope, issuer, now],
    );
    const daily = await client.query<{ count: number }>(
      `SELECT count(*)::integer AS count FROM direct_contact_invitations
       WHERE product_scope = $1 AND issuer_kingdom_id = $2 AND issued_game_time_ms > $3`,
      [this.productScope, issuer, gameTimeMs - 86_400_000],
    );
    if ((active.rows[0]?.count ?? 0) >= 20 || (daily.rows[0]?.count ?? 0) >= 20)
      throw new SocialError("INVITATION_FULL");
    const token = randomBytes(24).toString("base64url");
    const hash = createHash("sha256").update(token).digest();
    await client.query(
      `INSERT INTO direct_contact_invitations(id, product_scope, issuer_kingdom_id, token_hash, issued_game_time_ms, issued_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [randomUUID(), this.productScope, issuer, hash, gameTimeMs, now, new Date(now.getTime() + 7 * 86_400_000)],
    );
    await this.emit(client, "contact.invitation.issued.v1", { issuerKingdomId: issuer, gameTimeMs });
    return token;
  }

  async acceptDirectInvitation(
    client: PoolClient,
    accountId: string,
    token: string,
    gameTimeMs: number,
  ): Promise<void> {
    const recipient = await this.ownerKingdom(client, accountId);
    if (!/^[A-Za-z0-9_-]{32}$/.test(token)) throw new SocialError("INVITATION_INVALID");
    const hash = createHash("sha256").update(token).digest();
    const found = await client.query<InvitationRow>(
      "SELECT * FROM direct_contact_invitations WHERE product_scope = $1 AND token_hash = $2",
      [this.productScope, hash],
    );
    const invitation = found.rows[0];
    if (!invitation) throw new SocialError("INVITATION_INVALID");
    await this.lockPair(client, invitation.issuer_kingdom_id, recipient);
    const locked = await client.query<InvitationRow>(
      "SELECT * FROM direct_contact_invitations WHERE product_scope = $1 AND id = $2 FOR UPDATE",
      [this.productScope, invitation.id],
    );
    const current = locked.rows[0];
    if (current?.redeemed_by_kingdom_id === recipient) return;
    if (!current || current.redeemed_by_kingdom_id || current.revoked_at || current.expires_at <= this.clock.now())
      throw new SocialError("INVITATION_INVALID");
    await this.assertDirectCommunicationAllowed(client, invitation.issuer_kingdom_id, recipient);
    await this.createContact(client, invitation.issuer_kingdom_id, recipient, gameTimeMs);
    await client.query(
      "UPDATE direct_contact_invitations SET redeemed_by_kingdom_id = $2, redeemed_at = $3 WHERE id = $1",
      [invitation.id, recipient, this.clock.now()],
    );
    await this.emit(client, "contact.accepted.v1", { invitationId: invitation.id });
  }

  async revokeDirectInvitation(client: PoolClient, accountId: string, token: string): Promise<void> {
    const issuer = await this.ownerKingdom(client, accountId);
    if (!/^[A-Za-z0-9_-]{32}$/.test(token)) throw new SocialError("INVITATION_INVALID");
    const hash = createHash("sha256").update(token).digest();
    await client.query(
      `UPDATE direct_contact_invitations SET revoked_at = $4
       WHERE product_scope = $1 AND issuer_kingdom_id = $2 AND token_hash = $3
         AND redeemed_at IS NULL AND revoked_at IS NULL`,
      [this.productScope, issuer, hash, this.clock.now()],
    );
  }

  async expireRequests(client: PoolClient, gameTimeMs: number): Promise<number> {
    const result = await client.query(
      `UPDATE cold_contact_requests SET status = 'expired'
       WHERE product_scope = $1 AND status = 'pending' AND expires_game_time_ms <= $2`,
      [this.productScope, gameTimeMs],
    );
    return result.rowCount ?? 0;
  }

  private async emit(client: PoolClient, type: string, payload: Record<string, unknown>): Promise<void> {
    await appendOutbox(client, { productScope: this.productScope, eventId: randomUUID(), type, payload });
  }
}
