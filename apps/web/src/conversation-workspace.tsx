import type { PactClient, SandboxAction } from "@pact/client-sdk";
import { type AgreementHistoryItem, EngineAgreementHistory } from "@pact/ui-features";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConversationOutbox, definiteMessageRefusal } from "./conversation-outbox.js";
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
  const [showObservations, setShowObservations] = useState(false);
  const [historyItems, setHistoryItems] = useState<AgreementHistoryItem[]>([]),
    [historyNext, setHistoryNext] = useState<ThreadPage["next"]>(null),
    [confirmedRejection, setConfirmedRejection] = useState("");
  const pending = useRef<ReturnType<typeof client.prepareCommand> | null>(null),
    generation = useRef(0),
    historyInitialized = useRef(false);
  const outbox = useRef<ConversationOutbox | null>(null),
    restoredOwner = useRef(""),
    contactPages = useRef(1);
  const refresh = useCallback(async () => {
    const pages = await Promise.all(
      Array.from({ length: contactPages.current }, (_, i) =>
        request(`/v1/game/social${i ? `?contactOffset=${i * 50}` : ""}`),
      ),
    );
    const first = pages[0] as unknown as ConversationData;
    if (first) {
      const contacts = pages.flatMap((p) => (p as unknown as ConversationData).contacts);
      setData({
        ...first,
        contacts: [...new Map(contacts.map((c) => [c.kingdomId, c])).values()],
        contactsNextOffset: (pages.at(-1) as unknown as ConversationData).contactsNextOffset ?? null,
      });
    }
  }, [request]);
  useEffect(() => {
    if (!data || restoredOwner.current === data.kingdomId) return;
    restoredOwner.current = data.kingdomId;
    outbox.current = new ConversationOutbox(sessionStorage);
    const command = outbox.current.restore(data.kingdomId);
    if (command?.action.kind === "game.message.send") {
      pending.current = command;
      setSelected(command.action.recipientKingdomId);
      setDraft(command.action.body);
      setNotice("An earlier delivery is unconfirmed. Check its receipt or retry the exact original message.");
    }
  }, [data]);
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
    const history = await request(`/v1/game/conversations/agreements?kingdomId=${selected}`);
    if (current !== generation.current) return;
    setHistoryItems((old) => [
      ...old.filter((x) => !(history.offers as AgreementHistoryItem[]).some((n) => n.id === x.id)),
      ...(history.offers as AgreementHistoryItem[]).map((n) => {
        const previous = old.find((x) => x.id === n.id);
        if (!previous) return n;
        return {
          ...n,
          versions: [
            ...n.versions,
            ...previous.versions.filter((v) => !n.versions.some((x) => x.version === v.version)),
          ],
          signatures: [
            ...n.signatures,
            ...previous.signatures.filter(
              (s) => !n.signatures.some((x) => x.version === s.version && x.kingdomId === s.kingdomId),
            ),
          ],
          versionsNextBefore: previous.versionsNextBefore,
        };
      }),
    ]);
    if (!historyInitialized.current) {
      historyInitialized.current = true;
      setHistoryNext(history.next as ThreadPage["next"]);
    }
    await refresh();
  }, [selected, request, refresh]);
  useEffect(() => {
    ++generation.current;
    setPage({ messages: [], next: null });
    setHistoryItems([]);
    setHistoryNext(null);
    historyInitialized.current = false;
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
      if (!outbox.current) throw Error("OUTBOX_UNAVAILABLE");
      outbox.current.save(data.kingdomId, command);
      const receipt = await client.submitCommand(command);
      if (["COMMITTED", "ALREADY_COMMITTED"].includes(receipt.code)) {
        outbox.current.confirmed(data.kingdomId);
        pending.current = null;
        setDraft("");
        setNotice("Message delivered.");
        await readLatest();
      } else {
        setNotice(`Not delivered: ${receipt.code}. The original command is retained.`);
        if (!["RATE_LIMITED", "APPROVAL_REQUIRED"].includes(receipt.code)) setConfirmedRejection(receipt.code);
      }
    } catch (error) {
      const receipt = await client.reconcileReceipt(command.commandId).catch(() => null);
      if (receipt && ["COMMITTED", "ALREADY_COMMITTED"].includes(receipt.code)) {
        outbox.current?.confirmed(data.kingdomId);
        pending.current = null;
        setDraft("");
        setNotice("Delivery confirmed from the original receipt.");
        await readLatest();
      } else if (definiteMessageRefusal(error)) {
        setConfirmedRejection(error instanceof Error ? error.message : "Refused");
        setNotice("The server refused this delivery. You may edit a new message after acknowledging the refusal.");
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
        <button type="button" onClick={() => setShowObservations(!showObservations)}>
          Consented observations
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
      {showObservations && <ObservedExchanges request={request} />}
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
                    ++contactPages.current;
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
                              if (data) outbox.current?.confirmed(data.kingdomId);
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
                  {confirmedRejection && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (data) outbox.current?.confirmed(data.kingdomId);
                        pending.current = null;
                        setConfirmedRejection("");
                        setNotice(
                          `The server rejected the original message: ${confirmedRejection}. You can now edit a new message.`,
                        );
                      }}
                    >
                      Edit after confirmed rejection
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
              <EngineAgreementHistory
                items={historyItems}
                ownerId={data.kingdomId}
                onMoreVersions={(o) => {
                  const current = generation.current;
                  void request(
                    `/v1/game/conversations/versions?kingdomId=${selected}&offerId=${o.id}&beforeVersion=${o.versionsNextBefore}`,
                  )
                    .then((r) => {
                      if (current !== generation.current) return;
                      setHistoryItems((old) =>
                        old.map((x) =>
                          x.id === o.id
                            ? {
                                ...x,
                                versions: [
                                  ...x.versions,
                                  ...(r.versions as AgreementHistoryItem["versions"]).filter(
                                    (v) => !x.versions.some((a) => a.version === v.version),
                                  ),
                                ],
                                signatures: [
                                  ...x.signatures,
                                  ...(r.signatures as AgreementHistoryItem["signatures"]).filter(
                                    (s) =>
                                      !x.signatures.some((a) => a.version === s.version && a.kingdomId === s.kingdomId),
                                  ),
                                ],
                                versionsNextBefore: r.nextBefore as number | null,
                              }
                            : x,
                        ),
                      );
                    })
                    .catch(() => setNotice("Earlier offer versions unavailable. Retry loading them."));
                }}
              />
              {historyNext && (
                <button
                  type="button"
                  onClick={() => {
                    const current = generation.current,
                      cursor = historyNext;
                    void request(
                      `/v1/game/conversations/agreements?kingdomId=${selected}&beforeGameTimeMs=${cursor.gameTimeMs}&beforeId=${cursor.id}`,
                    )
                      .then((r) => {
                        if (current !== generation.current) return;
                        setHistoryItems((old) => [
                          ...old,
                          ...(r.offers as AgreementHistoryItem[]).filter((o) => !old.some((x) => x.id === o.id)),
                        ]);
                        setHistoryNext(r.next as ThreadPage["next"]);
                      })
                      .catch(() => setNotice("Earlier negotiations unavailable. Retry loading them."));
                  }}
                >
                  Earlier negotiations
                </button>
              )}
              <ObservationConsent key={selected} peerId={selected} request={request} canWrite={canWrite} />
            </>
          ) : (
            <p>Choose a relationship to inspect its obligations.</p>
          )}
        </aside>
      </div>
    </section>
  );
}

type ObservationConsentRecord = {
  observerKingdomId: string;
  handle: string;
  displayName: string;
  enabled: boolean;
  peerEnabled: boolean;
  version: number;
};
function ObservationConsent({ peerId, request, canWrite }: { peerId: string; request: Request; canWrite: boolean }) {
  const [consents, setConsents] = useState<ObservationConsentRecord[]>([]),
    [observer, setObserver] = useState(""),
    [observerName, setObserverName] = useState(""),
    [observerSearch, setObserverSearch] = useState(""),
    [observerMatches, setObserverMatches] = useState<Party[]>([]),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const pending = useRef<{ commandId: string; action: Record<string, unknown> } | null>(null);
  const load = useCallback(async () => {
    const r = await request(`/v1/game/conversations/consents?kingdomId=${peerId}`);
    setConsents(r.consents as ObservationConsentRecord[]);
  }, [request, peerId]);
  useEffect(() => {
    void load().catch(() => setNotice("Observation settings unavailable."));
  }, [load]);
  async function save(id: string, enabled: boolean) {
    if (!canWrite || busy) return;
    setBusy(true);
    pending.current ??= {
      commandId: crypto.randomUUID(),
      action: {
        kind: "conversation.observation",
        peerKingdomId: peerId,
        observerKingdomId: id,
        enabled,
        expectedVersion: consents.find((c) => c.observerKingdomId === id)?.version ?? 0,
      },
    };
    try {
      const r = await request("/v1/social/commands", "POST", {
        schemaVersion: "pact.social-command.v2",
        ...pending.current,
      });
      const receipt = r.receipt as { code: string };
      if (["COMMITTED", "ALREADY_COMMITTED"].includes(receipt.code)) {
        pending.current = null;
        setNotice("Your observation consent was saved. The other participant must independently consent.");
        await load();
      } else {
        pending.current = null;
        setNotice(
          `The server rejected this change: ${receipt.code}. Refresh its current state before another decision.`,
        );
        await load();
      }
    } catch (error) {
      if (
        error instanceof Error &&
        ["INVALID_COMMAND", "FORBIDDEN", "INVALID_INPUT", "OPERATION_CONFLICT"].includes(error.message)
      ) {
        pending.current = null;
        setNotice(`Change rejected: ${error.message}. Review refreshed consent before a new decision.`);
        await load();
      } else setNotice("Change unconfirmed. Retry preserves the exact observer, setting and command ID.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="cw-agreement">
      <summary>Named observation consent</summary>
      <p>
        Private by default. A named observer can read retained and future messages only while both participants consent.
        Revocation stops future reads; content already read cannot be recalled. Private notes, reasoning, credentials
        and stocks are never included.
      </p>
      {consents.map((c) => (
        <div key={c.observerKingdomId}>
          <p>
            {c.displayName} · @{c.handle}: you {c.enabled ? "consent" : "do not consent"}, peer{" "}
            {c.peerEnabled ? "consents" : "has not consented"}. Blocks take precedence.
          </p>
          <button
            type="button"
            disabled={!canWrite || busy || pending.current !== null}
            onClick={() => void save(c.observerKingdomId, !c.enabled)}
          >
            {c.enabled ? "Revoke your consent" : "Enable your consent"}
          </button>
        </div>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void request(`/v1/game/council?search=${encodeURIComponent(observerSearch)}`)
            .then((r) =>
              setObserverMatches((r.players as { players: Party[] }).players.filter((p) => p.kingdomId !== peerId)),
            )
            .catch(() => setNotice("Public player search unavailable."));
        }}
      >
        <label>
          Find a named observer
          <input
            placeholder="Name or @handle"
            maxLength={80}
            value={observerSearch}
            disabled={pending.current !== null}
            onChange={(e) => setObserverSearch(e.target.value)}
          />
        </label>
        <button type="submit" disabled={!canWrite || busy || pending.current !== null}>
          Find observer
        </button>
      </form>
      {observerMatches.map((p) => (
        <button
          type="button"
          key={p.kingdomId}
          disabled={pending.current !== null}
          onClick={() => {
            setObserver(p.kingdomId);
            setObserverName(`${p.displayName} (@${p.handle})`);
          }}
        >
          Choose {p.displayName} · @{p.handle}
        </button>
      ))}
      {observer && <p>Selected observer: {observerName}</p>}
      <button
        type="button"
        disabled={!observer || !canWrite || busy || pending.current !== null}
        onClick={() => void save(observer, true)}
      >
        Consent to the selected observer reading this exchange
      </button>
      {pending.current && (
        <button type="button" disabled={busy} onClick={() => void save("", false)}>
          Retry original consent change
        </button>
      )}
      {notice && <p role="status">{notice}</p>}
    </details>
  );
}
type ObservedPair = {
  leftKingdomId: string;
  leftName: string;
  leftHandle: string;
  rightKingdomId: string;
  rightName: string;
  rightHandle: string;
};
function ObservedExchanges({ request }: { request: Request }) {
  const [pairs, setPairs] = useState<ObservedPair[]>([]),
    [nextOffset, setNextOffset] = useState<number | null>(null),
    [selected, setSelected] = useState<ObservedPair | null>(null),
    [messages, setMessages] = useState<(Message & { agentOriginated: boolean })[]>([]),
    [next, setNext] = useState<ThreadPage["next"]>(null),
    [notice, setNotice] = useState("");
  const selectedRef = useRef<ObservedPair | null>(null);
  const hasObservedPage = useRef(false);
  const load = useCallback(
    async (offset = 0) => {
      const r = await request(`/v1/game/conversations/observations?offset=${offset}`);
      setPairs((old) => (offset ? [...old, ...(r.pairs as ObservedPair[])] : (r.pairs as ObservedPair[])));
      setNextOffset(r.nextOffset as number | null);
    },
    [request],
  );
  useEffect(() => {
    void load().catch(() => setNotice("Consented observations unavailable."));
  }, [load]);
  const read = useCallback(
    async function read(pair: ObservedPair, cursor?: ThreadPage["next"]) {
      try {
        const r = await request(
          `/v1/game/conversations/observe?leftKingdomId=${pair.leftKingdomId}&rightKingdomId=${pair.rightKingdomId}${cursor ? `&beforeGameTimeMs=${cursor.gameTimeMs}&beforeId=${cursor.id}` : ""}`,
        );
        if (selectedRef.current !== pair) return;
        setMessages((old) =>
          [
            ...old.filter((m) => !(r.messages as Message[]).some((n) => n.id === m.id)),
            ...(r.messages as (Message & { agentOriginated: boolean })[]),
          ].sort((a, b) => Number(a.sentGameTimeMs) - Number(b.sentGameTimeMs) || a.id.localeCompare(b.id)),
        );
        if (cursor || !hasObservedPage.current) setNext(r.next as ThreadPage["next"]);
        hasObservedPage.current = true;
        setNotice("");
      } catch {
        if (selectedRef.current === pair) {
          setMessages([]);
          setNext(null);
          setNotice("Observation unavailable or revoked. Both participants must currently consent.");
        }
        void load();
      }
    },
    [request, load],
  );
  useEffect(
    () => (selected ? startVisiblePolling(() => read(selected), document, globalThis, 30000) : undefined),
    [selected, read],
  );
  return (
    <section className="cw-delegation" aria-label="Consented observations">
      <h2>Consented exchanges</h2>
      <p>
        Only pairs that independently consented to your kingdom are listed. Reading here never acknowledges either
        participant's inbox. Revocation prevents subsequent reads.
      </p>
      {pairs.map((p) => (
        <button
          type="button"
          key={`${p.leftKingdomId}:${p.rightKingdomId}`}
          onClick={() => {
            selectedRef.current = p;
            hasObservedPage.current = false;
            setSelected(p);
            setMessages([]);
            setNext(null);
            void read(p);
          }}
        >
          {p.leftName} ↔ {p.rightName}
        </button>
      ))}
      {!pairs.length && <p>No mutually consented exchanges.</p>}
      {nextOffset !== null && (
        <button
          type="button"
          onClick={() => void load(nextOffset).catch(() => setNotice("More consented pairs unavailable."))}
        >
          More consented pairs
        </button>
      )}
      {selected && (
        <div>
          <h3>
            {selected.leftName} ↔ {selected.rightName}
          </h3>
          {next && (
            <button type="button" onClick={() => void read(selected, next)}>
              Earlier observed messages
            </button>
          )}
          <div className="cw-timeline">
            {messages.map((m) => (
              <article className="cw-message" key={m.id}>
                <small>
                  {m.senderKingdomId === selected.leftKingdomId ? selected.leftName : selected.rightName} ·{" "}
                  {m.agentOriginated ? "agent" : "human"} statement · {time(m.sentGameTimeMs)}
                </small>
                <p>{m.body}</p>
              </article>
            ))}
          </div>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
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
            if (!["COMMITTED", "ALREADY_COMMITTED"].includes((r.receipt as { code: string })?.code))
              throw new Error("Not committed");
            pending.current = null;
            setNotice("Social delegation saved.");
            return onSaved();
          })
          .catch(async (error) => {
            if (
              error instanceof Error &&
              ["INVALID_COMMAND", "FORBIDDEN", "INVALID_INPUT", "OPERATION_CONFLICT"].includes(error.message)
            ) {
              pending.current = null;
              setNotice(`Change rejected: ${error.message}. Reload current delegation before another decision.`);
              await onSaved();
            } else setNotice("Change unconfirmed. Retry retains the original settings and command ID.");
          })
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
