import type { PactClient, SandboxAction } from "@pact/client-sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import { startVisiblePolling } from "./visible-polling.js";
import "./conversation-workspace.css";

type Request = (path: string, method?: string, body?: unknown) => Promise<Record<string, unknown>>;
type Party = { kingdomId: string; handle: string; displayName: string; unreadCount?: number };
type Message = { id: string; senderKingdomId: string; body: string; authorKind: string; sentGameTimeMs: string };
type Offer = Party & {
  id: string;
  version: number;
  status: string;
  terms: Record<string, unknown>;
  signedBy: string[];
  expiresGameTimeMs: string;
  youSend?: Flow;
  youReceive?: Flow;
};
type Flow = { resource: string; wholePerHour: number } | null;
type Contract = Party & {
  id: string;
  status: string;
  terms: Record<string, unknown>;
  startGameTimeMs: string;
  endGameTimeMs: string;
  youSend?: Flow;
  youReceive?: Flow;
};
type Introduction = Party & { id: string; note: string; direction: string; expiresGameTimeMs: string };
export type ConversationData = {
  kingdomId: string;
  contacts: Party[];
  contactsNextOffset?: number | null;
  requests: Introduction[];
  messages: Message[];
  supplyOffers: Offer[];
  garrisonOffers: Offer[];
  supplyContracts: Contract[];
  garrisonContracts: Contract[];
  delegation?: { mode: string; allowedKingdomIds: string[]; version: number };
};
type ThreadPage = { messages: Message[]; next: { gameTimeMs: string; id: string } | null };
type Group = Party & {
  messages: Message[];
  introductions: Introduction[];
  offers: Offer[];
  contracts: Contract[];
  waitingYou: boolean;
  waitingPeer: boolean;
  active: number;
};
export function conversationGroups(data: ConversationData): Group[] {
  const groups = new Map<string, Group>();
  for (const p of [
    ...data.contacts,
    ...data.requests,
    ...data.supplyOffers,
    ...data.garrisonOffers,
    ...data.supplyContracts,
    ...data.garrisonContracts,
    ...data.messages.filter((m): m is Message & Party => "kingdomId" in m && "handle" in m && "displayName" in m),
  ]) {
    if (!groups.has(p.kingdomId))
      groups.set(p.kingdomId, {
        ...p,
        messages: [],
        introductions: [],
        offers: [],
        contracts: [],
        waitingYou: false,
        waitingPeer: false,
        active: 0,
      });
  }
  for (const g of groups.values()) {
    g.messages = data.messages
      .filter((m) => "kingdomId" in m && m.kingdomId === g.kingdomId)
      .sort((a, b) => Number(a.sentGameTimeMs) - Number(b.sentGameTimeMs) || a.id.localeCompare(b.id));
    g.introductions = data.requests.filter((r) => r.kingdomId === g.kingdomId);
    g.offers = [...data.supplyOffers, ...data.garrisonOffers].filter((o) => o.kingdomId === g.kingdomId);
    g.contracts = [...data.supplyContracts, ...data.garrisonContracts].filter((c) => c.kingdomId === g.kingdomId);
    g.waitingYou =
      g.introductions.some((r) => r.direction === "incoming") ||
      g.offers.some((o) => !o.signedBy.includes(data.kingdomId));
    g.waitingPeer =
      g.introductions.some((r) => r.direction === "outgoing") ||
      g.offers.some((o) => o.signedBy.includes(data.kingdomId) && !o.signedBy.includes(g.kingdomId));
    g.active = g.contracts.filter((c) => c.status === "active").length;
  }
  return [...groups.values()];
}
const time = (ms: string) => new Date(Number(ms)).toLocaleString();
const flow = (f: Flow | undefined) => (f ? `${f.wholePerHour} ${f.resource}/hour` : "Nothing");

export function AgreementTracks({
  group,
  ownerId,
  onAction,
}: {
  group: Group;
  ownerId: string;
  onAction?: (action: SandboxAction) => void;
}) {
  return (
    <>
      <h2>Agreement tracks</h2>
      <p className="cw-muted">
        Engine records · Messages and promises do not activate agreements. Both parties sign the same version.
      </p>
      {group.offers.map((o) => (
        <article className="cw-agreement" key={o.id}>
          <span className="cw-tag">
            Proposal · {o.signedBy.length} signature(s) · v{o.version}
          </span>
          <h3>{"youSend" in o ? "Supply" : "Garrison"} terms</h3>
          {"youSend" in o && (
            <p>
              You send {flow(o.youSend)}
              <br />
              You receive {flow(o.youReceive)}
            </p>
          )}
          <p>
            Your signature: {o.signedBy.includes(ownerId) ? "recorded" : "pending"}
            <br />
            Their signature: {o.signedBy.includes(group.kingdomId) ? "recorded" : "pending"}
          </p>
          <p>Expires {time(o.expiresGameTimeMs)}</p>
          <details>
            <summary>Exact current terms and record</summary>
            <pre>{JSON.stringify(o.terms, null, 2)}</pre>
            <code>
              {o.id} · version {o.version}
            </code>
          </details>
          {onAction && !o.signedBy.includes(ownerId) && (
            <button
              type="button"
              onClick={() =>
                onAction({
                  kind: "youSend" in o ? "game.supply.sign" : "game.garrison.sign",
                  offerId: o.id,
                  version: o.version,
                } as SandboxAction)
              }
            >
              Review signing v{o.version}
            </button>
          )}
          <a href={`?people=1&offer=${encodeURIComponent(o.id)}`}>Open negotiation controls</a>
        </article>
      ))}
      {group.contracts.map((c) => (
        <article className="cw-agreement" key={c.id}>
          <span className="cw-tag">Engine contract · {c.status}</span>
          <h3>{"youSend" in c ? "Supply" : "Garrison"} obligations</h3>
          {"youSend" in c && (
            <p>
              You send {flow(c.youSend)}
              <br />
              You receive {flow(c.youReceive)}
            </p>
          )}
          <p>
            From {time(c.startGameTimeMs)}
            <br />
            Until {time(c.endGameTimeMs)}
          </p>
          <details>
            <summary>Committed terms</summary>
            <pre>{JSON.stringify(c.terms, null, 2)}</pre>
            <code>{c.id}</code>
          </details>
          <a href={`?people=1&contract=${encodeURIComponent(c.id)}`}>Inspect contract and exit controls</a>
        </article>
      ))}
      {!group.offers.length && !group.contracts.length && (
        <p>No structured agreement with this player is recorded in this page.</p>
      )}
    </>
  );
}

export function ConversationWorkspace({
  request,
  client,
  canWrite,
  onReview,
}: {
  request: Request;
  client: PactClient<"human">;
  canWrite: boolean;
  onReview: (summary: string, action: SandboxAction) => void;
}) {
  const [data, setData] = useState<ConversationData | null>(null),
    [selected, setSelected] = useState(() => new URLSearchParams(location.search).get("conversation") ?? ""),
    [panel, setPanel] = useState(() => new URLSearchParams(location.search).get("conversationPanel") ?? "thread"),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [page, setPage] = useState<ThreadPage>({ messages: [], next: null }),
    [notice, setNotice] = useState(""),
    [draft, setDraft] = useState(""),
    [busy, setBusy] = useState(false),
    [showPolicy, setShowPolicy] = useState(false);
  const pending = useRef<ReturnType<typeof client.prepareCommand> | null>(null),
    generation = useRef(0);
  const refresh = useCallback(async () => {
    const result = await request("/v1/game/social");
    setData(result as unknown as ConversationData);
  }, [request]);
  useEffect(() => {
    const stop = startVisiblePolling(
      () => refresh().catch(() => setNotice("Conversation summary unavailable. Your draft is retained.")),
      document,
      globalThis,
      30000,
    );
    return stop;
  }, [refresh]);
  const readLatest = useCallback(async () => {
    if (!selected) return;
    const current = generation.current;
    const result = (await request(`/v1/game/council/thread?kingdomId=${selected}`)) as unknown as ThreadPage;
    if (current !== generation.current) return;
    setPage((old) => ({
      next: old.messages.length ? old.next : result.next,
      messages: [...old.messages.filter((m) => !result.messages.some((n) => n.id === m.id)), ...result.messages].sort(
        (a, b) => Number(a.sentGameTimeMs) - Number(b.sentGameTimeMs) || a.id.localeCompare(b.id),
      ),
    }));
    await refresh();
  }, [selected, request, refresh]);
  useEffect(() => {
    ++generation.current;
    setPage({ messages: [], next: null });
    if (!selected) return;
    return startVisiblePolling(
      () => readLatest().catch(() => setNotice("Thread unavailable. Your draft is retained.")),
      document,
      globalThis,
      30000,
    );
  }, [selected, readLatest]);
  useEffect(() => {
    const change = () => {
      setSelected(new URLSearchParams(location.search).get("conversation") ?? "");
      setPanel(new URLSearchParams(location.search).get("conversationPanel") ?? "thread");
    };
    window.addEventListener("popstate", change);
    return () => window.removeEventListener("popstate", change);
  }, []);
  function open(id: string, nextPanel = "thread") {
    if (pending.current) {
      setNotice("Confirm or retry the original pending message before changing conversations.");
      return;
    }
    setSelected(id);
    setPanel(nextPanel);
    setDraft("");
    const url = new URL(location.href);
    if (id) url.searchParams.set("conversation", id);
    else url.searchParams.delete("conversation");
    url.searchParams.set("conversationPanel", nextPanel);
    history.pushState({}, "", url);
  }
  async function send() {
    if (!data || !selected || busy || !canWrite) return;
    setBusy(true);
    setNotice("");
    pending.current ??= client.prepareCommand({ kind: "game.message.send", recipientKingdomId: selected, body: draft });
    const command = pending.current;
    try {
      const receipt = await client.submitCommand(command);
      if (["COMMITTED", "ALREADY_COMMITTED"].includes(receipt.code)) {
        pending.current = null;
        setDraft("");
        setNotice("Message delivered.");
        await readLatest();
      } else setNotice(`Not delivered: ${receipt.code}. The original command is retained.`);
    } catch {
      const receipt = await client.reconcileReceipt(command.commandId).catch(() => null);
      if (receipt && ["COMMITTED", "ALREADY_COMMITTED"].includes(receipt.code)) {
        pending.current = null;
        setDraft("");
        setNotice("Delivery confirmed from the original receipt.");
        await readLatest();
      } else setNotice(`Delivery unconfirmed. Retry preserves command ${command.commandId}.`);
    } finally {
      setBusy(false);
    }
  }
  const groups = data ? conversationGroups(data) : [],
    group = groups.find((g) => g.kingdomId === selected);
  const visible = groups.filter(
    (g) =>
      `${g.handle} ${g.displayName}`.toLowerCase().includes(search.toLowerCase()) &&
      (filter === "all" ||
        (filter === "unread" && (g.unreadCount ?? 0) > 0) ||
        (filter === "you" && g.waitingYou) ||
        (filter === "peer" && g.waitingPeer) ||
        (filter === "active" && g.active > 0) ||
        (filter === "past" && g.contracts.some((c) => c.status !== "active"))),
  );
  return (
    <section className="conversation-workspace" aria-label="Conversations">
      <header className="cw-heading">
        <div>
          <span className="cw-eyebrow">PACT · correspondence</span>
          <h1>Conversations</h1>
          <p>Relationships, proposals and their consequences.</p>
        </div>
        <button type="button" onClick={() => setShowPolicy(!showPolicy)}>
          Social delegation
        </button>
        <button type="button" onClick={() => void refresh().catch(() => setNotice("Refresh unavailable."))}>
          Refresh
        </button>
      </header>
      <p className="cw-policy">
        Communication v2 · Free introductions · 4,096 code points · No daily text quota. Service retries and participant
        preferences still apply.
      </p>
      {showPolicy && data && <SocialDelegation data={data} request={request} onSaved={refresh} canWrite={canWrite} />}
      {notice && (
        <p role="status" className="cw-notice">
          {notice}
        </p>
      )}
      <div
        className={`cw-layout ${selected ? "cw-selected" : ""} ${panel === "agreements" ? "cw-show-agreements" : ""}`}
      >
        <aside className="cw-relationships" aria-label="Relationships">
          <label>
            Find a conversation
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or handle" />
          </label>
          <label>
            Show
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All relationships</option>
              <option value="unread">Unread</option>
              <option value="you">Awaiting you</option>
              <option value="peer">Awaiting peer</option>
              <option value="active">Active obligations</option>
              <option value="past">Past agreements</option>
            </select>
          </label>
          {visible.map((g) => (
            <button
              type="button"
              className="cw-peer"
              aria-current={selected === g.kingdomId ? "true" : undefined}
              key={g.kingdomId}
              onClick={() => open(g.kingdomId)}
            >
              <strong>{g.displayName}</strong>
              <span>@{g.handle}</span>
              <small>
                {g.unreadCount ? `${g.unreadCount} unread · ` : ""}
                {g.active
                  ? `${g.active} active agreement${g.active === 1 ? "" : "s"}`
                  : g.waitingYou
                    ? "Awaiting you"
                    : g.waitingPeer
                      ? "Awaiting peer"
                      : "Conversation"}
              </small>
            </button>
          ))}
          {data?.contactsNextOffset !== null && data?.contactsNextOffset !== undefined && (
            <button
              type="button"
              onClick={() =>
                void request(`/v1/game/social?contactOffset=${data.contactsNextOffset}`)
                  .then((r) => {
                    const next = r as unknown as ConversationData;
                    setData((old) =>
                      old
                        ? {
                            ...old,
                            contacts: [
                              ...old.contacts,
                              ...next.contacts.filter((c) => !old.contacts.some((x) => x.kingdomId === c.kingdomId)),
                            ],
                            contactsNextOffset: next.contactsNextOffset ?? null,
                          }
                        : next,
                    );
                  })
                  .catch(() => setNotice("More relationships unavailable. Retry loading this page."))
              }
            >
              More relationships
            </button>
          )}
          {data && !visible.length && <p>No matching conversations.</p>}
          <a href="?people=1">Discover players and send an introduction</a>
        </aside>
        <main className="cw-thread" aria-label="Selected conversation">
          {group ? (
            <>
              <header>
                <button className="cw-mobile-back" type="button" onClick={() => open("")}>
                  ← Relationships
                </button>
                <h2>{group.displayName}</h2>
                <p>@{group.handle} · Participant-only conversation</p>
                <button className="cw-mobile-back" type="button" onClick={() => open(group.kingdomId, "agreements")}>
                  Agreement tracks →
                </button>
              </header>
              {page.next && (
                <button
                  type="button"
                  onClick={() => {
                    const cursor = page.next;
                    if (!cursor) return;
                    const current = generation.current;
                    void request(
                      `/v1/game/council/thread?kingdomId=${selected}&beforeGameTimeMs=${cursor.gameTimeMs}&beforeId=${cursor.id}`,
                    )
                      .then((r) => {
                        if (current !== generation.current) return;
                        const next = r as unknown as ThreadPage;
                        setPage((old) => ({
                          next: next.next,
                          messages: [
                            ...next.messages.filter((m) => !old.messages.some((x) => x.id === m.id)),
                            ...old.messages,
                          ],
                        }));
                      })
                      .catch(() => setNotice("Earlier messages unavailable. No unseen message was acknowledged."));
                  }}
                >
                  Earlier messages
                </button>
              )}
              <div className="cw-timeline">
                {group.introductions.map((r) => (
                  <article className="cw-engine-event" key={r.id}>
                    <small>Engine record · {r.direction} introduction</small>
                    <p>{r.note}</p>
                    <p>Expires {time(r.expiresGameTimeMs)}</p>
                    {r.direction === "incoming" && (
                      <>
                        <button
                          type="button"
                          disabled={!canWrite}
                          onClick={() =>
                            onReview("Accept this introduction? This grants conversation only.", {
                              kind: "game.contact.answer",
                              requestId: r.id,
                              accept: true,
                            })
                          }
                        >
                          Review accepting
                        </button>
                        <button
                          type="button"
                          disabled={!canWrite}
                          onClick={() =>
                            onReview("Decline this introduction?", {
                              kind: "game.contact.answer",
                              requestId: r.id,
                              accept: false,
                            })
                          }
                        >
                          Decline
                        </button>
                      </>
                    )}
                  </article>
                ))}
                {page.messages.map((m) => (
                  <article
                    className={`cw-message ${m.senderKingdomId === data?.kingdomId ? "cw-owned" : ""}`}
                    key={m.id}
                  >
                    <small>
                      {m.senderKingdomId === data?.kingdomId ? "You" : group.displayName} · {m.authorKind ?? "agent"}{" "}
                      statement · {time(m.sentGameTimeMs)}
                    </small>
                    <p>{m.body}</p>
                  </article>
                ))}
                {!page.messages.length && (
                  <p className="cw-muted">
                    No delivered message in this page. A proposal appears separately in Agreement tracks.
                  </p>
                )}
              </div>
              {data?.contacts.some((c) => c.kingdomId === selected) ? (
                <form
                  className="cw-compose"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send();
                  }}
                >
                  <label>
                    Your message
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      disabled={pending.current !== null}
                      rows={4}
                      placeholder="Write in your own words…"
                    />
                  </label>
                  <small>{[...draft].length}/4,096 code points · Statements do not sign contracts</small>
                  <button type="submit" disabled={!canWrite || busy || !draft || [...draft].length > 4096}>
                    {pending.current ? "Retry original message" : "Send message"}
                  </button>
                  {pending.current && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const original = pending.current;
                        if (!original) return;
                        setBusy(true);
                        void client
                          .reconcileReceipt(original.commandId)
                          .then(async (receipt) => {
                            if (receipt && ["COMMITTED", "ALREADY_COMMITTED"].includes(receipt.code)) {
                              pending.current = null;
                              setDraft("");
                              setNotice("Original delivery confirmed.");
                              await readLatest();
                            } else
                              setNotice(
                                "Delivery is still unconfirmed. Retry the original message; its ID is retained.",
                              );
                          })
                          .catch(() => setNotice("Receipt unavailable. The original message is retained."))
                          .finally(() => setBusy(false));
                      }}
                    >
                      Check original receipt
                    </button>
                  )}
                </form>
              ) : (
                <p>A contact must be accepted before sending messages.</p>
              )}
            </>
          ) : (
            <div className="cw-empty">
              <h2>A society begins with a conversation</h2>
              <p>Choose a relationship to see its correspondence and exact agreements.</p>
              <a href="?people=1">Find players</a>
            </div>
          )}
        </main>
        <aside className="cw-tracks" aria-label="Agreement tracks">
          {group && data ? (
            <>
              <button className="cw-mobile-back" type="button" onClick={() => open(group.kingdomId)}>
                ← Conversation
              </button>
              <AgreementTracks
                group={group}
                ownerId={data.kingdomId}
                onAction={(action) =>
                  onReview(
                    "Review signing these exact current terms? The server checks current stock, authority, bonds and deadlines.",
                    action,
                  )
                }
              />
            </>
          ) : (
            <p>Choose a relationship to inspect its obligations.</p>
          )}
        </aside>
      </div>
    </section>
  );
}

function SocialDelegation({
  data,
  request,
  onSaved,
  canWrite,
}: {
  data: ConversationData;
  request: Request;
  onSaved: () => Promise<void>;
  canWrite: boolean;
}) {
  const [mode, setMode] = useState(data.delegation?.mode ?? "manual"),
    [ids, setIds] = useState((data.delegation?.allowedKingdomIds ?? []).join("\n")),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const pending = useRef<{ id: string; action: Record<string, unknown> } | null>(null);
  return (
    <form
      className="cw-delegation"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        const action = {
          kind: "contact.delegation",
          mode,
          allowedKingdomIds: mode === "allowlist" ? ids.split(/\s+/).filter(Boolean) : [],
          expectedVersion: data.delegation?.version ?? 0,
        };
        pending.current ??= { id: crypto.randomUUID(), action };
        void request("/v1/social/commands", "POST", {
          schemaVersion: "pact.social-command.v2",
          commandId: pending.current.id,
          action: pending.current.action,
        })
          .then((r) => {
            if ((r.receipt as { code: string })?.code !== "COMMITTED") throw new Error("Not committed");
            pending.current = null;
            setNotice("Social delegation saved.");
            return onSaved();
          })
          .catch(() => setNotice("Change unconfirmed. Retry retains the original settings and command ID."))
          .finally(() => setBusy(false));
      }}
    >
      <h2>Who decides contact requests?</h2>
      <p>
        Applies to existing and future pending introductions. It grants conversation only and starts no model. You can
        revoke it by choosing Manual.
      </p>
      <label>
        Contact decisions
        <select value={mode} disabled={pending.current !== null} onChange={(e) => setMode(e.target.value)}>
          <option value="manual">Manual — I decide</option>
          <option value="allowlist">Agent — only named senders</option>
          <option value="agent_decides">Agent — any incoming sender</option>
        </select>
      </label>
      {mode === "allowlist" && (
        <label>
          Allowed sender kingdom IDs, one per line
          <textarea value={ids} disabled={pending.current !== null} onChange={(e) => setIds(e.target.value)} />
        </label>
      )}
      <button type="submit" disabled={!canWrite || busy}>
        {pending.current ? "Retry original change" : "Save social delegation"}
      </button>
      {notice && <p role="status">{notice}</p>}
    </form>
  );
}
