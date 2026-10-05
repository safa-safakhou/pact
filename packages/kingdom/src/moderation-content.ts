import type { PoolClient } from "pg";
export type ModerationTargetKind = "message" | "profile" | "post" | "article" | "court" | "pin" | "seal";
export class ModerationError extends Error {
  constructor(
    readonly code:
      | "FORBIDDEN"
      | "NOT_FOUND"
      | "INVALID_INPUT"
      | "ALREADY_ASSIGNED"
      | "EXPIRED"
      | "ALREADY_RESOLVED"
      | "CONTENT_CHANGED",
  ) {
    super(code);
  }
}
export type ContentSnapshot = {
  kind: ModerationTargetKind;
  id: string;
  content: Record<string, unknown>;
  version?: number;
};
export class ModerationContent {
  constructor(private readonly scope: string) {}
  async capture(
    client: PoolClient,
    reporter: string,
    kind: ModerationTargetKind,
    id: string,
    now: Date,
  ): Promise<{ subjectAccountId: string; snapshot: ContentSnapshot }> {
    let query: string;
    if (kind === "message")
      query = `SELECT m.body,m.sender_kingdom_id,m.recipient_kingdom_id,m.sent_game_time_ms,k.account_id AS subject
    FROM direct_messages m JOIN kingdoms k ON k.id=m.sender_kingdom_id AND k.product_scope=m.product_scope
    WHERE m.product_scope=$1 AND m.id=$2 AND m.created_at>$4 AND EXISTS(SELECT 1 FROM kingdoms v
      WHERE v.product_scope=m.product_scope AND v.account_id=$3 AND v.id IN(m.sender_kingdom_id,m.recipient_kingdom_id))`;
    else if (kind === "profile")
      query = `SELECT display_name,portrait,account_id AS subject FROM kingdoms WHERE product_scope=$1 AND id=$2 AND status='ranked'
    AND EXISTS(SELECT 1 FROM accounts a WHERE a.product_scope=$1 AND a.id=$3 AND a.status='active') AND activated_at<=$4`;
    else if (kind === "post")
      query = `SELECT p.title,p.commentary,p.fact,p.seal_ids,p.version,k.account_id AS subject FROM chronicle_posts p
    JOIN kingdoms k ON k.id=p.author_kingdom_id AND k.product_scope=p.product_scope
    WHERE p.product_scope=$1 AND p.id=$2 AND p.status='published' AND p.published_at>$4 AND
     EXISTS(SELECT 1 FROM accounts a WHERE a.product_scope=$1 AND a.id=$3 AND a.status='active')`;
    else if (kind === "article")
      query = `SELECT p.title,p.body,p.version,k.account_id AS subject FROM kingdom_articles p
    JOIN kingdoms k ON k.id=p.author_kingdom_id AND k.product_scope=p.product_scope WHERE p.product_scope=$1 AND p.id=$2
    AND p.status='active' AND p.published_at<=$4 AND EXISTS(SELECT 1 FROM accounts a WHERE a.product_scope=$1 AND a.id=$3 AND a.status='active')`;
    else if (kind === "court")
      query = `SELECT c.title,c.description,c.version,k.account_id AS subject FROM courts c JOIN kingdoms k ON k.id=c.owner_kingdom_id AND k.product_scope=c.product_scope
    WHERE c.product_scope=$1 AND c.id=$2 AND c.status='active' AND c.created_at<=$4 AND EXISTS(SELECT 1 FROM accounts a WHERE a.id=$3 AND a.product_scope=$1 AND a.status='active')`;
    else if (kind === "pin")
      query = `SELECT p.body,p.court_id,p.slot,p.created_at,k.account_id AS subject FROM court_pins p JOIN courts c ON c.id=p.court_id
    JOIN kingdoms k ON k.id=p.author_kingdom_id AND k.product_scope=c.product_scope WHERE c.product_scope=$1 AND p.id=$2 AND c.status='active' AND p.created_at<=$4
    AND EXISTS(SELECT 1 FROM accounts a WHERE a.id=$3 AND a.product_scope=$1 AND a.status='active')`;
    else if (kind === "seal")
      query = `SELECT s.signed_payload,s.signature,s.kid,k.account_id AS subject FROM evidence_seals s JOIN kingdoms k ON k.id=s.creator_kingdom_id AND k.product_scope=s.product_scope JOIN seal_signing_keys sk ON sk.kid=s.kid AND sk.compromised=false
    WHERE s.product_scope=$1 AND s.id=$2 AND s.status='published' AND s.published_at<=$4 AND EXISTS(SELECT 1 FROM accounts a WHERE a.id=$3 AND a.product_scope=$1 AND a.status='active')`;
    else throw new ModerationError("INVALID_INPUT");
    const threshold =
      kind === "message"
        ? new Date(now.getTime() - 90 * 86_400_000)
        : kind === "post"
          ? new Date(now.getTime() - 180 * 86_400_000)
          : now;
    const row = (await client.query<Record<string, unknown>>(query, [this.scope, id, reporter, threshold])).rows[0];
    if (!row || typeof row.subject !== "string") throw new ModerationError("NOT_FOUND");
    const { subject, version, ...content } = row;
    const snapshot: ContentSnapshot = { kind, id, content, ...(typeof version === "number" ? { version } : {}) };
    if (Buffer.byteLength(JSON.stringify(snapshot)) > 65536) throw new ModerationError("INVALID_INPUT");
    return { subjectAccountId: subject, snapshot };
  }
  async hide(client: PoolClient, snapshot: ContentSnapshot, caseId: string, now: Date): Promise<void> {
    const args = [this.scope, snapshot.id, caseId];
    let result: { rowCount: number | null };
    if (snapshot.kind === "message")
      result = await client.query(
        "UPDATE direct_messages SET body='[Removed by moderation]',moderation_case_id=$3 WHERE product_scope=$1 AND id=$2 AND moderation_case_id IS NULL RETURNING id",
        args,
      );
    else if (snapshot.kind === "profile")
      result = await client.query(
        "UPDATE kingdoms SET display_name='Hidden profile',portrait='moderated',moderation_case_id=$3 WHERE product_scope=$1 AND id=$2 AND moderation_case_id IS NULL RETURNING id",
        args,
      );
    else if (snapshot.kind === "post")
      result = await client.query(
        "UPDATE chronicle_posts SET status='removed',title='',commentary='',fact=NULL,seal_ids='{}',version=version+1,moderation_case_id=$3 WHERE product_scope=$1 AND id=$2 AND status='published' AND version=$4 RETURNING id",
        [...args, snapshot.version],
      );
    else if (snapshot.kind === "court")
      result = await client.query(
        "UPDATE courts SET title='Hidden Court profile',description='',version=version+1,moderation_case_id=$3 WHERE product_scope=$1 AND id=$2 AND status='active' AND version=$4 RETURNING id",
        [...args, snapshot.version],
      );
    else if (snapshot.kind === "pin")
      result = await client.query(
        "UPDATE court_pins SET body='[Removed by moderation]',moderation_case_id=$3 WHERE id=$2 AND moderation_case_id IS NULL AND EXISTS(SELECT 1 FROM courts c WHERE c.id=court_id AND c.product_scope=$1) RETURNING id",
        args,
      );
    else if (snapshot.kind === "seal")
      result = await client.query(
        "UPDATE evidence_seals SET status='removed',moderation_case_id=$3 WHERE product_scope=$1 AND id=$2 AND status='published' RETURNING id",
        args,
      );
    else
      result = await client.query(
        "UPDATE kingdom_articles SET status='moderated',title='Removed',body='Removed by moderation',closed_at=$4,moderation_case_id=$3 WHERE product_scope=$1 AND id=$2 AND status='active' AND version=$5 RETURNING id",
        [...args, now, snapshot.version],
      );
    if (!result.rowCount) throw new ModerationError("CONTENT_CHANGED");
  }
  async restore(client: PoolClient, snapshot: ContentSnapshot, caseId: string): Promise<void> {
    const args = [this.scope, snapshot.id, caseId];
    if (snapshot.kind === "message")
      await client.query(
        "UPDATE direct_messages SET body=$4,moderation_case_id=NULL WHERE product_scope=$1 AND id=$2 AND moderation_case_id=$3",
        [...args, snapshot.content.body],
      );
    else if (snapshot.kind === "profile")
      await client.query(
        "UPDATE kingdoms SET display_name=$4,portrait=$5,moderation_case_id=NULL WHERE product_scope=$1 AND id=$2 AND moderation_case_id=$3 AND status='ranked'",
        [...args, snapshot.content.display_name, snapshot.content.portrait],
      );
    else if (snapshot.kind === "post")
      await client.query(
        `UPDATE chronicle_posts SET status='published',title=$4,commentary=$5,fact=$6::jsonb,seal_ids=$7::uuid[],version=version+1,moderation_case_id=NULL
    WHERE product_scope=$1 AND id=$2 AND moderation_case_id=$3 AND status='removed' AND version=$8`,
        [
          ...args,
          snapshot.content.title,
          snapshot.content.commentary,
          snapshot.content.fact == null ? null : JSON.stringify(snapshot.content.fact),
          snapshot.content.seal_ids,
          (snapshot.version ?? 0) + 1,
        ],
      );
    else if (snapshot.kind === "court")
      await client.query(
        "UPDATE courts SET title=$4,description=$5,version=version+1,moderation_case_id=NULL WHERE product_scope=$1 AND id=$2 AND moderation_case_id=$3 AND status='active' AND version=$6",
        [...args, snapshot.content.title, snapshot.content.description, (snapshot.version ?? 0) + 1],
      );
    else if (snapshot.kind === "pin")
      await client.query(
        "UPDATE court_pins SET body=$4,moderation_case_id=NULL WHERE id=$2 AND moderation_case_id=$3 AND EXISTS(SELECT 1 FROM courts c WHERE c.id=court_id AND c.product_scope=$1)",
        [...args, snapshot.content.body],
      );
    else if (snapshot.kind === "seal")
      await client.query(
        "UPDATE evidence_seals SET status='published',moderation_case_id=NULL WHERE product_scope=$1 AND id=$2 AND moderation_case_id=$3 AND status='removed'",
        args,
      );
    else
      await client.query(
        "UPDATE kingdom_articles SET status='active',title=$4,body=$5,closed_at=NULL,moderation_case_id=NULL WHERE product_scope=$1 AND id=$2 AND moderation_case_id=$3 AND status='moderated'",
        [...args, snapshot.content.title, snapshot.content.body],
      );
  }
}
