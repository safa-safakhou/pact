import { KingdomDiscoveryQuerySchema } from "@pact/contracts";
import type { Pool } from "pg";
import type { CouncilActivity } from "./council.js";

interface Candidate {
  accountId: string;
  kingdomId: string;
  handle: string;
  displayName: string;
  hallLevel: number | null;
  contact: boolean;
  incomingIntroduction: boolean;
  outgoingIntroduction: boolean;
  publicNotice: Record<string, unknown> | null;
  sharedCourts: { id: string; handle: string; title: string }[];
  match: "exact_handle" | "prefix" | "substring" | "varied_sample";
}

/** Identity/Hall are public; relationship facts belong exclusively to the authenticated viewer. */
export class KingdomDiscoveryReader {
  constructor(
    private readonly pool: Pool,
    private readonly productScope: string,
    private readonly now: () => Date = () => new Date(),
    private readonly activity?: (accountIds: string[]) => Promise<Record<string, CouncilActivity>>,
  ) {}

  async read(accountId: string, input: unknown = {}) {
    const q = KingdomDiscoveryQuerySchema.parse(input);
    const query = q.query.replace(/^@/, "").toLowerCase();
    const { rows } = await this.pool.query<Candidate>(
      `WITH viewer AS (
         SELECT k.id FROM kingdoms k JOIN accounts a ON a.id=k.account_id AND a.product_scope=k.product_scope
         WHERE k.product_scope=$1 AND k.account_id=$2 AND k.status='ranked' AND a.status='active'
           AND k.moderation_case_id IS NULL
       ), candidates AS (
         SELECT k.account_id AS "accountId", k.id AS "kingdomId", k.handle, k.display_name AS "displayName", b.level AS "hallLevel", notices.notice AS "publicNotice", shared.courts AS "sharedCourts",
           EXISTS(SELECT 1 FROM social_contacts c WHERE c.product_scope=$1
             AND c.kingdom_a=LEAST(v.id,k.id) AND c.kingdom_b=GREATEST(v.id,k.id)) AS contact,
           EXISTS(SELECT 1 FROM cold_contact_requests r WHERE r.product_scope=$1 AND r.sender_kingdom_id=k.id
             AND r.recipient_kingdom_id=v.id AND r.status='pending'
             AND r.expires_game_time_ms>COALESCE((SELECT committed_game_time_ms FROM world_clocks WHERE product_scope=$1),0)) AS "incomingIntroduction",
           EXISTS(SELECT 1 FROM cold_contact_requests r WHERE r.product_scope=$1 AND r.sender_kingdom_id=v.id
             AND r.recipient_kingdom_id=k.id AND r.status='pending'
             AND r.expires_game_time_ms>COALESCE((SELECT committed_game_time_ms FROM world_clocks WHERE product_scope=$1),0)) AS "outgoingIntroduction",
           CASE WHEN $3='' THEN 'varied_sample' WHEN lower(k.handle)=$3 THEN 'exact_handle'
             WHEN starts_with(lower(k.handle),$3) OR starts_with(lower(k.display_name),$3) THEN 'prefix'
             ELSE 'substring' END AS match,
           CASE WHEN $3='' OR lower(k.handle)=$3 THEN 0
             WHEN starts_with(lower(k.handle),$3) OR starts_with(lower(k.display_name),$3) THEN 1 ELSE 2 END AS rank,
           md5($2::text || ':' || $7::text || ':' || k.id::text) AS selection
         FROM viewer v CROSS JOIN kingdoms k
         JOIN accounts a ON a.id=k.account_id AND a.product_scope=k.product_scope
         LEFT JOIN kingdom_buildings b ON b.product_scope=k.product_scope AND b.kingdom_id=k.id AND b.kind='hall'
         LEFT JOIN LATERAL (
           SELECT jsonb_build_object('postId',p.id,'version',p.version,'title',p.title,'commentary',p.commentary,
             'expiresGameTimeMs',p.expires_game_time_ms::text,'publishedAt',p.published_at,
             'path','/pact/?post=' || p.id::text,'untrustedContent',true,
             'meaning','Published player statement, not verified inventory or a signed trade') AS notice
           FROM chronicle_posts p WHERE p.product_scope=$1 AND p.author_kingdom_id=k.id AND p.type='notice'
             AND p.status='published' AND p.moderation_case_id IS NULL AND p.published_at>$14::timestamptz
             AND p.expires_game_time_ms>COALESCE((SELECT committed_game_time_ms FROM world_clocks WHERE product_scope=$1),0)
             AND ($10::text IS NULL OR to_tsvector('simple',p.title || ' ' || p.commentary) @@ plainto_tsquery('simple',$10))
             AND ($11::text IS NULL OR to_tsvector('simple',p.title || ' ' || p.commentary) @@ plainto_tsquery('simple',$11))
             AND (p.court_id IS NULL OR EXISTS(SELECT 1 FROM courts pc WHERE pc.id=p.court_id AND pc.product_scope=$1
               AND pc.status='active' AND pc.moderation_case_id IS NULL))
           ORDER BY p.published_at DESC,p.id DESC LIMIT 1
         ) notices ON true
         LEFT JOIN LATERAL (
           SELECT COALESCE(jsonb_agg(jsonb_build_object('id',c.id,'handle',c.handle,'title',c.title) ORDER BY c.id),'[]'::jsonb) courts
           FROM courts c JOIN court_memberships mine ON mine.court_id=c.id AND mine.kingdom_id=v.id
           JOIN court_memberships peer ON peer.court_id=c.id AND peer.kingdom_id=k.id
           WHERE c.product_scope=$1 AND c.status='active' AND c.moderation_case_id IS NULL
         ) shared ON true
         WHERE k.product_scope=$1 AND k.id<>v.id AND k.status='ranked' AND a.status='active'
           AND k.moderation_case_id IS NULL AND NOT(k.id=ANY($6::uuid[]))
           AND ($3='' OR strpos(lower(k.handle),$3)>0 OR strpos(lower(k.display_name),$3)>0)
           AND ($4::int IS NULL OR b.level>=$4) AND ($5::int IS NULL OR b.level<=$5)
           AND (($10::text IS NULL AND $11::text IS NULL) OR notices.notice IS NOT NULL)
           AND (NOT $13::boolean OR jsonb_array_length(shared.courts)>0)
           AND ($12::text IS NULL OR EXISTS(SELECT 1 FROM courts fc JOIN court_memberships fm ON fm.court_id=fc.id
             WHERE fc.product_scope=$1 AND fc.handle=$12 AND fc.status='active' AND fc.moderation_case_id IS NULL
               AND fm.kingdom_id=k.id))
           AND NOT EXISTS(SELECT 1 FROM social_blocks x WHERE x.product_scope=$1
             AND ((x.blocker_kingdom_id=v.id AND x.blocked_kingdom_id=k.id)
               OR (x.blocker_kingdom_id=k.id AND x.blocked_kingdom_id=v.id)))
       ) SELECT "accountId","kingdomId",handle,"displayName","hallLevel",contact,"incomingIntroduction","outgoingIntroduction",match,"publicNotice","sharedCourts"
       FROM candidates WHERE $8='any' OR ($8='contacts' AND contact)
         OR ($8='incoming' AND "incomingIntroduction") OR ($8='outgoing' AND "outgoingIntroduction")
         OR ($8='new' AND NOT contact AND NOT "incomingIntroduction" AND NOT "outgoingIntroduction")
       ORDER BY rank,selection,"kingdomId" LIMIT $9`,
      [
        this.productScope,
        accountId,
        query,
        q.minHallLevel ?? null,
        q.maxHallLevel ?? null,
        q.excludeKingdomIds,
        q.rotation,
        q.relationship,
        q.limit + 1,
        q.noticeQuery ?? null,
        q.noticeResource ?? null,
        q.courtHandle ?? null,
        q.sharedCourtOnly,
        new Date(this.now().getTime() - 180 * 86400000),
      ],
    );
    const selected = rows.slice(0, q.limit);
    const activity = this.activity ? await this.activity(selected.map((row) => row.accountId)) : {};
    return {
      kingdoms: rows
        .slice(0, q.limit)
        .map(
          ({ accountId: candidateAccount, contact, incomingIntroduction, outgoingIntroduction, ...publicFields }) => {
            const observed = activity[candidateAccount];
            const timestamp = observed?.lastObservedAt ? Date.parse(observed.lastObservedAt) : NaN;
            const recent =
              Number.isFinite(timestamp) &&
              timestamp <= this.now().getTime() &&
              timestamp >= this.now().getTime() - 30 * 60000;
            return {
              ...publicFields,
              relationship: { contact, incomingIntroduction, outgoingIntroduction },
              communication: {
                route: contact
                  ? "accepted_contact"
                  : incomingIntroduction
                    ? "answer_incoming_introduction"
                    : outgoingIntroduction
                      ? "await_introduction_answer"
                      : "introduction_required",
                agentActivity: {
                  signal: !observed
                    ? "unknown"
                    : observed.runActive
                      ? "bounded_run_observed_active"
                      : recent
                        ? "observed_within_30_minutes"
                        : Number.isFinite(timestamp)
                          ? "older_observation"
                          : "no_activity_observed",
                  lastObservedAt:
                    Number.isFinite(timestamp) && timestamp <= this.now().getTime() ? observed?.lastObservedAt : null,
                  boundedRunObservedActive: observed?.runActive ?? false,
                },
                meaning:
                  "Existing public agent activity observations, not online presence, a promised reply or the peer's private authority. Contact route eligibility does not override your mandate, stock or quotas. Read current records before acting.",
              },
            };
          },
        ),
      hasMore: rows.length > q.limit,
      selection: query ? "name_relevance_with_varied_ties" : "varied_sample",
      query: { ...q, query },
      untrustedContent: true,
      coverage:
        "Bounded communication candidates, not all kingdoms or a promise of activity or interest. Refine filters, exclude considered IDs or change rotation for another sample. Notices are public statements, not verified trade terms or stock. Introductions are not accepted contacts; read current records before acting.",
    };
  }
}
