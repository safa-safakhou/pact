export type TelegramErrorCode =
  | "ALREADY_LINKED"
  | "BOOTSTRAP_EXPIRED"
  | "BOOTSTRAP_REPLAYED"
  | "FORBIDDEN"
  | "GROUP_CHAT_DENIED"
  | "INVALID_INIT_DATA"
  | "INVALID_WEBHOOK_SECRET"
  | "LINK_NOT_CONFIRMED"
  | "NOT_FOUND";

export class TelegramError extends Error {
  constructor(readonly code: TelegramErrorCode) {
    super(code);
    this.name = "TelegramError";
  }
}

export interface VerifiedTelegramLaunch {
  readonly userId: string;
  readonly username?: string;
  readonly queryId?: string;
  readonly authDate: Date;
  readonly fingerprint: string;
}

export interface TelegramBootstrap {
  readonly bootstrapToken: string;
  readonly telegramUserId: string;
  readonly expiresAt: Date;
}

export interface IssuedHumanSession {
  readonly sessionId: string;
  readonly sessionToken: string;
  readonly csrfToken: string;
  readonly absoluteExpiresAt: Date;
}

export interface TelegramChannelSession extends IssuedHumanSession {
  readonly accountId: string;
  readonly telegramUserId: string;
}
