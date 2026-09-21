import { createHash, randomBytes, randomUUID } from "node:crypto";
import { withTransaction } from "@pact/db";
import type { Pool, PoolClient } from "pg";
import { verifyTelegramInitData, verifyWebhookSecret } from "./crypto.js";
import {
  type IssuedHumanSession,
  type TelegramBootstrap,
  type TelegramChannelSession,
  TelegramError,
} from "./types.js";

const BOOTSTRAP_TTL_MS = 5 * 60_000;

interface BootstrapRow {
  id: string;
  telegram_user_id: string;
  init_fingerprint: string;
  account_id: string | null;
  expires_at: Date;
  confirmed_at: Date | null;
  used_at: Date | null;
}

interface LinkRow {
  id: string;
  account_id: string;
  telegram_user_id: string;
  revoked_at: Date | null;
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

function issueToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: digest(raw) };
}

export interface TelegramServiceOptions {
  readonly productScope: string;
  readonly botId: string;
  readonly botToken: string;
  readonly webhookSecret: string;
  readonly clock: { now(): Date };
  readonly issueHumanSession: (accountId: string, label: string) => Promise<IssuedHumanSession>;
  readonly revokeHumanSessions: (accountId: string, sessionIds: readonly string[]) => Promise<void>;
}

export class TelegramService {
  constructor(
    private readonly pool: Pool,
    private readonly options: TelegramServiceOptions,
  ) {}

  async beginBootstrap(rawInitData: string): Promise<TelegramBootstrap> {
    const now = this.options.clock.now();
    const launch = verifyTelegramInitData(rawInitData, this.options.botToken, now);
    const token = issueToken();
    const expiresAt = new Date(now.getTime() + BOOTSTRAP_TTL_MS);
    try {
      await this.pool.query(
        `INSERT INTO telegram_link_bootstraps(
           id, product_scope, telegram_user_id, init_fingerprint, token_hash, created_at, expires_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [randomUUID(), this.options.productScope, launch.userId, launch.fingerprint, token.hash, now, expiresAt],
      );
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
        throw new TelegramError("BOOTSTRAP_REPLAYED");
      }
      throw error;
    }
    return { bootstrapToken: token.raw, telegramUserId: launch.userId, expiresAt };
  }

  async confirmLink(accountId: string, bootstrapToken: string): Promise<void> {
    await withTransaction(this.pool, async (client) => {
      const row = await this.loadBootstrap(client, bootstrapToken);
      this.assertLiveBootstrap(row);
      if (row.account_id && row.account_id !== accountId) throw new TelegramError("FORBIDDEN");
      const existing = await client.query<{ account_id: string; telegram_user_id: string }>(
        `SELECT account_id, telegram_user_id FROM telegram_account_links
         WHERE product_scope = $1 AND revoked_at IS NULL
           AND (account_id = $2 OR telegram_user_id = $3) FOR UPDATE`,
        [this.options.productScope, accountId, row.telegram_user_id],
      );
      if (
        existing.rows.some(
          (link) => link.account_id !== accountId || String(link.telegram_user_id) !== String(row.telegram_user_id),
        )
      ) {
        throw new TelegramError("ALREADY_LINKED");
      }
      await client.query(
        `UPDATE telegram_link_bootstraps SET account_id = $2, confirmed_at = COALESCE(confirmed_at, $3)
         WHERE id = $1`,
        [row.id, accountId, this.options.clock.now()],
      );
    });
  }

  async exchangeBootstrap(rawInitData: string, bootstrapToken: string): Promise<TelegramChannelSession> {
    const launch = verifyTelegramInitData(rawInitData, this.options.botToken, this.options.clock.now());
    const linked = await withTransaction(this.pool, async (client) => {
      const row = await this.loadBootstrap(client, bootstrapToken);
      this.assertLiveBootstrap(row);
      if (!row.confirmed_at || !row.account_id) throw new TelegramError("LINK_NOT_CONFIRMED");
      if (row.init_fingerprint !== launch.fingerprint || String(row.telegram_user_id) !== launch.userId) {
        throw new TelegramError("FORBIDDEN");
      }
      const link = await this.activateLink(client, row.account_id, launch.userId, launch.username);
      await client.query("UPDATE telegram_link_bootstraps SET used_at = $2 WHERE id = $1 AND used_at IS NULL", [
        row.id,
        this.options.clock.now(),
      ]);
      return link;
    });

    const human = await this.options.issueHumanSession(linked.account_id, "Telegram Mini App");
    try {
      await this.pool.query(
        `INSERT INTO telegram_channel_sessions(
           id, product_scope, link_id, account_id, human_session_id, created_at, expires_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          randomUUID(),
          this.options.productScope,
          linked.id,
          linked.account_id,
          human.sessionId,
          this.options.clock.now(),
          human.absoluteExpiresAt,
        ],
      );
    } catch (error) {
      await this.options.revokeHumanSessions(linked.account_id, [human.sessionId]);
      throw error;
    }
    return {
      ...human,
      accountId: linked.account_id,
      telegramUserId: String(linked.telegram_user_id),
    };
  }

  async unlink(accountId: string): Promise<void> {
    const sessionIds = await withTransaction(this.pool, async (client) => {
      const link = await client.query<LinkRow>(
        `UPDATE telegram_account_links SET revoked_at = $3
         WHERE product_scope = $1 AND account_id = $2 AND revoked_at IS NULL RETURNING *`,
        [this.options.productScope, accountId, this.options.clock.now()],
      );
      if (link.rowCount !== 1) throw new TelegramError("NOT_FOUND");
      const sessions = await client.query<{ human_session_id: string }>(
        `UPDATE telegram_channel_sessions SET revoked_at = $3
         WHERE product_scope = $1 AND account_id = $2 AND revoked_at IS NULL
         RETURNING human_session_id`,
        [this.options.productScope, accountId, this.options.clock.now()],
      );
      return sessions.rows.map((row) => row.human_session_id);
    });
    await this.options.revokeHumanSessions(accountId, sessionIds);
  }

  async acceptWebhook(
    receivedSecret: string | undefined,
    update: unknown,
  ): Promise<{ accepted: boolean; duplicate: boolean; privilegedAction: false }> {
    verifyWebhookSecret(receivedSecret, this.options.webhookSecret);
    if (typeof update !== "object" || update === null || !("update_id" in update)) {
      throw new TelegramError("FORBIDDEN");
    }
    const updateId = update.update_id;
    if (!Number.isSafeInteger(updateId) || Number(updateId) < 0) throw new TelegramError("FORBIDDEN");
    if ("message" in update && typeof update.message === "object" && update.message !== null) {
      const message = update.message as { chat?: { type?: unknown } };
      if (message.chat?.type !== "private") throw new TelegramError("GROUP_CHAT_DENIED");
    }
    const inserted = await this.pool.query(
      `INSERT INTO telegram_webhook_updates(product_scope, bot_id, update_id, received_at)
       VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
      [this.options.productScope, this.options.botId, updateId, this.options.clock.now()],
    );
    return { accepted: inserted.rowCount === 1, duplicate: inserted.rowCount !== 1, privilegedAction: false };
  }

  private async loadBootstrap(client: PoolClient, token: string): Promise<BootstrapRow> {
    const result = await client.query<BootstrapRow>(
      `SELECT * FROM telegram_link_bootstraps
       WHERE product_scope = $1 AND token_hash = $2 FOR UPDATE`,
      [this.options.productScope, digest(token)],
    );
    const row = result.rows[0];
    if (!row) throw new TelegramError("NOT_FOUND");
    return row;
  }

  private assertLiveBootstrap(row: BootstrapRow): void {
    if (row.used_at) throw new TelegramError("BOOTSTRAP_REPLAYED");
    if (row.expires_at <= this.options.clock.now()) throw new TelegramError("BOOTSTRAP_EXPIRED");
  }

  private async activateLink(
    client: PoolClient,
    accountId: string,
    telegramUserId: string,
    username: string | undefined,
  ): Promise<LinkRow> {
    const conflicts = await client.query<LinkRow>(
      `SELECT * FROM telegram_account_links WHERE product_scope = $1
       AND (account_id = $2 OR telegram_user_id = $3) FOR UPDATE`,
      [this.options.productScope, accountId, telegramUserId],
    );
    const incompatible = conflicts.rows.find(
      (row) => row.account_id !== accountId || String(row.telegram_user_id) !== telegramUserId,
    );
    if (incompatible) throw new TelegramError("ALREADY_LINKED");
    const compatible = conflicts.rows.find(
      (row) => row.account_id === accountId && String(row.telegram_user_id) === telegramUserId,
    );
    if (compatible) {
      const updated = await client.query<LinkRow>(
        `UPDATE telegram_account_links SET revoked_at = NULL, linked_at = $2, display_username = $3
         WHERE id = $1 RETURNING *`,
        [compatible.id, this.options.clock.now(), username ?? null],
      );
      const row = updated.rows[0];
      if (!row) throw new Error("Telegram link update failed");
      return row;
    }
    const inserted = await client.query<LinkRow>(
      `INSERT INTO telegram_account_links(
         id, product_scope, account_id, telegram_user_id, display_username, linked_at
       ) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [randomUUID(), this.options.productScope, accountId, telegramUserId, username ?? null, this.options.clock.now()],
    );
    const row = inserted.rows[0];
    if (!row) throw new Error("Telegram link insert failed");
    return row;
  }
}
