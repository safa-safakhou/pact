import { createHash, randomBytes, randomUUID } from "node:crypto";
import { withTransaction } from "@pact/db";
import type { Pool, PoolClient } from "pg";
import { TelegramError } from "./types.js";

type Box = { seal(value: Uint8Array): string; open(value: string): Uint8Array };
export type BotRunSettings = {
  credentialId: string;
  provider: string;
  model: string;
  maxCalls: number;
  maxTokens: number;
  maxMessages: number;
  maxConversations: number;
};
export type BotReply = { text: string; buttons?: { text: string; callbackData?: string; webAppUrl?: string }[] };
export interface BotPorts {
  read(accountId: string, command: "world" | "inbox" | "status"): Promise<string>;
  validateSettings(accountId: string, settings: BotRunSettings): Promise<void>;
  start(client: PoolClient, accountId: string, objective: string, settings: BotRunSettings): Promise<{ runId: string }>;
  stop(client: PoolClient, accountId: string, runIds?: readonly string[]): Promise<void>;
}
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
type Preview = {
  id: string;
  account_id: string;
  link_id: string;
  telegram_user_id: string;
  sealed_objective: string;
  settings: BotRunSettings;
  expires_at: Date;
  used_at: Date | null;
  message_id: string | null;
};
export class TelegramBotService {
  constructor(
    private readonly pool: Pool,
    private readonly options: {
      productScope: string;
      clock: { now(): Date };
      secretBox: Box;
      miniAppUrl: string;
      botId: string;
      ports: BotPorts;
    },
  ) {}
  private seal(value: unknown) {
    return this.options.secretBox.seal(Buffer.from(JSON.stringify(value)));
  }
  private open<T>(value: string): T {
    return JSON.parse(Buffer.from(this.options.secretBox.open(value)).toString("utf8")) as T;
  }
  async settings(accountId: string): Promise<{ settings: BotRunSettings | null }> {
    const result = await this.pool.query<{ settings: BotRunSettings }>(
      "SELECT settings FROM telegram_run_preferences WHERE product_scope=$1 AND account_id=$2",
      [this.options.productScope, accountId],
    );
    return { settings: result.rows[0]?.settings ?? null };
  }
  async saveSettings(accountId: string, settings: BotRunSettings) {
    if (
      !settings.model.trim() ||
      settings.model.length > 200 ||
      settings.provider.length > 50 ||
      !settings.credentialId ||
      ![
        [settings.maxCalls, 20],
        [settings.maxTokens, 40000],
        [settings.maxMessages, 24],
        [settings.maxConversations, 12],
      ].every(([v, max]) => Number.isInteger(v) && v! >= 1 && v! <= max!)
    )
      throw new TelegramError("FORBIDDEN");
    await this.options.ports.validateSettings(accountId, settings);
    await this.pool.query(
      "INSERT INTO telegram_run_preferences(product_scope,account_id,settings,updated_at) VALUES($1,$2,$3,$4) ON CONFLICT(product_scope,account_id) DO UPDATE SET settings=EXCLUDED.settings,updated_at=EXCLUDED.updated_at",
      [this.options.productScope, accountId, settings, this.options.clock.now()],
    );
    return { saved: true };
  }
  private async queue(client: PoolClient, user: string, account: string | null, reply: BotReply, previewId?: string) {
    await client.query(
      "INSERT INTO telegram_bot_replies(id,product_scope,account_id,telegram_user_id,sealed_reply,preview_id,created_at,available_at) VALUES($1,$2,$3,$4,$5,$6,$7,$7)",
      [
        randomUUID(),
        this.options.productScope,
        account,
        user,
        this.seal(reply),
        previewId ?? null,
        this.options.clock.now(),
      ],
    );
  }
  /** Called within the authenticated webhook's deduplication transaction. Raw updates are discarded. */
  async process(client: PoolClient, raw: unknown): Promise<void> {
    if (typeof raw !== "object" || raw === null) return;
    const update = raw as { message?: unknown; callback_query?: unknown };
    if (!update.message && !update.callback_query) return;
    const callback = update.callback_query as
      | {
          from?: { id?: unknown; is_bot?: boolean };
          data?: unknown;
          message?: {
            message_id?: unknown;
            chat?: { id?: unknown; type?: unknown };
            from?: { is_bot?: boolean };
            forward_origin?: unknown;
          };
          inline_message_id?: unknown;
        }
      | undefined;
    const message = (callback?.message ?? update.message) as
      | {
          from?: { id?: unknown; is_bot?: boolean };
          chat?: { id?: unknown; type?: unknown };
          text?: unknown;
          forward_origin?: unknown;
          forward_from?: unknown;
          forward_date?: unknown;
          via_bot?: unknown;
          message_id?: unknown;
        }
      | undefined;
    const sender = callback?.from ?? message?.from;
    if (!message?.chat || message.chat.type !== "private") throw new TelegramError("GROUP_CHAT_DENIED");
    if (
      !sender ||
      sender.is_bot ||
      !Number.isSafeInteger(sender.id) ||
      !Number.isSafeInteger(message.chat.id) ||
      sender.id !== message.chat.id ||
      message.forward_origin ||
      message.forward_from ||
      message.forward_date ||
      message.via_bot ||
      callback?.inline_message_id
    )
      throw new TelegramError("FORBIDDEN");
    const user = String(sender.id),
      scope = this.options.productScope,
      now = this.options.clock.now();
    const link = (
      await client.query<{ id: string; account_id: string }>(
        `SELECT l.id,l.account_id FROM telegram_account_links l JOIN accounts a ON a.id=l.account_id AND a.product_scope=l.product_scope
   WHERE l.product_scope=$1 AND l.telegram_user_id=$2 AND l.revoked_at IS NULL AND a.status='active' AND a.email_verified_at IS NOT NULL FOR UPDATE OF l`,
        [scope, user],
      )
    ).rows[0];
    if (!link) {
      await this.queue(client, user, null, {
        text: "Link your verified PACT account in the Mini App first.",
        buttons: [{ text: "Open PACT", webAppUrl: this.options.miniAppUrl }],
      });
      return;
    }
    if (callback) {
      if (
        message.from?.is_bot !== true ||
        String(message.from.id) !== this.options.botId ||
        typeof callback.data !== "string" ||
        !/^pact-run:[A-Za-z0-9_-]{32}$/.test(callback.data) ||
        !Number.isSafeInteger(message.message_id)
      )
        throw new TelegramError("FORBIDDEN");
      const row = (
        await client.query<Preview>(
          "SELECT * FROM telegram_run_previews WHERE product_scope=$1 AND nonce_hash=$2 FOR UPDATE",
          [scope, digest(callback.data.slice(9))],
        )
      ).rows[0];
      if (
        !row ||
        row.account_id !== link.account_id ||
        row.link_id !== link.id ||
        row.telegram_user_id !== user ||
        row.used_at ||
        row.expires_at <= now ||
        String(message.message_id) !== String(row.message_id)
      ) {
        await this.queue(client, user, link.account_id, {
          text: "This run confirmation is unavailable, already used, or expired. Send a new objective.",
        });
        return;
      }
      await this.options.ports.validateSettings(link.account_id, row.settings);
      let run: { runId: string };
      try {
        run = await this.options.ports.start(
          client,
          link.account_id,
          this.open<string>(row.sealed_objective),
          row.settings,
        );
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          ["RUN_ALREADY_ACTIVE", "LEASE_HELD", "FORBIDDEN"].includes(String(error.code))
        ) {
          await this.queue(client, user, link.account_id, {
            text:
              "Run not started: " +
              String(error.code) +
              ". Open PACT to review the active run, lease or account restriction. No extra inference was queued.",
          });
          return;
        }
        throw error;
      }
      await client.query(
        "INSERT INTO telegram_started_runs(product_scope,account_id,run_id,created_at) VALUES($1,$2,$3,$4)",
        [scope, link.account_id, run.runId, now],
      );
      await client.query("UPDATE telegram_run_previews SET used_at=$2,run_id=$3 WHERE id=$1", [row.id, now, run.runId]);
      await this.queue(client, user, link.account_id, {
        text:
          "Bounded Envoy started. Run " +
          run.runId +
          ". /status tracks it; /stop stops further inference. Committed game actions continue.",
        buttons: [{ text: "Track in PACT", webAppUrl: this.options.miniAppUrl + "?inbox" }],
      });
      return;
    }
    if (typeof message.text !== "string") return;
    if (message.text.length > 2000) {
      await this.queue(client, user, link.account_id, {
        text: "Keep the objective within 2,000 characters so its complete confirmation fits in Telegram. No inference has started.",
      });
      return;
    }
    const text = message.text.trim();
    if (!text) return;
    const command = text.split(/\s/, 1)[0]?.split("@")[0];
    if (["/world", "/inbox", "/status"].includes(command ?? "")) {
      const read = await this.options.ports.read(link.account_id, command!.slice(1) as "world" | "inbox" | "status");
      await this.queue(client, user, link.account_id, {
        text: read.slice(0, 3500),
        buttons: [
          {
            text: "Open full authenticated view",
            webAppUrl: this.options.miniAppUrl + (command === "/inbox" ? "?inbox" : ""),
          },
        ],
      });
      return;
    }
    if (command === "/stop") {
      await this.options.ports.stop(client, link.account_id);
      await this.queue(client, user, link.account_id, {
        text: "Stopped further Envoy inference and released the shared write lease. Committed actions and game jobs continue.",
      });
      return;
    }
    if (command === "/start" || command === "/help") {
      await this.queue(client, user, link.account_id, {
        text: "/world, /inbox and /status are factual reads. /run objective (or free text) previews a bounded run. Press its exact confirmation to start. /stop stops further inference. Game approvals are reviewed in PACT.",
        buttons: [{ text: "Open PACT", webAppUrl: this.options.miniAppUrl }],
      });
      return;
    }
    if (text.startsWith("/") && command !== "/run") {
      await this.queue(client, user, link.account_id, {
        text: "Unknown command. Try /help. Game approvals require the authenticated PACT review sheet.",
      });
      return;
    }
    const objective = command === "/run" ? text.slice(text.indexOf(" ") + 1).trim() : text;
    if ((command === "/run" && !text.includes(" ")) || !objective) {
      await this.queue(client, user, link.account_id, {
        text: "Use /run followed by your objective. No model call has started.",
      });
      return;
    }
    const settings = (
      await client.query<{ settings: BotRunSettings }>(
        "SELECT settings FROM telegram_run_preferences WHERE product_scope=$1 AND account_id=$2",
        [scope, link.account_id],
      )
    ).rows[0]?.settings;
    if (!settings) {
      await this.queue(client, user, link.account_id, {
        text: "Choose and save your Telegram provider, model and limits in PACT Envoy first. No model call has started.",
        buttons: [{ text: "Choose model and limits", webAppUrl: this.options.miniAppUrl + "?inbox" }],
      });
      return;
    }
    await this.options.ports.validateSettings(link.account_id, settings);
    const recent = await client.query(
      "SELECT id FROM telegram_run_previews WHERE product_scope=$1 AND account_id=$2 AND created_at>$3",
      [scope, link.account_id, new Date(now.getTime() - 60000)],
    );
    if ((recent.rowCount ?? 0) >= 5) {
      await this.queue(client, user, link.account_id, {
        text: "Please wait a minute before another preview. No model call has started.",
      });
      return;
    }
    const nonce = randomBytes(24).toString("base64url"),
      id = randomUUID(),
      expires = new Date(now.getTime() + 5 * 60000);
    await client.query(
      "INSERT INTO telegram_run_previews(id,product_scope,account_id,link_id,telegram_user_id,nonce_hash,sealed_objective,settings,created_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [id, scope, link.account_id, link.id, user, digest(nonce), this.seal(objective), settings, now, expires],
    );
    await this.queue(
      client,
      user,
      link.account_id,
      {
        text:
          "Preview only — no model call has started.\nObjective: " +
          objective +
          "\nProvider/model: " +
          settings.provider +
          " / " +
          settings.model +
          "\nLimits: " +
          settings.maxCalls +
          " calls, " +
          settings.maxTokens +
          " tokens, " +
          settings.maxMessages +
          " messages, " +
          settings.maxConversations +
          " conversations, 15 minutes.\nAccount: " +
          link.account_id +
          "\nNo conversation context selected. Provider price unavailable. Confirm within five minutes. Game exceptions still need a separate authenticated exact approval.",
        buttons: [
          { text: "Start this exact bounded run", callbackData: "pact-run:" + nonce },
          { text: "Open PACT", webAppUrl: this.options.miniAppUrl },
        ],
      },
      id,
    );
  }
  async unlink(client: PoolClient, accountId: string): Promise<void> {
    await client.query(
      "UPDATE telegram_run_previews SET used_at=COALESCE(used_at,$3) WHERE product_scope=$1 AND account_id=$2",
      [this.options.productScope, accountId, this.options.clock.now()],
    );
    await client.query(
      "UPDATE telegram_bot_replies SET status='cancelled',sealed_reply='' WHERE product_scope=$1 AND account_id=$2 AND status='ready'",
      [this.options.productScope, accountId],
    );
    const runs = (
      await client.query<{ run_id: string }>(
        "SELECT run_id FROM telegram_started_runs WHERE product_scope=$1 AND account_id=$2 ORDER BY run_id",
        [this.options.productScope, accountId],
      )
    ).rows;
    await this.options.ports.stop(
      client,
      accountId,
      runs.map((r) => r.run_id),
    );
  }
}
