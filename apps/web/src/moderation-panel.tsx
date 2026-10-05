import { createContext, useContext, useEffect, useRef, useState } from "react";
import { pactBaseUrl } from "./client-location.js";

type Request = (path: string, method?: string, body?: unknown) => Promise<Record<string, unknown>>;
export const ReportingContext = createContext<{ request: Request; canWrite: boolean } | null>(null);
export function ReportControl({ kind, targetId }: { kind: string; targetId: string }) {
  const context = useContext(ReportingContext),
    retry = useRef<{ key: string; id: string } | null>(null);
  const [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  if (!context) return null;
  return (
    <details>
      <summary>Report this content</summary>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setStatus("");
          const fields = Object.fromEntries(new FormData(e.currentTarget)),
            input = { kind, targetId, category: fields.category, details: fields.details },
            key = JSON.stringify(input);
          if (retry.current?.key !== key) retry.current = { key, id: crypto.randomUUID() };
          try {
            const r = await context.request("/v1/moderation/reports", "POST", {
              ...input,
              reportKey: retry.current.id,
            });
            retry.current = null;
            setStatus(
              "Report received. Case " + r.caseId + ". Triage due " + new Date(String(r.triageDueAt)).toLocaleString(),
            );
          } catch (error) {
            setStatus(String(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Reason
          <select name="category">
            <option value="abuse">Harassment or abuse</option>
            <option value="doxxing">Exposed personal information</option>
            <option value="threat">Urgent threat</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          Context
          <textarea name="details" required maxLength={2000} />
        </label>
        <p>
          Only this selected content and your report are retained as case evidence. Urgent reports: 24 hours; others: 72
          hours.
        </p>
        <button type="submit" disabled={busy || !context.canWrite}>
          Submit report
        </button>
      </form>
      {status && <p role="status">{status}</p>}
    </details>
  );
}
type CaseSummary = {
  id: string;
  status: string;
  target_kind: string;
  triage_due_at: string;
  appeal_due_at?: string;
  appeal_review_due_at?: string;
  can_appeal: boolean;
  decisions?: { action: string; reason: string; occurredAt: string }[];
};
export function ModerationPanel({ request, canWrite }: { request: Request; canWrite: boolean }) {
  const [cases, setCases] = useState<CaseSummary[]>([]),
    [status, setStatus] = useState(""),
    [staff, setStaff] = useState(false),
    [queue, setQueue] = useState<CaseSummary[]>([]),
    [selected, setSelected] = useState(""),
    [evidence, setEvidence] = useState<Record<string, unknown> | null>(null),
    [busy, setBusy] = useState(false);
  async function perform(operation: () => Promise<void>) {
    setBusy(true);
    setStatus("");
    try {
      await operation();
    } catch (e) {
      setStatus(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="game-card">
      <h3>Reports and appeals</h3>
      <p>
        Appeal within 14 days of a decision. A different staff member reviews the appeal within seven days. English
        support.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          void perform(async () => {
            setCases((await request("/v1/moderation/mine")).cases as CaseSummary[]);
          })
        }
      >
        Load my cases
      </button>
      {cases.map((c) => (
        <section key={c.id}>
          <h4>
            {c.target_kind} · {c.status}
          </h4>
          <p>
            Case {c.id} · triage due {new Date(c.triage_due_at).toLocaleString()}
          </p>
          {c.decisions?.map((d) => (
            <p key={d.occurredAt + d.action}>
              {d.action}: {d.reason}
            </p>
          ))}
          {c.can_appeal && c.status === "resolved" && c.appeal_due_at && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const reason = String(new FormData(e.currentTarget).get("reason"));
                void perform(async () => {
                  await request("/v1/moderation/cases/" + c.id + "/appeal", "POST", { reason });
                  setStatus("Appeal submitted");
                  setCases((await request("/v1/moderation/mine")).cases as CaseSummary[]);
                });
              }}
            >
              <label>
                Appeal reason
                <textarea name="reason" required maxLength={2000} />
              </label>
              <p>Due {new Date(c.appeal_due_at).toLocaleString()}</p>
              <button type="submit" disabled={busy || !canWrite}>
                Submit appeal
              </button>
            </form>
          )}
          {c.appeal_review_due_at && <p>Review due {new Date(c.appeal_review_due_at).toLocaleString()}</p>}
        </section>
      ))}
      <details onToggle={(e) => setStaff(e.currentTarget.open)}>
        <summary>Staff moderation console</summary>
        {staff && (
          <>
            <p>Platform staff with a recent MFA sign-in only. Court roles grant no platform moderation access.</p>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  setQueue((await request("/v1/moderation/queue")).cases as CaseSummary[]);
                })
              }
            >
              Load queue
            </button>
            {queue.map((c) => (
              <p key={c.id}>
                {c.target_kind} · {c.status} · due {c.appeal_review_due_at ?? c.triage_due_at}{" "}
                <button
                  type="button"
                  disabled={busy || !canWrite}
                  onClick={() =>
                    void perform(async () => {
                      await request("/v1/moderation/cases/" + c.id + "/claim", "POST", {});
                      setSelected(c.id);
                      setEvidence(await request("/v1/moderation/cases/" + c.id));
                    })
                  }
                >
                  Claim and read selected case
                </button>
              </p>
            ))}
            {evidence && (
              <>
                <h4>Case {selected}</h4>
                <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                  {JSON.stringify(evidence, null, 2)}
                </pre>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = Object.fromEntries(new FormData(e.currentTarget));
                    void perform(async () => {
                      await request("/v1/moderation/cases/" + selected + "/actions", "POST", {
                        action: f.action,
                        reason: f.reason,
                        ...(f.until ? { until: new Date(String(f.until)).toISOString() } : {}),
                      });
                      setEvidence(await request("/v1/moderation/cases/" + selected));
                      setStatus("Decision recorded");
                    });
                  }}
                >
                  <label>
                    Action
                    <select name="action">
                      <option value="hide">Hide selected content</option>
                      <option value="suspend-messaging">Suspend messaging</option>
                      <option value="suspend-play">Suspend play</option>
                      <option value="close">Close account through privacy process</option>
                      <option value="dismiss">Dismiss report</option>
                      <option value="uphold">Uphold appealed decision</option>
                      <option value="overturn">Overturn appealed decision</option>
                    </select>
                  </label>
                  <label>
                    Audit reason (shown to the subject)
                    <textarea name="reason" required maxLength={1000} />
                  </label>
                  <label>
                    Suspension end, if applicable
                    <input name="until" type="datetime-local" />
                  </label>
                  <button type="submit" disabled={busy || !canWrite}>
                    Record decision
                  </button>
                </form>
                <details>
                  <summary>Scoped evidence hold</summary>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = Object.fromEntries(new FormData(e.currentTarget));
                      void perform(async () => {
                        await request("/v1/moderation/cases/" + selected + "/hold", "POST", {
                          basis: f.basis,
                          reviewAt: new Date(String(f.reviewAt)).toISOString(),
                          authorizedStaffIds: String(f.staff ?? "")
                            .split(",")
                            .map((v) => v.trim())
                            .filter(Boolean),
                        });
                        setStatus("Scoped hold recorded");
                      });
                    }}
                  >
                    <label>
                      Legal or safety basis
                      <textarea name="basis" required maxLength={2000} />
                    </label>
                    <label>
                      Review due (within 90 days)
                      <input name="reviewAt" type="datetime-local" required />
                    </label>
                    <label>
                      Additional authorized staff UUIDs, comma separated
                      <input name="staff" />
                    </label>
                    <p>
                      Holds cover selected evidence and audit only. Access remains assigned, expires after seven days,
                      and requires recent MFA.
                    </p>
                    <button type="submit" disabled={busy || !canWrite}>
                      Record hold
                    </button>
                  </form>
                  <button
                    type="button"
                    disabled={busy || !canWrite}
                    onClick={() =>
                      void perform(async () => {
                        await request("/v1/moderation/cases/" + selected + "/hold/release", "POST", {});
                        setStatus("Hold released");
                      })
                    }
                  >
                    Release scoped hold
                  </button>
                </details>
              </>
            )}
          </>
        )}
      </details>
      {status && <p role="status">{status}</p>}
    </article>
  );
}
export function AppealPage() {
  const [token] = useState(
    () =>
      new URLSearchParams(window.location.hash.slice(1)).get("appeal") ??
      new URLSearchParams(window.location.search).get("appeal") ??
      "",
  );
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("appeal");
    url.hash = "";
    window.history.replaceState(null, "", url);
  }, []);
  const [status, setStatus] = useState(""),
    [done, setDone] = useState(false),
    [busy, setBusy] = useState(false);
  return (
    <main className="game-shell auth-shell">
      <h1>Appeal a moderation decision</h1>
      <p>
        This one-use link accepts an appeal for 14 days. It grants no game access. A different reviewer responds within
        seven days.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const r = await fetch(pactBaseUrl() + "v1/moderation/appeal", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ token, reason: String(new FormData(e.currentTarget).get("reason")) }),
            });
            if (!r.ok) throw new Error("Appeal unavailable or expired (" + r.status + ")");
            const data = await r.json();
            setDone(true);
            setStatus("Appeal received. Review due " + new Date(data.reviewDueAt).toLocaleString());
          } catch (error) {
            setStatus(String(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Appeal reason
          <textarea name="reason" required maxLength={2000} />
        </label>
        <button type="submit" disabled={busy || done || !token}>
          Submit appeal
        </button>
      </form>
      {status && <p role="status">{status}</p>}
      <a href={pactBaseUrl()}>Return to PACT</a>
    </main>
  );
}
