import { createHash, randomBytes, randomUUID } from "node:crypto";
import { appendOutbox, withTransaction } from "@pact/db";
import type { Pool, PoolClient } from "pg";
import {
  type ContentSnapshot,
  ModerationContent,
  ModerationError,
  type ModerationTargetKind,
} from "./moderation-content.js";
import { moderationRetention } from "./moderation-retention.js";

export { ModerationError, type ModerationTargetKind } from "./moderation-content.js";
export type StaffIdentity = { accountId: string; sessionId: string };
type SecretBox = { seal(data: Uint8Array): string; open(data: string): Uint8Array };
type Case = {
  id: string;
  subject_account_id: string | null;
  reporter_account_id: string | null;
  target_kind: ModerationTargetKind;
  target_id: string;
  status: string;
  assigned_staff_id: string | null;
  initial_reviewer_id: string | null;
  access_expires_at: Date | null;
  resolved_at: Date | null;
  appeal_due_at: Date | null;
  appeal_used_at: Date | null;
};
const day = 86_400_000;
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export class ModerationService {
  private readonly content: ModerationContent;
  constructor(
    private readonly pool: Pool,
    private readonly options: {
      productScope: string;
      clock: { now(): Date };
      secretBox: SecretBox;
      closeAccount?: (accountId: string) => Promise<unknown>;
    },
  ) {
    this.content = new ModerationContent(options.productScope);
  }
  get retention() {
    return moderationRetention(this.options.productScope);
  }
  private seal(value: unknown) {
    return this.options.secretBox.seal(Buffer.from(JSON.stringify(value)));
  }
  private open<T>(value: string): T {
    return JSON.parse(Buffer.from(this.options.secretBox.open(value)).toString("utf8")) as T;
  }
  private text(value: string, maximum = 2000) {
    if (!value.trim() || value.length > maximum || value.includes("\0")) throw new ModerationError("INVALID_INPUT");
  }
  async report(
    accountId: string,
    input: {
      reportKey: string;
      kind: ModerationTargetKind;
      targetId: string;
      category: "doxxing" | "threat" | "abuse" | "other";
      details: string;
    },
  ): Promise<{ caseId: string; triageDueAt: Date }> {
    this.text(input.details);
    return withTransaction(this.pool, async (client) => {
      const active = await client.query(
        "SELECT id FROM accounts WHERE product_scope=$1 AND id=$2 AND status='active' AND (email_verified_at IS NOT NULL OR is_guest) FOR UPDATE",
        [this.options.productScope, accountId],
      );
      if (!active.rowCount) throw new ModerationError("FORBIDDEN");
      const duplicate = (
        await client.query<{
          id: string;
          target_kind: string;
          target_id: string;
          category: string;
          triage_due_at: Date;
        }>(
          "SELECT id,target_kind,target_id,category,triage_due_at FROM moderation_cases WHERE product_scope=$1 AND reporter_account_id=$2 AND report_key=$3",
          [this.options.productScope, accountId, input.reportKey],
        )
      ).rows[0];
      if (duplicate) {
        if (
          duplicate.target_kind !== input.kind ||
          duplicate.target_id !== input.targetId ||
          duplicate.category !== input.category
        )
          throw new ModerationError("INVALID_INPUT");
        const prior = (
          await client.query<{ sealed_report: string }>(
            "SELECT sealed_report FROM moderation_evidence WHERE case_id=$1",
            [duplicate.id],
          )
        ).rows[0];
        if (!prior || this.open<string>(prior.sealed_report) !== input.details)
          throw new ModerationError("INVALID_INPUT");
        return { caseId: duplicate.id, triageDueAt: duplicate.triage_due_at };
      }
      const now = this.options.clock.now();
      const count = await client.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM moderation_cases WHERE product_scope=$1 AND reporter_account_id=$2 AND created_at>$3",
        [this.options.productScope, accountId, new Date(now.getTime() - day)],
      );
      if ((count.rows[0]?.count ?? 0) >= 20) throw new ModerationError("INVALID_INPUT");
      const evidence = await this.content.capture(client, accountId, input.kind, input.targetId, now);
      const urgent = ["doxxing", "threat"].includes(input.category),
        due = new Date(now.getTime() + (urgent ? day : 3 * day)),
        caseId = randomUUID();
      await client.query(
        `INSERT INTO moderation_cases(id,product_scope,reporter_account_id,subject_account_id,target_kind,target_id,category,priority,created_at,triage_due_at,report_key)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          caseId,
          this.options.productScope,
          accountId,
          evidence.subjectAccountId,
          input.kind,
          input.targetId,
          input.category,
          urgent ? "urgent" : "ordinary",
          now,
          due,
          input.reportKey,
        ],
      );
      await client.query("INSERT INTO moderation_evidence(case_id,sealed_snapshot,sealed_report) VALUES($1,$2,$3)", [
        caseId,
        this.seal(evidence.snapshot),
        this.seal(input.details),
      ]);
      return { caseId, triageDueAt: due };
    });
  }
  private async staff(client: PoolClient, staff: StaffIdentity) {
    const allowed = await client.query(
      `SELECT s.id FROM sessions s JOIN accounts a ON a.id=s.account_id AND a.product_scope=s.product_scope
   WHERE s.product_scope=$1 AND s.id=$2 AND a.id=$3 AND a.role='staff' AND a.status='active' AND s.audience='human'
   AND a.totp_secret_ciphertext IS NOT NULL AND s.revoked_at IS NULL AND s.expires_at>$4 AND s.idle_expires_at>$4 AND s.mfa_authenticated_at >= $5`,
      [
        this.options.productScope,
        staff.sessionId,
        staff.accountId,
        this.options.clock.now(),
        new Date(this.options.clock.now().getTime() - 5 * 60_000),
      ],
    );
    if (!allowed.rowCount) throw new ModerationError("FORBIDDEN");
  }
  private async load(client: PoolClient, id: string): Promise<Case> {
    const row = (
      await client.query<Case>("SELECT * FROM moderation_cases WHERE product_scope=$1 AND id=$2 FOR UPDATE", [
        this.options.productScope,
        id,
      ])
    ).rows[0];
    if (!row) throw new ModerationError("NOT_FOUND");
    return row;
  }
  private async assigned(client: PoolClient, staff: StaffIdentity, id: string) {
    await this.staff(client, staff);
    const row = await this.load(client, id);
    if (
      row.assigned_staff_id !== staff.accountId ||
      !row.access_expires_at ||
      row.access_expires_at <= this.options.clock.now()
    )
      throw new ModerationError("FORBIDDEN");
    return row;
  }
  private async audit(
    client: PoolClient,
    staff: string | null,
    caseId: string | null,
    action: string,
    reason?: string,
  ) {
    await client.query(
      "INSERT INTO moderation_audit(product_scope,case_id,staff_account_id,action,sealed_reason,occurred_at) VALUES($1,$2,$3,$4,$5,$6)",
      [this.options.productScope, caseId, staff, action, reason ? this.seal(reason) : null, this.options.clock.now()],
    );
  }
  async queue(staff: StaffIdentity) {
    return withTransaction(this.pool, async (client) => {
      await this.staff(client, staff);
      await this.audit(client, staff.accountId, null, "queue.read");
      return {
        cases: (
          await client.query(
            `SELECT id,target_kind,category,priority,status,triage_due_at,triaged_at,appeal_review_due_at,assigned_staff_id
     FROM moderation_cases WHERE product_scope=$1 AND status IN('open','appealed')
     ORDER BY COALESCE(appeal_review_due_at,triage_due_at),id LIMIT 50`,
            [this.options.productScope],
          )
        ).rows,
      };
    });
  }
  async claim(staff: StaffIdentity, id: string) {
    return withTransaction(this.pool, async (client) => {
      await this.staff(client, staff);
      const row = await this.load(client, id),
        now = this.options.clock.now();
      const held = (
        await client.query<{ authorized_staff_ids: string[] }>(
          "SELECT authorized_staff_ids FROM moderation_holds WHERE case_id=$1 AND review_at>$2",
          [id, now],
        )
      ).rows[0];
      if (held && !held.authorized_staff_ids.includes(staff.accountId)) throw new ModerationError("FORBIDDEN");
      if (row.status === "appealed" && row.initial_reviewer_id === staff.accountId)
        throw new ModerationError("FORBIDDEN");
      if (
        row.assigned_staff_id &&
        row.assigned_staff_id !== staff.accountId &&
        row.access_expires_at &&
        row.access_expires_at > now
      )
        throw new ModerationError("ALREADY_ASSIGNED");
      await client.query(
        `UPDATE moderation_cases SET assigned_staff_id=$3,access_expires_at=$4,triaged_at=COALESCE(triaged_at,$5)
    WHERE product_scope=$1 AND id=$2`,
        [this.options.productScope, id, staff.accountId, new Date(now.getTime() + 7 * day), now],
      );
      await this.audit(client, staff.accountId, id, "case.claim");
      return { claimed: true };
    });
  }
  async read(staff: StaffIdentity, id: string) {
    return withTransaction(this.pool, async (client) => {
      const row = await this.assigned(client, staff, id);
      await this.audit(client, staff.accountId, id, "evidence.read");
      const evidence = (
        await client.query<{ sealed_snapshot: string; sealed_report: string; sealed_appeal: string | null }>(
          "SELECT * FROM moderation_evidence WHERE case_id=$1",
          [id],
        )
      ).rows[0];
      if (!evidence) throw new ModerationError("NOT_FOUND");
      const audit = (
        await client.query<{ action: string; sealed_reason: string | null; occurred_at: Date }>(
          "SELECT action,sealed_reason,occurred_at FROM moderation_audit WHERE case_id=$1 ORDER BY id",
          [id],
        )
      ).rows;
      return {
        case: row,
        evidence: this.open<ContentSnapshot>(evidence.sealed_snapshot),
        report: this.open<string>(evidence.sealed_report),
        appeal: evidence.sealed_appeal ? this.open<string>(evidence.sealed_appeal) : null,
        audit: audit.map((a) => ({
          action: a.action,
          reason: a.sealed_reason ? this.open<string>(a.sealed_reason) : null,
          occurredAt: a.occurred_at,
        })),
      };
    });
  }
  async action(
    staff: StaffIdentity,
    id: string,
    input: {
      action: "hide" | "suspend-messaging" | "suspend-play" | "close" | "dismiss" | "overturn" | "uphold";
      reason: string;
      until?: Date;
    },
  ) {
    this.text(input.reason, 1000);
    if (!["hide", "suspend-messaging", "suspend-play", "close", "dismiss", "overturn", "uphold"].includes(input.action))
      throw new ModerationError("INVALID_INPUT");
    return withTransaction(this.pool, async (client) => {
      const row = await this.assigned(client, staff, id),
        now = this.options.clock.now();
      if (!["open", "appealed"].includes(row.status)) throw new ModerationError("ALREADY_RESOLVED");
      const isAppeal = row.status === "appealed";
      if (isAppeal && (row.initial_reviewer_id === staff.accountId || !["overturn", "uphold"].includes(input.action)))
        throw new ModerationError("FORBIDDEN");
      if (!isAppeal && ["overturn", "uphold"].includes(input.action)) throw new ModerationError("INVALID_INPUT");
      const evidence = (
        await client.query<{ sealed_snapshot: string }>(
          "SELECT sealed_snapshot FROM moderation_evidence WHERE case_id=$1",
          [id],
        )
      ).rows[0];
      if (!evidence) throw new ModerationError("NOT_FOUND");
      const snapshot = this.open<ContentSnapshot>(evidence.sealed_snapshot);
      if (input.action === "hide") await this.content.hide(client, snapshot, id, now);
      if (input.action === "overturn") {
        await this.content.restore(client, snapshot, id);
        await client.query("DELETE FROM moderation_restrictions WHERE product_scope=$1 AND case_id=$2", [
          this.options.productScope,
          id,
        ]);
        await client.query(
          "DELETE FROM moderation_closure_jobs WHERE product_scope=$1 AND case_id=$2 AND status='ready'",
          [this.options.productScope, id],
        );
      }
      if (["suspend-messaging", "suspend-play"].includes(input.action)) {
        if (
          !row.subject_account_id ||
          !input.until ||
          input.until <= now ||
          input.until.getTime() > now.getTime() + 180 * day
        )
          throw new ModerationError("INVALID_INPUT");
        await client.query(
          `INSERT INTO moderation_restrictions(product_scope,account_id,case_id,kind,until_at,created_at) VALUES($1,$2,$3,$4,$5,$6)
      ON CONFLICT(product_scope,account_id,case_id,kind) DO UPDATE SET until_at=EXCLUDED.until_at`,
          [
            this.options.productScope,
            row.subject_account_id,
            id,
            input.action === "suspend-play" ? "play" : "messaging",
            input.until,
            now,
          ],
        );
      }
      if (input.action === "close") {
        if (!row.subject_account_id || !this.options.closeAccount) throw new ModerationError("INVALID_INPUT");
        await client.query(
          "INSERT INTO moderation_closure_jobs(product_scope,case_id,account_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
          [this.options.productScope, id, row.subject_account_id],
        );
      }
      const token = randomBytes(32).toString("base64url"),
        deadline = new Date(now.getTime() + 14 * day);
      await client.query(
        `UPDATE moderation_cases SET status=$3,initial_reviewer_id=COALESCE(initial_reviewer_id,$4),resolved_at=$5,
     appeal_due_at=$6,appeal_token_hash=$7,appeal_used_at=NULL WHERE product_scope=$1 AND id=$2`,
        [
          this.options.productScope,
          id,
          isAppeal ? "appeal_resolved" : "resolved",
          staff.accountId,
          now,
          isAppeal ? row.appeal_due_at : deadline,
          isAppeal ? null : hash(token),
        ],
      );
      await this.audit(client, staff.accountId, id, input.action, input.reason);
      if (row.subject_account_id && !isAppeal)
        await appendOutbox(client, {
          productScope: this.options.productScope,
          eventId: randomUUID(),
          type: "security.email.requested.v1",
          payload: {
            accountId: row.subject_account_id,
            template: "moderation_decision",
            sealedToken: this.options.secretBox.seal(Buffer.from(token)),
          },
        });
      return {
        status: isAppeal ? "appeal_resolved" : "resolved",
        appealDueAt: isAppeal ? row.appeal_due_at : deadline,
      };
    });
  }
  async appeal(accountId: string, id: string, reason: string) {
    this.text(reason);
    return withTransaction(this.pool, async (client) => {
      const row = await this.load(client, id);
      if (row.subject_account_id !== accountId) throw new ModerationError("FORBIDDEN");
      return this.submitAppeal(client, row, reason);
    });
  }
  async appealByToken(token: string, reason: string) {
    this.text(reason);
    return withTransaction(this.pool, async (client) => {
      const row = (
        await client.query<Case>(
          "SELECT * FROM moderation_cases WHERE product_scope=$1 AND appeal_token_hash=$2 FOR UPDATE",
          [this.options.productScope, hash(token)],
        )
      ).rows[0];
      if (!row) throw new ModerationError("NOT_FOUND");
      return this.submitAppeal(client, row, reason);
    });
  }
  private async submitAppeal(client: PoolClient, row: Case, reason: string) {
    const now = this.options.clock.now();
    if (row.status !== "resolved" || row.appeal_used_at) throw new ModerationError("ALREADY_RESOLVED");
    if (!row.appeal_due_at || row.appeal_due_at <= now) throw new ModerationError("EXPIRED");
    const due = new Date(now.getTime() + 7 * day);
    await client.query("UPDATE moderation_evidence SET sealed_appeal=$2 WHERE case_id=$1", [row.id, this.seal(reason)]);
    await client.query(
      `UPDATE moderation_cases SET status='appealed',assigned_staff_id=NULL,access_expires_at=NULL,appealed_at=$3,
     appeal_review_due_at=$4,appeal_used_at=$3,appeal_token_hash=NULL WHERE product_scope=$1 AND id=$2`,
      [this.options.productScope, row.id, now, due],
    );
    await this.audit(client, null, row.id, "appeal.submitted");
    return { submitted: true, reviewDueAt: due };
  }
  async hold(
    staff: StaffIdentity,
    id: string,
    input: { basis: string; reviewAt: Date; authorizedStaffIds?: string[] },
  ) {
    this.text(input.basis, 2000);
    const now = this.options.clock.now();
    if (input.reviewAt <= now || input.reviewAt.getTime() > now.getTime() + 90 * day)
      throw new ModerationError("INVALID_INPUT");
    return withTransaction(this.pool, async (client) => {
      const row = await this.assigned(client, staff, id);
      const authorized = [
        ...new Set([
          staff.accountId,
          ...(input.authorizedStaffIds ?? []),
          ...(row.initial_reviewer_id ? [row.initial_reviewer_id] : []),
        ]),
      ];
      if (authorized.length > 10) throw new ModerationError("INVALID_INPUT");
      const valid = await client.query(
        "SELECT id FROM accounts WHERE product_scope=$1 AND role='staff' AND status='active' AND id=ANY($2::uuid[])",
        [this.options.productScope, authorized],
      );
      if (valid.rowCount !== authorized.length) throw new ModerationError("INVALID_INPUT");
      await client.query(
        `INSERT INTO moderation_holds(case_id,scope,sealed_basis,authorized_staff_ids,review_at,created_at)
      VALUES($1,'reported-evidence-and-audit',$2,$3,$4,$5) ON CONFLICT(case_id) DO UPDATE SET sealed_basis=EXCLUDED.sealed_basis,
      authorized_staff_ids=EXCLUDED.authorized_staff_ids,review_at=EXCLUDED.review_at`,
        [id, this.seal(input.basis), authorized, input.reviewAt, now],
      );
      await this.audit(client, staff.accountId, id, "hold.created");
      return { reviewAt: input.reviewAt };
    });
  }
  async releaseHold(staff: StaffIdentity, id: string) {
    return withTransaction(this.pool, async (client) => {
      await this.assigned(client, staff, id);
      await client.query("DELETE FROM moderation_holds WHERE case_id=$1", [id]);
      await this.audit(client, staff.accountId, id, "hold.released");
      return { released: true };
    });
  }
  async myCases(accountId: string) {
    const cases = (
      await this.pool.query<Case & { can_appeal: boolean }>(
        `SELECT id,target_kind,target_id,category,priority,status,triage_due_at,appeal_due_at,appeal_review_due_at,
    (subject_account_id=$2) AS can_appeal FROM moderation_cases WHERE product_scope=$1 AND (reporter_account_id=$2 OR subject_account_id=$2)
    ORDER BY created_at DESC LIMIT 50`,
        [this.options.productScope, accountId],
      )
    ).rows;
    const audit = (
      await this.pool.query<{ case_id: string; action: string; sealed_reason: string; occurred_at: Date }>(
        "SELECT case_id,action,sealed_reason,occurred_at FROM moderation_audit WHERE product_scope=$1 AND case_id=ANY($2::uuid[]) AND sealed_reason IS NOT NULL ORDER BY id",
        [this.options.productScope, cases.filter((c) => c.can_appeal).map((c) => c.id)],
      )
    ).rows;
    return {
      cases: cases.map((c) => ({
        ...c,
        decisions: audit
          .filter((a) => a.case_id === c.id)
          .map((a) => ({ action: a.action, reason: this.open<string>(a.sealed_reason), occurredAt: a.occurred_at })),
      })),
    };
  }
  async assertAllowed(client: PoolClient, accountId: string, kind: "play" | "messaging"): Promise<void> {
    const restriction = await client.query(
      "SELECT case_id FROM moderation_restrictions WHERE product_scope=$1 AND account_id=$2 AND kind=$3 AND until_at>$4",
      [this.options.productScope, accountId, kind, this.options.clock.now()],
    );
    if (restriction.rowCount) throw new ModerationError("FORBIDDEN");
  }
  async processClosures(workerId: string): Promise<number> {
    if (!this.options.closeAccount) return 0;
    const now = this.options.clock.now();
    const row = (
      await this.pool.query<{ case_id: string; account_id: string }>(
        `WITH candidate AS(SELECT case_id FROM moderation_closure_jobs
   WHERE product_scope=$1 AND status='ready' AND (lease_expires_at IS NULL OR lease_expires_at<=$2) ORDER BY case_id LIMIT 1 FOR UPDATE SKIP LOCKED)
   UPDATE moderation_closure_jobs j SET leased_by=$3,lease_expires_at=$2+interval '60 seconds' FROM candidate c WHERE j.case_id=c.case_id RETURNING j.*`,
        [this.options.productScope, now, workerId],
      )
    ).rows[0];
    if (!row) return 0;
    try {
      await this.options.closeAccount(row.account_id);
    } catch (error) {
      if (!(typeof error === "object" && error !== null && "code" in error && error.code === "ALREADY_CLOSING"))
        throw error;
    }
    await this.pool.query(
      "UPDATE moderation_closure_jobs SET status='done',leased_by=NULL,lease_expires_at=NULL WHERE product_scope=$1 AND case_id=$2 AND leased_by=$3",
      [this.options.productScope, row.case_id, workerId],
    );
    return 1;
  }
}
