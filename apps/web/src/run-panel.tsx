import { useCallback, useEffect, useRef, useState } from "react";

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
};
type Entry = {
  id: string;
  category: string;
  callId: string;
  code: string;
  commandId?: string;
  approvalId?: string;
  records: { record: string; version: number }[];
  nextStep: string;
};
type Report = {
  timestamps?: Record<string, string>;
  label: string;
  status: string;
  entries: Entry[];
  assessments: { id: string; label: string; text: string }[];
  nextStep: string;
  truncated: boolean;
};
export function RunResult({ report }: { report: Report }) {
  return (
    <article className="game-card">
      <h3>{report.label}</h3>
      <p>
        {report.status} · {report.nextStep}
      </p>
      {!report.entries.length && <p>No recorded gameplay action in this report. Connection alone is not play.</p>}
      {report.entries.map((e) => (
        <div key={e.id}>
          <h4>
            {e.category.replaceAll("_", " ")} · {e.code}
          </h4>
          <p>{e.nextStep}</p>
          {report.timestamps?.[e.id] && (
            <p>
              <time dateTime={report.timestamps[e.id]}>{report.timestamps[e.id]}</time>
            </p>
          )}
          {e.commandId && (
            <p>
              <a href={`${import.meta.env.BASE_URL}v1/receipts/${e.commandId}`} target="_blank" rel="noreferrer">
                Read receipt <code>{e.commandId}</code>
              </a>
            </p>
          )}
          {e.approvalId && <a href={`/pact/?approval=${e.approvalId}`}>Human: review exact approval</a>}
          <ul>
            {e.records.map((r) => (
              <li key={r.record}>
                {r.record} · version {r.version}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {report.assessments.map((a) => (
        <div key={a.id}>
          <h4>{a.label}</h4>
          <p style={{ whiteSpace: "pre-wrap" }}>{a.text}</p>
        </div>
      ))}
      {report.truncated && <p>Report bounded to the latest 50 results; inspect receipts for older details.</p>}
    </article>
  );
}
export function RunPanel({
  request,
  contacts,
  canWrite = true,
}: {
  request: Request;
  contacts: { kingdomId: string; handle: string }[];
  canWrite?: boolean;
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
        setExternal(null);
        setExternalError("External-agent activity is unavailable; no success or absence is inferred.");
      }
    }
  }, [request]);
  useEffect(() => {
    void refresh();
    return () => {
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
          Maximum 15 minutes, 20 model calls, 40,000 reported tokens, 12 outgoing messages. Provider price unavailable;
          this is not a currency guarantee or free-model claim.
        </p>
        <label>
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />I explicitly
          confirm this provider/model and token-bounded run.
        </label>
        <button type="submit" disabled={!canWrite || busy || !confirmed || !credentialId}>
          Start bounded Envoy
        </button>
      </form>
      {!connections.length && (
        <p>
          No saved model connection is available. Manual play and your existing external agent connection still work; no
          model call has started.
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
      {report && <RunResult report={report} />}
      <h3>External-agent recorded activity</h3>
      <p>
        Receipt-backed actions from your external chats. No hidden reasoning or chatbot token usage is collected.
        Refresh to inspect new moves; reading never starts inference.
      </p>
      {externalError && <p role="status">{externalError}</p>}
      {external && <RunResult report={external} />}
    </section>
  );
}
