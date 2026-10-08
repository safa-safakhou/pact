import { useEffect, useRef, useState } from "react";
import { pactBaseUrl } from "./client-location.js";

type Json = Record<string, unknown>;
type Request = (path: string, method?: string, body?: unknown) => Promise<Json>;
export type ApprovalReviewData = {
  approvalId: string;
  status: string;
  effectsSummary: string;
  expiresAt: string;
  receipt: { code?: string } | null;
};
export function approvalTitle(summary: string): string {
  const building = /^Queue (\w+) level (\d+) in builder slot/.exec(summary);
  return building ? `Upgrade ${building[1]} to level ${building[2]}` : "Your Envoy’s request";
}
export function approvalIsPending(review: ApprovalReviewData, now: number): boolean {
  return review.status === "pending" && new Date(review.expiresAt).getTime() > now;
}
export function ApprovalDecision({
  review,
  now,
  busy,
  canWrite,
  onDecide,
}: {
  review: ApprovalReviewData;
  now: number;
  busy: boolean;
  canWrite: boolean;
  onDecide: (approve: boolean) => void;
}) {
  const pending = approvalIsPending(review, now);
  const expired = review.status === "expired" || (review.status === "pending" && !pending);
  const remaining = Math.max(0, Math.ceil((new Date(review.expiresAt).getTime() - now) / 60000));
  const title = approvalTitle(review.effectsSummary);
  const cost = /construction costs (\d+) Iron and (\d+) Silver/.exec(review.effectsSummary);
  return (
    <article className="approval-decision" aria-label="Review your Envoy’s request">
      <p className="eyebrow">Your decision</p>
      <h1>{title}</h1>
      {cost && (
        <p className="approval-cost">
          {cost[1]} Iron + {cost[2]} Silver
        </p>
      )}
      <p>{review.effectsSummary}</p>
      <p>Approve allows this one action only. Your agent’s regular permissions stay the same.</p>
      {pending && (
        <p role="status">
          Waiting for your decision · expires in {remaining} {remaining === 1 ? "minute" : "minutes"}
        </p>
      )}
      {expired && (
        <p role="status">
          This request has expired. Nothing was approved. Return to ChatGPT and ask your Envoy for a fresh request for
          the same action.
        </p>
      )}
      {review.status === "approved" && (
        <p role="status">
          Approved · the action was submitted to the game. Construction may be queued or underway; approval is not
          building completion. Return to ChatGPT and ask your Envoy to check the result.
        </p>
      )}
      {review.status === "rejected" && <p role="status">Declined. This request will not be carried out.</p>}
      {pending && (
        <div className="approval-actions">
          <button type="button" disabled={busy || !canWrite} onClick={() => onDecide(true)}>
            {busy ? "Saving your decision…" : `Approve: ${title}`}
          </button>
          <button type="button" className="secondary" disabled={busy || !canWrite} onClick={() => onDecide(false)}>
            Decline this action
          </button>
        </div>
      )}
      {!canWrite && pending && <p>Reconnect to PACT before deciding. Your decision has not been sent.</p>}
    </article>
  );
}
export function ApprovalReview({
  approvalId,
  request,
  canWrite,
  onRefresh,
  kingdomName,
}: {
  approvalId?: string;
  request: Request;
  canWrite: boolean;
  onRefresh: () => Promise<void>;
  kingdomName?: string | undefined;
}) {
  const [selected, setSelected] = useState(approvalId ?? "");
  const [review, setReview] = useState<ApprovalReviewData | null>(null);
  const [list, setList] = useState<ApprovalReviewData[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now);
  const generation = useRef(0);
  const saving = useRef(false);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const g = ++generation.current;
    setReview(null);
    setError("");
    const path = selected ? `/v1/approvals/${encodeURIComponent(selected)}` : "/v1/approvals";
    void request(path)
      .then((value) => {
        if (g !== generation.current) return;
        if (selected) setReview(value as unknown as ApprovalReviewData);
        else setList(value.approvals as ApprovalReviewData[]);
      })
      .catch(() => {
        if (g === generation.current)
          setError(
            "We couldn’t load this decision. Check your connection and try again. If this is another kingdom’s link, reconnect to the kingdom that requested it.",
          );
      });
    return () => {
      generation.current++;
    };
  }, [selected, request]);
  async function decide(approve: boolean) {
    if (!review || !canWrite || saving.current || !approvalIsPending(review, Date.now())) return;
    saving.current = true;
    setBusy(true);
    setError("");
    const g = generation.current;
    try {
      const result = await request(
        `/v1/approvals/${encodeURIComponent(review.approvalId)}/${approve ? "approve" : "reject"}`,
        "POST",
      );
      if (g !== generation.current) return;
      setReview(result as unknown as ApprovalReviewData);
      await onRefresh();
    } catch {
      if (g !== generation.current) return;
      try {
        const fresh = await request(`/v1/approvals/${encodeURIComponent(review.approvalId)}`);
        if (g !== generation.current) return;
        setReview(fresh as unknown as ApprovalReviewData);
      } catch {
        /* Keep the last review; never assume a write succeeded. */
      }
      setError(
        "The decision could not be confirmed. Review the current status before trying again; the game rechecks resources and expiry when you approve.",
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="approval-review" aria-label="Your decisions">
      <p className="eyebrow">PACT {kingdomName ? `· ${kingdomName}` : "· Your Envoy"}</p>
      {error && <p role="alert">{error}</p>}
      {selected && !review && !error && <p role="status">Opening your Envoy’s request…</p>}
      {review && (
        <ApprovalDecision
          review={review}
          now={now}
          busy={busy}
          canWrite={canWrite}
          onDecide={(approve) => void decide(approve)}
        />
      )}
      {!selected && (
        <>
          <h2>Decisions waiting for you</h2>
          {list.length ? (
            list
              .filter((r) => approvalIsPending(r, now))
              .map((r) => (
                <button type="button" key={r.approvalId} onClick={() => setSelected(r.approvalId)}>
                  {approvalTitle(r.effectsSummary)}
                </button>
              ))
          ) : (
            <p>No pending requests. Your Envoy will link here when it needs your decision.</p>
          )}
        </>
      )}
      {error && (
        <button
          type="button"
          onClick={() => {
            setSelected("");
            setError("");
          }}
        >
          Show pending decisions
        </button>
      )}
      <p>
        <a href={pactBaseUrl()}>Back to your kingdom</a>
      </p>
    </section>
  );
}
