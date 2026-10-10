import { type EnrollmentCommand, EnrollmentCommandSchema } from "@pact/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { startVisiblePolling } from "./visible-polling.js";

type Request = (path: string, method?: string, body?: unknown) => Promise<Record<string, unknown>>;
type Cursor = { beforeAt: string; beforeId: string };
type Enrollment = {
  id: string;
  version: number;
  configuredStatus: string;
  state: string;
  settings: Extract<EnrollmentCommand, { kind: "enroll" }>;
  deadlineAt: string;
  nextEligibleAt: string;
  remainingCalls: number;
  remainingTokenCapacity: number;
  allocatedCalls: number;
  allocatedTokenCapacity: string;
  pendingWork: boolean;
  lastSuccessfulTurnAt: string | null;
  activeRun: null | { runId: string; status: string; usedCalls: number; usedTokens: number };
};
type Status = {
  enrollments: Enrollment[];
  next: Cursor | null;
  host: {
    available: boolean;
    heartbeatFresh: boolean;
    executionEnabled: boolean;
    lastHeartbeatAt: string | null;
    nextAvailableAt: string | null;
  };
};
const states: Record<string, string> = {
  stopped: "Stopped by you",
  deadline_passed: "Deadline passed",
  needs_owner: "Your decision is needed",
  running_now: "A bounded turn is running",
  host_unavailable: "Execution host unavailable",
  budget_exhausted: "Lifetime budget allocated",
  cooling: "Cooling until the next eligible turn",
  waiting_for_event: "Waiting for a new event",
  queued: "Work queued",
};
function berlin(value: string | null) {
  return value
    ? new Date(value).toLocaleString("en-GB", { timeZone: "Europe/Berlin", timeZoneName: "short" })
    : "None recorded";
}
export function PersistentPlay({
  request,
  ownerId,
  canWrite,
}: {
  request: Request;
  ownerId: string;
  canWrite: boolean;
}) {
  const storageKey = `pact_enrollment_pending:${ownerId}`;
  const [open, setOpen] = useState(false),
    [status, setStatus] = useState<Status | null>(null),
    [notice, setNotice] = useState(""),
    [stale, setStale] = useState(false),
    [busy, setBusy] = useState(false),
    [connections, setConnections] = useState<{ id: string; provider: string; label: string; status: string }[]>([]),
    [credentialId, setCredentialId] = useState(""),
    [model, setModel] = useState(""),
    [objective, setObjective] = useState(""),
    [deadline, setDeadline] = useState(() => new Date(Date.now() + 7200000).toISOString().slice(0, 16)),
    [mode, setMode] = useState<"events" | "periodic">("events"),
    [interval, setInterval] = useState(1),
    [calls, setCalls] = useState(10),
    [tokens, setTokens] = useState(200000),
    [sliceCalls, setSliceCalls] = useState(2),
    [sliceTokens, setSliceTokens] = useState(20000),
    [confirmedTerms, setConfirmed] = useState(""),
    [pending, setPending] = useState<EnrollmentCommand | null>(() => {
      try {
        const p = EnrollmentCommandSchema.safeParse(JSON.parse(sessionStorage.getItem(storageKey) ?? "null"));
        return p.success ? p.data : null;
      } catch {
        return null;
      }
    });
  const generation = useRef(0),
    refreshing = useRef(false);
  const loadConnections = useCallback(async () => {
    try {
      const result = await request("/v1/model-connections");
      setConnections(result.connections as typeof connections);
      setNotice((previous) => (previous.startsWith("Model connections could not") ? "" : previous));
    } catch {
      setNotice("Model connections could not be loaded. Reconnect and refresh.");
    }
  }, [request]);
  const refresh = useCallback(
    async (cursor?: Cursor) => {
      if (refreshing.current) return;
      refreshing.current = true;
      const g = ++generation.current;
      try {
        const result = (await request(
          `/v1/runs/enrollment${cursor ? `?${new URLSearchParams(cursor)}` : ""}`,
        )) as unknown as Status;
        if (g === generation.current) {
          setStatus((old) =>
            cursor && old
              ? {
                  ...result,
                  enrollments: [
                    ...old.enrollments,
                    ...result.enrollments.filter((x) => !old.enrollments.some((e) => e.id === x.id)),
                  ],
                }
              : result,
          );
          setStale(false);
        }
      } catch {
        if (g === generation.current) setStale(true);
      } finally {
        refreshing.current = false;
      }
    },
    [request],
  );
  useEffect(() => {
    if (!open) return;
    const stop = startVisiblePolling(() => refresh(), document);
    void loadConnections();
    return () => {
      stop();
      generation.current++;
    };
  }, [open, refresh, loadConnections]);
  const consentTerms = JSON.stringify({
    credentialId,
    model,
    objective,
    deadline,
    mode,
    interval,
    calls,
    tokens,
    sliceCalls,
    sliceTokens,
  });
  const confirmed = canWrite && confirmedTerms === consentTerms;
  async function send(command: EnrollmentCommand) {
    if (!canWrite || busy) return;
    setBusy(true);
    setNotice("");
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(command));
      setPending(command);
      await request("/v1/runs/enrollment", "POST", command);
      sessionStorage.removeItem(storageKey);
      setPending(null);
      setConfirmed("");
      setNotice(
        command.kind === "enroll"
          ? "Your enrollment was saved. Check the actual host and work state below."
          : "Enrollment stopped. Already committed game actions retain their consequences.",
      );
      await refresh();
    } catch (error) {
      const reason = String(error);
      if (
        /STALE_VERSION|OPERATION_CONFLICT|ALREADY_ENROLLED|INVALID_DEADLINE|ROUTE_UNAVAILABLE|INVALID_INPUT/.test(
          reason,
        )
      ) {
        sessionStorage.removeItem(storageKey);
        setPending(null);
        setConfirmed("");
        setNotice(`The server declined this request: ${reason}. Refresh before making a new decision.`);
        await refresh();
      } else
        setNotice(
          "The result is uncertain. Reconnect, then retry the original request below; its identity and terms are preserved.",
        );
    } finally {
      setBusy(false);
    }
  }
  const active = status?.enrollments.some((e) => ["active", "needs_owner"].includes(e.configuredStatus));
  return (
    <details className="game-card persistent-play" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>Persistent play — consent, budget and host status</summary>
      <p>
        Let your Envoy return under a fixed deadline and lifetime compute budget. Each turn remains bounded and uses the
        same kingdom write lease and mandate.
      </p>
      <button
        type="button"
        onClick={() => {
          void refresh();
          void loadConnections();
        }}
        disabled={busy}
      >
        Reconnect and refresh status
      </button>
      {stale && (
        <p role="alert">
          Status is stale or unavailable. Reconnect before deciding; no running or stopped state is inferred.
        </p>
      )}
      {!status && !stale && <p role="status">Loading execution status…</p>}
      {status && (
        <section aria-label="Execution host status">
          <h3>PACT API host</h3>
          {stale && <p>Last known host information; reconnect for current evidence.</p>}
          <p>
            {!status.host.heartbeatFresh
              ? "No recent worker heartbeat. The server may be offline or disconnected."
              : !status.host.executionEnabled
                ? "Worker heartbeat is current; model execution is disabled on this host."
                : "Worker heartbeat is current; model execution is enabled."}
          </p>
          <p>
            Heartbeat: {berlin(status.host.lastHeartbeatAt)}. Earliest shared admission:{" "}
            {berlin(status.host.nextAvailableAt)}.
          </p>
          <p>
            Local Windows/WSL, Codex and ChatGPT hosts need their separate enrollment adapters and acceptance. This page
            cannot reconnect them or confirm that they are running.
          </p>
        </section>
      )}
      {notice && <p role="status">{notice}</p>}
      {pending && (
        <section aria-label="Uncertain enrollment request">
          <h3>Original request preserved</h3>
          <p>
            {pending.kind === "enroll"
              ? `Enroll until ${berlin(pending.deadlineAt)}; ${pending.totalCallBudget} calls and ${pending.totalTokenBudget.toLocaleString()} token capacity.`
              : "Stop the original enrollment."}{" "}
            Do not create a replacement while its result is uncertain.
          </p>
          <button type="button" disabled={busy || !canWrite} onClick={() => void send(pending)}>
            Retry original enrollment request
          </button>
        </section>
      )}
      {!pending && status && !active && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const connection = connections.find((c) => c.id === credentialId);
            if (!connection || !confirmed || !canWrite || stale) return;
            const command = EnrollmentCommandSchema.safeParse({
              schemaVersion: "pact.enrollment.v2",
              commandId: crypto.randomUUID(),
              enrollmentId: crypto.randomUUID(),
              expectedVersion: 0,
              kind: "enroll",
              route: "api",
              objective: objective.trim(),
              provider: connection.provider,
              model: model.trim(),
              credentialId,
              deadlineAt: `${deadline}:00Z`,
              mode,
              minIntervalMs: interval * 3600000,
              totalCallBudget: calls,
              totalTokenBudget: tokens,
              sliceCalls,
              sliceTokens,
              sliceDurationMs: 300000,
              maxMessages: 12,
              maxConversations: 6,
            });
            if (!command.success) {
              setNotice(
                "Check the objective, model, UTC deadline and budgets. At least one complete turn must fit the lifetime budget.",
              );
              return;
            }
            void send(command.data);
          }}
        >
          <h3>New owner consent</h3>
          <label>
            Objective
            <textarea
              maxLength={4000}
              required
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              disabled={busy}
            />
          </label>
          <label>
            Stored model connection
            <select required value={credentialId} onChange={(e) => setCredentialId(e.target.value)} disabled={busy}>
              <option value="">Choose a connection</option>
              {connections
                .filter((c) => c.status === "active")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label} · {c.provider}
                  </option>
                ))}
            </select>
          </label>
          {!connections.some((c) => c.status === "active") && (
            <p>Add an API model connection in Envoy first. No credential is copied into the model prompt.</p>
          )}
          <label>
            Exact model ID
            <input maxLength={160} required value={model} onChange={(e) => setModel(e.target.value)} disabled={busy} />
          </label>
          <label>
            Fixed deadline in UTC
            <input
              type="datetime-local"
              required
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              disabled={busy}
            />
          </label>
          <p>
            Berlin display:{" "}
            {deadline && !Number.isNaN(new Date(`${deadline}:00Z`).getTime())
              ? berlin(`${deadline}:00Z`)
              : "Choose a valid UTC time"}
            . UTC avoids ambiguous daylight-saving hours. Maximum 30 days; no automatic renewal.
          </p>
          <label>
            Return when
            <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} disabled={busy}>
              <option value="events">New durable inbox work arrives</option>
              <option value="periodic">The next interval arrives</option>
            </select>
          </label>
          <label>
            Minimum hours between your turns
            <input
              type="number"
              min={1}
              max={24}
              required
              value={interval}
              onChange={(e) => setInterval(Number(e.target.value))}
              disabled={busy}
            />
          </label>
          <fieldset disabled={busy}>
            <legend>Lifetime compute allocation</legend>
            <label>
              Total call ceiling
              <input
                type="number"
                min={1}
                max={1000}
                required
                value={calls}
                onChange={(e) => setCalls(Number(e.target.value))}
              />
            </label>
            <label>
              Total token capacity
              <input
                type="number"
                min={1}
                max={40000000}
                required
                value={tokens}
                onChange={(e) => setTokens(Number(e.target.value))}
              />
            </label>
            <label>
              Calls reserved per turn
              <input
                type="number"
                min={1}
                max={20}
                required
                value={sliceCalls}
                onChange={(e) => setSliceCalls(Number(e.target.value))}
              />
            </label>
            <label>
              Token capacity reserved per turn
              <input
                type="number"
                min={1}
                max={40000}
                required
                value={sliceTokens}
                onChange={(e) => setSliceTokens(Number(e.target.value))}
              />
            </label>
          </fieldset>
          <p>
            Each turn reserves its full caps even if it uses less: {sliceCalls} calls, {sliceTokens.toLocaleString()}{" "}
            token capacity, at most five minutes, six conversations and 12 outgoing messages. This is an allocation
            ceiling; provider billing can differ. Failed or waiting turns require your decision. Incoming text cannot
            enlarge consent.
          </p>
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked ? consentTerms : "")}
              disabled={busy || !canWrite || stale}
            />
            I authorize this exact objective, deadline and lifetime budget for the selected API connection. The worker
            can perform bounded turns while my browser is closed.
          </label>
          <button type="submit" disabled={busy || !canWrite || stale || !confirmed || !credentialId}>
            Enroll persistent play
          </button>
        </form>
      )}
      {status?.enrollments.map((e) => (
        <article key={e.id} aria-label="Persistent enrollment">
          <h3>
            {stale ? "Last known: " : ""}
            {states[e.state] ?? e.state}
          </h3>
          <p style={{ whiteSpace: "pre-wrap" }}>{e.settings.objective}</p>
          <p>
            {e.settings.provider} · {e.settings.model} · {e.settings.mode === "events" ? "Event-driven" : "Periodic"}
          </p>
          <p>
            Fixed deadline: {berlin(e.deadlineAt)}. Next owner eligibility: {berlin(e.nextEligibleAt)}. Pending durable
            work: {e.pendingWork ? "Yes" : "No"}.
          </p>
          <p>
            Remaining allocation: {e.remainingCalls} calls and {e.remainingTokenCapacity.toLocaleString()} token
            capacity. Reserved so far: {e.allocatedCalls} calls / {Number(e.allocatedTokenCapacity).toLocaleString()}{" "}
            token capacity.
          </p>
          <p>
            Last completed model turn: {berlin(e.lastSuccessfulTurnAt)}. This timestamp does not measure decision
            quality.
          </p>
          {e.activeRun && (
            <p>
              Latest linked turn: {e.activeRun.status}; recorded usage {e.activeRun.usedCalls} calls /{" "}
              {e.activeRun.usedTokens} tokens.
            </p>
          )}
          {e.state === "needs_owner" && (
            <p>
              Review the bounded run and its exact approval or failure below. Resume preserves that run’s original
              allowance. Stop this enrollment before granting new consent.
            </p>
          )}
          {["active", "needs_owner"].includes(e.configuredStatus) && (
            <button
              type="button"
              disabled={busy || !canWrite || stale || Boolean(pending)}
              onClick={() =>
                void send({
                  schemaVersion: "pact.enrollment.v2",
                  commandId: crypto.randomUUID(),
                  enrollmentId: e.id,
                  kind: "revoke",
                  expectedVersion: e.version,
                })
              }
            >
              Stop this enrollment
            </button>
          )}
        </article>
      ))}
      {status?.next && (
        <button
          type="button"
          disabled={busy || stale}
          onClick={() => {
            if (status.next) void refresh(status.next);
          }}
        >
          Load earlier enrollments
        </button>
      )}
    </details>
  );
}
