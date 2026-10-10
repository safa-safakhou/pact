export type NoticeDates = {
  status: string;
  publishedAt?: string | undefined;
  expiresGameTimeMs?: number | null | undefined;
};
export function noticeDates(post: NoticeDates): string {
  const created =
    post.publishedAt && Number.isFinite(Date.parse(post.publishedAt))
      ? `Created ${post.publishedAt}`
      : "Created date unknown";
  const expires =
    typeof post.expiresGameTimeMs === "number" &&
    Number.isSafeInteger(post.expiresGameTimeMs) &&
    post.expiresGameTimeMs >= 0
      ? `expires at game time ${new Date(post.expiresGameTimeMs).toISOString()}`
      : "expiry unknown";
  const state =
    post.status === "expired"
      ? "Expired notice"
      : created.includes("unknown") || expires.includes("unknown")
        ? "Freshness unknown"
        : "Unexpired as of server read";
  return `${state}. ${created}; ${expires}. Response time unknown.`;
}
export type OutgoingContact = { id: string; status: string; handle: string; expiresGameTimeMs: string };
export function contactState(request: OutgoingContact, gameTimeMs: number | undefined): string {
  const deadline = Number(request.expiresGameTimeMs);
  if (request.status === "pending")
    return Number.isFinite(deadline) && gameTimeMs !== undefined && deadline <= gameTimeMs
      ? "Recorded pending; deadline passed, refresh for the actual outcome. Response time unknown."
      : "Pending: waiting for the recipient's owner or delegated agent. Response time unknown.";
  if (request.status === "accepted") return "Accepted: the recipient recorded acceptance.";
  if (request.status === "declined") return "Declined: respect the recipient's decision.";
  if (request.status === "expired") return "Expired: no acceptance was recorded.";
  return `Recorded ${request.status}; inspect the source before acting.`;
}
export function OutgoingContactHistory({
  entries,
  gameTimeMs,
}: {
  entries: OutgoingContact[] | undefined;
  gameTimeMs: number | undefined;
}) {
  return (
    <article className="game-card">
      <h3>Your outgoing contact requests</h3>
      {entries === undefined ? (
        <p>Outgoing history unavailable; refresh before inferring an outcome.</p>
      ) : entries.length ? (
        <ul>
          {entries.map((r) => (
            <li key={r.id}>
              @{r.handle}: {contactState(r, gameTimeMs)}{" "}
              <small>Recorded expiry game time: {r.expiresGameTimeMs} ms.</small>
            </li>
          ))}
        </ul>
      ) : (
        <p>No outgoing requests in the retained view. You can read public notices, leave and return later.</p>
      )}
      <p>
        Introductions are free. The recipient's social delegation determines who can decide. A recorded request does not
        prove acceptance or create a contract.
      </p>
    </article>
  );
}
