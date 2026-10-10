import { PactClientError, type SandboxAction } from "@pact/client-sdk";
import { wholeUnitText } from "@pact/domain/resource-facts";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccountAccess, PasswordRecovery } from "./account-access.js";
import { type Ambition, AmbitionChoice } from "./ambition.js";
import { ApprovalReview } from "./approval-review.js";
import { ChroniclePanel } from "./chronicle-panel.js";
import { pactBaseUrl } from "./client-location.js";
import { CodexConnection } from "./codex-connection.js";
import { Consequences, type ConsequenceView } from "./consequences.js";
import { ConversationWorkspace } from "./conversation-workspace.js";
import { CourtPanel } from "./court-panel.js";
import { developmentChoices } from "./development-choices.js";
import { EvidencePanel } from "./evidence-panel.js";
import { clearExperiencePreferences, type ExperienceAudio } from "./experience-audio.js";
import { ExperienceControls } from "./experience-controls.js";
import { FirstSession } from "./first-session.js";
import { FriendsLobby } from "./friends-lobby.js";
import { linkedGameTab } from "./game-navigation.js";
import { remainingGameTime } from "./game-time.js";
import { GuestEntry } from "./guest-entry.js";
import { HallKeepsakes } from "./hall-keepsakes.js";
import { InvitationPanel } from "./invitation-panel.js";
import { KingdomScene } from "./kingdom-scene.js";
import { LiveConnection, liveFetch } from "./live-connection.js";
import { ModerationPanel, ReportControl, ReportingContext } from "./moderation-panel.js";
import { NotificationSettings } from "./notification-settings.js";
import { OutcomeCards } from "./outcome-cards.js";
import { createWebPactClient } from "./pact-client.js";
import { PoliticsPanel } from "./politics-panel.js";
import { BuilderStatus, QuickBuilds } from "./quick-builds.js";
import { RefreshGate } from "./refresh-gate.js";
import { type ReportKind, type ReportRead, ReportReader } from "./report-reader.js";
import { RunPanel } from "./run-panel.js";
import { SeasonPanel } from "./season-panel.js";
import { SessionDevices } from "./session-devices.js";
import { OutgoingContactHistory } from "./social-freshness.js";
import { confirmTelegramLink, readTelegramBootstrap } from "./telegram-link.js";
import { readWebResponse } from "./web-response.js";

type Json = Record<string, unknown>;
type Tab = "Kingdom" | "Envoy" | "People" | "Chronicle";
type Draft = { displayName: string | null; proposedHandle: string | null; version: number };
type Party = { kingdomId: string; handle: string; displayName: string };
type Offer = Party & { id: string; version: number; terms: Json; signedBy: string[] };
type Contract = Party & { id: string; terms: Json; status: string; endGameTimeMs: string };
type SocialOverview = {
  requestHistory?: { id: string; status: string; handle: string; expiresGameTimeMs: string }[];
  contacts: Party[];
  requests: (Party & { id: string; direction: "incoming" | "outgoing"; note: string; expiresGameTimeMs: string })[];
  messages: (Party & { id: string; senderKingdomId: string; body: string; sentGameTimeMs: string })[];
  supplyOffers: (Offer & { kingdomA: string; kingdomB: string })[];
  supplyContracts: (Contract & { kingdomA: string; kingdomB: string })[];
  garrisonOffers: (Offer & { lenderKingdomId: string; hostKingdomId: string })[];
  garrisonContracts: (Contract & { lenderKingdomId: string; hostKingdomId: string })[];
};
export type OwnerView = {
  ambition?: Ambition;
  consequences?: ConsequenceView;
  audience: "owner";
  profile: { kingdomId: string; handle: string; displayName: string };
  asOfGameTimeMs: number;
  committedTickSequence: string;
  worldStatus: string;
  charges?: {
    kind: "scout" | "raid";
    available: number;
    capacity: number;
    regenerationHours: number;
    nextRegenerationGameTimeMs: number | null;
    retryAtGameTimeMs: number | null;
  }[];
  balances: Record<
    string,
    {
      ordinaryUnits: string;
      foundingAllowanceUnits: string;
      lockedUnits: string;
      capacityUnits: string;
      productionPerMinuteUnits: string;
      facts?: {
        ordinaryWhole: string;
        allowanceWhole: string;
        lockedWhole: string;
        capacityWhole: string;
        rates: { gross: { label: string }; upkeep: { label: string }; net: { label: string }; excludes: string };
      };
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
  troops: { type: string; placement: string; homeGuard: boolean; count: number }[];
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
  raids: {
    raidId: string;
    status: string;
    side: string;
    role?: "leader" | "contributor" | "defender";
    otherKingdomId: string;
    lockGameTimeMs?: number;
    dueGameTimeMs: number;
  }[];
  scouts: { operationId: string; status: "active" | "completed"; targetKingdomId: string; dueGameTimeMs: number }[];
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
  if (error instanceof Error && /^HTTP_5\d\d$/.test(error.message))
    return `Game server temporarily unavailable (${error.message.replace("HTTP_", "HTTP ")}). Try again shortly.`;
  return error instanceof Error ? error.message : String(error);
}
function actionCodeMessage(action: SandboxAction, code: string): string {
  if (code === "WORLD_PAUSED")
    return "WORLD_PAUSED · The world is paused or a tick is pending. This action did not commit. Refresh the game state before deciding whether to retry.";
  if (code === "RATE_LIMITED")
    return "RATE_LIMITED · A shared action limit or charge pool is exhausted. Check your charges and game-time deadline; switching clients does not refill them.";
  if (code === "EXPIRED" && action.kind === "game.raid.withdraw")
    return "EXPIRED · The withdrawal window is closed. A raid cannot be withdrawn at or after its battle lock; refresh Chronicle for the committed operation state.";
  if (code === "INVALID_COMMAND" && action.kind === "game.scout.start")
    return "Scout unavailable. You need two trained ordinary Spearmen (founding Home Guard cannot scout), 10 Silver, 5 Grain, and a scout charge.";
  return code;
}
function actionFailure(action: SandboxAction, error: unknown): string {
  return actionCodeMessage(action, failure(error));
}
export function actionReceiptNotice(action: SandboxAction, receipt: { code: string; commandId: string }): string {
  return `${action.kind}: ${actionCodeMessage(action, receipt.code)} · ${receipt.commandId}`;
}
function units(value: string): string {
  return wholeUnitText(value);
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
  const bond = (value: unknown): string => {
    if (!value || typeof value !== "object") return "none";
    const item = value as { wholeAmount?: number; resource?: string };
    return `${item.wholeAmount ?? "?"} ${item.resource ?? "resource"}`;
  };
  return `${units.map((unit: { count?: number; type?: string }) => `${unit.count ?? 0} ${unit.type ?? "troops"}`).join(", ") || "No units"} · ${terms.durationHours ?? "?"}h · host pays troop upkeep · lender bond ${bond(terms.lenderBond)} · host bond ${bond(terms.hostBond)}`;
}
function owner(value: unknown): OwnerView {
  if (!value || typeof value !== "object" || (value as Json).audience !== "owner")
    throw new Error("OWNER_VIEW_UNAVAILABLE");
  return value as OwnerView;
}

export interface GameHost {
  readonly csrfToken: string;
  readonly onAuthenticationRequired: () => void;
  readonly openAccount: () => void;
  readonly onTabChange: (tab: Tab) => void;
  readonly subscribeBack: (callback: () => void) => () => void;
}
export function GameApp({ host }: { host?: GameHost } = {}): React.JSX.Element {
  const [experienceAudio, setExperienceAudio] = useState<ExperienceAudio | null>(null);
  const apiOrigin = useMemo(() => new URL(pactBaseUrl(), window.location.origin), []);
  const telegramBootstrap = useMemo(() => readTelegramBootstrap(window.location.search), []);
  const connection = useMemo(() => new LiveConnection(navigator.onLine), []);
  const [connectionStatus, setConnectionStatus] = useState(connection.status);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);
  const confirmation = useRef<HTMLElement | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const send = useMemo(
    () =>
      liveFetch(
        async (input, init) => {
          const response = await window.fetch(input, init);
          if (host && response.status === 403) {
            // A scoped permission refusal is different from an expired channel session.
            const session = await window.fetch(new URL("v1/auth/connections", apiOrigin), { credentials: "include" });
            if (session.status === 403) host.onAuthenticationRequired();
          }
          return response;
        },
        connection,
        () => {
          setConnectionStatus(connection.status);
          setPendingAction(null);
        },
      ),
    [connection, host, apiOrigin],
  );
  const [csrf, setCsrf] = useState(() => host?.csrfToken ?? sessionStorage.getItem("pact_csrf") ?? "");
  const client = useMemo(
    () =>
      createWebPactClient({
        apiOrigin: apiOrigin.toString(),
        csrfToken: () => csrf || undefined,
        fetch: send,
      }),
    [apiOrigin, csrf, send],
  );
  const [guestMode, setGuestMode] = useState<boolean | null>(host ? false : null);
  const [guestPlayer, setGuestPlayer] = useState(false);
  const [passwordEntry, setPasswordEntry] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [councilOpen, setCouncilOpen] = useState(() => linkedGameTab(window.location.search) === null && !host);
  useEffect(() => {
    if (host) return;
    void Promise.all([
      fetch(new URL("v1/play", apiOrigin), { credentials: "include" }).then((r) => r.json()),
      fetch(new URL("v1/auth/session", apiOrigin), { credentials: "include" }).then(async (r) =>
        r.ok ? r.json() : null,
      ),
    ])
      .then(([play, session]) => {
        setGuestMode(play.enabled === true);
        setGuestPlayer(session?.guest === true);
        if (session?.csrfToken) {
          sessionStorage.setItem("pact_csrf", session.csrfToken);
          setCsrf(session.csrfToken);
        } else {
          sessionStorage.removeItem("pact_csrf");
          setCsrf("");
        }
        if (session && !session.guest) {
          localStorage.removeItem("pact_guest_entry");
          localStorage.removeItem("pact_guest_pending_rotation");
          localStorage.removeItem("pact_guest_name");
        }
      })
      .catch(() => setGuestMode(false));
  }, [host, apiOrigin]);
  const [auth, setAuth] = useState<"checking" | "login" | "draft" | "ready">("checking");
  const [tab, setTab] = useState<Tab>(() => linkedGameTab(window.location.search) ?? "Kingdom");
  useEffect(() => {
    host?.onTabChange(tab);
  }, [host, tab]);
  useEffect(
    () =>
      host?.subscribeBack(() => {
        setPendingAction(null);
        setTab("Kingdom");
      }),
    [host],
  );
  useEffect(() => {
    if (auth === "login" && host) host.onAuthenticationRequired();
  }, [auth, host]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [kingdomId, setKingdomId] = useState("");
  const [view, setView] = useState<OwnerView | null>(null);
  const [decisions, setDecisions] = useState<{
    kingdomId: string;
    approvals: { approvalId: string; status: string; deepLinkPath: string }[];
    failure?: { code: string; commandId?: string };
  } | null>(null);
  const [localFailure, setLocalFailure] = useState<{ code: string; commandId?: string } | null>(null);
  const [social, setSocial] = useState<SocialOverview | null>(null);
  const [target, setTarget] = useState("");
  const [pendingAction, setPendingAction] = useState<{ summary: string; action: SandboxAction } | null>(null);
  const [inbox, setInbox] = useState<{ sequence: string; type: string; event: unknown }[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [notice, setNotice] = useState("");
  const [refreshFailure, setRefreshFailure] = useState("");
  const refreshGate = useRef(new RefreshGate());
  const visibleKingdom = useRef("");
  const [busy, setBusy] = useState(false);

  const request = useCallback(
    async (path: string, method = "GET", body?: unknown): Promise<Json> => {
      const response = await send(new URL(path.replace(/^\//, ""), apiOrigin), {
        method,
        credentials: "include",
        headers: {
          ...(body !== undefined ? { "content-type": "application/json" } : {}),
          ...(method !== "GET" && csrf ? { "x-csrf-token": csrf } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      return readWebResponse(response);
    },
    [apiOrigin, csrf, send],
  );

  const refresh = useCallback(async () => {
    const gate = refreshGate.current;
    const ticket = gate.begin();
    if (ticket === null) return;
    const connectionRevision = connection.beginRefresh();
    try {
      const current = await request("/v1/kingdom/me");
      if (!gate.isCurrent(ticket)) return;
      const id = String(current.kingdomId);
      if (visibleKingdom.current && visibleKingdom.current !== id) {
        gate.pause();
        setTarget("");
        setPendingAction(null);
        setSocial(null);
        setInbox([]);
        setView(null);
        setDecisions(null);
        setLocalFailure(null);
        setKingdomId("");
        setDraft(null);
        clearExperiencePreferences(localStorage);
        sessionStorage.removeItem("pact_csrf");
        setCsrf("");
        setLastRefreshed(null);
        setRefreshFailure("");
        setNotice("Player changed in another tab. Sign in again before taking an action.");
        setAuth("login");
        return;
      }
      const nextView = owner(await client.readKingdomView(id));
      if (!gate.isCurrent(ticket)) return;
      visibleKingdom.current = id;
      setKingdomId(id);
      setView(nextView);
      setAuth("ready");
      setRefreshFailure("");
      if (connection.confirmRefresh(connectionRevision)) {
        setConnectionStatus(connection.status);
        setLastRefreshed(new Date().toLocaleTimeString());
      }
      setNotice((current) => (current === "Signed in. Loading your kingdom…" ? "" : current));
      try {
        const nextSocial = (await request("/v1/game/social")) as unknown as SocialOverview;
        if (!gate.isCurrent(ticket)) return;
        setSocial(nextSocial);
      } catch {
        if (!gate.isCurrent(ticket)) return;
        setSocial(null);
      }
      try {
        const [pending, activity] = await Promise.all([
          request("/v1/approvals"),
          request("/v1/runs/external-activity"),
        ]);
        if (!gate.isCurrent(ticket)) return;
        const entries = Array.isArray(activity.entries)
          ? (activity.entries as { category: string; code: string; commandId?: string }[])
          : [];
        const latest = entries.at(-1);
        setDecisions({
          kingdomId: id,
          approvals: pending.approvals as { approvalId: string; status: string; deepLinkPath: string }[],
          ...(latest?.category === "failed"
            ? { failure: { code: latest.code, ...(latest.commandId ? { commandId: latest.commandId } : {}) } }
            : {}),
        });
      } catch {
        if (gate.isCurrent(ticket)) setDecisions(null);
      }
      try {
        const nextInbox = await client.readInbox(undefined, 50);
        if (!gate.isCurrent(ticket)) return;
        setInbox(
          nextInbox.events.map((event) => ({
            sequence: event.sequence,
            type: event.type,
            event: event.event,
          })),
        );
      } catch {
        /* The world remains playable during inbox interruptions. */
      }
    } catch (error) {
      if (!gate.isCurrent(ticket)) return;
      if (failure(error) === "KINGDOM_NOT_FOUND") {
        try {
          const nextDraft = (await request("/v1/setup/draft")) as unknown as Draft;
          if (!gate.isCurrent(ticket)) return;
          setDraft(nextDraft);
          setAuth("draft");
          if (connection.confirmRefresh(connectionRevision)) setConnectionStatus(connection.status);
        } catch {
          if (!gate.isCurrent(ticket)) return;
          setAuth("login");
        }
      } else if (["FORBIDDEN", "AUTHENTICATION_REQUIRED", "INVALID_CREDENTIALS"].includes(failure(error))) {
        clearExperiencePreferences(localStorage);
        setAuth("login");
        if (connection.confirmRefresh(connectionRevision)) setConnectionStatus(connection.status);
      } else {
        connection.invalidate();
        setConnectionStatus(connection.status);
        setPendingAction(null);
        setRefreshFailure(`World refresh failed: ${failure(error)}`);
        setAuth((current) => (current === "checking" ? "login" : current));
      }
    } finally {
      gate.finish(ticket);
    }
  }, [client, request, connection]);

  useEffect(() => {
    const changed = () => {
      connection.invalidate(navigator.onLine);
      setConnectionStatus(connection.status);
      setPendingAction(null);
      refreshGate.current.invalidate();
      if (navigator.onLine) void refresh();
    };
    window.addEventListener("offline", changed);
    window.addEventListener("online", changed);
    return () => {
      window.removeEventListener("offline", changed);
      window.removeEventListener("online", changed);
    };
  }, [connection, refresh]);

  useEffect(() => {
    if (pendingAction) confirmation.current?.focus();
  }, [pendingAction]);

  useEffect(() => {
    if (guestMode !== null) void refresh();
    return () => refreshGate.current.invalidate();
  }, [refresh, guestMode]);
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

  async function login(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const mfaCode = String(new FormData(event.currentTarget).get("mfaCode") ?? "").trim();
      const result = await request("/v1/auth/login", "POST", {
        email,
        password,
        label: "PACT Alpha web",
        ...(mfaCode ? { mfaCode } : {}),
      });
      refreshGate.current.invalidate();
      refreshGate.current.resume();
      visibleKingdom.current = "";
      setLastRefreshed(null);
      setTarget("");
      setPendingAction(null);
      setView(null);
      setDecisions(null);
      setLocalFailure(null);
      setSocial(null);
      setInbox([]);
      setKingdomId("");
      setDraft(null);
      setRefreshFailure("");
      const token = String(result.csrfToken);
      sessionStorage.setItem("pact_csrf", token);
      setCsrf(token);
      setPassword("");
      setGuestPlayer(false);
      localStorage.removeItem("pact_guest_entry");
      localStorage.removeItem("pact_guest_name");
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

  async function queueSuggested(building: string, level: number) {
    if (!view || !connection.writable) return;
    try {
      const fresh = owner(await client.readKingdomView(view.profile.kingdomId));
      const free = fresh.builders.find((b) => !b.instructionId);
      const built = fresh.buildings.find((b) => b.kind === building);
      if (
        !free ||
        !built ||
        built.level + 1 !== level ||
        fresh.builders.some((b) => b.kind === building && b.instructionId)
      ) {
        setNotice("Your builders changed. Review the refreshed choices.");
        await refresh();
        return;
      }
      await act({
        kind: "game.building.queue",
        building: building as "farm",
        targetLevel: level,
        slot: free.slot as 1 | 2,
      });
    } catch {
      setNotice("Could not check your builders. Refresh and try again.");
    }
  }
  async function act(action: SandboxAction): Promise<void> {
    if (!connection.writable) {
      setNotice("Refresh live state before deciding again. No action was queued.");
      return;
    }
    setBusy(true);
    setNotice("");
    const command = client.prepareCommand(action);
    try {
      const receipt = await client.submitCommand(command);
      setNotice(actionReceiptNotice(action, receipt));
      setLocalFailure(
        ["COMMITTED", "ALREADY_COMMITTED"].includes(receipt.code)
          ? null
          : { code: receipt.code, commandId: receipt.commandId },
      );
    } catch (error) {
      setLocalFailure({ code: failure(error), commandId: command.commandId });
      if (failure(error) === "NETWORK_UNCERTAIN") {
        const receipt = await client.reconcileReceipt(command.commandId).catch(() => null);
        setNotice(
          receipt
            ? actionReceiptNotice(action, receipt)
            : `Network uncertain. Command ${command.commandId} must be reconciled before retry.`,
        );
      } else setNotice(`${action.kind}: ${actionFailure(action, error)}`);
    } finally {
      setBusy(false);
      await refresh();
    }
  }
  function confirmAction(summary: string, action: SandboxAction): void {
    if (!connection.writable) return;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPendingAction({ summary, action });
  }
  const canWrite = Boolean(csrf) && !busy && connectionStatus === "live";
  const connectionNotice = (
    <ConnectionNotice status={connectionStatus} lastRefreshed={lastRefreshed} onRefresh={() => void refresh()} />
  );

  if (telegramBootstrap && !host)
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
              void confirmTelegramLink(send, apiOrigin, telegramBootstrap, { email, password })
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
  if (auth === "login" && guestMode && !host && !passwordEntry)
    return (
      <GuestEntry
        onSignIn={() => {
          setPasswordEntry(true);
          setNotice("");
        }}
        onJoined={(token) => {
          refreshGate.current.invalidate();
          refreshGate.current.resume();
          visibleKingdom.current = "";
          sessionStorage.setItem("pact_csrf", token);
          setCsrf(token);
          setGuestPlayer(true);
          setAuth("checking");
          setNotice("");
        }}
      />
    );
  if (guestMode === null || auth === "checking")
    return (
      <main className="game-shell">
        <h1>PACT Alpha</h1>
        <p>Loading…</p>
      </main>
    );
  if (auth === "login" && host)
    return (
      <main className="game-shell">
        <h1>Reconnect your PACT account</h1>
        <p>Your session ended. Return to the secure PACT sign-in flow before taking another action.</p>
        <button type="button" onClick={host.onAuthenticationRequired}>
          Reconnect
        </button>
      </main>
    );
  if (auth === "login")
    return (
      <main className="game-shell auth-shell">
        <h1>PACT Alpha</h1>
        {connectionNotice}
        <p>Sign in to return to your kingdom. Manual play does not require a model provider.</p>
        {guestMode && (
          <button type="button" className="secondary" onClick={() => setPasswordEntry(false)}>
            Back to guest entry
          </button>
        )}
        <InvitationPanel request={request} authenticated={false} canWrite={false} />
        {new URLSearchParams(window.location.search).has("post") && (
          <ChroniclePanel request={request} canWrite={false} />
        )}
        {new URLSearchParams(window.location.search).has("seal") && (
          <EvidencePanel request={request} canWrite={false} />
        )}
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
          <label>
            Authenticator or recovery code (if enabled)
            <input name="mfaCode" autoComplete="one-time-code" maxLength={64} />
          </label>
          <button type="submit" disabled={busy}>
            Sign in
          </button>
        </form>
        {notice && <p role="status">{notice}</p>}
        {refreshFailure && <p role="status">{refreshFailure}</p>}
        <PasswordRecovery request={request} />
        <Registration request={request} onNotice={setNotice} />
      </main>
    );
  if (auth === "draft")
    return (
      <main className="game-shell auth-shell">
        <h1>Found your kingdom</h1>
        {connectionNotice}
        <p>Your name and handle become public on entry. This private Alpha uses a test portrait.</p>
        <InvitationPanel request={request} authenticated canWrite={canWrite} />
        {!host && (
          <details>
            <summary>Optional game notifications</summary>
            <NotificationSettings request={request} canWrite={canWrite} />
          </details>
        )}
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
          <button type="submit" disabled={!canWrite}>
            Found kingdom
          </button>
        </form>
        {notice && <p role="status">{notice}</p>}
      </main>
    );
  const linkedApproval = new URLSearchParams(window.location.search).get("approval");
  if (linkedApproval)
    return (
      <main className="game-shell approval-shell">
        {connectionNotice}
        <ApprovalReview
          key={kingdomId}
          approvalId={linkedApproval}
          kingdomName={view?.profile.displayName}
          request={request}
          canWrite={canWrite}
          onRefresh={refresh}
        />
      </main>
    );
  if (accountOpen)
    return (
      <main className="game-shell account-shell">
        <button type="button" className="secondary" onClick={() => setAccountOpen(false)}>
          Back to game
        </button>
        <h1>Account</h1>
        {connectionNotice}
        <AccountAccess
          guest={guestPlayer}
          canWrite={canWrite}
          request={request}
          onChanged={() => {
            setGuestPlayer(false);
            void refresh();
          }}
        />
        <SessionDevices request={request} />
        {!guestPlayer &&
          (host ? (
            <button type="button" onClick={host.openAccount}>
              Open secure account settings
            </button>
          ) : (
            <PrivacySettings
              request={request}
              onNotice={setNotice}
              apiOrigin={apiOrigin}
              onCsrfChange={(token) => {
                sessionStorage.setItem("pact_csrf", token);
                setCsrf(token);
              }}
            />
          ))}
        <article className="game-card">
          <h2>Sessions</h2>
          <button
            disabled={!canWrite}
            type="button"
            onClick={() =>
              void request("/v1/auth/logout", "POST")
                .then(() => {
                  localStorage.removeItem("pact_guest_entry");
                  localStorage.removeItem("pact_guest_name");
                  sessionStorage.removeItem("pact_csrf");
                  window.location.reload();
                })
                .catch((e) => setNotice(failure(e)))
            }
          >
            Sign out on this device
          </button>
          <p>For a guest, save a recovery code before signing out. Your kingdom remains in the world.</p>
          <button
            disabled={!canWrite}
            className="secondary"
            type="button"
            onClick={() => {
              if (window.confirm("Sign out all browser sessions and revoke your agent connections?"))
                void request("/v1/auth/sign-out-everywhere", "POST")
                  .then(() => {
                    localStorage.removeItem("pact_guest_entry");
                    localStorage.removeItem("pact_guest_name");
                    sessionStorage.removeItem("pact_csrf");
                    window.location.reload();
                  })
                  .catch((e) => setNotice(failure(e)));
            }}
          >
            Sign out everywhere
          </button>
        </article>
        {notice && <p role="status">{notice}</p>}
      </main>
    );
  return (
    <ReportingContext.Provider value={{ request, canWrite }}>
      <main className={guestMode ? "game-shell friends-play" : "game-shell"} id="game-content" tabIndex={-1}>
        <section className="kingdom-controls">
          <a className="skip-link" href="#game-areas">
            Skip to game areas
          </a>
          <header className="game-header">
            <div>
              <p className="eyebrow">PACT · friends world</p>
              <h1>{view?.profile.displayName ?? "Kingdom"}</h1>
              <p>
                @{view?.profile.handle} {view?.worldStatus === "paused" ? " · World paused" : ""}
              </p>
              <details>
                <summary>Kingdom reference</summary>
                <code>{kingdomId}</code>
              </details>
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
                disabled={busy}
                onClick={() => {
                  if (
                    guestPlayer &&
                    !window.confirm("Start a new kingdom in this browser? Your current guest will be left behind.")
                  )
                    return;
                  if (guestPlayer) {
                    localStorage.removeItem("pact_guest_entry");
                    localStorage.removeItem("pact_guest_name");
                  }
                  clearExperiencePreferences(localStorage);
                  refreshGate.current.pause();
                  setNotice("");
                  setRefreshFailure("");
                  setTarget("");
                  setSocial(null);
                  setView(null);
                  setDecisions(null);
                  setLocalFailure(null);
                  setPendingAction(null);
                  setInbox([]);
                  setKingdomId("");
                  setDraft(null);
                  setAuth("login");
                  setLastRefreshed(null);
                }}
              >
                {guestPlayer ? "New guest" : "Switch test player"}
              </button>
            </div>
          </header>
          {view && (
            <ExperienceControls
              key={view.profile.kingdomId}
              owner={view.profile.kingdomId}
              onAudioReady={setExperienceAudio}
            />
          )}
          {!csrf && <p role="status">Sign in again before taking an action in this browser tab.</p>}
          {connectionNotice}
          <nav className="game-nav" id="game-areas" tabIndex={-1} aria-label="Game areas">
            {!host && (
              <button
                type="button"
                aria-current={councilOpen ? "page" : undefined}
                onClick={() => setCouncilOpen(true)}
              >
                Conversations
              </button>
            )}
            {(["Kingdom", "People", "Chronicle", "Envoy"] as const).map((item) => (
              <button
                type="button"
                key={item}
                aria-current={!councilOpen && tab === item ? "page" : undefined}
                onClick={() => {
                  setCouncilOpen(false);
                  setTab(item);
                }}
              >
                {item === "People" ? "Society" : item}
              </button>
            ))}
            <button type="button" onClick={() => setAccountOpen(true)}>
              Account
            </button>
          </nav>
          {councilOpen ? (
            <ConversationWorkspace request={request} client={client} canWrite={canWrite} onReview={confirmAction} />
          ) : (
            <>
              {tab === "Envoy" && (
                <details className="game-card">
                  <summary>Reports and appeals</summary>
                  <ModerationPanel request={request} canWrite={canWrite} />
                </details>
              )}
              {tab === "Envoy" && !host && (
                <CodexConnection request={request} handle={view?.profile.handle} guest={guestPlayer} />
              )}
              {view && (
                <FirstSession
                  compact
                  stage={{
                    stale: !canWrite || Boolean(refreshFailure),
                    approvalsAvailable: decisions?.kingdomId === view.profile.kingdomId,
                    approvals: decisions?.kingdomId === view.profile.kingdomId ? decisions.approvals : [],
                    failure:
                      localFailure ?? (decisions?.kingdomId === view.profile.kingdomId ? decisions.failure : undefined),
                    ambition: view.ambition,
                    asOfGameTimeMs: view.asOfGameTimeMs,
                    worldStatus: view.worldStatus,
                    requests: social?.requests,
                    contactOutcome: social?.requestHistory?.find((r) =>
                      ["accepted", "declined", "expired"].includes(r.status),
                    ),
                    build: (() => {
                      const b = view.builders.find(
                        (b) => b.instructionId && b.kind && ["waiting", "active"].includes(b.state ?? ""),
                      );
                      return b?.instructionId && b.kind
                        ? { ...b, instructionId: b.instructionId, kind: b.kind, state: b.state ?? "waiting" }
                        : undefined;
                    })(),
                    freeBuilders: view.builders.filter((b) => !b.instructionId).length,
                    choices: developmentChoices(view),
                    ownerSource: `${pactBaseUrl()}v1/world/kingdoms/${view.profile.kingdomId}`,
                    socialAvailable: social !== null,
                    farmComplete: view.buildings.some((b) => b.kind === "farm" && b.level >= 2),
                    farmPending: view.builders.some((b) => b.kind === "farm" && b.instructionId !== null),
                    contacts: social?.contacts.length ?? 0,
                    pendingRequests: social?.requests.length ?? 0,
                    pendingOffers: social ? social.supplyOffers.length + social.garrisonOffers.length : 0,
                    contracts: social ? social.supplyContracts.length + social.garrisonContracts.length : 0,
                  }}
                  onArea={setTab}
                />
              )}
              {view && tab === "Kingdom" && <BuilderStatus view={view} />}
              {view && (
                <details className="game-card">
                  <summary>Game moments and notifications</summary>
                  <OutcomeCards
                    key={view.profile.kingdomId}
                    owner={view.profile.kingdomId}
                    view={view}
                    stale={!csrf || connectionStatus !== "live" || Boolean(refreshFailure)}
                    offers={social?.supplyOffers}
                    requests={social?.requests}
                    approvals={decisions?.kingdomId === view.profile.kingdomId ? decisions.approvals : undefined}
                    audio={experienceAudio}
                    onNotice={setNotice}
                  />
                </details>
              )}

              {notice && (
                <p className="game-notice" role="status">
                  {notice}
                </p>
              )}
              {refreshFailure && (
                <p className="game-notice" role="status">
                  {refreshFailure}
                </p>
              )}
              {pendingAction && (
                <section
                  className="game-confirm"
                  aria-label="Confirm game action"
                  ref={confirmation}
                  tabIndex={-1}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setPendingAction(null);
                      returnFocus.current?.focus();
                    }
                  }}
                >
                  <div>
                    <strong>Confirm this action</strong>
                    <p>{pendingAction.summary}</p>
                  </div>
                  <button
                    type="button"
                    disabled={!canWrite}
                    onClick={() => {
                      const action = pendingAction.action;
                      setPendingAction(null);
                      void act(action);
                    }}
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      setPendingAction(null);
                      returnFocus.current?.focus();
                    }}
                  >
                    Cancel
                  </button>
                </section>
              )}
              {tab === "Kingdom" && view && (
                <details className="game-card">
                  <summary>Private notes</summary>
                  <AmbitionChoice
                    value={view.ambition ?? ""}
                    disabled={!canWrite}
                    save={async (ambition) => {
                      await request("/v1/kingdom/ambition", "PATCH", { ambition });
                      await refresh();
                    }}
                  />
                </details>
              )}
              {tab === "Kingdom" && view && (
                <Kingdom
                  view={view}
                  busy={!canWrite}
                  act={act}
                  social={social}
                  kingdomId={kingdomId}
                  onPeople={() => setTab("People")}
                  queueSuggested={queueSuggested}
                />
              )}
              {tab === "Envoy" && (
                <Envoy
                  canWrite={canWrite}
                  inbox={inbox}
                  request={request}
                  onNotice={setNotice}
                  onRefresh={refresh}
                  apiOrigin={apiOrigin}
                  openAccount={() => setAccountOpen(true)}
                  onCsrfChange={(token) => {
                    sessionStorage.setItem("pact_csrf", token);
                    setCsrf(token);
                  }}
                />
              )}
              {tab === "Envoy" && !host && <NotificationSettings request={request} canWrite={canWrite} />}
              {tab === "Envoy" && (
                <RunPanel
                  request={request}
                  contacts={social?.contacts ?? []}
                  canWrite={canWrite}
                  ambition={view?.ambition ?? ""}
                />
              )}
              {tab === "People" && (
                <People
                  friends={Boolean(guestMode)}
                  request={request}
                  client={client}
                  act={act}
                  busy={!canWrite}
                  view={view}
                  kingdomId={kingdomId}
                  social={social}
                  target={target}
                  setTarget={setTarget}
                  confirmAction={confirmAction}
                  hallLevel={view?.buildings.find((item) => item.kind === "hall")?.level ?? 1}
                  charges={view?.charges ?? []}
                />
              )}

              {tab === "Kingdom" && (
                <SeasonPanel request={request} kingdomId={kingdomId} worldStatus={view?.worldStatus ?? "unknown"} />
              )}

              {tab === "People" && <ChroniclePanel request={request} canWrite={canWrite} noticesOnly />}
              {tab === "Chronicle" && view && (
                <Chronicle
                  view={view}
                  client={client}
                  inbox={inbox}
                  social={social}
                  busy={busy}
                  confirmAction={confirmAction}
                  onKingdom={() => setTab("Kingdom")}
                />
              )}
              {tab === "People" && (
                <details
                  className="game-card"
                  open={Boolean(
                    new URLSearchParams(window.location.search).get("court") ||
                      new URLSearchParams(window.location.search).get("invite") ||
                      new URLSearchParams(window.location.search).get("politics"),
                  )}
                >
                  <summary>Courts, allegiance and invitations</summary>
                  <CourtPanel request={request} kingdomId={kingdomId} canWrite={canWrite} />
                  <PoliticsPanel request={request} kingdomId={kingdomId} canWrite={canWrite} />
                  <InvitationPanel request={request} authenticated canWrite={canWrite} kingdomId={kingdomId} />
                </details>
              )}
              {tab === "Chronicle" && (
                <details
                  className="game-card"
                  open={
                    new URLSearchParams(window.location.search).has("post") ||
                    new URLSearchParams(window.location.search).has("chronicle")
                  }
                >
                  <summary>Public Chronicle and evidence publishing</summary>
                  <ChroniclePanel request={request} canWrite={canWrite} />
                  <EvidencePanel request={request} canWrite={canWrite} />
                </details>
              )}
            </>
          )}
        </section>
      </main>
    </ReportingContext.Provider>
  );
}

export function ConnectionNotice({
  status,
  lastRefreshed,
  onRefresh,
}: {
  status: "live" | "offline" | "stale";
  lastRefreshed: string | null;
  onRefresh: () => void;
}) {
  return (
    <section className="connection-notice" aria-label="Game connection" role="status" aria-live="polite">
      <p>
        {status === "offline"
          ? "Offline — displayed information is stale. Game actions are disabled; nothing is queued."
          : status === "stale"
            ? "Live refresh required — displayed information may be stale. Review fresh state and decide again; signatures, raids and approvals are not replayed."
            : lastRefreshed
              ? `Last owner refresh: ${lastRefreshed}. The server rechecks every action.`
              : "Game actions require a live server response."}
      </p>
      {status !== "live" && (
        <button type="button" onClick={onRefresh}>
          Refresh live state
        </button>
      )}
    </section>
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

export function ActionCharges({ charges }: { charges: NonNullable<OwnerView["charges"]> }): React.JSX.Element | null {
  if (charges.length === 0) return null;
  return (
    <article className="game-card" aria-label="Game action charges">
      <h3>Action charges</h3>
      {charges.map((charge) => (
        <div key={charge.kind}>
          <strong>
            {charge.kind}: {charge.available} / {charge.capacity}
          </strong>
          <p>
            {charge.nextRegenerationGameTimeMs === null
              ? "Pool full."
              : `Next charge: ${new Date(charge.nextRegenerationGameTimeMs).toLocaleString()} game time.`}
          </p>
          <small>Regenerates one every {charge.regenerationHours} game hours.</small>
          {charge.available === 0 && <p>No charges available. Wait for regeneration before trying again.</p>}
        </div>
      ))}
      <p>Shared by manual play and agents. A paused world also pauses regeneration.</p>
    </article>
  );
}

export function Kingdom({
  view,
  busy,
  act,
  social,
  kingdomId,
  onPeople,
  queueSuggested,
  initialArea = "Overview",
}: {
  view: OwnerView;
  busy: boolean;
  act: (action: SandboxAction) => Promise<void>;
  social: SocialOverview | null;
  kingdomId: string;
  onPeople: () => void;
  initialArea?: "Overview" | "Buildings" | "Army" | "Economy";
  queueSuggested?: (building: string, level: number) => void;
}): React.JSX.Element {
  const [area, setArea] = useState(initialArea);
  const [building, setBuilding] = useState("farm");
  const currentLevel = view.buildings.find((item) => item.kind === building)?.level ?? 1;
  const level = Math.min(6, currentLevel + 1);
  const maxLevel = currentLevel >= 6;
  const alreadyQueued = view.builders.some((item) => item.kind === building && item.instructionId !== null);
  const [slot, setSlot] = useState(1);
  useEffect(() => {
    const free = view.builders.find((b) => !b.instructionId);
    if (free) setSlot(free.slot);
  }, [view.builders]);
  const [troopType, setTroopType] = useState("spearman");
  const [troopCount, setTroopCount] = useState(1);
  return (
    <section>
      <nav className="game-nav kingdom-nav" aria-label="Kingdom sections">
        {(["Overview", "Buildings", "Army", "Economy"] as const).map((item) => (
          <button
            type="button"
            key={item}
            aria-current={area === item ? "page" : undefined}
            onClick={() => setArea(item)}
          >
            {item}
          </button>
        ))}
      </nav>
      <h2>{area}</h2>
      {area === "Overview" && <KingdomScene facts={{ ...view, audience: "owner" }} />}
      {area === "Overview" && <BuilderStatus view={view} />}
      <div className="resource-strip">
        {["grain", "iron", "silver"].map((kind) => (
          <div key={kind}>
            <strong>{kind}</strong>
            <span>
              {units(view.balances[kind]?.ordinaryUnits ?? "0")}{" "}
              <small>+ {units(view.balances[kind]?.foundingAllowanceUnits ?? "0")} starter stock</small>
            </span>
          </div>
        ))}
      </div>
      {area === "Overview" && queueSuggested && <QuickBuilds view={view} disabled={busy} onBuild={queueSuggested} />}
      <section aria-label={`${area} controls`}>
        {area === "Economy" && (
          <>
            <ActionCharges charges={view.charges ?? []} />
            <p>
              Committed game time {new Date(view.asOfGameTimeMs).toLocaleString()}. Resource amounts below use whole
              game units; the server decides costs and limits.
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
                        Gross {balance.facts?.rates.gross.label ?? `${units(balance.productionPerMinuteUnits)} / min`} ·
                        upkeep {balance.facts?.rates.upkeep.label ?? "inspect troops"} · net{" "}
                        {balance.facts?.rates.net.label ?? "unavailable"} · cap {units(balance.capacityUnits)} · version{" "}
                        {balance.version}
                      </small>
                    </article>
                  )
                );
              })}
            </div>
            <article className="game-card">
              <h3>Next-hour expected ending stock</h3>
              <p>This is ending stock, not the net increase. Gross production, upkeep and assumed deliveries differ.</p>
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
                <small>Through {new Date(view.forecast.throughGameTimeMs).toLocaleString()} game time</small>
              </details>
            </article>
          </>
        )}
        <div className="game-grid">
          {area === "Buildings" && (
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
                    ? ` · ${remainingGameTime(item.dueGameTimeMs, view)}`
                    : item.state === "waiting"
                      ? " · waiting for level prerequisites, stock, authority, or a builder slot"
                      : ""}
                </p>
              ))}
              {(building === "hall" ||
                view.builders.some((item) => item.kind === "hall" && item.state === "waiting")) && (
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
                  <input type="number" value={level} readOnly />
                </label>
                <label>
                  Builder slot
                  <select value={slot} onChange={(event) => setSlot(Number(event.target.value))}>
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                  </select>
                </label>
                <button type="submit" disabled={busy || maxLevel || alreadyQueued}>
                  {maxLevel ? "Maximum level reached" : alreadyQueued ? "Upgrade already queued" : "Queue upgrade"}
                </button>
                <p>
                  {maxLevel
                    ? "Level VI is the development cap."
                    : `Next upgrade: ${building} ${currentLevel} → ${level}. Missing stock or prerequisites can leave an instruction waiting; the server decides admission and costs.`}
                </p>
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
                      if (item.instructionId)
                        void act({ kind: "game.building.cancel", instructionId: item.instructionId });
                    }}
                  >
                    Cancel slot {item.slot}
                  </button>
                ))}
            </article>
          )}
          {area === "Army" && (
            <article className="game-card">
              <h3>Troops</h3>
              <ul>
                {view.troops.map((item) => (
                  <li key={`${item.type}-${item.placement}-${item.homeGuard}`}>
                    {item.count} {item.type} · {item.placement} ·{" "}
                    {item.homeGuard ? "Home Guard (defense only)" : "ordinary"}
                  </li>
                ))}
              </ul>
              <p>
                Upkeep {units(view.upkeep.perMinuteUnits)} Grain/min{view.upkeep.hungry ? " · hungry" : ""}
              </p>
              <p>Founding Home Guard defend only. Train ordinary troops before scouting, lending, or raiding.</p>
              {view.training.length > 0 && (
                <div>
                  <h4>Training in progress</h4>
                  {view.training.map((batch) => (
                    <div className="game-list-item" key={batch.batchId}>
                      <strong>
                        {batch.completedCount} of {batch.requestedCount} {batch.type} ready
                      </strong>
                      <p>Next unit: {remainingGameTime(batch.nextUnitDueGameTimeMs, view)}</p>
                      <small>
                        One unit every {batch.unitMinutes} game minutes. The clock stops if the world pauses.
                      </small>
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
          )}
        </div>
        <div className="game-grid">
          {area === "Overview" && (
            <article className="game-card">
              <h3>Supply contracts</h3>
              {social?.supplyContracts.filter((item) => item.status === "active").length ? (
                social.supplyContracts
                  .filter((item) => item.status === "active")
                  .map((item) => (
                    <div className="game-list-item" key={item.id}>
                      <strong>Supply with {item.displayName}</strong>
                      <p>{supplyTerms(item.terms, item.kingdomA === kingdomId)}</p>
                      <small>{remainingGameTime(Number(item.endGameTimeMs), view ?? null)}</small>
                    </div>
                  ))
              ) : (
                <p>No active supply contracts. Garrison contracts appear in People.</p>
              )}
              <button type="button" className="secondary" onClick={onPeople}>
                See offers and all contracts
              </button>
            </article>
          )}
          {(area === "Army" || area === "Overview") && (
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
          )}
        </div>
      </section>
      {area === "Overview" &&
        (Object.values(view.consequences?.firstRetained ?? {}).some(Boolean) ? (
          <details className="game-card">
            <summary>Your Hall keepsakes</summary>
            <HallKeepsakes owner={view.profile.kingdomId} view={view} />
          </details>
        ) : (
          <p className="quiet">Your first completed build earns a little keepsake here.</p>
        ))}
    </section>
  );
}

function Envoy({
  canWrite,
  inbox,
  request,
  onNotice,
  onRefresh,
  openAccount,
}: {
  canWrite: boolean;
  inbox: { sequence: string; type: string; event: unknown }[];
  request: (path: string, method?: string, body?: unknown) => Promise<Json>;
  onNotice: (message: string) => void;
  onRefresh: () => Promise<void>;
  apiOrigin: URL;
  onCsrfChange: (token: string) => void;
  openAccount?: (() => void) | undefined;
}): React.JSX.Element {
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
    if (!canWrite || !mandate) return;
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
  return (
    <details className="game-card" open>
      <summary>Agent authority, exact approvals and account</summary>
      <h2>Envoy</h2>
      <p>Manual actions remain available without a model connection. Reading an approval never commits it.</p>
      <article className="game-card">
        <h3>Agent authority</h3>
        <details>
          <summary>Review or change your agent authority</summary>
          <p>
            Connect this account through Codex OAuth, then start a 15-minute agent lease. Access tokens expire after 15
            minutes and the revocable connection can refresh for 30 days. Never paste a password or token into a chat.
          </p>
          <p>
            Current authority:{" "}
            {mandate?.allowedActions.includes("raid.commit") ? "bounded playtest" : "read and contact messages only"}.
          </p>
          <button type="button" disabled={!canWrite || !mandate} onClick={() => void setPlaytestMandate(true)}>
            Enable bounded agent playtest
          </button>{" "}
          <button
            type="button"
            className="secondary"
            disabled={!canWrite || !mandate}
            onClick={() => void setPlaytestMandate(false)}
          >
            Disable new agent game actions
          </button>
          <p>
            Only the human can change this authority or approve an exact exception. The game still enforces stock,
            charges, and locks.
          </p>
        </details>
      </article>
      <ApprovalReview request={request} canWrite={canWrite} onRefresh={onRefresh} />
      <details className="game-card">
        <summary>Inbox notifications</summary>
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
      </details>
      {openAccount && (
        <button type="button" className="secondary" onClick={openAccount}>
          Manage account
        </button>
      )}
    </details>
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
      clearExperiencePreferences(localStorage);
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

export function scoutUiReady(view: Pick<OwnerView, "troops" | "balances" | "charges"> | null): boolean {
  if (!view) return false;
  const homeSpearmen = view.troops
    .filter((unit) => unit.type === "spearman" && unit.placement === "home" && !unit.homeGuard)
    .reduce((total, unit) => total + unit.count, 0);
  const stockAtLeast = (resource: string, minimumUnits: bigint): boolean => {
    const raw = view.balances[resource]?.ordinaryUnits;
    return typeof raw === "string" && /^\d+$/.test(raw) && BigInt(raw) >= minimumUnits;
  };
  return (
    homeSpearmen >= 2 &&
    stockAtLeast("silver", 6000n) &&
    stockAtLeast("grain", 3000n) &&
    Boolean(view.charges?.some((charge) => charge.kind === "scout" && charge.available > 0))
  );
}

export function raidUiReady(
  view: Pick<OwnerView, "troops" | "charges"> | null,
  type: "spearman" | "archer" | "rider" | "ram",
  count: number,
): boolean {
  if (!view || !Number.isInteger(count) || count < 8 || count > 40) return false;
  const available = view.troops
    .filter((unit) => unit.type === type && unit.placement === "home" && !unit.homeGuard)
    .reduce((total, unit) => total + unit.count, 0);
  return available >= count && Boolean(view.charges?.some((charge) => charge.kind === "raid" && charge.available > 0));
}

export function People({
  friends = false,
  request,
  client,
  act,
  busy,
  view,
  kingdomId,
  social,
  target,
  setTarget,
  confirmAction,
  hallLevel,
  charges,
}: {
  friends?: boolean;
  request?: (path: string, method?: string, body?: unknown) => Promise<Json>;
  client: ReturnType<typeof createWebPactClient>;
  act: (action: SandboxAction) => Promise<void>;
  busy: boolean;
  view: OwnerView | null;
  kingdomId: string;
  social: SocialOverview | null;
  target: string;
  setTarget: (value: string) => void;
  confirmAction: (summary: string, action: SandboxAction) => void;
  hallLevel: number;
  charges: NonNullable<OwnerView["charges"]>;
}): React.JSX.Element {
  const [profile, setProfile] = useState<unknown>(null);
  const [handle, setHandle] = useState("");
  const profileGeneration = useRef(0);
  const [message, setMessage] = useState("");
  const [resource, setResource] = useState<"iron" | "silver" | "grain">("grain");
  const [amount, setAmount] = useState(1);
  const selected = social?.contacts.find((item) => item.kingdomId === target);
  const messages = social?.messages.filter((item) => item.kingdomId === target).reverse() ?? [];
  return (
    <section>
      <h2>People</h2>
      <p>Talk, trade, and make alliances with other kingdoms. Private details are shown only to the parties.</p>
      {friends && request && (
        <FriendsLobby
          request={request}
          contacts={social?.contacts ?? []}
          requests={social?.requests ?? []}
          onChoose={(id, text) => {
            setTarget(id);
            setMessage(text);
            setProfile(null);
            document.getElementById("contact-composer")?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        />
      )}

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
            <p>
              No contacts yet. Choose a kingdom above and request contact. Once they accept, you can chat and trade.
            </p>
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
                  <small>Waiting for the recipient human. Response time unknown.</small>
                )}
              </div>
            ))
          ) : (
            <p>No pending requests.</p>
          )}
        </article>
      </div>
      <article className="game-card">
        <h3>
          {selected
            ? `Conversation with ${selected.displayName}`
            : target
              ? "Your selected kingdom"
              : "Choose a kingdom above"}
        </h3>
        <details open={!friends}>
          <summary>Find another kingdom or inspect its profile</summary>
          {request && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const g = ++profileGeneration.current;
                setProfile(null);
                setTarget("");
                void request(`/v1/people/${encodeURIComponent(handle.trim().replace(/^@/, ""))}`)
                  .then(async (result) => {
                    if (g !== profileGeneration.current) return;
                    const found = result.kingdom as { profile?: { kingdomId?: string } } | null;
                    const id = found?.profile?.kingdomId;
                    if (!id) {
                      setProfile({ error: "No real kingdom matches that exact handle." });
                      return;
                    }
                    setTarget(id);
                    const value = await client.readKingdomView(id);
                    if (g === profileGeneration.current) setProfile(value);
                  })
                  .catch((error: unknown) => {
                    if (g === profileGeneration.current) setProfile({ error: failure(error) });
                  });
              }}
            >
              <label>
                Exact player handle
                <input
                  required
                  value={handle}
                  onChange={(event) => {
                    profileGeneration.current++;
                    setHandle(event.target.value);
                    setTarget("");
                    setProfile(null);
                  }}
                />
              </label>
              <button type="submit">Find real player</button>
            </form>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const g = ++profileGeneration.current;
              void client
                .readKingdomView(target)
                .then((value) => {
                  if (g === profileGeneration.current) setProfile(value);
                })
                .catch((error: unknown) => {
                  if (g === profileGeneration.current) setProfile({ error: failure(error) });
                });
            }}
          >
            <label>
              Kingdom ID (or choose a contact above)
              <input
                required
                value={target}
                onChange={(event) => {
                  profileGeneration.current++;
                  setProfile(null);
                  setTarget(event.target.value.trim());
                }}
              />
            </label>
            <button type="submit">Inspect profile</button>
          </form>
          {profile !== null && <PublicProfile value={profile} />}
        </details>
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
                    {new Date(Number(item.sentGameTimeMs)).toLocaleString()} game time
                  </small>
                  <p>{item.body}</p>
                  <ReportControl kind="message" targetId={item.id} />
                  <a href={`/pact/?sealSource=message&sourceId=${encodeURIComponent(item.id)}`}>Seal this message</a>
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
          <h3 id="contact-composer">Contact and message</h3>
          <p>
            Introductions are free. The recipient's social delegation determines acceptance. Messages and direct
            transfers need an accepted contact.
          </p>
          <label>
            Text
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} />
          </label>
          <button
            type="button"
            disabled={
              busy || !target || !message || [...message].length > 4096 || target === kingdomId || Boolean(selected)
            }
            onClick={() => {
              void act({ kind: "game.contact.request", recipientKingdomId: target, note: message });
            }}
          >
            Request contact
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy || !selected || !message || [...message].length > 4096}
            onClick={() => {
              void act({ kind: "game.message.send", recipientKingdomId: target, body: message });
            }}
          >
            Send message
          </button>
        </article>
        <article className="game-card">
          <h3>Direct transfer</h3>
          <p>Choose an accepted contact, then review the recipient and amount. Server rules enforce available stock.</p>
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
            disabled={busy || !selected || target === kingdomId}
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
      <details className="game-card">
        <summary>Trade, diplomacy and records</summary>
        <ActionCharges charges={charges} />
        <Consequences data={view?.consequences} worldStatus={view?.worldStatus ?? "unknown"} />
        <OutgoingContactHistory entries={social?.requestHistory} gameTimeMs={view?.asOfGameTimeMs} />
        <ContractBoard view={view} social={social} kingdomId={kingdomId} busy={busy} confirmAction={confirmAction} />
        <DiplomacyForms
          target={target}
          busy={busy}
          act={act}
          confirmAction={confirmAction}
          hallLevel={hallLevel}
          view={view}
          kingdomId={kingdomId}
          scoutReady={scoutUiReady(view) && target !== kingdomId}
        />
      </details>
    </section>
  );
}

function PublicProfile({ value }: { value: unknown }): React.JSX.Element {
  if (!value || typeof value !== "object") return <p>Profile unavailable.</p>;
  const result = value as {
    profile?: { displayName?: string; handle?: string; kingdomId?: string };
    worldStatus?: string;
    error?: string;
  };
  if (result.error) return <p role="alert">{result.error}</p>;
  return (
    <div className="game-profile">
      <strong>{result.profile?.displayName ?? "Kingdom"}</strong> · @{result.profile?.handle ?? "unknown"} ·{" "}
      {result.worldStatus ?? "in the world"}
      {result.profile?.kingdomId && <ReportControl kind="profile" targetId={result.profile.kingdomId} />}
    </div>
  );
}

export function ContractBoard({
  view,
  social,
  kingdomId,
  busy,
  confirmAction,
}: {
  view?: OwnerView | null;
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
                    aria-label={`Sign supply offer with ${item.displayName}`}
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
                <small>{remainingGameTime(Number(item.endGameTimeMs), view ?? null)}</small>
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
                    aria-label={`Sign garrison offer with ${item.displayName}`}
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
                {item.lenderKingdomId === kingdomId && (
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      confirmAction(`Withdraw your garrison offer to ${item.displayName}?`, {
                        kind: "game.garrison.withdraw",
                        offerId: item.id,
                      })
                    }
                  >
                    Withdraw offer
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
                <small>{remainingGameTime(Number(item.endGameTimeMs), view ?? null)}</small>
                {item.status === "active" && (
                  <div className="game-inline-actions">
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        confirmAction(
                          `Request mutual release of your garrison with ${item.displayName}? Both players must agree; there is no early-exit default if they do.`,
                          { kind: "game.garrison.release", contractId: item.id },
                        )
                      }
                    >
                      Request mutual release
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        confirmAction(
                          `${item.lenderKingdomId === kingdomId ? "Recall" : "Return"} this garrison early? This defaults your promise and may transfer your bond. Battle-locked troops return after their existing battle.`,
                          { kind: "game.garrison.exit", contractId: item.id },
                        )
                      }
                    >
                      {item.lenderKingdomId === kingdomId ? "Recall troops" : "Return troops"}
                    </button>
                    {item.hostKingdomId === kingdomId && (
                      <button
                        type="button"
                        className="danger-button"
                        disabled={busy}
                        onClick={() =>
                          confirmAction(
                            `Seize ${item.displayName}'s visiting troops? This permanently transfers surviving units to you, publicly defaults your garrison promise, and forfeits your host bond.`,
                            { kind: "game.garrison.seize", contractId: item.id },
                          )
                        }
                      >
                        Seize troops
                      </button>
                    )}
                  </div>
                )}
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
  view,
  kingdomId,
  scoutReady,
}: {
  target: string;
  busy: boolean;
  act: (action: SandboxAction) => Promise<void>;
  confirmAction: (summary: string, action: SandboxAction) => void;
  hallLevel: number;
  view: OwnerView | null;
  kingdomId: string;
  scoutReady: boolean;
}): React.JSX.Element {
  const [sendResource, setSendResource] = useState<"iron" | "silver" | "grain">("grain");
  const [receiveResource, setReceiveResource] = useState<"iron" | "silver" | "grain">("silver");
  const [sendRate, setSendRate] = useState(0);
  const [receiveRate, setReceiveRate] = useState(0);
  const [duration, setDuration] = useState<1 | 6 | 24 | 72>(6);
  const [noticeHours, setNoticeHours] = useState<0 | 1 | 6>(0);
  const [troopType, setTroopType] = useState<"spearman" | "archer" | "rider" | "ram">("spearman");
  const [troopCount, setTroopCount] = useState(1);
  const [raidTroopType, setRaidTroopType] = useState<"spearman" | "archer" | "rider" | "ram">("spearman");
  const [raidTroopCount, setRaidTroopCount] = useState(8);
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
  const raidUnits = [{ type: raidTroopType, count: raidTroopCount }];
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
          disabled={busy || !target || !scoutReady}
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
          duration, with no bond in this Alpha sheet. The host pays their upkeep and can deliberately seize them;
          seizure publicly defaults the host's promise. Early unilateral recall or return defaults the player who acts.
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
        <label>
          Raid troop type
          <select
            value={raidTroopType}
            onChange={(event) => setRaidTroopType(event.target.value as typeof raidTroopType)}
          >
            {["spearman", "archer", "rider", "ram"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          Raid troop count
          <input
            type="number"
            min={8}
            max={40}
            value={raidTroopCount}
            onChange={(event) => setRaidTroopCount(Number(event.target.value))}
          />
        </label>
        <button
          type="button"
          disabled={busy || !target || target === kingdomId || !raidUiReady(view, raidTroopType, raidTroopCount)}
          onClick={() => {
            confirmAction(`Declare raid on ${target} with ${raidTroopCount} ${raidTroopType}? This can cause losses.`, {
              kind: "game.raid.declare",
              targetKingdomId: target,
              units: raidUnits,
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
            void act({ kind: "game.raid.accept", raidId, units: raidUnits });
          }}
        >
          Join nominated raid
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy || !raidId}
          onClick={() => {
            confirmAction(
              `Withdraw your attack from raid ${raidId}? If you lead it, the whole raid is canceled. Spent provisions and charges are not refunded.`,
              { kind: "game.raid.withdraw", raidId },
            );
          }}
        >
          Withdraw raid
        </button>
      </article>
    </div>
  );
}

export function RaidOperations({
  raids,
  gameTimeMs,
  worldStatus,
  busy,
  confirmAction,
  readReport,
}: {
  raids: OwnerView["raids"];
  gameTimeMs: number;
  worldStatus: string;
  busy: boolean;
  confirmAction: (summary: string, action: SandboxAction) => void;
  readReport: (raidId: string) => void;
}): React.JSX.Element {
  return (
    <article className="game-card" aria-label="Your raid operations">
      <h3>Your raids</h3>
      {!raids.length && <p>No raids yet.</p>}
      <ul>
        {raids.map((raid) => {
          const active = raid.status === "declared" || raid.status === "locked";
          const locked =
            raid.status === "locked" || (raid.lockGameTimeMs !== undefined && gameTimeMs >= raid.lockGameTimeMs);
          const attacker = raid.role === "leader" || raid.role === "contributor";
          return (
            <li key={raid.raidId} className="game-list-item">
              <strong>
                {raid.role ?? raid.side} · {raid.status}
              </strong>
              <p>
                Other kingdom: {raid.otherKingdomId} · <code>{raid.raidId}</code>
              </p>
              <p>
                Scheduled resolution:{" "}
                {remainingGameTime(raid.dueGameTimeMs, { asOfGameTimeMs: gameTimeMs, worldStatus })}
              </p>
              {active && (
                <>
                  <p>
                    {raid.lockGameTimeMs === undefined
                      ? "Lock deadline unavailable; refresh before acting."
                      : `Battle lock: ${remainingGameTime(raid.lockGameTimeMs, { asOfGameTimeMs: gameTimeMs, worldStatus })}. ${locked ? "Locked through resolution." : "Withdrawal closes at this boundary."}`}
                  </p>
                  {raid.role === "defender" && <p>Defense is automatic. You cannot withdraw another kingdom's raid.</p>}
                  {attacker && (
                    <p>
                      {raid.role === "leader"
                        ? "Withdrawing cancels the entire raid."
                        : "Withdrawing returns only your contribution."}{" "}
                      Spent provisions and charges are not refunded.
                    </p>
                  )}
                  {attacker && raid.lockGameTimeMs !== undefined && (
                    <button
                      type="button"
                      className="secondary"
                      aria-label={`Withdraw attack ${raid.raidId}`}
                      disabled={busy || worldStatus !== "active" || locked}
                      onClick={() =>
                        confirmAction(
                          `Withdraw ${raid.role === "leader" ? "the entire raid" : "your contribution to raid"} ${raid.raidId}? Spent provisions and charges are not refunded.`,
                          { kind: "game.raid.withdraw", raidId: raid.raidId },
                        )
                      }
                    >
                      {locked ? "Withdrawal closed" : "Withdraw attack"}
                    </button>
                  )}
                  {worldStatus !== "active" && <p>The world is paused; game deadlines and actions are frozen.</p>}
                </>
              )}
              {raid.status === "resolved" && (
                <button type="button" className="secondary" onClick={() => readReport(raid.raidId)}>
                  Read battle report
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <small>
        Times are committed game time, not wall-clock countdowns. Refresh before deciding; the server rechecks every
        withdrawal.
      </small>
    </article>
  );
}

function Chronicle({
  view,
  client,
  inbox,
  social,
  busy,
  confirmAction,
  onKingdom,
}: {
  view: OwnerView;
  client: ReturnType<typeof createWebPactClient>;
  inbox: { sequence: string; type: string; event: unknown }[];
  social: SocialOverview | null;
  busy: boolean;
  confirmAction: (summary: string, action: SandboxAction) => void;
  onKingdom: () => void;
}): React.JSX.Element {
  const [report, setReport] = useState<ReportRead | null>(null);
  const [reportId, setReportId] = useState("");
  const [reportKind, setReportKind] = useState<ReportKind>("scout");
  const reader = useRef(new ReportReader());
  useEffect(() => {
    const current = reader.current;
    return () => current.invalidate();
  }, []);
  const readReport = (kind: ReportKind, id: string): void => {
    setReportKind(kind);
    setReportId(id);
    void reader.current.read(
      { kind, id },
      (selectedKind, selectedId) => client.readReport(selectedKind, selectedId),
      setReport,
    );
  };
  return (
    <section>
      <h2>Chronicle</h2>
      <Consequences data={view.consequences} worldStatus={view.worldStatus} />
      <p>Committed records and authorized private reports.</p>
      <article className="game-card">
        <h3>Your scouts</h3>
        {view.scouts.length ? (
          <ul>
            {view.scouts.map((scout) => (
              <li key={scout.operationId}>
                {scout.status} · target {scout.targetKingdomId} · due {remainingGameTime(scout.dueGameTimeMs, view)}{" "}
                game time · <code>{scout.operationId}</code>{" "}
                {scout.status === "completed" && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      readReport("scout", scout.operationId);
                    }}
                  >
                    Read scout report
                  </button>
                )}
                {scout.status === "completed" && (
                  <a href={`/pact/?sealSource=scout&sourceId=${encodeURIComponent(scout.operationId)}`}>
                    Seal this report
                  </a>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>No scouts yet.</p>
        )}
      </article>
      <RaidOperations
        raids={view.raids}
        gameTimeMs={view.asOfGameTimeMs}
        worldStatus={view.worldStatus}
        busy={busy}
        confirmAction={confirmAction}
        readReport={(raidId) => {
          readReport("raid_participant", raidId);
        }}
      />
      <article className="game-card">
        <h3>Notification history</h3>
        {view.records.length ? (
          <ul>
            {view.records.map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                {item.kind} · {item.occurredAt} · <code>{item.id}</code>
              </li>
            ))}
          </ul>
        ) : (
          <p>No inbox notifications yet. Builds, contacts and delivered trade are shown above.</p>
        )}
      </article>
      <article className="game-card">
        <h3>Open a report</h3>
        {reportId && reportKind !== "raid_public" && (
          <a
            href={`/pact/?sealSource=${reportKind === "scout" ? "scout" : "battle"}&sourceId=${encodeURIComponent(reportId)}`}
          >
            Seal this report
          </a>
        )}
        <p>Use an operation or raid ID from a receipt or inbox event. Event IDs above are not report IDs.</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            readReport(reportKind, reportId);
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
        <ReportPanel report={report} social={social} viewerKingdomId={view.profile.kingdomId} onRebuild={onKingdom} />
      )}
      <p>{inbox.length} recent inbox events. Open Envoy for details.</p>
    </section>
  );
}

export function ReportPanel({
  report,
  social,
  viewerKingdomId,
  onRebuild,
}: {
  report: ReportRead;
  social: SocialOverview | null;
  viewerKingdomId: string;
  onRebuild: () => void;
}): React.JSX.Element {
  const label =
    report.kind === "scout" ? "Scout" : report.kind === "raid_participant" ? "Battle participant" : "Public battle";
  const code = report.status === "failed" ? failure(report.error) : "";
  return (
    <article className="game-card" aria-label="Selected report" aria-busy={report.status === "loading"}>
      <h3>Report</h3>
      <p>
        {label} · <code>{report.id}</code>
      </p>
      {report.status === "loading" && <p role="status">Loading the selected report…</p>}
      {report.status === "failed" && (
        <p role="alert">
          {code === "NOT_FOUND" || code === "FORBIDDEN" || code === "UNAUTHORIZED"
            ? "Report unavailable to this session. It may still be pending, missing, or not visible to this kingdom."
            : `Report could not be loaded: ${code}. Check your connection and try reading it again; no game action was submitted.`}
        </p>
      )}
      {report.status === "ready" && (
        <GameReport value={report.value} social={social} viewerKingdomId={viewerKingdomId} onRebuild={onRebuild} />
      )}
    </article>
  );
}

function GameReport({
  value,
  social,
  viewerKingdomId,
  onRebuild,
}: {
  value: unknown;
  social: SocialOverview | null;
  viewerKingdomId: string;
  onRebuild: () => void;
}): React.JSX.Element {
  if (!value || typeof value !== "object") return <p>Report unavailable.</p>;
  const item = value as Json;
  if (item.error) return <p role="status">Report not available yet, or not visible to this kingdom.</p>;
  if (item.status === "resolved" && typeof item.raidId === "string") {
    const trace = item.trace && typeof item.trace === "object" ? (item.trace as Json) : null;
    const winner = String(trace?.winner ?? item.winner ?? "unknown");
    const groups = Array.isArray(trace?.casualtyGroups)
      ? (trace.casualtyGroups as {
          side: string;
          ownerId: string;
          casualties: number;
          participating: number;
          byType: Record<string, number>;
        }[])
      : [];
    const ownGroup = groups.find((group) => group.ownerId === viewerKingdomId);
    const loot = trace?.lootTaken && typeof trace.lootTaken === "object" ? (trace.lootTaken as Json) : null;
    const lootEntries = Object.entries(loot ?? {}).filter(([, amount]) => Number(amount) > 0);
    return (
      <div className="game-report">
        <p>
          <strong>
            {winner === "attacker" ? "Attackers" : winner === "defender" ? "Defenders" : "Neither side"} won.
          </strong>{" "}
          The battle resolved at {new Date(Number(item.gameTimeMs)).toLocaleString()} game time.
        </p>
        <div className="game-grid">
          <section className="game-report-card">
            <h4>Your outcome</h4>
            {ownGroup ? (
              <p>
                You were on the {ownGroup.side} side and lost {ownGroup.casualties} of {ownGroup.participating} troops.
                {winner === ownGroup.side ? " Your side won." : " Your side lost."}
              </p>
            ) : (
              <p>This is the public result; individual losses are private to participants.</p>
            )}
            {ownGroup && ownGroup.casualties > 0 && (
              <div>
                <p>Replacements are not automatic or free. Review ordinary stock and your training queue in Kingdom.</p>
                <button type="button" className="secondary" onClick={onRebuild}>
                  Review replacement training
                </button>
              </div>
            )}
          </section>
          {groups.length > 0 && (
            <section className="game-report-card">
              <h4>Losses by kingdom</h4>
              <ul>
                {groups.map((group) => (
                  <li key={`${group.side}-${group.ownerId}`}>
                    {group.ownerId === viewerKingdomId ? "You" : group.ownerId} ({group.side}): {group.casualties} of{" "}
                    {group.participating} lost
                  </li>
                ))}
              </ul>
            </section>
          )}
          {loot && (
            <section className="game-report-card">
              <h4>Loot taken</h4>
              <p>
                {lootEntries.length
                  ? lootEntries.map(([resource, amount]) => `${units(String(amount))} ${resource}`).join(", ")
                  : "None"}
              </p>
            </section>
          )}
        </div>
        <details>
          <summary>Battle proof and full trace</summary>
          <pre>{JSON.stringify(value, null, 2)}</pre>
        </details>
      </div>
    );
  }
  if (item.kind !== "engine_report") return <pre>{JSON.stringify(value, null, 2)}</pre>;
  const targetId = String(item.targetKingdomId ?? "");
  const targetName = social?.contacts.find((contact) => contact.kingdomId === targetId)?.displayName ?? targetId;
  const stock = item.ordinaryStock as Record<string, string> | undefined;
  const troops = item.homeTroops as Record<string, string> | undefined;
  return (
    <div className="game-report">
      <p>
        Scouted <strong>{targetName}</strong> at {new Date(Number(item.observedGameTimeMs)).toLocaleString()} game time.
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
