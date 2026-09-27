import { PactClientError, type SandboxAction } from "@pact/client-sdk";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createWebPactClient } from "./pact-client.js";
import { wholeResourceAmount } from "./resource-units.js";
import { confirmTelegramLink, readTelegramBootstrap } from "./telegram-link.js";

type Json = Record<string, unknown>;
type Tab = "Kingdom" | "Envoy" | "People" | "Chronicle";
type Draft = { displayName: string | null; proposedHandle: string | null; version: number };
type Party = { kingdomId: string; handle: string; displayName: string };
type Offer = Party & { id: string; version: number; terms: Json; signedBy: string[] };
type Contract = Party & { id: string; terms: Json; status: string; endGameTimeMs: string };
type SocialOverview = {
  contacts: Party[];
  requests: (Party & { id: string; direction: "incoming" | "outgoing"; note: string })[];
  messages: (Party & { id: string; senderKingdomId: string; body: string; sentGameTimeMs: string })[];
  supplyOffers: (Offer & { kingdomA: string; kingdomB: string })[];
  supplyContracts: (Contract & { kingdomA: string; kingdomB: string })[];
  garrisonOffers: (Offer & { lenderKingdomId: string; hostKingdomId: string })[];
  garrisonContracts: (Contract & { lenderKingdomId: string; hostKingdomId: string })[];
};
type OwnerView = {
  audience: "owner";
  profile: { kingdomId: string; handle: string; displayName: string };
  asOfGameTimeMs: number;
  committedTickSequence: string;
  worldStatus: string;
  balances: Record<
    string,
    {
      ordinaryUnits: string;
      foundingAllowanceUnits: string;
      lockedUnits: string;
      capacityUnits: string;
      productionPerMinuteUnits: string;
      version: string;
    }
  >;
  buildings: { kind: string; level: number }[];
  builders: {
    slot: number;
    instructionId: string | null;
    kind: string | null;
    state: string | null;
    dueGameTimeMs: number | null;
  }[];
  troops: { type: string; placement: string; count: number }[];
  training: {
    batchId: string;
    type: string;
    requestedCount: number;
    completedCount: number;
    nextUnitDueGameTimeMs: number;
    unitMinutes: number;
  }[];
  upkeep: { perMinuteUnits: string; hungry: boolean };
  contracts: { id: string; counterpartyKingdomId: string; endsGameTimeMs: number; terms: Json }[];
  threats: { kind: string; id: string; dueGameTimeMs: number }[];
  records: { kind: string; id: string; occurredAt: string }[];
  forecast: {
    throughGameTimeMs: number;
    assumption: string;
    expected: Record<string, { ordinaryUnits: string; foundingAllowanceUnits: string }>;
  };
};

function failure(error: unknown): string {
  if (error instanceof PactClientError) return error.serverCode ?? error.code;
  return error instanceof Error ? error.message : String(error);
}
function actionFailure(action: SandboxAction, error: unknown): string {
  const code = failure(error);
  if (code === "INVALID_COMMAND" && action.kind === "game.scout.start")
    return "Scout unavailable. You need two trained ordinary Spearmen (the eight founding Home Guard cannot scout), 10 Silver, 5 Grain, and a scout charge.";
  return code;
}
function units(value: string): string {
  return wholeResourceAmount(value).toLocaleString(undefined, { maximumFractionDigits: 3 });
}
function supplyTerms(terms: Json, sendA: boolean): string {
  const direction = (value: unknown): string => {
    if (!value || typeof value !== "object") return "nothing";
    const item = value as { wholePerHour?: number; resource?: string };
    return `${item.wholePerHour ?? 0} ${item.resource ?? "resource"}/h`;
  };
  return `You send ${direction(terms[sendA ? "aToB" : "bToA"])} · receive ${direction(terms[sendA ? "bToA" : "aToB"])} · ${terms.durationHours ?? "?"}h`;
}
function garrisonTerms(terms: Json): string {
  const units = Array.isArray(terms.units) ? terms.units : [];
  return `${units.map((unit: { count?: number; type?: string }) => `${unit.count ?? 0} ${unit.type ?? "troops"}`).join(", ") || "No units"} · ${terms.durationHours ?? "?"}h`;
}
function owner(value: unknown): OwnerView {
  if (!value || typeof value !== "object" || (value as Json).audience !== "owner")
    throw new Error("OWNER_VIEW_UNAVAILABLE");
  return value as OwnerView;
}

export function GameApp(): React.JSX.Element {
  const apiOrigin = useMemo(() => new URL(import.meta.env.BASE_URL, window.location.origin), []);
  const telegramBootstrap = useMemo(() => readTelegramBootstrap(window.location.search), []);
  const [csrf, setCsrf] = useState(() => sessionStorage.getItem("pact_csrf") ?? "");
  const client = useMemo(
    () =>
      createWebPactClient({
        apiOrigin: apiOrigin.toString(),
        csrfToken: () => csrf || undefined,
        fetch: window.fetch.bind(window),
      }),
    [apiOrigin, csrf],
  );
  const [auth, setAuth] = useState<"checking" | "login" | "draft" | "ready">("checking");
  const [tab, setTab] = useState<Tab>("Kingdom");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [kingdomId, setKingdomId] = useState("");
  const [view, setView] = useState<OwnerView | null>(null);
  const [social, setSocial] = useState<SocialOverview | null>(null);
  const [target, setTarget] = useState("");
  const [pendingAction, setPendingAction] = useState<{ summary: string; action: SandboxAction } | null>(null);
  const [inbox, setInbox] = useState<{ sequence: string; type: string; event: unknown }[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const request = useCallback(
    async (path: string, method = "GET", body?: unknown): Promise<Json> => {
      const response = await fetch(new URL(path.replace(/^\//, ""), apiOrigin), {
        method,
        credentials: "include",
        headers: {
          ...(body !== undefined ? { "content-type": "application/json" } : {}),
          ...(method !== "GET" && csrf ? { "x-csrf-token": csrf } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      const value = (await response.json()) as Json;
      if (!response.ok)
        throw new Error(String((value.error as { code?: string } | undefined)?.code ?? `HTTP_${response.status}`));
      return value;
    },
    [apiOrigin, csrf],
  );

  const refresh = useCallback(async () => {
    try {
      const current = await request("/v1/kingdom/me");
      const id = String(current.kingdomId);
      setKingdomId(id);
      setView(owner(await client.readKingdomView(id)));
      setAuth("ready");
      try {
        setSocial((await request("/v1/game/social")) as unknown as SocialOverview);
      } catch {
        setSocial(null);
      }
      try {
        setInbox(
          (await client.readInbox(undefined, 50)).events.map((event) => ({
            sequence: event.sequence,
            type: event.type,
            event: event.event,
          })),
        );
      } catch {
        /* The world remains playable during inbox interruptions. */
      }
    } catch (error) {
      if (failure(error) === "KINGDOM_NOT_FOUND") {
        try {
          setDraft((await request("/v1/setup/draft")) as unknown as Draft);
          setAuth("draft");
        } catch {
          setAuth("login");
        }
      } else if (["FORBIDDEN", "AUTHENTICATION_REQUIRED", "INVALID_CREDENTIALS"].includes(failure(error))) {
        setAuth("login");
      } else {
        setNotice(`World refresh failed: ${failure(error)}`);
        setAuth((current) => (current === "checking" ? "login" : current));
      }
    }
  }, [client, request]);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (auth !== "ready") return;
    const timer = window.setInterval(() => {
      void refresh();
    }, 15_000);
    const stream = new EventSource(new URL("v1/inbox/stream", apiOrigin).toString(), { withCredentials: true });
    stream.addEventListener("inbox", () => {
      void refresh();
    });
    return () => {
      clearInterval(timer);
      stream.close();
    };
  }, [auth, apiOrigin, refresh]);

  async function login(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const result = await request("/v1/auth/login", "POST", { email, password, label: "PACT Alpha web" });
      const token = String(result.csrfToken);
      sessionStorage.setItem("pact_csrf", token);
      setCsrf(token);
      setPassword("");
      setNotice("Signed in. Loading your kingdom…");
    } catch (error) {
      setNotice(`Sign-in failed: ${failure(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function found(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!draft) return;
    setBusy(true);
    setNotice("");
    try {
      const form = new FormData(event.currentTarget as HTMLFormElement);
      await request("/v1/setup/draft", "PATCH", {
        displayName: String(form.get("displayName")),
        proposedHandle: String(form.get("handle")),
        portrait: "alpha-default",
        expectedVersion: draft.version,
      });
      await client.submitCommand(client.prepareCommand({ kind: "sandbox.echo", message: "Alpha connection check" }));
      await request("/v1/setup/connection-check", "POST");
      await request("/v1/setup/activate", "POST");
      await refresh();
    } catch (error) {
      setNotice(`Founding failed: ${failure(error)}`);
      try {
        setDraft((await request("/v1/setup/draft")) as unknown as Draft);
      } catch {
        /* Show original error. */
      }
    } finally {
      setBusy(false);
    }
  }

  async function act(action: SandboxAction): Promise<void> {
    setBusy(true);
    setNotice("");
    const command = client.prepareCommand(action);
    try {
      const receipt = await client.submitCommand(command);
      setNotice(`${action.kind}: ${receipt.code} · ${receipt.commandId}`);
    } catch (error) {
      if (failure(error) === "NETWORK_UNCERTAIN") {
        const receipt = await client.reconcileReceipt(command.commandId).catch(() => null);
        setNotice(
          receipt
            ? `${action.kind}: ${receipt.code} · ${receipt.commandId}`
            : `Network uncertain. Command ${command.commandId} must be reconciled before retry.`,
        );
      } else setNotice(`${action.kind}: ${actionFailure(action, error)}`);
    } finally {
      setBusy(false);
      await refresh();
    }
  }
  function confirmAction(summary: string, action: SandboxAction): void {
    setPendingAction({ summary, action });
  }

  if (telegramBootstrap)
    return (
      <main className="game-shell auth-shell">
        <h1>Confirm Telegram link</h1>
        {telegramLinked ? (
          <p>Linked. Return to the Mini App and exchange the confirmed link.</p>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setBusy(true);
              void confirmTelegramLink(window.fetch.bind(window), apiOrigin, telegramBootstrap, { email, password })
                .then(() => {
                  setTelegramLinked(true);
                  setPassword("");
                })
                .catch((error: unknown) => setNotice(`Telegram link failed: ${failure(error)}`))
                .finally(() => setBusy(false));
            }}
          >
            <p>Sign in to the PACT account you want to use with this private Telegram chat.</p>
            <label>
              Email
              <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label>
              Password
              <input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <button type="submit" disabled={busy}>
              Sign in and confirm
            </button>
          </form>
        )}
        {notice && <p role="alert">{notice}</p>}
      </main>
    );
  if (auth === "checking")
    return (
      <main className="game-shell">
        <h1>PACT Alpha</h1>
        <p>Loading…</p>
      </main>
    );
  if (auth === "login")
    return (
      <main className="game-shell auth-shell">
        <h1>PACT Alpha</h1>
        <p>Sign in with a private test account. Manual play does not require a model provider.</p>
        <form
          onSubmit={(event) => {
            void login(event);
          }}
        >
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button type="submit" disabled={busy}>
            Sign in
          </button>
        </form>
        {notice && <p role="status">{notice}</p>}
        <Registration request={request} onNotice={setNotice} />
      </main>
    );
  if (auth === "draft")
    return (
      <main className="game-shell auth-shell">
        <h1>Found your kingdom</h1>
        <p>Your name and handle become public on entry. This private Alpha uses a test portrait.</p>
        <form
          onSubmit={(event) => {
            void found(event);
          }}
        >
          <label>
            Kingdom name
            <input name="displayName" minLength={2} maxLength={40} required defaultValue={draft?.displayName ?? ""} />
          </label>
          <label>
            Public handle
            <input name="handle" pattern="[a-z][a-z0-9_]{2,23}" required defaultValue={draft?.proposedHandle ?? ""} />
          </label>
          <button type="submit" disabled={busy}>
            Found kingdom
          </button>
        </form>
        {notice && <p role="status">{notice}</p>}
      </main>
    );
  return (
    <main className="game-shell">
      <header className="game-header">
        <div>
          <p className="eyebrow">PACT · private Alpha</p>
          <h1>{view?.profile.displayName ?? "Kingdom"}</h1>
          <p>
            @{view?.profile.handle} · {view?.worldStatus} · tick {view?.committedTickSequence}
          </p>
          <p>
            Your kingdom ID: <code>{kingdomId}</code>
          </p>
        </div>
        <div className="game-header-actions">
          <button
            type="button"
            onClick={() => {
              void refresh();
            }}
            disabled={busy}
          >
            Refresh
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setNotice("");
              setTarget("");
              setSocial(null);
              setView(null);
              setPendingAction(null);
              setAuth("login");
            }}
          >
            Switch test player
          </button>
        </div>
      </header>
      {!csrf && <p role="status">Sign in again before taking an action in this browser tab.</p>}
      <nav className="game-nav" aria-label="Game areas">
        {(["Kingdom", "Envoy", "People", "Chronicle"] as const).map((item) => (
          <button
            type="button"
            key={item}
            aria-current={tab === item ? "page" : undefined}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </nav>
      {notice && (
        <p className="game-notice" role="status">
          {notice}
        </p>
      )}
      {pendingAction && (
        <section className="game-confirm" aria-label="Confirm game action">
          <div>
            <strong>Confirm this action</strong>
            <p>{pendingAction.summary}</p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const action = pendingAction.action;
              setPendingAction(null);
              void act(action);
            }}
          >
            Confirm
          </button>
          <button type="button" className="secondary" onClick={() => setPendingAction(null)}>
            Cancel
          </button>
        </section>
      )}
      {tab === "Kingdom" && view && (
        <Kingdom
          view={view}
          busy={busy}
          act={act}
          social={social}
          kingdomId={kingdomId}
          onPeople={() => setTab("People")}
        />
      )}
      {tab === "Envoy" && (
        <Envoy
          inbox={inbox}
          request={request}
          onNotice={setNotice}
          onRefresh={refresh}
          apiOrigin={apiOrigin}
          onCsrfChange={(token) => {
            sessionStorage.setItem("pact_csrf", token);
            setCsrf(token);
          }}
        />
      )}
      {tab === "People" && (
        <People
          client={client}
          act={act}
          busy={busy}
          kingdomId={kingdomId}
          social={social}
          target={target}
          setTarget={setTarget}
          confirmAction={confirmAction}
          hallLevel={view?.buildings.find((item) => item.kind === "hall")?.level ?? 1}
        />
      )}
      {tab === "Chronicle" && view && <Chronicle view={view} client={client} inbox={inbox} social={social} />}
    </main>
  );
}

function Registration({
  request,
  onNotice,
}: {
  request: (path: string, method?: string, body?: unknown) => Promise<Json>;
  onNotice: (message: string) => void;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [legal, setLegal] = useState<Json | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [age, setAge] = useState(false);
  const [accepted, setAccepted] = useState(false);
  useEffect(() => {
    if (open)
      void request("/v1/legal/notices")
        .then(setLegal)
        .catch((error: unknown) => onNotice(failure(error)));
  }, [open, request, onNotice]);
  const documents = legal?.documents as { termsVersion?: string; termsUrl?: string; privacyUrl?: string } | undefined;
  return (
    <section className="game-card">
      <button type="button" className="secondary" onClick={() => setOpen(!open)}>
        {open ? "Hide test registration" : "Create a synthetic test account"}
      </button>
      {open && (
        <>
          <p>
            This private Alpha captures verification email on the VPS; ask the test operator for your one-time token. Do
            not use a personal email or password.
          </p>
          {legal?.registrationEnabled === false && <p role="alert">Registration is currently closed.</p>}
          {documents && (
            <p>
              Read the <a href={documents.termsUrl}>test terms</a> and{" "}
              <a href={documents.privacyUrl}>test privacy notice</a> before signing up.
            </p>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!documents?.termsVersion) return;
              void request("/v1/auth/signup", "POST", {
                email,
                password,
                age18Declared: age,
                acceptedTermsVersion: documents.termsVersion,
              })
                .then(() => {
                  setPassword("");
                  onNotice(
                    "Signup accepted. Get the captured verification token from the operator, then verify below.",
                  );
                })
                .catch((error: unknown) => onNotice(failure(error)));
            }}
          >
            <label>
              Test email
              <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label>
              Test password
              <input
                type="password"
                minLength={12}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <label>
              <input type="checkbox" checked={age} onChange={(event) => setAge(event.target.checked)} />I declare I am
              18 or older
            </label>
            <label>
              <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />I
              accept the test terms and privacy notice
            </label>
            <button
              type="submit"
              disabled={!age || !accepted || !documents?.termsVersion || legal?.registrationEnabled !== true}
            >
              Request test account
            </button>
          </form>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void request("/v1/auth/verify", "POST", { token })
                .then(() => {
                  setToken("");
                  onNotice("Verified. Sign in above.");
                })
                .catch((error: unknown) => onNotice(failure(error)));
            }}
          >
            <label>
              One-time verification token
              <input required value={token} onChange={(event) => setToken(event.target.value.trim())} />
            </label>
            <button type="submit">Verify account</button>
          </form>
        </>
      )}
    </section>
  );
}

function Kingdom({
  view,
  busy,
  act,
  social,
  kingdomId,
  onPeople,
}: {
  view: OwnerView;
  busy: boolean;
  act: (action: SandboxAction) => Promise<void>;
  social: SocialOverview | null;
  kingdomId: string;
  onPeople: () => void;
}): React.JSX.Element {
  const [building, setBuilding] = useState("farm");
  const [level, setLevel] = useState(2);
  const [slot, setSlot] = useState(1);
  const [troopType, setTroopType] = useState("spearman");
  const [troopCount, setTroopCount] = useState(1);
  return (
    <section>
      <h2>Kingdom</h2>
      <p>
        Committed {new Date(view.asOfGameTimeMs).toLocaleString()}. Resource amounts below use whole game units; the
        server decides costs and limits.
      </p>
      <div className="game-grid">
        {["iron", "silver", "grain"].map((resource) => {
          const balance = view.balances[resource];
          return (
            balance && (
              <article className="game-card" key={resource}>
                <h3>{resource}</h3>
                <strong>{units(balance.ordinaryUnits)}</strong>
                <p>
                  Founding allowance {units(balance.foundingAllowanceUnits)} · locked {units(balance.lockedUnits)}
                </p>
                <small>
                  +{units(balance.productionPerMinuteUnits)} / min · cap {units(balance.capacityUnits)} · version{" "}
                  {balance.version}
                </small>
              </article>
            )
          );
        })}
      </div>
      <article className="game-card">
        <h3>Next-hour forecast</h3>
        <ul>
          {Object.entries(view.forecast.expected).map(([resource, amount]) => (
            <li key={resource}>
              {resource}: {units(amount.ordinaryUnits)} ordinary + {units(amount.foundingAllowanceUnits)} founding
              allowance
            </li>
          ))}
        </ul>
        <details>
          <summary>What this forecast assumes</summary>
          <p>{view.forecast.assumption}</p>
          <small>Through {new Date(view.forecast.throughGameTimeMs).toLocaleString()}</small>
        </details>
      </article>
      <div className="game-grid">
        <article className="game-card">
          <h3>Buildings</h3>
          <ul>
            {view.buildings.map((item) => (
              <li key={item.kind}>
                {item.kind} {item.level}
              </li>
            ))}
          </ul>
          {view.builders.map((item) => (
            <p key={item.slot}>
              Slot {item.slot}: {item.kind ?? "free"} {item.state ?? ""}
              {item.dueGameTimeMs !== null
                ? ` · due ${new Date(item.dueGameTimeMs).toLocaleString()} game time`
                : item.state === "waiting"
                  ? " · waiting for level prerequisites, stock, authority, or a builder slot"
                  : ""}
            </p>
          ))}
          {(building === "hall" || view.builders.some((item) => item.kind === "hall" && item.state === "waiting")) && (
            <p>Hall upgrades require Farm and Barracks at the target level and Storehouse one level below it.</p>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void act({
                kind: "game.building.queue",
                building: building as "farm",
                targetLevel: level,
                slot: slot as 1 | 2,
              });
            }}
          >
            <label>
              Building
              <select value={building} onChange={(event) => setBuilding(event.target.value)}>
                {["hall", "farm", "mine", "market", "storehouse", "barracks", "wall"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              Target level
              <input
                type="number"
                min={2}
                max={6}
                value={level}
                onChange={(event) => setLevel(Number(event.target.value))}
              />
            </label>
            <label>
              Builder slot
              <select value={slot} onChange={(event) => setSlot(Number(event.target.value))}>
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
            </label>
            <button type="submit" disabled={busy}>
              Queue upgrade
            </button>
          </form>
          {view.builders
            .filter((item) => item.instructionId)
            .map((item) => (
              <button
                type="button"
                key={item.instructionId}
                className="secondary"
                disabled={busy}
                onClick={() => {
                  if (item.instructionId) void act({ kind: "game.building.cancel", instructionId: item.instructionId });
                }}
              >
                Cancel slot {item.slot}
              </button>
            ))}
        </article>
        <article className="game-card">
          <h3>Troops</h3>
          <ul>
            {view.troops.map((item) => (
              <li key={`${item.type}-${item.placement}`}>
                {item.count} {item.type} · {item.placement}
              </li>
            ))}
          </ul>
          <p>
            Upkeep {units(view.upkeep.perMinuteUnits)} Grain/min{view.upkeep.hungry ? " · hungry" : ""}
          </p>
          <p>The eight founding Home Guard defend only. Train ordinary troops before scouting, lending, or raiding.</p>
          {view.training.length > 0 && (
            <div>
              <h4>Training in progress</h4>
              {view.training.map((batch) => (
                <div className="game-list-item" key={batch.batchId}>
                  <strong>
                    {batch.completedCount} of {batch.requestedCount} {batch.type} ready
                  </strong>
                  <p>Next unit: {new Date(batch.nextUnitDueGameTimeMs).toLocaleString()} game time</p>
                  <small>One unit every {batch.unitMinutes} game minutes. The clock stops if the world pauses.</small>
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() => void act({ kind: "game.training.cancel", batchId: batch.batchId })}
                  >
                    Cancel remaining training
                  </button>
                </div>
              ))}
            </div>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void act({ kind: "game.training.queue", type: troopType as "spearman", count: troopCount });
            }}
          >
            <label>
              Type
              <select value={troopType} onChange={(event) => setTroopType(event.target.value)}>
                {["spearman", "archer", "rider", "ram"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              Count
              <input
                type="number"
                min={1}
                max={40}
                value={troopCount}
                onChange={(event) => setTroopCount(Number(event.target.value))}
              />
            </label>
            <button type="submit" disabled={busy || view.training.length > 0}>
              {view.training.length > 0 ? "Training queue occupied" : "Queue training"}
            </button>
          </form>
        </article>
      </div>
      <div className="game-grid">
        <article className="game-card">
          <h3>Contracts</h3>
          {social?.supplyContracts.filter((item) => item.status === "active").length ? (
            social.supplyContracts
              .filter((item) => item.status === "active")
              .map((item) => (
                <div className="game-list-item" key={item.id}>
                  <strong>Supply with {item.displayName}</strong>
                  <p>{supplyTerms(item.terms, item.kingdomA === kingdomId)}</p>
                  <small>Ends {new Date(Number(item.endGameTimeMs)).toLocaleString()}</small>
                </div>
              ))
          ) : (
            <p>No active contracts.</p>
          )}
          <button type="button" className="secondary" onClick={onPeople}>
            See offers and all contracts
          </button>
        </article>
        <article className="game-card">
          <h3>Threats</h3>
          {view.threats.length ? (
            view.threats.map((item) => (
              <p key={item.id}>
                {item.kind} · {item.id}
              </p>
            ))
          ) : (
            <p>No known incoming operations.</p>
          )}
        </article>
      </div>
    </section>
  );
}

function Envoy({
  inbox,
  request,
  onNotice,
  onRefresh,
  apiOrigin,
  onCsrfChange,
}: {
  inbox: { sequence: string; type: string; event: unknown }[];
  request: (path: string, method?: string, body?: unknown) => Promise<Json>;
  onNotice: (message: string) => void;
  onRefresh: () => Promise<void>;
  apiOrigin: URL;
  onCsrfChange: (token: string) => void;
}): React.JSX.Element {
  const [approvalId, setApprovalId] = useState("");
  const [review, setReview] = useState<Json | null>(null);
  const [mandate, setMandate] = useState<{
    version: number;
    allowedActions: string[];
    resourceLimits: Record<string, string>;
  } | null>(null);
  useEffect(() => {
    void request("/v1/mandate")
      .then((value) =>
        setMandate(
          value as unknown as { version: number; allowedActions: string[]; resourceLimits: Record<string, string> },
        ),
      )
      .catch((error: unknown) => onNotice(`Mandate read failed: ${failure(error)}`));
  }, [request, onNotice]);

  async function setPlaytestMandate(enabled: boolean): Promise<void> {
    if (!mandate) return;
    if (
      enabled &&
      !window.confirm(
        "Allow this kingdom's authorized agents to spend up to 500 whole units of each ordinary resource per 24 game hours, commit up to 40 troops, and initiate raids? Game stock and rules still apply.",
      )
    )
      return;
    try {
      const next = await request("/v1/mandate", "POST", {
        allowedActions: enabled
          ? [
              "world.read",
              "inbox.read",
              "message.send.contact",
              "contact.request",
              "transfer",
              "training.queue",
              "building.queue",
              "scout.start",
              "supply.sign",
              "supply.break",
              "garrison.sign",
              "garrison.break",
              "raid.commit",
            ]
          : ["world.read", "inbox.read", "message.send.contact"],
        resourceLimits: enabled
          ? { iron: "300000", silver: "300000", grain: "300000" }
          : { iron: "0", silver: "0", grain: "0" },
        reserveFloors: { grain: "12000" },
        troopLimit: enabled ? 40 : 0,
        sessionLimit: 1,
        expectedVersion: mandate.version,
      });
      setMandate(next as unknown as typeof mandate);
      onNotice(enabled ? "Agent playtest authority enabled for this kingdom." : "New agent game actions disabled.");
    } catch (error) {
      onNotice(`Mandate update failed: ${failure(error)}. Sign in again if recent authentication is required.`);
    }
  }
  async function decide(approve: boolean): Promise<void> {
    if (!review || !window.confirm(`${approve ? "Approve" : "Reject"} this exact server-rendered request?`)) return;
    try {
      const result = await request(
        `/v1/approvals/${encodeURIComponent(approvalId)}/${approve ? "approve" : "reject"}`,
        "POST",
      );
      onNotice(`${approve ? "Approved" : "Rejected"}: ${JSON.stringify(result)}`);
      setReview(null);
      await onRefresh();
    } catch (error) {
      onNotice(failure(error));
    }
  }
  return (
    <section>
      <h2>Envoy</h2>
      <p>Manual actions remain available without a model connection. Reading an approval never commits it.</p>
      <article className="game-card">
        <h3>Codex agent playtest</h3>
        <p>
          Connect this account through Codex OAuth, then start a 15-minute agent lease. Access tokens expire after 15
          minutes and the revocable connection can refresh for 30 days. Never paste a password or token into a chat.
        </p>
        <p>
          Current authority:{" "}
          {mandate?.allowedActions.includes("raid.commit") ? "bounded playtest" : "read and contact messages only"}.
        </p>
        <button type="button" disabled={!mandate} onClick={() => void setPlaytestMandate(true)}>
          Enable bounded agent playtest
        </button>{" "}
        <button type="button" className="secondary" disabled={!mandate} onClick={() => void setPlaytestMandate(false)}>
          Disable new agent game actions
        </button>
        <p>
          Only the human can change this authority or approve an exact exception. The game still enforces stock,
          charges, and locks.
        </p>
      </article>
      <article className="game-card">
        <h3>Exact approval review</h3>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void request(`/v1/approvals/${encodeURIComponent(approvalId)}`)
              .then(setReview)
              .catch((error: unknown) => onNotice(failure(error)));
          }}
        >
          <label>
            Approval ID
            <input required value={approvalId} onChange={(event) => setApprovalId(event.target.value)} />
          </label>
          <button type="submit">Preview</button>
        </form>
        {review && (
          <div>
            <pre>{JSON.stringify(review, null, 2)}</pre>
            <button
              type="button"
              onClick={() => {
                void decide(true);
              }}
            >
              Approve
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                void decide(false);
              }}
            >
              Reject
            </button>
          </div>
        )}
      </article>
      <article className="game-card">
        <h3>Inbox</h3>
        {inbox.length ? (
          <ul>
            {inbox.map((item) => (
              <li key={item.sequence}>
                {item.type} · {item.sequence}
                <details>
                  <summary>Recorded event</summary>
                  <pre>{JSON.stringify(item.event, null, 2)}</pre>
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <p>No events yet.</p>
        )}
      </article>
      <PrivacySettings request={request} onNotice={onNotice} apiOrigin={apiOrigin} onCsrfChange={onCsrfChange} />
    </section>
  );
}

function PrivacySettings({
  request,
  onNotice,
  apiOrigin,
  onCsrfChange,
}: {
  request: (path: string, method?: string, body?: unknown) => Promise<Json>;
  onNotice: (message: string) => void;
  apiOrigin: URL;
  onCsrfChange: (token: string) => void;
}): React.JSX.Element {
  const [password, setPassword] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  async function exportData(): Promise<void> {
    try {
      const result = await request("/v1/privacy/exports", "POST", { password });
      if (typeof result.csrfToken === "string") onCsrfChange(result.csrfToken);
      setDownloadUrl(
        typeof result.downloadUrl === "string"
          ? new URL(result.downloadUrl.replace(/^\//, ""), apiOrigin).toString()
          : "",
      );
      setPassword("");
      onNotice("Account export ready.");
    } catch (error) {
      onNotice(`Export failed: ${failure(error)}`);
    }
  }
  async function closeAccount(): Promise<void> {
    if (!window.confirm("Close this PACT account now? Access will be revoked immediately.")) return;
    try {
      await request("/v1/privacy/deletion", "POST", { password });
      setPassword("");
      setDownloadUrl("");
      sessionStorage.removeItem("pact_csrf");
      onNotice("Account closed. Access revoked.");
    } catch (error) {
      onNotice(`Closure failed: ${failure(error)}`);
    }
  }
  return (
    <article className="game-card">
      <h3>Privacy and account data</h3>
      <p>Export account data or close the account. Both require your current password.</p>
      <label>
        Current password
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={!password}
        onClick={() => {
          void exportData();
        }}
      >
        Prepare export
      </button>
      <button
        type="button"
        className="secondary"
        disabled={!password}
        onClick={() => {
          void closeAccount();
        }}
      >
        Close account
      </button>
      {downloadUrl && (
        <p>
          <a href={downloadUrl}>Download JSON export</a>
        </p>
      )}
    </article>
  );
}

function People({
  client,
  act,
  busy,
  kingdomId,
  social,
  target,
  setTarget,
  confirmAction,
  hallLevel,
}: {
  client: ReturnType<typeof createWebPactClient>;
  act: (action: SandboxAction) => Promise<void>;
  busy: boolean;
  kingdomId: string;
  social: SocialOverview | null;
  target: string;
  setTarget: (value: string) => void;
  confirmAction: (summary: string, action: SandboxAction) => void;
  hallLevel: number;
}): React.JSX.Element {
  const [profile, setProfile] = useState<unknown>(null);
  const [message, setMessage] = useState("");
  const [resource, setResource] = useState<"iron" | "silver" | "grain">("grain");
  const [amount, setAmount] = useState(1);
  const selected = social?.contacts.find((item) => item.kingdomId === target);
  const messages = social?.messages.filter((item) => item.kingdomId === target).reverse() ?? [];
  return (
    <section>
      <h2>People</h2>
      <p>Talk, trade, and make alliances with other kingdoms. Private details are shown only to the parties.</p>
      {!social && <p role="status">Social activity is temporarily unavailable. Your kingdom is still playable.</p>}
      <div className="game-grid">
        <article className="game-card">
          <h3>Contacts</h3>
          {social?.contacts.length ? (
            social.contacts.map((item) => (
              <button
                type="button"
                className="game-person"
                key={item.kingdomId}
                onClick={() => {
                  setTarget(item.kingdomId);
                  setProfile(null);
                }}
              >
                <strong>{item.displayName}</strong>
                <span>@{item.handle}</span>
              </button>
            ))
          ) : (
            <p>No contacts yet. Send a contact request to start talking.</p>
          )}
        </article>
        <article className="game-card">
          <h3>Contact requests</h3>
          {social?.requests.length ? (
            social.requests.map((item) => (
              <div className="game-list-item" key={item.id}>
                <strong>
                  {item.direction === "incoming" ? "From" : "To"} {item.displayName}
                </strong>
                <p>{item.note}</p>
                {item.direction === "incoming" ? (
                  <div className="game-inline-actions">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void act({ kind: "game.contact.answer", requestId: item.id, accept: true })}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy}
                      onClick={() => void act({ kind: "game.contact.answer", requestId: item.id, accept: false })}
                    >
                      Decline
                    </button>
                  </div>
                ) : (
                  <small>Awaiting response</small>
                )}
              </div>
            ))
          ) : (
            <p>No pending requests.</p>
          )}
        </article>
      </div>
      <ContractBoard social={social} kingdomId={kingdomId} busy={busy} confirmAction={confirmAction} />
      <article className="game-card">
        <h3>{selected ? `Conversation with ${selected.displayName}` : "Find a kingdom"}</h3>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void client
              .readKingdomView(target)
              .then(setProfile)
              .catch((error: unknown) => setProfile({ error: failure(error) }));
          }}
        >
          <label>
            Kingdom ID (or choose a contact above)
            <input required value={target} onChange={(event) => setTarget(event.target.value.trim())} />
          </label>
          <button type="submit">Inspect profile</button>
        </form>
        {profile !== null && <PublicProfile value={profile} />}
        {target && (
          <div className="game-messages" role="log" aria-label="Conversation">
            {messages.length ? (
              messages.map((item) => (
                <div
                  className={`game-message ${item.senderKingdomId === kingdomId ? "outgoing" : "incoming"}`}
                  key={item.id}
                >
                  <small>
                    {item.senderKingdomId === kingdomId ? "You" : item.displayName} ·{" "}
                    {new Date(Number(item.sentGameTimeMs)).toLocaleString()}
                  </small>
                  <p>{item.body}</p>
                </div>
              ))
            ) : (
              <p>No messages with this kingdom yet.</p>
            )}
          </div>
        )}
      </article>
      <div className="game-grid">
        <article className="game-card">
          <h3>Contact and message</h3>
          <label>
            Text
            <textarea maxLength={1000} value={message} onChange={(event) => setMessage(event.target.value)} />
          </label>
          <button
            type="button"
            disabled={busy || !target || !message || target === kingdomId}
            onClick={() => {
              void act({ kind: "game.contact.request", recipientKingdomId: target, note: message });
            }}
          >
            Request contact
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy || !target || !message}
            onClick={() => {
              void act({ kind: "game.message.send", recipientKingdomId: target, body: message });
            }}
          >
            Send message
          </button>
        </article>
        <article className="game-card">
          <h3>Direct transfer</h3>
          <p>Review the recipient and amount. Server rules enforce available stock.</p>
          <label>
            Resource
            <select value={resource} onChange={(event) => setResource(event.target.value as typeof resource)}>
              {["grain", "iron", "silver"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Whole amount
            <input type="number" min={1} value={amount} onChange={(event) => setAmount(Number(event.target.value))} />
          </label>
          <button
            type="button"
            disabled={busy || !target || target === kingdomId}
            onClick={() => {
              confirmAction(`Transfer ${amount} ${resource} to ${selected?.displayName ?? target}?`, {
                kind: "game.transfer",
                recipientKingdomId: target,
                resource,
                wholeAmount: amount,
              });
            }}
          >
            Transfer
          </button>
        </article>
      </div>
      <DiplomacyForms target={target} busy={busy} act={act} confirmAction={confirmAction} hallLevel={hallLevel} />
    </section>
  );
}

function PublicProfile({ value }: { value: unknown }): React.JSX.Element {
  if (!value || typeof value !== "object") return <p>Profile unavailable.</p>;
  const result = value as { profile?: { displayName?: string; handle?: string }; worldStatus?: string; error?: string };
  if (result.error) return <p role="alert">{result.error}</p>;
  return (
    <p className="game-profile">
      <strong>{result.profile?.displayName ?? "Kingdom"}</strong> · @{result.profile?.handle ?? "unknown"} ·{" "}
      {result.worldStatus ?? "in the world"}
    </p>
  );
}

function ContractBoard({
  social,
  kingdomId,
  busy,
  confirmAction,
}: {
  social: SocialOverview | null;
  kingdomId: string;
  busy: boolean;
  confirmAction: (summary: string, action: SandboxAction) => void;
}): React.JSX.Element {
  return (
    <section className="game-section">
      <h2>Offers & contracts</h2>
      <p>Review the exact terms before signing. A contract activates only when both kingdoms sign the same version.</p>
      <div className="game-grid">
        <article className="game-card">
          <h3>Supply offers</h3>
          {social?.supplyOffers.length ? (
            social.supplyOffers.map((item) => (
              <div className="game-list-item" key={item.id}>
                <strong>{item.displayName}</strong>
                <p>{supplyTerms(item.terms, item.kingdomA === kingdomId)}</p>
                <small>
                  Version {item.version} · {item.signedBy.includes(kingdomId) ? "You signed" : "Your signature needed"}
                </small>
                {!item.signedBy.includes(kingdomId) && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      confirmAction(
                        `Sign supply offer from ${item.displayName}: ${supplyTerms(item.terms, item.kingdomA === kingdomId)}?`,
                        { kind: "game.supply.sign", offerId: item.id, version: item.version },
                      )
                    }
                  >
                    Sign offer
                  </button>
                )}
              </div>
            ))
          ) : (
            <p>No open supply offers.</p>
          )}
        </article>
        <article className="game-card">
          <h3>Supply contracts</h3>
          {social?.supplyContracts.length ? (
            social.supplyContracts.map((item) => (
              <div className="game-list-item" key={item.id}>
                <strong>
                  {item.displayName} · {item.status}
                </strong>
                <p>{supplyTerms(item.terms, item.kingdomA === kingdomId)}</p>
                <small>Ends {new Date(Number(item.endGameTimeMs)).toLocaleString()}</small>
              </div>
            ))
          ) : (
            <p>No supply contracts yet.</p>
          )}
        </article>
        <article className="game-card">
          <h3>Garrison offers</h3>
          {social?.garrisonOffers.length ? (
            social.garrisonOffers.map((item) => (
              <div className="game-list-item" key={item.id}>
                <strong>{item.displayName}</strong>
                <p>{garrisonTerms(item.terms)}</p>
                <small>
                  Version {item.version} · {item.signedBy.includes(kingdomId) ? "You signed" : "Your signature needed"}
                </small>
                {!item.signedBy.includes(kingdomId) && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      confirmAction(`Sign garrison offer with ${item.displayName}: ${garrisonTerms(item.terms)}?`, {
                        kind: "game.garrison.sign",
                        offerId: item.id,
                        version: item.version,
                      })
                    }
                  >
                    Sign offer
                  </button>
                )}
              </div>
            ))
          ) : (
            <p>No open garrison offers.</p>
          )}
        </article>
        <article className="game-card">
          <h3>Garrison contracts</h3>
          {social?.garrisonContracts.length ? (
            social.garrisonContracts.map((item) => (
              <div className="game-list-item" key={item.id}>
                <strong>
                  {item.displayName} · {item.status}
                </strong>
                <p>{garrisonTerms(item.terms)}</p>
                <small>Ends {new Date(Number(item.endGameTimeMs)).toLocaleString()}</small>
              </div>
            ))
          ) : (
            <p>No garrison contracts yet.</p>
          )}
        </article>
      </div>
    </section>
  );
}

function DiplomacyForms({
  target,
  busy,
  act,
  confirmAction,
  hallLevel,
}: {
  target: string;
  busy: boolean;
  act: (action: SandboxAction) => Promise<void>;
  confirmAction: (summary: string, action: SandboxAction) => void;
  hallLevel: number;
}): React.JSX.Element {
  const [sendResource, setSendResource] = useState<"iron" | "silver" | "grain">("grain");
  const [receiveResource, setReceiveResource] = useState<"iron" | "silver" | "grain">("silver");
  const [sendRate, setSendRate] = useState(0);
  const [receiveRate, setReceiveRate] = useState(0);
  const [duration, setDuration] = useState<1 | 6 | 24 | 72>(6);
  const [noticeHours, setNoticeHours] = useState<0 | 1 | 6>(0);
  const [troopType, setTroopType] = useState<"spearman" | "archer" | "rider" | "ram">("spearman");
  const [troopCount, setTroopCount] = useState(1);
  const [raidId, setRaidId] = useState("");
  const [garrisonDuration, setGarrisonDuration] = useState<1 | 6 | 24>(6);
  const resourceOptions = ["grain", "iron", "silver"] as const;
  const terms = {
    aToB: sendRate > 0 ? { resource: sendResource, wholePerHour: sendRate } : null,
    bToA: receiveRate > 0 ? { resource: receiveResource, wholePerHour: receiveRate } : null,
    aBond: null,
    bBond: null,
    durationHours: duration,
    noticeHours,
  };
  const selectedUnits = [{ type: troopType, count: troopCount }];
  return (
    <div className="game-grid game-actions-grid">
      <article className="game-card">
        <h3>Create a supply offer</h3>
        <p>
          For a new offer, you send A→B and receive B→A each game hour. No bond in this Alpha sheet. The other player
          can review and sign it in Offers & contracts above.
        </p>
        <label>
          You send
          <select value={sendResource} onChange={(event) => setSendResource(event.target.value as typeof sendResource)}>
            {resourceOptions.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          Whole per hour
          <input type="number" min={0} value={sendRate} onChange={(event) => setSendRate(Number(event.target.value))} />
        </label>
        <label>
          You receive
          <select
            value={receiveResource}
            onChange={(event) => setReceiveResource(event.target.value as typeof receiveResource)}
          >
            {resourceOptions.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          Whole per hour
          <input
            type="number"
            min={0}
            value={receiveRate}
            onChange={(event) => setReceiveRate(Number(event.target.value))}
          />
        </label>
        <label>
          Duration hours
          <select value={duration} onChange={(event) => setDuration(Number(event.target.value) as typeof duration)}>
            {[1, 6, 24, 72].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          Notice hours
          <select
            value={noticeHours}
            onChange={(event) => setNoticeHours(Number(event.target.value) as typeof noticeHours)}
          >
            {[0, 1, 6].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={busy || !target || (!sendRate && !receiveRate)}
          onClick={() => {
            confirmAction(
              `Offer to ${target}: send ${sendRate} ${sendResource}/h, receive ${receiveRate} ${receiveResource}/h for ${duration}h?`,
              { kind: "game.supply.offer", counterpartyKingdomId: target, terms },
            );
          }}
        >
          Offer supply terms
        </button>
      </article>
      <article className="game-card">
        <h3>Scout</h3>
        <p>
          Requires two trained ordinary Spearmen (not founding Home Guard), 10 Silver, 5 Grain, and one scout charge.
          They return after ten game minutes.
        </p>
        <button
          type="button"
          disabled={busy || !target}
          onClick={() => {
            confirmAction(`Scout kingdom ${target}? This spends resources and a charge.`, {
              kind: "game.scout.start",
              targetKingdomId: target,
            });
          }}
        >
          Start scout
        </button>
        <h3>Garrison lending</h3>
        <p>
          Lending requires Hall level 3 and ordinary (non-Home Guard) troops. Lend the selected units for a fixed
          duration, with no bond in this Alpha sheet.
        </p>
        <label>
          Troop type
          <select value={troopType} onChange={(event) => setTroopType(event.target.value as typeof troopType)}>
            {["spearman", "archer", "rider", "ram"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          Count
          <input
            type="number"
            min={1}
            max={40}
            value={troopCount}
            onChange={(event) => setTroopCount(Number(event.target.value))}
          />
        </label>
        <label>
          Duration hours
          <select
            value={garrisonDuration}
            onChange={(event) => setGarrisonDuration(Number(event.target.value) as typeof garrisonDuration)}
          >
            {[1, 6, 24].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={busy || !target || hallLevel < 3}
          onClick={() => {
            confirmAction(`Offer ${troopCount} ${troopType} to ${target} for ${garrisonDuration}h?`, {
              kind: "game.garrison.offer",
              hostKingdomId: target,
              terms: { units: selectedUnits, durationHours: garrisonDuration, lenderBond: null, hostBond: null },
            });
          }}
        >
          Offer garrison
        </button>
      </article>
      <article className="game-card">
        <h3>Raid</h3>
        <p>
          Raids require at least eight trained ordinary troops; founding Home Guard cannot attack. The server determines
          locks, combat, losses, and loot.
        </p>
        <button
          type="button"
          disabled={busy || !target || troopCount < 8}
          onClick={() => {
            confirmAction(`Declare raid on ${target} with ${troopCount} ${troopType}? This can cause losses.`, {
              kind: "game.raid.declare",
              targetKingdomId: target,
              units: selectedUnits,
            });
          }}
        >
          Declare raid
        </button>
        <label>
          Raid ID
          <input value={raidId} onChange={(event) => setRaidId(event.target.value.trim())} />
        </label>
        <button
          type="button"
          className="secondary"
          disabled={busy || !raidId}
          onClick={() => {
            void act({ kind: "game.raid.accept", raidId, units: selectedUnits });
          }}
        >
          Join nominated raid
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy || !raidId}
          onClick={() => {
            void act({ kind: "game.raid.withdraw", raidId });
          }}
        >
          Withdraw raid
        </button>
      </article>
    </div>
  );
}

function Chronicle({
  view,
  client,
  inbox,
  social,
}: {
  view: OwnerView;
  client: ReturnType<typeof createWebPactClient>;
  inbox: { sequence: string; type: string; event: unknown }[];
  social: SocialOverview | null;
}): React.JSX.Element {
  const [report, setReport] = useState<unknown>(null);
  const [reportId, setReportId] = useState("");
  const [reportKind, setReportKind] = useState<"scout" | "raid_participant" | "raid_public">("scout");
  return (
    <section>
      <h2>Chronicle</h2>
      <p>Committed records and authorized private reports.</p>
      <article className="game-card">
        <h3>Records</h3>
        {view.records.length ? (
          <ul>
            {view.records.map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                {item.kind} · {item.occurredAt} · <code>{item.id}</code>
              </li>
            ))}
          </ul>
        ) : (
          <p>No records yet.</p>
        )}
      </article>
      <article className="game-card">
        <h3>Open a report</h3>
        <p>Use a scout operation or raid ID from a receipt or inbox event. Event IDs above are not report IDs.</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void client
              .readReport(reportKind, reportId)
              .then(setReport)
              .catch((error: unknown) => setReport({ error: failure(error) }));
          }}
        >
          <label>
            Report type
            <select value={reportKind} onChange={(event) => setReportKind(event.target.value as typeof reportKind)}>
              <option value="scout">Scout</option>
              <option value="raid_participant">Raid participant</option>
              <option value="raid_public">Raid public</option>
            </select>
          </label>
          <label>
            Operation or raid ID
            <input required value={reportId} onChange={(event) => setReportId(event.target.value.trim())} />
          </label>
          <button type="submit">Read report</button>
        </form>
      </article>
      {report !== null && (
        <article className="game-card">
          <h3>Report</h3>
          <GameReport value={report} social={social} />
        </article>
      )}
      <p>{inbox.length} recent inbox events. Open Envoy for details.</p>
    </section>
  );
}

function GameReport({ value, social }: { value: unknown; social: SocialOverview | null }): React.JSX.Element {
  if (!value || typeof value !== "object") return <p>Report unavailable.</p>;
  const item = value as Json;
  if (item.error) return <p role="status">Report not available yet, or not visible to this kingdom.</p>;
  if (item.kind !== "engine_report") return <pre>{JSON.stringify(value, null, 2)}</pre>;
  const targetId = String(item.targetKingdomId ?? "");
  const targetName = social?.contacts.find((contact) => contact.kingdomId === targetId)?.displayName ?? targetId;
  const stock = item.ordinaryStock as Record<string, string> | undefined;
  const troops = item.homeTroops as Record<string, string> | undefined;
  return (
    <div className="game-report">
      <p>
        Scouted <strong>{targetName}</strong> at {new Date(Number(item.observedGameTimeMs)).toLocaleString()}.
        {item.staleAfterObservation ? " This is a snapshot; the kingdom may have changed since then." : ""}
      </p>
      <div className="game-grid">
        <section className="game-report-card">
          <h4>Defenses</h4>
          <p>Wall level {String(item.wallLevel ?? "unknown")}</p>
        </section>
        <section className="game-report-card">
          <h4>Home troops</h4>
          <ul>
            {Object.entries(troops ?? {}).map(([type, band]) => (
              <li key={type}>
                {type}: {band}
              </li>
            ))}
          </ul>
        </section>
        <section className="game-report-card">
          <h4>Ordinary stores</h4>
          <ul>
            {Object.entries(stock ?? {}).map(([resource, band]) => (
              <li key={resource}>
                {resource}: {band}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
