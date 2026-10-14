import type { AdminKingdomPage, AdminOverview } from "@pact/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { pactBaseUrl } from "./client-location.js";
import { ModerationPanel } from "./moderation-panel.js";
import "./admin-dashboard.css";

const sections = ["Overview", "Players", "Economy", "Society", "Agents", "Activity", "Management"] as const;
type Section = (typeof sections)[number];
function date(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : "Unavailable";
}
function number(value: number | string) {
  return typeof value === "number" ? value.toLocaleString() : value;
}
function Metric({ label, value, detail }: { label: string; value: number | string; detail?: string }) {
  return (
    <article className="admin-metric">
      <span>{label}</span>
      <strong>{number(value)}</strong>
      {detail && <small>{detail}</small>}
    </article>
  );
}
export function ActivityChart({ view }: { view: AdminOverview }) {
  const start = Math.floor(Date.parse(view.since) / 3600000) * 3600000;
  const counts = new Map(view.platform.trend.map((x) => [Date.parse(x.hour), x.count]));
  const bins = Array.from({ length: view.hours + 1 }, (_, i) => ({
    hour: start + i * 3600000,
    count: counts.get(start + i * 3600000) ?? 0,
  }));
  const maximum = Math.max(1, ...bins.map((x) => x.count));
  return (
    <section className="admin-panel">
      <div className="admin-panel-title">
        <h2>Command activity</h2>
        <span>Last {view.hours} hours · real time</span>
      </div>
      <p>Recorded command outcomes, including rejected requests. Current and first hours may be partial.</p>
      <div
        className="admin-chart"
        role="img"
        aria-label={`${bins.reduce((s, x) => s + x.count, 0)} recorded commands over ${view.hours} hours`}
      >
        {bins.map((x) => (
          <div
            key={x.hour}
            style={{ height: `${Math.max(2, (x.count / maximum) * 100)}%` }}
            title={`${new Date(x.hour).toLocaleString()}: ${x.count} commands`}
          >
            <span>{x.count}</span>
          </div>
        ))}
      </div>
      <div className="admin-chart-axis">
        <span>{date(view.since)}</span>
        <span>{date(view.generatedAt)}</span>
      </div>
      <details>
        <summary>View hourly counts</summary>
        <div className="admin-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Hour</th>
                <th>Commands</th>
              </tr>
            </thead>
            <tbody>
              {bins.map((x) => (
                <tr key={x.hour}>
                  <td>{date(new Date(x.hour).toISOString())}</td>
                  <td>{x.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
export function AdminOverviewContent({ view }: { view: AdminOverview }) {
  const overdue = !!view.world && Date.parse(view.world.nextTickDueAt) < Date.parse(view.generatedAt) - 120000;
  const issues = [
    ...(!view.world ? ["World clock is unavailable."] : []),
    ...(view.world?.status === "paused" ? ["The game clock is paused."] : []),
    ...(overdue ? ["The next game tick is over two minutes overdue."] : []),
    ...(view.platform.jobs.failed ? [`${view.platform.jobs.failed} durable jobs failed.`] : []),
    ...(view.platform.jobs.overdue
      ? [`${view.platform.jobs.overdue} durable jobs are over five minutes overdue.`]
      : []),
    ...(view.game.moderation.overdue ? [`${view.game.moderation.overdue} moderation cases need overdue review.`] : []),
    ...(view.game.society.collectionFailures
      ? [`${view.game.society.collectionFailures} collection events failed projection.`]
      : []),
  ];
  return (
    <>
      <div className="admin-metrics">
        <Metric label="Active kingdoms" value={view.game.society.kingdoms ?? 0} detail="Current ranked population" />
        <Metric
          label="Players observed"
          value={view.identity.active}
          detail={`Human sessions used in ${view.hours}h`}
        />
        <Metric label="New players" value={view.identity.joined} detail={`Accounts created in ${view.hours}h`} />
        <Metric
          label="Active agreements"
          value={view.game.society.contracts ?? 0}
          detail="Supply contracts delivering"
        />
      </div>
      <section className={`admin-attention ${issues.length ? "has-issues" : ""}`}>
        <h2>{issues.length ? "Needs attention" : "No queue alerts detected"}</h2>
        {issues.length ? (
          <ul>
            {issues.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        ) : (
          <p>Clock and queue checks passed at the last refresh.</p>
        )}
      </section>
      <ActivityChart view={view} />
      <div className="admin-columns">
        <section className="admin-panel">
          <h2>World clock</h2>
          <dl>
            <dt>Status</dt>
            <dd>{view.world?.status ?? "Unavailable"}</dd>
            <dt>Committed tick</dt>
            <dd>{view.world?.tick ?? "—"}</dd>
            <dt>Game time</dt>
            <dd>{view.world ? date(new Date(Number(view.world.gameTimeMs)).toISOString()) : "—"}</dd>
            <dt>Heartbeat</dt>
            <dd>{date(view.world?.heartbeatAt)}</dd>
            <dt>Next tick due</dt>
            <dd>{date(view.world?.nextTickDueAt)}</dd>
            <dt>Rules</dt>
            <dd>{view.world?.rulesId ?? "—"}</dd>
          </dl>
        </section>
        <section className="admin-panel">
          <h2>Operational queues</h2>
          <dl>
            <dt>Due jobs</dt>
            <dd>{view.platform.jobs.due}</dd>
            <dt>Failed jobs</dt>
            <dd>{view.platform.jobs.failed}</dd>
            <dt>Open moderation cases</dt>
            <dd>{view.game.moderation.open}</dd>
            <dt>Collection backlog</dt>
            <dd>{view.game.collection.pending}</dd>
            <dt>Accounts closing</dt>
            <dd>{view.identity.closing}</dd>
            <dt>Administrators</dt>
            <dd>{view.identity.administrators}</dd>
          </dl>
        </section>
      </div>
    </>
  );
}

export function AdminDashboard() {
  const [section, setSection] = useState<Section>("Overview"),
    [hours, setHours] = useState(24),
    [view, setView] = useState<AdminOverview | null>(null),
    [page, setPage] = useState<AdminKingdomPage | null>(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [poll, setPoll] = useState(true),
    [search, setSearch] = useState(""),
    [offset, setOffset] = useState(0),
    [authorized, setAuthorized] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false),
    [setupCode, setSetupCode] = useState(""),
    [notice, setNotice] = useState("");
  const csrf = useRef(""),
    sequence = useRef(0),
    active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      sequence.current++;
    };
  }, []);
  const request = useCallback(
    async (path: string, method = "GET", body?: unknown): Promise<Record<string, unknown>> => {
      const response = await fetch(`${pactBaseUrl()}${path.replace(/^\//, "")}`, {
        method,
        credentials: "include",
        cache: "no-store",
        headers: {
          "content-type": "application/json",
          ...(method !== "GET" && csrf.current ? { "x-csrf-token": csrf.current } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 403 && !path.includes("/setup/")) {
          sequence.current++;
          setAuthorized(false);
          setView(null);
          setPage(null);
        }
        throw new Error(
          response.status === 403
            ? "Administrator username and password sign-in is required."
            : response.status === 429
              ? "Too many attempts. Try again later."
              : `Request failed (${result.error?.code ?? response.status}).`,
        );
      }
      return result;
    },
    [],
  );
  const refresh = useCallback(async () => {
    const id = ++sequence.current;
    setBusy(true);
    setError("");
    try {
      const snapshot = (await request(`/v1/admin/overview?hours=${hours}`)) as unknown as AdminOverview;
      if (!active.current || id !== sequence.current) return;
      setView(snapshot);
      setAuthorized(true);
      if (!csrf.current) {
        const session = await request("/v1/auth/session");
        if (active.current && id === sequence.current) csrf.current = String(session.csrfToken);
      }
    } catch (e) {
      if (active.current) setError(e instanceof Error ? e.message : "Refresh failed.");
    } finally {
      if (active.current) setBusy(false);
    }
  }, [hours, request]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!poll || !authorized) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && !busy) void refresh();
    }, 30000);
    return () => clearInterval(timer);
  }, [poll, authorized, busy, refresh]);
  useEffect(() => {
    if (section !== "Players" || !authorized || !view?.generatedAt) return;
    let current = true;
    setPage(null);
    const timer = setTimeout(() => {
      void request(`/v1/admin/kingdoms?search=${encodeURIComponent(search)}&offset=${offset}`)
        .then((r) => {
          if (current) setPage(r as unknown as AdminKingdomPage);
        })
        .catch((e) => {
          if (current) setError(String(e.message));
        });
    }, 200);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [section, authorized, search, offset, request, view?.generatedAt]);
  async function submit(operation: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }
  const title: Record<Section, string> = {
    Overview: "The world at a glance",
    Players: "Player population",
    Economy: "Resources & production",
    Society: "Diplomacy & conflict",
    Agents: "Agent execution",
    Activity: "Activity & outcomes",
    Management: "Reports & management",
  };
  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <a className="admin-brand" href={`${pactBaseUrl()}admin`}>
          P<span>A</span>CT<small>ADMINISTRATION</small>
        </a>
        <div className="admin-sidebar-label">OPERATIONS</div>
        <nav aria-label="Administration">
          {sections.map((s, i) => (
            <button
              type="button"
              key={s}
              aria-current={section === s ? "page" : undefined}
              onClick={() => setSection(s)}
            >
              <span>0{i + 1}</span>
              {s}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <p>
            One world.
            <br />A complete view.
          </p>
          <a href={pactBaseUrl()}>Open PACT ↗</a>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <span>WORLD OPERATIONS / {section.toUpperCase()}</span>
          <div>
            <span className={`admin-dot ${view?.world?.status === "active" ? "is-active" : ""}`} />
            {view?.world?.status ?? "Sign in"}
          </div>
        </header>
        <div className="admin-heading">
          <div>
            <div className="admin-eyebrow">PACT CONTROL ROOM</div>
            <h1>{title[section]}</h1>
            <p>Observe the game. Understand the activity. Manage what needs attention.</p>
          </div>
          {authorized && (
            <button
              type="button"
              className="admin-secondary"
              disabled={busy}
              onClick={() =>
                void submit(async () => {
                  await request("/v1/auth/logout", "POST", {});
                  sequence.current++;
                  setAuthorized(false);
                  setView(null);
                  setPage(null);
                  csrf.current = "";
                })
              }
            >
              Sign out
            </button>
          )}
        </div>
        {error && (
          <p className="admin-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="admin-notice" role="status">
            {notice}
          </p>
        )}
        {!authorized ? (
          <section className="admin-panel admin-login">
            <div className="admin-eyebrow">ADMINISTRATOR ACCESS</div>
            <h2>Sign in to the control room</h2>
            <p>Use your administrator username and password. No player account or kingdom is required.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fields = Object.fromEntries(new FormData(e.currentTarget));
                void submit(async () => {
                  const r = await request("/v1/admin/login", "POST", fields);
                  csrf.current = String(r.csrfToken);
                  await refresh();
                });
              }}
            >
              <label>
                Username
                <input name="username" required autoComplete="username" defaultValue="admin" />
              </label>
              <label>
                Password
                <input name="password" type="password" required autoComplete="current-password" />
              </label>
              <button type="submit" disabled={busy}>
                Sign in
              </button>
            </form>
            <button type="button" className="admin-text-button" onClick={() => setSetupOpen(!setupOpen)}>
              Set up the first administrator
            </button>
            {setupOpen && (
              <div className="admin-setup">
                <h3>First administrator setup</h3>
                <p>The private setup code is issued by the server operator and works once.</p>
                <label>
                  Setup code
                  <input
                    type="password"
                    autoComplete="off"
                    value={setupCode}
                    onChange={(e) => setSetupCode(e.target.value)}
                  />
                </label>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fields = Object.fromEntries(new FormData(e.currentTarget));
                    void submit(async () => {
                      const r = await request("/v1/admin/setup/complete", "POST", { ...fields, setupCode });
                      setSetupCode("");
                      setSetupOpen(false);
                      setNotice(`Administrator ${r.username} created. Sign in with your username and password.`);
                    });
                  }}
                >
                  <label>
                    Administrator username
                    <input
                      name="username"
                      pattern="[a-z][a-z0-9_-]{2,31}"
                      defaultValue="admin"
                      required
                      autoComplete="username"
                    />
                  </label>
                  <label>
                    New password · 15–128 characters
                    <input
                      name="password"
                      type="password"
                      minLength={15}
                      maxLength={128}
                      required
                      autoComplete="new-password"
                    />
                  </label>
                  <button type="submit" disabled={busy}>
                    Create administrator
                  </button>
                </form>
              </div>
            )}
          </section>
        ) : (
          view && (
            <>
              <div className="admin-toolbar">
                <label>
                  Reporting window
                  <select value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                    <option value={24}>24 hours</option>
                    <option value={72}>3 days</option>
                    <option value={168}>7 days</option>
                  </select>
                </label>
                <label className="admin-checkbox">
                  <input type="checkbox" checked={poll} onChange={(e) => setPoll(e.target.checked)} />
                  Refresh every 30s
                </label>
                <button type="button" disabled={busy} onClick={() => void refresh()}>
                  {busy ? "Refreshing…" : "Refresh"}
                </button>
                <span>Snapshot {date(view.generatedAt)}</span>
                <button
                  type="button"
                  className="admin-secondary"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(view, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `pact-overview-${view.generatedAt.slice(0, 10)}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Export snapshot
                </button>
              </div>
              {section === "Overview" && <AdminOverviewContent view={view} />}
              {section === "Players" && (
                <section className="admin-panel">
                  <h2>Kingdom directory</h2>
                  <p>
                    Public identity and activity metadata. Administrator accounts are separate from this population.
                  </p>
                  <label>
                    Search name or handle
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setOffset(0);
                      }}
                      placeholder="Find a player…"
                    />
                  </label>
                  <div className="admin-table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Player</th>
                          <th>Status</th>
                          <th>Hall</th>
                          <th>Founded</th>
                          <th>Last action · game time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {page?.players.map((p) => (
                          <tr key={p.id}>
                            <td>
                              <strong>{p.name}</strong>
                              <small>@{p.handle}</small>
                            </td>
                            <td>{p.status}</td>
                            <td>{p.hall ?? "—"}</td>
                            <td>{date(p.joinedAt)}</td>
                            <td>
                              {p.lastActionGameTimeMs
                                ? date(new Date(Number(p.lastActionGameTimeMs)).toISOString())
                                : "No recorded action"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!page ? (
                    <p>Loading players…</p>
                  ) : (
                    <>
                      <p>
                        {page.total
                          ? `${offset + 1}–${Math.min(offset + page.pageSize, page.total)} of ${page.total} kingdoms`
                          : "No matching kingdoms."}
                      </p>
                      <div className="admin-page-controls">
                        <button
                          type="button"
                          disabled={offset === 0}
                          onClick={() => setOffset(Math.max(0, offset - 25))}
                        >
                          Previous
                        </button>
                        <button
                          type="button"
                          disabled={offset + 25 >= page.total}
                          onClick={() => setOffset(offset + 25)}
                        >
                          Next
                        </button>
                      </div>
                    </>
                  )}
                </section>
              )}
              {section === "Economy" && (
                <>
                  <section className="admin-panel">
                    <h2>World resource ledger</h2>
                    <p>
                      Current aggregate stock and base production per game minute. Fractional values retain exact 1/600
                      units; season and upkeep affect realized production.
                    </p>
                    <div className="admin-table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Resource</th>
                            <th>Ordinary stock</th>
                            <th>Founding allowance</th>
                            <th>Locked stock</th>
                            <th>Base / minute</th>
                            <th>Stores at cap</th>
                          </tr>
                        </thead>
                        <tbody>
                          {view.economy.map((r) => (
                            <tr key={r.resource}>
                              <th>{r.resource}</th>
                              <td>{r.ordinary}</td>
                              <td>{r.allowance}</td>
                              <td>{r.locked}</td>
                              <td>{r.production}</td>
                              <td>{r.atCapacity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!view.economy.length && <p>No resource balances yet.</p>}
                  </section>
                  <div className="admin-metrics">
                    <Metric label="Construction queued / active" value={view.game.society.construction ?? 0} />
                    <Metric label="Active training" value={view.game.society.training ?? 0} />
                    <Metric label="Active supply contracts" value={view.game.society.contracts ?? 0} />
                    <Metric label="Retained defaults" value={view.game.society.defaults ?? 0} />
                  </div>
                </>
              )}
              {section === "Society" && (
                <>
                  <div className="admin-metrics">
                    {[
                      ["Accepted contacts", "contacts"],
                      ["Pending introductions", "pendingContacts"],
                      ["Retained messages", "messages"],
                      ["Open supply offers", "offers"],
                      ["Active agreements", "contracts"],
                      ["Active Courts", "courts"],
                      ["Active raids", "raids"],
                      ["Active scouts", "scouts"],
                    ].map(([label, key]) => (
                      <Metric key={key} label={label ?? ""} value={view.game.society[key ?? ""] ?? 0} />
                    ))}
                  </div>
                  <section className="admin-panel">
                    <h2>Reading the society</h2>
                    <p>
                      These are current states and retained totals. Expired introductions and offers are excluded from
                      open counts. Message contents, negotiations and private memories retain their existing access
                      controls.
                    </p>
                    <p>
                      Use Activity to inspect event types and command outcomes, and Management to review reported
                      content.
                    </p>
                  </section>
                </>
              )}
              {section === "Agents" && (
                <>
                  <div className="admin-metrics">
                    <Metric
                      label="Reported model calls"
                      value={view.agents.usage.calls}
                      detail={`PACT runs created in ${hours}h`}
                    />
                    <Metric
                      label="Reported tokens"
                      value={view.agents.usage.tokens}
                      detail="Reported by the run ledger"
                    />
                    <Metric
                      label="External observations"
                      value={view.agents.external.observations}
                      detail={`${view.agents.external.accounts} accounts observed`}
                    />
                    <Metric
                      label="Failed runs"
                      value={view.agents.usage.failed}
                      detail={`PACT runs created in ${hours}h`}
                    />
                  </div>
                  <div className="admin-columns">
                    <section className="admin-panel">
                      <h2>Retained PACT runs</h2>
                      <dl>
                        {view.agents.runs.map((r) => (
                          <div key={r.status}>
                            <dt>{r.status}</dt>
                            <dd>{r.count}</dd>
                          </div>
                        ))}
                      </dl>
                      {!view.agents.runs.length && <p>No retained runs.</p>}
                    </section>
                    <section className="admin-panel">
                      <h2>Unexpired write leases</h2>
                      <dl>
                        {view.agents.leases.map((r) => (
                          <div key={r.kind}>
                            <dt>{r.kind}</dt>
                            <dd>{r.count}</dd>
                          </div>
                        ))}
                      </dl>
                      {!view.agents.leases.length && <p>No active write leases.</p>}
                    </section>
                  </div>
                  <section className="admin-panel">
                    <h2>PACT execution hosts</h2>
                    {view.agents.hosts.map((h) => (
                      <p key={h.id}>
                        <strong>{h.id}</strong> · {h.available ? "Available" : "Execution unavailable"} · heartbeat{" "}
                        {date(h.heartbeatAt)}
                        {Date.parse(view.generatedAt) - Date.parse(h.heartbeatAt) > 120000 ? " · stale heartbeat" : ""}
                      </p>
                    ))}
                    {!view.agents.hosts.length && <p>No registered PACT hosts.</p>}
                    <p>
                      Fleet is an independent service. External observations show contact with PACT; they do not
                      establish ongoing inference or measure Fleet budgets. Existing run and enrollment controls remain
                      with their owners.
                    </p>
                  </section>
                </>
              )}
              {section === "Activity" && (
                <>
                  <ActivityChart view={view} />
                  <div className="admin-columns">
                    <section className="admin-panel">
                      <h2>Command outcomes · {hours}h</h2>
                      <dl>
                        {view.platform.receipts.map((r) => (
                          <div key={r.code}>
                            <dt>{r.code}</dt>
                            <dd>{r.count}</dd>
                          </div>
                        ))}
                      </dl>
                      {!view.platform.receipts.length && <p>No command receipts in this window.</p>}
                    </section>
                    <section className="admin-panel">
                      <h2>Security event counts · {hours}h</h2>
                      <dl>
                        {view.identity.security.map((r) => (
                          <div key={r.type}>
                            <dt>{r.type}</dt>
                            <dd>{r.count}</dd>
                          </div>
                        ))}
                      </dl>
                      {!view.identity.security.length && <p>No security events in this window.</p>}
                    </section>
                  </div>
                  <section className="admin-panel">
                    <h2>Latest retained events</h2>
                    <p>Latest 30 event types and timestamps. Payloads are private.</p>
                    <div className="admin-table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Sequence</th>
                            <th>Event</th>
                            <th>Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {view.platform.events.map((e) => (
                            <tr key={e.id}>
                              <td>{e.id}</td>
                              <td>{e.type}</td>
                              <td>{date(e.occurredAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              )}
              {section === "Management" && (
                <>
                  <section className="admin-panel">
                    <h2>Platform administration</h2>
                    <p>
                      Review the moderation queue, claim a report and apply an audited decision using the controls
                      below. Administrator access uses your username and password.
                    </p>
                    <p>
                      Game clock changes, backup restoration and deployment remain server operations. Administrator
                      access does not confer kingdom ownership or permit editing balances.
                    </p>
                  </section>
                  <ModerationPanel request={request} canWrite={!!csrf.current} />
                </>
              )}
            </>
          )
        )}
        <footer className="admin-footer">
          PACT administration{" "}
          <span>Snapshots show committed and retained data · Times use your browser’s timezone</span>
        </footer>
      </main>
    </div>
  );
}
