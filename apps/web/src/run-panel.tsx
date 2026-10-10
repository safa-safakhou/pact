import { useCallback, useEffect, useRef, useState } from "react";
import { pactBaseUrl } from "./client-location.js";
import { resultSummary } from "./result-summary.js";
import { startVisiblePolling } from "./visible-polling.js";

type Request = (path: string, method?: string, body?: unknown) => Promise<Record<string, unknown>>;
type Run = {
  runId: string;
  status: string;
  objective: string;
  provider: string;
  model: string;
  deadlineAt: string;
  usedCalls: number;
  maxCalls: number;
  usedTokens: number;
  maxTokens: number;
  lastErrorCode: string | null;
  execution?: { state: string; checkedAt: string; leaseExpiresAt: string | null; hostStatus: string };
};
type Entry = {
  id: string;
  category: string;
  callId: string;
  code: string;
  actionKind?: string;
  toolName?: string;
  detail?: string;
  reason?: string;
  commandId?: string;
  approvalId?: string;
  currentFacts?: { record?: string; label: string; status: string; nextStep: string; reviewPath?: string }[];
  records: { record: string; version: number }[];
  nextStep: string;
};
type Report = {
  stale?: boolean;
  checkedAt?: string;
  timestamps?: Record<string, string>;
  label: string;
  status: string;
  entries: Entry[];
  assessments: { id: string; label: string; text: string }[];
  nextStep: string;
  truncated: boolean;
};
export function RunResult({ report, ambition = "" }: { report: Report; ambition?: string }) {
  const brief = resultSummary(report, ambition);
  return (
    <article className="game-card">
      <h3>{report.label}</h3>
      <section aria-label="Factual result summary">
        <h4>Recorded result and current decision</h4>
        <p>
          Notes: {brief.ambition}. Result state: {brief.state}.
        </p>
        <p>Latest receipt: {brief.latestResult}</p>
        <p>Current decision: {brief.currentDecision}</p>
        <p>Next step: {brief.nextStep}</p>
        {brief.receiptId && <a href={`${pactBaseUrl()}v1/receipts/${brief.receiptId}`}>Inspect actual receipt</a>}
        {brief.reviewPath && (
          <p>
            <a href={brief.reviewPath}>Human: review exact approval</a>
          </p>
        )}
        <p>{brief.authority}</p>
      </section>
      <p>
        {report.status} · {report.nextStep}
      </p>
      {report.checkedAt && (
        <p>
          Current facts checked at{" "}
          <time dateTime={report.checkedAt}>{new Date(report.checkedAt).toLocaleString()}</time>. Updates can take ten
          seconds; refresh after a decision.
        </p>
      )}
      {report.stale && (
        <p role="status">
          Current state is stale or unavailable. Historical results remain below; reconnect and refresh before deciding.
        </p>
      )}
      {!report.entries.length && <p>No recorded gameplay action in this report. Connection alone is not play.</p>}
      {!report.stale &&
        report.entries.flatMap((e) =>
          (e.currentFacts ?? [])
            .filter((f) => f.reviewPath)
            .map((f) => (
              <p key={e.id}>
                <a href={f.reviewPath}>Pending human decision: review exact approval</a>
              </p>
            )),
        )}
      {report.entries
        .slice(-3)
        .toReversed()
        .map((e) => (
          <ActivityEntry key={e.id} entry={e} report={report} />
        ))}
      {report.entries.length > 3 && (
        <details>
          <summary>Earlier recorded activity ({report.entries.length - 3})</summary>
          {report.entries
            .slice(0, -3)
            .toReversed()
            .map((e) => (
              <ActivityEntry key={e.id} entry={e} report={report} />
            ))}
        </details>
      )}
      {report.assessments.map((a) => (
        <div key={a.id}>
          <h4>Agent interpretation: {a.label}</h4>
          <p style={{ whiteSpace: "pre-wrap" }}>{a.text}</p>
        </div>
      ))}
      {report.truncated && <p>Report bounded to the latest 50 results; inspect receipts for older details.</p>}
    </article>
  );
}
function ActivityEntry({ entry: e, report }: { entry: Entry; report: Report }) {
  return (
    <div key={e.id}>
      <h4>Recorded outcome: {e.category.replaceAll("_", " ")}</h4>
      {e.currentFacts?.map((fact) => (
        <p key={fact.record ?? fact.label}>
          <strong>
            {fact.label}: {fact.status}
          </strong>
          {fact.reviewPath && !report.stale && (
            <>
              {" "}
              · <a href={fact.reviewPath}>Human: review exact approval</a>
            </>
          )}
        </p>
      ))}
      <p>{e.nextStep}</p>
      {report.timestamps?.[e.id] && (
        <p>
          <time dateTime={report.timestamps[e.id]}>{report.timestamps[e.id]}</time>
        </p>
      )}
      <details>
        <summary>Receipt and record references</summary>
        <p>Original result code: {e.code}</p>
        {(e.actionKind || e.toolName) && <p>Action: {e.actionKind ?? e.toolName}</p>}
        {(e.detail || e.reason) && <p>Cause: {e.detail ?? e.reason}</p>}
        {e.commandId && (
          <p>
            <a href={`${pactBaseUrl()}v1/receipts/${e.commandId}`} target="_blank" rel="noreferrer">
              Read receipt <code>{e.commandId}</code>
            </a>
          </p>
        )}
        {e.approvalId && !e.currentFacts && (
          <a href={`${pactBaseUrl()}?approval=${encodeURIComponent(e.approvalId)}`}>Human: review exact approval</a>
        )}
        <ul>
          {e.records.map((r) => (
            <li key={r.record}>
              {r.record} · version {r.version}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
export function RunPanel({
  request,
  contacts,
  canWrite = true,
  ambition = "",
}: {
  request: Request;
  contacts: { kingdomId: string; handle: string }[];
  canWrite?: boolean;
  ambition?: string;
}) {
  const [runs, setRuns] = useState<Run[]>([]),
    [connections, setConnections] = useState<{ id: string; provider: string; label: string; status: string }[]>([]),
    [credentialId, setCredentialId] = useState(""),
    [model, setModel] = useState(""),
    [objective, setObjective] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [report, setReport] = useState<Report | null>(null);
  const [external, setExternal] = useState<Report | null>(null);
  const [externalError, setExternalError] = useState("");
  const generation = useRef(0);
  const reportGeneration = useRef(0);
  const refreshing = useRef(false);
  useEffect(() => {
    if (!canWrite) setConfirmed(false);
  }, [canWrite]);
  async function readReport(runId: string) {
    const g = ++reportGeneration.current;
    setReport(null);
    try {
      const value = await request(`/v1/runs/${runId}/report`);
      if (g === reportGeneration.current) setReport(value as unknown as Report);
    } catch (e) {
      if (g === reportGeneration.current) setError(String(e));
    }
  }
  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    const g = ++generation.current;
    try {
      const r = await request("/v1/runs");
      if (g === generation.current) setRuns(r.runs as Run[]);
    } catch (e) {
      if (g === generation.current) setError(String(e));
    }
    try {
      const activity = await request("/v1/runs/external-activity");
      if (g === generation.current) {
        setExternal(activity as unknown as Report);
        setExternalError("");
      }
    } catch {
      if (g === generation.current) {
        setExternal((previous) => (previous ? { ...previous, stale: true } : null));
        setExternalError("External-agent activity is unavailable; no success or absence is inferred.");
      }
    }
    refreshing.current = false;
  }, [request]);
  useEffect(() => {
    const stop = startVisiblePolling(refresh, document);
    return () => {
      stop();
      generation.current++;
      reportGeneration.current++;
    };
  }, [refresh]);
  useEffect(() => {
    let current = true;
    void request("/v1/model-connections").then(
      (r) => {
        if (current)
          setConnections(
            (r.connections as { id: string; provider: string; label: string; status: string }[]).filter(
              (c) => c.status === "active",
            ),
          );
      },
      () => {},
    );
    return () => {
      current = false;
    };
  }, [request]);
  async function control(run: Run, action: string) {
    if (!canWrite) return;
    setBusy(true);
    setError("");
    try {
      await request(`/v1/runs/${run.runId}/${action}`, "POST");
      await refresh();
      await readReport(run.runId);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="court-panel">
      <h3>External-agent recorded activity</h3>
      <p>
        Receipt-backed actions from your external chats. No hidden reasoning or chatbot token usage is collected.
        Updates every ten seconds while this area is visible; reading never starts inference.
      </p>
      {externalError && <p role="status">{externalError}</p>}
      {external && <RunResult report={external} ambition={ambition} />}
      <details>
        <summary>Optional in-app provider and bounded runs</summary>
        <h3>Objective and bounded Envoy runs</h3>
        <p>
          Start only when you want inference. Waiting, messages and game ticks never start it. External chatbot usage is
          managed by that chatbot; committed game actions continue after stopping.
        </p>
        {error && <p role="alert">{error}</p>}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const connection = connections.find((c) => c.id === credentialId);
            if (!canWrite || !connection || !confirmed) return;
            setBusy(true);
            setError("");
            try {
              await request("/v1/runs", "POST", {
                objective,
                provider: connection.provider,
                model,
                credentialId,
                maxCalls: 20,
                maxTokens: 40000,
                maxMessages: 12,
                maxConversations: 6,
                conversationKingdomIds: selected,
              });
              setConfirmed(false);
              await refresh();
            } catch (err) {
              setError(String(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Your objective
            <textarea
              required
              maxLength={4000}
              value={objective}
              onChange={(e) => {
                setObjective(e.target.value);
                setConfirmed(false);
              }}
              placeholder="Find a real trade opportunity and explain what is waiting for my decision."
            />
          </label>
          <label>
            Saved model connection
            <select
              required
              value={credentialId}
              onChange={(e) => {
                setCredentialId(e.target.value);
                setConfirmed(false);
              }}
            >
              <option value="">Choose an existing connection</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.provider} · {c.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tool-capable model identifier
            <input
              required
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                setConfirmed(false);
              }}
            />
          </label>
          <fieldset>
            <legend>Selected conversations (up to six; unselected threads are not sent)</legend>
            {contacts.map((c) => (
              <label key={c.kingdomId}>
                <input
                  type="checkbox"
                  checked={selected.includes(c.kingdomId)}
                  disabled={!selected.includes(c.kingdomId) && selected.length >= 6}
                  onChange={(e) => {
                    setSelected(
                      e.target.checked ? [...selected, c.kingdomId] : selected.filter((id) => id !== c.kingdomId),
                    );
                    setConfirmed(false);
                  }}
                />
                @{c.handle}
              </label>
            ))}
          </fieldset>
          <p>
            Maximum 15 minutes, 20 model calls, 40,000 reported tokens, 12 outgoing messages. Provider price
            unavailable; this is not a currency guarantee or free-model claim.
          </p>
          <label>
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />I explicitly
            confirm this provider/model and token-bounded run.
          </label>
          <button type="submit" disabled={!canWrite || busy || !confirmed || !credentialId}>
            Start bounded Envoy
          </button>
        </form>
        <details>
          <summary>Telegram run preferences</summary>
          <p>
            Select the saved connection and model above, then choose the maximum allowance for bot previews. Saving
            these settings starts no inference. Every objective still needs its own confirmation in your linked private
            chat.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const connection = connections.find((c) => c.id === credentialId);
              if (!connection) return;
              const fields = Object.fromEntries(new FormData(e.currentTarget));
              setBusy(true);
              setError("");
              try {
                await request("/v1/telegram/run-settings", "POST", {
                  credentialId,
                  provider: connection.provider,
                  model,
                  maxCalls: Number(fields.calls),
                  maxTokens: Number(fields.tokens),
                  maxMessages: Number(fields.messages),
                  maxConversations: Number(fields.conversations),
                });
                setError("Telegram settings saved. No model call started.");
              } catch (error) {
                setError(String(error));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Maximum model calls
              <input name="calls" type="number" min="1" max="20" defaultValue="3" required />
            </label>
            <label>
              Maximum tokens
              <input name="tokens" type="number" min="1" max="40000" defaultValue="16000" required />
            </label>
            <label>
              Maximum outgoing messages
              <input name="messages" type="number" min="1" max="24" defaultValue="4" required />
            </label>
            <label>
              Maximum conversations
              <input name="conversations" type="number" min="1" max="12" defaultValue="2" required />
            </label>
            <button type="submit" disabled={busy || !canWrite || !credentialId || !model.trim()}>
              Save selected model for Telegram previews
            </button>
          </form>
        </details>
        {!connections.length && (
          <p>
            No saved model connection is available. Manual play and your existing external agent connection still work;
            no model call has started.
          </p>
        )}
        <button type="button" disabled={busy} onClick={() => void refresh()}>
          Refresh recorded activity
        </button>
        {runs.map((r) => (
          <article key={r.runId} className="game-card">
            <h4>{r.status === "waiting" ? "Waiting — no automatic inference" : r.status}</h4>
            <p>{r.objective}</p>
            <p>
              {r.provider} / {r.model} · until {r.deadlineAt} · {r.usedCalls}/{r.maxCalls} calls · {r.usedTokens}/
              {r.maxTokens} tokens
            </p>
            {r.lastErrorCode && <p>Failure: {r.lastErrorCode}</p>}
            {r.execution && (
              <p>
                Execution: {r.execution.state.replaceAll("_", " ")} · checked {r.execution.checkedAt}. Model host
                activity is unverified.
              </p>
            )}
            <button type="button" disabled={busy} onClick={() => void readReport(r.runId)}>
              Read recorded result
            </button>
            {["running", "waiting"].includes(r.status) && (
              <button type="button" disabled={!canWrite || busy} onClick={() => void control(r, "stop")}>
                Stop new actions
              </button>
            )}
            {r.status === "running" && (
              <button type="button" disabled={!canWrite || busy} onClick={() => void control(r, "wait")}>
                Wait without inference
              </button>
            )}
            {r.status === "waiting" && (
              <button type="button" disabled={!canWrite || busy} onClick={() => void control(r, "resume")}>
                Explicitly resume within original limits
              </button>
            )}
          </article>
        ))}
        {report && <RunResult report={report} ambition={ambition} />}
      </details>
    </section>
  );
}
