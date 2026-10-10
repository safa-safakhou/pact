import {
  type CollectionCommand,
  CollectionCommandSchema,
  type CollectionDisplay,
  collectionAsset,
  collectionPieces,
  collectionSets,
} from "@pact/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { pactBaseUrl } from "./client-location.js";
import "./collection-workspace.css";

type Request = (path: string, method?: string, body?: unknown) => Promise<Record<string, unknown>>;
type Source = { kind: string; id: string; peerKingdomId?: string; handle?: string };
type Incident = {
  id: string;
  kind: string;
  gameTimeMs: string;
  facts: {
    achievementId?: string;
    winner?: string;
    ownSide?: string;
    ownOrdinaryUnits?: number;
    ownOrdinaryLosses?: number;
  };
  source: Source | null;
};
type Story = { id: string; version: number; title: string; annotation: string; incidentIds: string[] };
export type CollectionView = {
  pieces: ((typeof collectionPieces)[number] & { owned: boolean; earnedGameTimeMs: string | null; source: unknown })[];
  sets: ((typeof collectionSets)[number] & { ownedPieces: number; trophyOwned: boolean })[];
  progress: { partners: number; resources: string[] };
  watermark: { pending: boolean; processed_game_time_ms: string } | null;
  failedEvents: number;
  incidents: Incident[];
  instances: { id: string; itemId: string; pattern: string; incidentId: string | null }[];
  nextIncidentId: string | null;
  nextInstanceId: string | null;
  stories: Story[];
  display: CollectionDisplay;
  displayVersion: number;
  entitlements: string[];
  randomFinishesEnabled: false;
};
const names = { hall: "Hall object", banner: "Banner pattern", frame: "Portrait frame", stamp: "Wax-stamp appearance" };
export function collectionSourceHref(source: Source | null) {
  if (!source) return null;
  if (source.peerKingdomId)
    return `?conversation=${encodeURIComponent(source.peerKingdomId)}&conversationPanel=${source.kind === "message" ? "thread" : "agreements"}`;
  if (source.kind === "raid") return `?report=raid_participant&recordId=${encodeURIComponent(source.id)}`;
  if (source.kind === "court" && source.handle) return `?court=${encodeURIComponent(source.handle)}`;
  return null;
}
export function collectionItemName(item: string) {
  return (
    collectionPieces.find((p) => p.item === item)?.name ??
    collectionSets.find((s) => s.trophy === item)?.trophyName ??
    (item.startsWith("campaign:") ? "Campaign medallion" : item.replaceAll(".", " ").replaceAll("_", " "))
  );
}
function Picture({ item }: { item: string }) {
  const asset = item.startsWith("campaign:") || item === "campaign.medallion" ? "ornament.campaign_medallion" : item;
  return collectionPieces.some((p) => p.item === asset) || collectionSets.some((s) => s.trophy === asset) ? (
    <img width="100" height="100" alt="" src={`${pactBaseUrl().replace(/\/$/, "")}${collectionAsset(asset)}`} />
  ) : (
    <span className="col-monogram" aria-hidden="true">
      ◇
    </span>
  );
}
export function PublicCollectionCard({ handle, request }: { handle: string; request: Request }) {
  const [card, setCard] = useState<{
      title: string;
      items: { slot: string; itemId: string; appearance?: string }[];
      meaning: string;
    } | null>(null),
    [notice, setNotice] = useState("Loading public display…");
  useEffect(() => {
    let active = true;
    void request(`/v1/collections/public/${encodeURIComponent(handle)}`)
      .then((value) => {
        if (active) {
          setCard(value as unknown as typeof card);
          setNotice("");
        }
      })
      .catch(() => {
        if (active) setNotice("This public display is unavailable.");
      });
    return () => {
      active = false;
    };
  }, [handle, request]);
  return (
    <main className="game-shell col-public">
      <p className="col-kicker">PACT · Public appearance</p>
      <h1>{card?.title || "Hall of Stories"}</h1>
      {notice && <p role="status">{notice}</p>}
      <div className="col-items">
        {card?.items.map((item) => (
          <article className="col-piece" key={item.slot}>
            <Picture item={item.itemId} />
            <h2>{collectionItemName(item.itemId)}</h2>
            {item.appearance && <p>{item.appearance} pattern</p>}
          </article>
        ))}
      </div>
      <p>{card?.meaning}</p>
      <a href={pactBaseUrl()}>Visit PACT</a>
    </main>
  );
}
export function CollectionWorkspace({
  request,
  ownerId,
  handle,
  canWrite,
  initialView,
}: {
  request: Request;
  ownerId: string;
  handle: string;
  canWrite: boolean;
  initialView?: CollectionView;
}) {
  const initialArea = new URLSearchParams(typeof location === "undefined" ? "" : location.search).get("collection"),
    key = `pact_collection_pending:${ownerId}`;
  const [area, setArea] = useState(
      initialArea === "keepsakes" ? "Keepsakes" : initialArea === "display" ? "Display" : "Sets",
    ),
    [view, setView] = useState<CollectionView | null>(initialView ?? null),
    [draft, setDraft] = useState<CollectionDisplay | null>(initialView?.display ?? null),
    [selected, setSelected] = useState<string | null>(null),
    [filter, setFilter] = useState("all"),
    [selectedSet, setSetFilter] = useState("all"),
    [browse, setBrowse] = useState(false),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [needsReload, setNeedsReload] = useState(false),
    [fresh, setFresh] = useState<string[]>([]),
    [editing, setEditing] = useState<Story | null>(null),
    [title, setTitle] = useState(""),
    [annotation, setAnnotation] = useState(""),
    [chosen, setChosen] = useState<string[]>([]),
    [pending, setPending] = useState<CollectionCommand | null>(() => {
      try {
        const value = CollectionCommandSchema.safeParse(JSON.parse(sessionStorage.getItem(key) ?? "null"));
        return value.success ? value.data : null;
      } catch {
        return null;
      }
    });
  const observed = useRef(false),
    detailHeading = useRef<HTMLHeadingElement>(null),
    listHeading = useRef<HTMLHeadingElement>(null);
  const load = useCallback(async () => {
    const value = (await request("/v1/collections")) as unknown as CollectionView;
    setView(value);
    setDraft(structuredClone(value.display));
    setNeedsReload(false);
    setNotice("");
    if (!observed.current) {
      observed.current = true;
      try {
        const seen = new Set(JSON.parse(localStorage.getItem(`pact_collection_seen:${ownerId}`) ?? "[]") as string[]);
        setFresh(value.pieces.filter((p) => p.owned && !seen.has(p.id)).map((p) => p.name));
        localStorage.setItem(
          `pact_collection_seen:${ownerId}`,
          JSON.stringify(value.pieces.filter((p) => p.owned).map((p) => p.id)),
        );
      } catch {}
    }
  }, [request, ownerId]);
  useEffect(() => {
    if (!initialView) void load().catch(() => setNotice("Collection could not be loaded. Reconnect and refresh."));
  }, [load, initialView]);
  useEffect(() => {
    if (selected) detailHeading.current?.focus();
  }, [selected]);
  function chooseArea(next: string) {
    setArea(next);
    setSelected(null);
    const url = new URL(location.href);
    url.searchParams.set("collection", next.toLowerCase());
    history.replaceState(null, "", url);
  }
  async function save(exact: CollectionCommand) {
    setBusy(true);
    setNotice("");
    try {
      sessionStorage.setItem(key, JSON.stringify(exact));
      setPending(exact);
      await request("/v1/collections", "POST", exact);
      sessionStorage.removeItem(key);
      setPending(null);
      setEditing(null);
      setTitle("");
      setAnnotation("");
      setChosen([]);
      await load();
      setNotice("Saved to your account. All devices will read this version.");
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (
        ["STALE_VERSION", "NOT_OWNED", "INCOMPATIBLE_SLOT", "STORY_LIMIT", "INVALID_INPUT", "FORBIDDEN"].includes(code)
      ) {
        sessionStorage.removeItem(key);
        setPending(null);
        if (code === "STALE_VERSION") setNeedsReload(true);
        setNotice(
          code === "STALE_VERSION"
            ? "Another device saved a newer version. Refresh before making a new save."
            : `Save refused: ${code}.`,
        );
      } else setNotice("Save result is uncertain. Retry the original request before making another change.");
    } finally {
      setBusy(false);
    }
  }
  const write = canWrite && !busy && !pending && !needsReload;
  const piece = view?.pieces.find((p) => p.id === selected),
    incident = piece
      ? view?.incidents.find((i) => i.facts.achievementId === piece.id)
      : view?.incidents.find((i) => i.id === selected);
  const source = incident?.source ?? null,
    sourceLink = collectionSourceHref(source);
  const visibleSets =
    view?.sets.filter(
      (s) => (browse || s.id === "founding" || s.ownedPieces > 0) && (selectedSet === "all" || selectedSet === s.id),
    ) ?? [];
  const cards =
    view?.pieces.filter(
      (p) => visibleSets.some((s) => s.id === p.set) && (filter === "all" || (filter === "owned" ? p.owned : !p.owned)),
    ) ?? [];
  function closeDetail() {
    setSelected(null);
    queueMicrotask(() => listHeading.current?.focus());
  }
  const saveDisplay = () => {
    if (!draft || !view) return;
    void save({
      schemaVersion: "pact.collection-command.v2",
      commandId: crypto.randomUUID(),
      kind: "display",
      expectedVersion: view.displayVersion,
      display: draft,
    });
  };
  return (
    <section className="collection-workspace" aria-label="Hall of Stories">
      <header className="col-header">
        <div>
          <p className="col-kicker">Your kingdom · Collection</p>
          <h2 ref={listHeading} tabIndex={-1}>
            Hall of Stories
          </h2>
          <p>A record of what happened, and the pieces you choose to remember.</p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void load().catch(() => setNotice("Refresh failed; the last snapshot is still shown."))}
        >
          Refresh collection
        </button>
      </header>
      <nav className="game-nav" aria-label="Collection sections">
        {["Sets", "Keepsakes", "Display"].map((next) => (
          <button
            type="button"
            key={next}
            aria-current={area === next ? "page" : undefined}
            onClick={() => chooseArea(next)}
          >
            {next}
          </button>
        ))}
      </nav>
      <p role="status" className="col-notice">
        {notice}
      </p>
      {pending && (
        <aside className="col-status">
          <p>An exact save is waiting for confirmation.</p>
          <button type="button" disabled={!canWrite || busy} onClick={() => void save(pending)}>
            Retry original save
          </button>
        </aside>
      )}
      {!view || !draft ? (
        <p>Loading your collection…</p>
      ) : (
        <>
          {fresh.length > 0 && (
            <aside className="col-discoveries">
              <strong>Recorded since your last collection visit</strong>
              <p>{fresh.join(" · ")}</p>
              <p>Already yours. No claim or approval is needed.</p>
            </aside>
          )}
          {(view.watermark?.pending || view.failedEvents > 0 || !view.watermark) && (
            <aside className="col-status">
              {!view.watermark
                ? "Projection history is not yet available."
                : view.watermark.pending
                  ? "Some outcomes are still awaiting projection. Unrecorded progress is not confirmed."
                  : ""}
              {view.failedEvents > 0 && ` ${view.failedEvents} source events require operator inspection.`}
            </aside>
          )}
          {area === "Sets" && (
            <>
              <div className="col-filters">
                <label>
                  Show
                  <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                    <option value="all">All pieces</option>
                    <option value="owned">Owned</option>
                    <option value="locked">Locked</option>
                  </select>
                </label>
                <label>
                  Set
                  <select value={selectedSet} onChange={(e) => setSetFilter(e.target.value)}>
                    <option value="all">All discovered sets</option>
                    {view.sets
                      .filter((s) => browse || s.id === "founding" || s.ownedPieces > 0)
                      .map((s) => (
                        <option value={s.id} key={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={browse}
                    onChange={(e) => {
                      setBrowse(e.target.checked);
                      setSetFilter("all");
                    }}
                  />
                  Browse all sets
                </label>
                <span>Guaranteed pieces · random finishes disabled</span>
              </div>
              <div className={`col-workbench ${selected ? "col-selected" : ""}`}>
                <div className="col-list">
                  {visibleSets.map((s) => (
                    <section className="col-set" key={s.id}>
                      <header>
                        <h3>{s.name}</h3>
                        <span>
                          {s.ownedPieces}/4 pieces · {s.trophyOwned ? "Trophy earned" : s.trophyName}
                        </span>
                      </header>
                      <div className="col-items">
                        {cards
                          .filter((p) => p.set === s.id)
                          .map((p) => (
                            <button
                              type="button"
                              className={`col-piece ${p.owned ? "" : "col-locked"}`}
                              key={p.id}
                              onClick={() => setSelected(p.id)}
                              aria-label={`${p.name}, ${p.owned ? "owned" : "locked"}`}
                            >
                              <Picture item={p.item} />
                              <strong>{p.name}</strong>
                              <span>
                                {p.owned ? "Owned" : "Locked"}
                                {draft.goals.includes(p.id) ? " · Pinned goal" : ""}
                              </span>
                            </button>
                          ))}
                      </div>
                      {s.trophyOwned && (
                        <div className="col-trophy">
                          <Picture item={s.trophy} />
                          <span>{s.trophyName} · owned</span>
                        </div>
                      )}
                    </section>
                  ))}
                  {!cards.length && (
                    <p>No pieces match this filter. Change the filter to browse another part of your history.</p>
                  )}
                </div>
                <aside className="col-detail" aria-label="Collection detail">
                  {piece ? (
                    <>
                      <button className="col-back" type="button" onClick={closeDetail}>
                        ← Back to pieces
                      </button>
                      <Picture item={piece.item} />
                      <h3 tabIndex={-1} ref={detailHeading}>
                        {piece.name}
                      </h3>
                      <p className="col-kicker">
                        {piece.achievement} · {piece.owned ? "Owned" : "Locked"}
                      </p>
                      <p>{piece.condition}</p>
                      {piece.id === "three_trading_partners" && (
                        <p>Verified distinct partners: {view.progress.partners}/3</p>
                      )}
                      {piece.id === "three_resources_exchanged" && (
                        <p>
                          Verified resources: {view.progress.resources.join(", ") || "none"} (
                          {view.progress.resources.length}/3)
                        </p>
                      )}
                      <p>
                        {piece.owned
                          ? `Recorded at game time ${piece.earnedGameTimeMs}.`
                          : "No qualifying outcome is recorded yet."}
                      </p>
                      <p>
                        {sourceLink ? (
                          <a href={sourceLink}>Inspect retained source</a>
                        ) : (
                          "Retained authorized source unavailable. Missing history is not reconstructed."
                        )}
                      </p>
                      <button
                        type="button"
                        disabled={!write || (!draft.goals.includes(piece.id) && draft.goals.length === 3)}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            goals: draft.goals.includes(piece.id)
                              ? draft.goals.filter((id) => id !== piece.id)
                              : [...draft.goals, piece.id],
                          })
                        }
                      >
                        {draft.goals.includes(piece.id) ? "Unpin goal in preview" : "Pin goal in preview"}
                      </button>
                      <p>Optional goals · at most three · no expiry.</p>
                      <button type="button" disabled={!write} onClick={saveDisplay}>
                        Save display & goals
                      </button>
                      <p>
                        Appearance only.{" "}
                        {piece.earnedGems
                          ? `Original once-only achievement grants ${piece.earnedGems} earned Gems.`
                          : "This piece grants no currency or game advantage."}
                      </p>
                    </>
                  ) : (
                    <div className="col-empty-detail">
                      <p className="col-kicker">An archive of your journey</p>
                      <h3>Every piece has a story.</h3>
                      <p>Select a piece to see its exact condition, recorded outcome and optional goal.</p>
                    </div>
                  )}
                </aside>
              </div>
            </>
          )}
          {area === "Keepsakes" && (
            <div className={`col-workbench ${selected ? "col-selected" : ""}`}>
              <div className="col-list">
                <h3>Private incidents</h3>
                <button
                  type="button"
                  disabled={!write}
                  onClick={() => {
                    setSelected("new-story");
                    setEditing(null);
                    setTitle("");
                    setAnnotation("");
                    setChosen([]);
                  }}
                >
                  Create private story
                </button>
                <p>Engine facts stay separate from your interpretation. Battle costs come before cosmetic rewards.</p>
                {view.incidents.map((i) => (
                  <button type="button" className="col-incident" key={i.id} onClick={() => setSelected(i.id)}>
                    <strong>
                      {i.kind === "battle"
                        ? "Resolved battle"
                        : (collectionPieces.find((p) => p.id === i.facts.achievementId)?.achievement ??
                          "Recorded outcome")}
                    </strong>
                    <span>Game time {i.gameTimeMs}</span>
                    {i.kind === "battle" && (
                      <span>
                        {i.facts.ownOrdinaryLosses} ordinary units lost · replacements require stock and training
                      </span>
                    )}
                  </button>
                ))}
                {!view.incidents.length && <p>No retained incidents yet. Earlier missing history stays unavailable.</p>}
                {view.stories.map((story) => (
                  <button
                    type="button"
                    className="col-incident"
                    key={story.id}
                    onClick={() => {
                      setSelected(story.id);
                      setEditing(story);
                      setTitle(story.title);
                      setAnnotation(story.annotation);
                      setChosen(story.incidentIds);
                    }}
                  >
                    <strong>{story.title || "Untitled private story"}</strong>
                    <span>Owner interpretation · version {story.version}</span>
                  </button>
                ))}
                {view.nextIncidentId && (
                  <button
                    type="button"
                    onClick={() =>
                      void request(`/v1/collections?beforeIncidentId=${view.nextIncidentId}`)
                        .then((value) =>
                          setView({
                            ...view,
                            incidents: [...view.incidents, ...(value.incidents as Incident[])],
                            nextIncidentId: value.nextIncidentId as string | null,
                          }),
                        )
                        .catch(() => setNotice("Older incidents could not be loaded."))
                    }
                  >
                    Older incidents
                  </button>
                )}
                <h3>Campaign keepsakes</h3>
                {view.instances.map((i) => (
                  <article className="col-campaign" key={i.id}>
                    <Picture item={`campaign:${i.id}`} />
                    <div>
                      <strong>Campaign medallion</strong>
                      <p>{i.pattern} · guaranteed pattern</p>
                      <p>{i.incidentId ? "Private source retained" : "Source expired; owned appearance remains."}</p>
                      <button
                        type="button"
                        disabled={!write}
                        onClick={() => {
                          setDraft({ ...draft, slots: { ...draft.slots, hall: `campaign:${i.id}` } });
                          chooseArea("Display");
                        }}
                      >
                        Preview in Hall
                      </button>
                    </div>
                  </article>
                ))}
                {view.nextInstanceId && (
                  <button
                    type="button"
                    onClick={() =>
                      void request(`/v1/collections?beforeInstanceId=${view.nextInstanceId}`)
                        .then((value) =>
                          setView({
                            ...view,
                            instances: [...view.instances, ...(value.instances as CollectionView["instances"])],
                            nextInstanceId: value.nextInstanceId as string | null,
                          }),
                        )
                        .catch(() => setNotice("Older instances could not be loaded."))
                    }
                  >
                    More campaign keepsakes
                  </button>
                )}
                {!view.instances.length && (
                  <p>No campaign instances. Declarations or Home Guard alone do not grant one.</p>
                )}
              </div>
              <aside className="col-detail">
                <button className="col-back" type="button" onClick={closeDetail}>
                  ← Back to keepsakes
                </button>
                <h3 ref={detailHeading} tabIndex={-1}>
                  {incident?.kind === "battle" ? "Battle outcome" : "Private story card"}
                </h3>
                {incident?.kind === "battle" && (
                  <>
                    <p>
                      Winner: {incident.facts.winner}; your side: {incident.facts.ownSide}.
                    </p>
                    <p>
                      Your ordinary units: {incident.facts.ownOrdinaryUnits}. Lost: {incident.facts.ownOrdinaryLosses}.
                      Replacements are not automatic or free.
                    </p>
                  </>
                )}
                {sourceLink ? (
                  <a href={sourceLink}>Inspect authorized source</a>
                ) : (
                  <p>Retained authorized source unavailable.</p>
                )}
                <h4>Your interpretation</h4>
                <p>Private notes do not establish what caused an outcome.</p>
                <label>
                  Story title
                  <input value={title} maxLength={120} disabled={!write} onChange={(e) => setTitle(e.target.value)} />
                </label>
                <label>
                  Annotation
                  <textarea
                    value={annotation}
                    maxLength={4000}
                    disabled={!write}
                    onChange={(e) => setAnnotation(e.target.value)}
                  />
                </label>
                <fieldset disabled={!write}>
                  <legend>Owned incident references (up to eight)</legend>
                  {view.incidents.map((i) => (
                    <label key={i.id}>
                      <input
                        type="checkbox"
                        checked={chosen.includes(i.id)}
                        disabled={!chosen.includes(i.id) && chosen.length === 8}
                        onChange={() =>
                          setChosen(chosen.includes(i.id) ? chosen.filter((id) => id !== i.id) : [...chosen, i.id])
                        }
                      />
                      {i.kind} · {i.gameTimeMs}
                    </label>
                  ))}
                </fieldset>
                <button
                  type="button"
                  disabled={!write || (!title && !annotation)}
                  onClick={() =>
                    void save({
                      schemaVersion: "pact.collection-command.v2",
                      kind: "story",
                      commandId: crypto.randomUUID(),
                      storyId: editing?.id ?? crypto.randomUUID(),
                      expectedVersion: editing?.version ?? 0,
                      title,
                      annotation,
                      incidentIds: chosen,
                      deleted: false,
                    })
                  }
                >
                  Save private story
                </button>
                {view.stories.map((story) => (
                  <article className="col-story" key={story.id}>
                    <h4>{story.title || "Untitled story"}</h4>
                    <p>{story.annotation}</p>
                    <button
                      type="button"
                      disabled={!write}
                      onClick={() => {
                        setEditing(story);
                        setTitle(story.title);
                        setAnnotation(story.annotation);
                        setChosen(story.incidentIds);
                      }}
                    >
                      Edit story
                    </button>
                    <button
                      type="button"
                      disabled={!write}
                      onClick={() =>
                        void save({
                          schemaVersion: "pact.collection-command.v2",
                          kind: "story",
                          commandId: crypto.randomUUID(),
                          storyId: story.id,
                          expectedVersion: story.version,
                          title: "",
                          annotation: "",
                          incidentIds: [],
                          deleted: true,
                        })
                      }
                    >
                      Clear story
                    </button>
                  </article>
                ))}
              </aside>
            </div>
          )}
          {area === "Display" && (
            <div className="col-display">
              <div>
                <h3>Choose your display</h3>
                <p>This is a local preview until you save. Current account version: {view.displayVersion}.</p>
                {(Object.keys(names) as (keyof typeof names)[]).map((slot) => (
                  <label key={slot}>
                    {names[slot]}
                    <select
                      disabled={!write}
                      value={draft.slots[slot] ?? ""}
                      onChange={(e) =>
                        setDraft({ ...draft, slots: { ...draft.slots, [slot]: e.target.value || null } })
                      }
                    >
                      <option value="">None</option>
                      {view.entitlements
                        .filter((item) =>
                          slot === "hall"
                            ? collectionPieces.some((p) => p.item === item) ||
                              collectionSets.some((s) => s.trophy === item)
                            : item.startsWith(slot === "banner" ? "banner." : slot === "frame" ? "frame." : "stamp."),
                        )
                        .map((item) => (
                          <option key={item} value={item}>
                            {collectionItemName(item)}
                          </option>
                        ))}
                      {slot === "hall" &&
                        view.instances.map((i) => (
                          <option value={`campaign:${i.id}`} key={i.id}>
                            Campaign medallion · {i.pattern}
                          </option>
                        ))}
                    </select>
                  </label>
                ))}
                <h4>Optional goals</h4>
                <p>
                  {draft.goals.map((id) => collectionPieces.find((p) => p.id === id)?.achievement).join(" · ") ||
                    "None pinned"}
                </p>
                <h4>Public appearance</h4>
                <label>
                  <input
                    type="checkbox"
                    checked={draft.publicCard.enabled}
                    disabled={!write}
                    onChange={(e) =>
                      setDraft({ ...draft, publicCard: { ...draft.publicCard, enabled: e.target.checked } })
                    }
                  />
                  Enable a public display card
                </label>
                <label>
                  Chosen public title
                  <input
                    value={draft.publicCard.title}
                    maxLength={64}
                    disabled={!write}
                    onChange={(e) => setDraft({ ...draft, publicCard: { ...draft.publicCard, title: e.target.value } })}
                  />
                </label>
                <fieldset disabled={!write}>
                  <legend>Slots to include publicly</legend>
                  {(Object.keys(names) as (keyof typeof names)[]).map((slot) => (
                    <label key={slot}>
                      <input
                        type="checkbox"
                        checked={draft.publicCard.slots.includes(slot)}
                        onChange={() =>
                          setDraft({
                            ...draft,
                            publicCard: {
                              ...draft.publicCard,
                              slots: draft.publicCard.slots.includes(slot)
                                ? draft.publicCard.slots.filter((s) => s !== slot)
                                : [...draft.publicCard.slots, slot],
                            },
                          })
                        }
                      />
                      {names[slot]}
                    </label>
                  ))}
                </fieldset>
                <p>
                  Only chosen appearances and title are public. Sources, peers, private stories and goals stay private.
                </p>
                <button type="button" disabled={!write} onClick={saveDisplay}>
                  Save display & goals
                </button>
                {view.display.publicCard.enabled && (
                  <p>
                    <a href={`?display=${encodeURIComponent(handle)}`}>Open saved public card</a>
                  </p>
                )}
              </div>
              <aside className="col-preview">
                <p className="col-kicker">Local display preview</p>
                <h3>{draft.publicCard.title || "Your Hall"}</h3>
                <div className="col-items">
                  {Object.entries(draft.slots)
                    .filter(([, item]) => item)
                    .map(([slot, item]) => (
                      <article className="col-piece" key={slot}>
                        <Picture item={item ?? ""} />
                        <strong>{collectionItemName(item ?? "")}</strong>
                        <span>{names[slot as keyof typeof names]}</span>
                      </article>
                    ))}
                </div>
                <p>No game strength, authority or agent presence comes from cosmetics.</p>
              </aside>
            </div>
          )}
          <footer className="col-footer">
            Private collection · recorded game time {view.watermark?.processed_game_time_ms ?? "unavailable"} ·
            account-bound across devices and models
          </footer>
        </>
      )}
    </section>
  );
}
