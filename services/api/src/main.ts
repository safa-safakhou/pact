import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { clearInterval, setInterval } from "node:timers";
import {
  ChronicleFactReader,
  CommandDispatcher,
  DispatcherError,
  GameCommandHandler,
  outlookFeasibility,
  SocialCommandHandler,
} from "@pact/application";
import { ApprovalService, ApprovalStatusReader } from "@pact/approvals";
import { AuthorityService, ExactHumanPermitService, ExposureService, readReserveFloor } from "@pact/authority";
import { ProductScopeSchema } from "@pact/contracts";
import {
  CredentialVaultService,
  RsaOaepPublicKeyWrapper,
  storedCredentialRouteAvailable,
} from "@pact/credential-vault";
import { createPool, withTransaction } from "@pact/db";
import {
  AdminProvisioning,
  AesGcmSecretBox,
  baselineCompromisedPasswordDigests,
  IdentityService,
  LocalCompromisedPasswordChecker,
  TokenDigester,
} from "@pact/identity";
import { AgentEventService, InboxService, NotificationService } from "@pact/inbox";
import {
  ActionLimitService,
  AgentEventProjector,
  AgentOutlookService,
  BuildingEngine,
  ChronicleOutcomeReader,
  ChronicleService,
  CollectionService,
  CollectionStoriesService,
  ConstructionExposureAdapter,
  ConversationReader,
  CouncilReader,
  CourtInvitationDestination,
  CourtService,
  GarrisonService,
  gameNotificationCategories,
  ImmediateExposureAdapter,
  InvitationService,
  KingdomDiscoveryReader,
  KingdomRetirementService,
  KingdomService,
  ModerationError,
  ModerationService,
  OwnerRecordStates,
  PoliticsService,
  PrivateMemoryService,
  RaidRandomnessService,
  RaidService,
  readSeasonOverview,
  ScoutService,
  SealService,
  SeasonHonorsService,
  SeasonService,
  SocialOverviewReader,
  SocialService,
  SupplyExposureAdapter,
  SupplyService,
  SupplySettlementService,
  TroopService,
  WorldViewService,
} from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import { McpTransport } from "@pact/mcp";
import { OAuthService } from "@pact/oauth";
import { OnboardingService } from "@pact/onboarding";
import { OpenRouterAuthService } from "@pact/openrouter";
import { FileDeletionRegistry, PrivacyService } from "@pact/privacy";
import { ExternalAgentActivity, PersistentPlayService, RunError, RunService } from "@pact/runs";
import { botRetention, TelegramBotService, TelegramError, TelegramService } from "@pact/telegram";
import { WorldClockService } from "@pact/world";
import { AdminReader } from "./admin-reader.js";
import type { AdminSetup } from "./admin-routes.js";
import { AgentGuideReader } from "./agent-guide.js";
import { readEnvironment } from "./config.js";
import { activityStateResolver } from "./external-activity-state.js";
import { GameReportReader } from "./game-report-reader.js";
import { loadOperatorPreflight } from "./operator-preflight.js";
import { buildServer } from "./server.js";

const environment = readEnvironment();
const operatorPreflight = await loadOperatorPreflight(
  environment.PACT_OPERATOR_REGISTER_FILE,
  environment.CURRENT_TERMS_VERSION,
);
const publicBaseUrl = (environment.PACT_PUBLIC_BASE_URL ?? environment.PACT_ORIGIN).replace(/\/$/, "");
const pool = createPool(environment.DATABASE_URL);
const clock = { now: () => new Date() };
const compromisedPasswordDigests = environment.COMPROMISED_PASSWORD_SHA256_FILE
  ? (await readFile(environment.COMPROMISED_PASSWORD_SHA256_FILE, "utf8"))
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter((value) => /^[0-9a-f]{64}$/i.test(value))
  : baselineCompromisedPasswordDigests;
const identity = new IdentityService(pool, {
  connectionRefreshExpirations: (accountId) => oauth.refreshableGrantExpirations(accountId),
  productScope: "pact",
  guestPlayEnabled: environment.PACT_GUEST_PLAY === "1",
  currentTermsVersion: environment.CURRENT_TERMS_VERSION,
  allowedOrigins: new Set([environment.PACT_ORIGIN]),
  clock,
  digester: new TokenDigester(Buffer.from(environment.IDENTITY_TOKEN_PEPPER, "base64url")),
  secretBox: new AesGcmSecretBox(Buffer.from(environment.IDENTITY_ENCRYPTION_KEY, "base64url")),
  compromisedPasswords: new LocalCompromisedPasswordChecker(compromisedPasswordDigests),
});
const onboarding = new OnboardingService(pool, {
  productScope: "pact",
  currentTermsVersion: environment.CURRENT_TERMS_VERSION,
  now: clock.now,
});
const world = new WorldClockService(pool, "pact");
await world.bootstrap();
const kingdom = new KingdomService(pool, {
  productScope: "pact",
  onboarding,
  world,
  ledger: new ResourceLedger("pact"),
});
const politics = new PoliticsService(pool, "pact", clock);
const worldViews = new WorldViewService(pool, "pact", undefined, politics);
const agentOutlook = new AgentOutlookService(pool, "pact", worldViews, outlookFeasibility);
const seasons = new SeasonService("pact");
const honors = new SeasonHonorsService("pact");
const seasonViews = {
  readCurrent: (c: import("pg").PoolClient, cohortStart?: number, accountId?: string) =>
    readSeasonOverview(c, "pact", cohortStart, accountId),
};
const socialOverview = new SocialOverviewReader(pool, "pact");
const notifications = new NotificationService(pool, {
  productScope: "pact",
  clock,
  categories: gameNotificationCategories,
  secretBox: new AesGcmSecretBox(Buffer.from(environment.IDENTITY_ENCRYPTION_KEY, "base64url")),
  publicBaseUrl: publicBaseUrl + "/",
});
const moderation = new ModerationService(pool, {
  productScope: "pact",
  clock,
  secretBox: new AesGcmSecretBox(Buffer.from(environment.IDENTITY_ENCRYPTION_KEY, "base64url")),
  closeAccount: (accountId) => privacy.requestDeletion(accountId),
});
const agentEventProjector = new AgentEventProjector(pool, {
  productScope: "pact",
  clock,
  publish: async (c, input) => {
    if (agentEvents) await agentEvents.publishForAccount(c, input);
  },
});
const agentEvents = new AgentEventService(pool, {
  productScope: "pact",
  worldScope: publicBaseUrl,
  clock,
  cursorKey: Buffer.from(environment.IDENTITY_ENCRYPTION_KEY, "base64url"),
  authorizeOwner: (c, account) => agentEventProjector.authorizeOwner(c, account),
  authorize: (c, account, event) => agentEventProjector.authorized(c, account, event),
});
const inbox = new InboxService(pool, { productScope: "pact", clock });
const runs = new RunService(pool, {
  productScope: "pact",
  clock,
  inbox,
  validateContextSelection: async (accountId, contextIds) => {
    if (!(await new ConversationReader(pool, "pact").assertSelectable(accountId, contextIds))) {
      throw new RunError("FORBIDDEN");
    }
  },
});
const externalActivity = new ExternalAgentActivity(
  pool,
  "pact",
  clock,
  activityStateResolver(
    new OwnerRecordStates(pool, "pact", world),
    new ApprovalStatusReader(pool, "pact", clock, new URL(publicBaseUrl).pathname),
  ),
);
const social = new SocialService(
  "pact",
  new ResourceLedger("pact"),
  new ActionLimitService("pact"),
  clock,
  new ImmediateExposureAdapter(new ExposureService("pact")),
  async (client, accountId) => {
    try {
      await moderation.assertAllowed(client, accountId, "messaging");
    } catch (error) {
      if (error instanceof ModerationError) throw new DispatcherError("FORBIDDEN");
      throw error;
    }
  },
);
const courts = new CourtService(pool, "pact", clock);
const courtInvitations = new CourtInvitationDestination("pact", clock, courts);
const troops = new TroopService(
  "pact",
  new ResourceLedger("pact"),
  new ImmediateExposureAdapter(new ExposureService("pact")),
);
const humanPermits = new ExactHumanPermitService("pact");
const buildingLedger = new ResourceLedger("pact");
const buildings = new BuildingEngine(
  "pact",
  buildingLedger,
  new ConstructionExposureAdapter("pact", new ExposureService("pact", humanPermits), buildingLedger),
);
const retirementLedger = new ResourceLedger("pact");
const retirementExposure = new ExposureService("pact", humanPermits);
const retirementSupplyAuthority = new SupplyExposureAdapter(retirementExposure);
const supply = new SupplyService(
  "pact",
  retirementLedger,
  new ActionLimitService("pact"),
  social,
  retirementSupplyAuthority,
);
const supplySettlement = new SupplySettlementService(
  "pact",
  retirementLedger,
  { read: (client, accountId, resource) => readReserveFloor(client, "pact", accountId, resource) },
  retirementSupplyAuthority,
);
const scouts = new ScoutService("pact", retirementLedger, troops, new ActionLimitService("pact"), retirementExposure);
const garrison = new GarrisonService("pact", retirementLedger, troops, retirementExposure, humanPermits);
const raids = environment.RAID_SEED_ENCRYPTION_KEY_BASE64
  ? new RaidService(
      "pact",
      retirementLedger,
      troops,
      new ActionLimitService("pact"),
      retirementExposure,
      new RaidRandomnessService("pact", Buffer.from(environment.RAID_SEED_ENCRYPTION_KEY_BASE64, "base64")),
      garrison,
    )
  : undefined;
const reports = new GameReportReader(pool, scouts, raids);
const seals = new SealService(pool, "pact", clock, reports);
const chronicle = new ChronicleService(
  pool,
  "pact",
  clock,
  seals,
  new ChronicleFactReader("pact", clock, new ChronicleOutcomeReader("pact")),
  social,
);
const invitations = new InvitationService(pool, "pact", social, clock, {
  court: courtInvitations,
  notice: chronicle.destination("notice"),
  story: chronicle.destination("story"),
});
const gameCommands = new GameCommandHandler(
  social,
  (client, accountId, holderId) => runs.assertAgentWriteLease(client, accountId, holderId),
  kingdom,
  troops,
  buildings,
  humanPermits,
  supply,
  supplySettlement,
  retirementExposure,
  scouts,
  garrison,
  raids,
  (client, accountId, holderId) => runs.consumeOutgoingMessageAllowance(client, accountId, holderId),
);
const dispatcher = new CommandDispatcher({
  pool,
  assertPlayAllowed: async (client, accountId) => {
    try {
      await moderation.assertAllowed(client, accountId, "play");
    } catch (error) {
      if (error instanceof ModerationError) throw new DispatcherError("FORBIDDEN");
      throw error;
    }
  },
  clock,
  productScope: ProductScopeSchema.parse("pact"),
  onCommittedReceipt: async (client, principal, command, receipt) => {
    if (principal.agentOrigin !== "external" || !principal.sessionId) return;
    const proposed =
      !command.action.kind.endsWith("withdraw") &&
      Object.keys(receipt.recordVersions).some((key) => /^(supply-offer|garrison-offer|contact-request):/.test(key)) &&
      !Object.keys(receipt.recordVersions).some((key) => /^(supply-contract|garrison-contract):/.test(key));
    await externalActivity.record(client, {
      accountId: principal.accountId,
      sessionId: principal.sessionId,
      summary: { ...receipt, actionKind: command.action.kind, disposition: proposed ? "proposed" : "committed" },
    });
  },
  social: new SocialCommandHandler(invitations, courts, politics, seals, chronicle, social),
  game: {
    admit: async (operation) => world.admitCommand((client, snapshot) => operation(client, snapshot.gameTimeMs)),
    execute: (client, principal, command, gameTimeMs) => gameCommands.execute(client, principal, command, gameTimeMs),
  },
});
const oauth = new OAuthService(pool, {
  productScope: "pact",
  issuer: publicBaseUrl,
  mcpResource: `${publicBaseUrl}/mcp`,
  ...(environment.PACT_A2A_ENABLED === "1" ? { a2aResource: `${publicBaseUrl}/a2a` } : {}),
  // The owned old edge still proxies this same application, accounts and OAuth registry.
  mcpResourceAliases:
    publicBaseUrl === "https://pact.tinyagenttools.com" ? ["https://tinyagenttools.com/pact/mcp"] : [],
  humanResource: `${publicBaseUrl}/native`,
  clock,
});
await oauth.registerPreregisteredClient({
  clientId: "pact-native",
  displayName: "PACT native app",
  audience: "human",
  redirectUris: [`${publicBaseUrl}/native/callback`],
});
const authority = new AuthorityService(pool, { productScope: "pact", identity, now: clock.now });
const approvals = new ApprovalService(pool, {
  productScope: "pact",
  identity,
  dispatcher,
  clock,
  origin: environment.PACT_ORIGIN,
  webBasePath: new URL(publicBaseUrl).pathname,
  assertAgentWriteLease: (client, accountId, holderId) => runs.assertAgentWriteLease(client, accountId, holderId),
  inbox,
});
const privateMemory = new PrivateMemoryService(pool, "pact", { read: (client) => world.read(client), now: clock.now });
const persistentPlay = new PersistentPlayService(pool, "pact", {
  clock,
  runs,
  routeAvailable: (client, accountId, id, provider) =>
    storedCredentialRouteAvailable(client, "pact", accountId, id, provider),
});
async function publicAgentActivity(accountIds: string[]) {
  const [runs, observed] = await Promise.all([
    externalActivity.councilActivity(accountIds),
    mcp.councilObservations(accountIds),
  ]);
  for (const id of accountIds) {
    const previous = runs[id] ?? { lastObservedAt: null, runActive: false };
    const contact = observed[id];
    runs[id] = {
      ...previous,
      lastObservedAt:
        contact && (!previous.lastObservedAt || contact > previous.lastObservedAt) ? contact : previous.lastObservedAt,
    };
  }
  return runs;
}
const mcp = new McpTransport({
  persistentPlay,
  privateMemory,
  pool,
  productScope: "pact",
  dispatcher,
  origin: environment.PACT_ORIGIN,
  clock,
  worldViews,
  decisionSupport: new DecisionSupportReader(worldViews, socialOverview),
  notes: {
    read: (accountId) => kingdom.readNotes(accountId),
    write: (accountId, text, version) => kingdom.writeNotes(accountId, text, version),
  },
  playView: {
    read: (accountId, query) => readCouncil(accountId, query ?? { search: "", offset: 0 }),
  },
  councilThreads: { read: (accountId, peerId, before) => council.thread(accountId, peerId, before) },
  conversationHistory: {
    agreements: (accountId, peerId, before) => council.history.agreements(accountId, peerId, before),
    versions: (accountId, peerId, offerId, before) => council.history.versions(accountId, peerId, offerId, before),
  },
  agentGuide: new AgentGuideReader(worldViews, socialOverview, authority),
  seasons: {
    read: (query, accountId) =>
      withTransaction(pool, (c) => seasonViews.readCurrent(c, query.cohortStartGameTimeMs, accountId), {
        isolation: "REPEATABLE READ",
      }),
  },
  kingdomDiscovery: new KingdomDiscoveryReader(pool, "pact", clock.now, publicAgentActivity),
  publicProfiles: { read: (handle) => worldViews.publicProfile(handle) },
  courts: { read: (handle, offset, accountId) => courts.read(handle, offset, accountId) },
  seals: { read: (id, accountId) => seals.read(id, accountId) },
  chronicle: { read: async (query, accountId) => chronicle.read(query, (await world.read()).gameTimeMs, accountId) },
  runReports: {
    read: async (id, accountId) =>
      id
        ? runs.report(id, accountId)
        : { ...(await runs.list(accountId)), external: await externalActivity.read(accountId) },
  },
  activity: {
    record: (accountId, sessionId, summary) => externalActivity.record(pool, { accountId, sessionId, summary }),
  },
  politics: {
    read: async (handle, offset, accountId) =>
      politics.read(handle, offset, accountId, (await world.read()).gameTimeMs),
  },
  profile: {
    read: async (accountId) => {
      const owner = await kingdom.getByAccount(accountId);
      return owner ? { nickname: `${owner.handle} — PACT kingdom` } : {};
    },
  },
  reports,
  inbox,
  ...(process.env.PACT_AGENT_OUTLOOK_ENABLED === "1" ? { agentOutlook } : {}),
  ...(process.env.PACT_AGENT_EVENTS_ENABLED === "1" ? { agentEvents } : {}),
  conversations: new ConversationReader(pool, "pact"),
  approvals: new ApprovalStatusReader(pool, "pact", clock, new URL(publicBaseUrl).pathname),
  approvalProposals: approvals,
  runLeases: runs,
});
const council = new CouncilReader(pool, "pact", socialOverview, publicAgentActivity, clock.now);
async function readCouncil(
  accountId: string,
  query: { search: string; offset: number },
  human = false,
): Promise<Record<string, unknown>> {
  const players = await kingdom.discoverKingdoms(accountId, query.search, query.offset);
  const details = await council.read(
    accountId,
    players.players.map((p) => p.kingdomId),
    human,
  );
  return {
    world: await worldViews.readSelf(accountId),
    ...details,
    players,
    characterEditUrl: new URL("?envoy=edit", publicBaseUrl).href,
    decisions: (await approvals.pendingForAccount(accountId)).approvals.map((approval) => ({
      effectsSummary: approval.effectsSummary,
      expiresAt: approval.expiresAt,
      reviewUrl: new URL(approval.deepLinkPath, publicBaseUrl).href,
    })),
    untrustedContent: true,
  };
}
const credentialVault = environment.MODEL_CREDENTIAL_WRAPPING_PUBLIC_KEY_FILE
  ? new CredentialVaultService(pool, {
      productScope: "pact",
      clock,
      wrapper: new RsaOaepPublicKeyWrapper(
        await readFile(environment.MODEL_CREDENTIAL_WRAPPING_PUBLIC_KEY_FILE, "utf8"),
        environment.MODEL_CREDENTIAL_WRAPPING_KEY_ID,
      ),
    })
  : undefined;
const openRouter = new OpenRouterAuthService(pool, { productScope: "pact", clock });
const retirement = new KingdomRetirementService(
  "pact",
  world,
  retirementLedger,
  supply,
  supplySettlement,
  garrison,
  buildings,
  troops,
);
const privacy = new PrivacyService(pool, {
  productScope: "pact",
  clock,
  retirement,
  ownedData: [
    new CollectionService("pact").retention,
    new CollectionStoriesService(pool, "pact").retention,
    persistentPlay.retention,
    privateMemory.retention,
    externalActivity.retention,
    council.retention,
    notifications.retention,
    agentEvents.retention,
    moderation.retention,
    social.retention,
    council.history.retention,
    botRetention("pact"),
    {
      name: "kingdomExperience",
      forgetAccount: (c, id) => kingdom.forgetExperience(c, id),
      exportAccount: (c, id) => kingdom.exportExperience(c, id),
      prune: async () => 0,
    },
    {
      name: "seasonHonors",
      forgetAccount: (c, id) => honors.forgetAccount(c, id),
      exportAccount: (c, id) => honors.exportAccount(c, id),
      prune: (c, now) => honors.prune(c, now),
    },
    {
      name: "seasons",
      forgetAccount: (c, id) => seasons.forgetAccount(c, id),
      exportAccount: (c, id) => seasons.exportAccount(c, id),
      prune: (c, now) => seasons.prune(c, now),
    },
    {
      name: "chronicle",
      forgetAccount: (c, id) => chronicle.forgetAccount(c, id),
      prune: (c, now) => chronicle.prune(c, now),
      exportAccount: (c, id) => chronicle.exportAccount(c, id),
    },
    {
      name: "seals",
      forgetAccount: (client, accountId) => seals.forgetAccount(client, accountId),
      prune: (client, now) => seals.prune(client, now),
      exportAccount: (client, accountId) => seals.exportAccount(client, accountId),
    },
    {
      name: "politics",
      forgetAccount: (client, accountId) => politics.forgetAccount(client, accountId),
      prune: (client, now) => politics.prune(client, now),
      exportAccount: (client, accountId) => politics.exportAccount(client, accountId),
    },
    {
      name: "courtDestinations",
      forgetAccount: (client, accountId) => courtInvitations.forgetAccount(client, accountId),
      prune: (client, now) => courtInvitations.prune(client, now),
      exportAccount: (client, accountId) => courtInvitations.exportAccount(client, accountId),
    },
    {
      name: "destinationInvitations",
      exportAccount: (client, accountId) => invitations.exportAccount(client, accountId),
      forgetAccount: (client, accountId) => invitations.forgetAccount(client, accountId),
      prune: async (client, now) =>
        invitations.prune(client, new Date(now.getTime() - 30 * 86_400_000), (await world.read()).gameTimeMs),
    },
  ],
  ...(environment.PACT_DELETION_REGISTRY_FILE
    ? { deletionRegistry: new FileDeletionRegistry(environment.PACT_DELETION_REGISTRY_FILE) }
    : {}),
});
const telegramBot = environment.TELEGRAM_BOT_ID
  ? new TelegramBotService(pool, {
      productScope: "pact",
      clock,
      botId: environment.TELEGRAM_BOT_ID,
      miniAppUrl: publicBaseUrl + "/telegram/",
      secretBox: new AesGcmSecretBox(Buffer.from(environment.IDENTITY_ENCRYPTION_KEY, "base64url")),
      ports: {
        validateSettings: async (accountId, settings) => {
          if (!credentialVault) throw new TelegramError("FORBIDDEN");
          const saved = (await credentialVault.list(accountId)).find(
            (c) => c.id === settings.credentialId && c.provider === settings.provider && c.status === "active",
          );
          if (!saved) throw new TelegramError("FORBIDDEN");
        },
        start: async (client, accountId, objective, settings) => {
          await moderation.assertAllowed(client, accountId, "play");
          return runs.start(
            {
              accountId,
              objective,
              provider: settings.provider,
              model: settings.model,
              credentialId: settings.credentialId,
              limits: {
                maxCalls: settings.maxCalls,
                maxTokens: settings.maxTokens,
                maxMessages: settings.maxMessages,
                maxConversations: settings.maxConversations,
              },
            },
            client,
          );
        },
        stop: async (client, accountId, runIds) => {
          if (runIds) {
            for (const id of runIds) {
              try {
                await runs.stop(accountId, id, client);
              } catch (error) {
                if (!(error instanceof RunError && error.code === "NOT_FOUND")) throw error;
              }
            }
          } else await runs.takeover(accountId, accountId, client);
        },
        read: async (accountId, command) => {
          if (command === "world") {
            const view = await worldViews.readSelf(accountId);
            if (!view) return "No active kingdom. Open PACT to complete setup.";
            return (
              "@" +
              view.profile.handle +
              " / " +
              view.worldStatus +
              " / tick " +
              view.committedTickSequence +
              " / game " +
              view.asOfGameTimeMs +
              "ms\n" +
              Object.entries(view.balances)
                .map(
                  ([name, b]) =>
                    name +
                    ": " +
                    b.facts.ordinaryWhole +
                    " ordinary; " +
                    b.facts.allowanceWhole +
                    " founding; " +
                    b.facts.lockedWhole +
                    " locked",
                )
                .join("\n") +
              "\nBuilders: " +
              view.builders.map((b) => (b.kind ? b.kind + " (" + b.state + ")" : "idle")).join(", ") +
              "\nThese are committed game facts; no inference ran."
            );
          }
          if (command === "inbox") {
            const page = await inbox.list(accountId, undefined);
            return (
              "Latest owner inbox events:\n" +
              page.events
                .slice(-8)
                .map((e) => e.type + " / " + e.eventId)
                .join("\n") +
              "\nOpen PACT for complete authenticated details and exact approval sheets. No inference ran."
            );
          }
          const list = await runs.list(accountId);
          return (
            "Envoy runs:\n" +
            list.runs
              .slice(0, 5)
              .map(
                (r) =>
                  r.runId +
                  " / " +
                  r.status +
                  " / " +
                  r.provider +
                  "/" +
                  r.model +
                  " / " +
                  r.usedCalls +
                  "/" +
                  r.maxCalls +
                  " calls / " +
                  r.usedTokens +
                  "/" +
                  r.maxTokens +
                  " tokens",
              )
              .join("\n") +
            "\n/status is a read. /stop releases the shared lease and stops further PACT inference; externally hosted agents must also be stopped in their host."
          );
        },
      },
    })
  : undefined;
const telegram =
  environment.TELEGRAM_BOT_ID && environment.TELEGRAM_BOT_TOKEN && environment.TELEGRAM_WEBHOOK_SECRET
    ? new TelegramService(pool, {
        productScope: "pact",
        botId: environment.TELEGRAM_BOT_ID,
        botToken: environment.TELEGRAM_BOT_TOKEN,
        webhookSecret: environment.TELEGRAM_WEBHOOK_SECRET,
        clock,
        ...(telegramBot
          ? {
              processBotUpdate: (c: import("pg").PoolClient, update: unknown) => telegramBot.process(c, update),
              unlinkBot: (c: import("pg").PoolClient, id: string) => telegramBot.unlink(c, id),
            }
          : {}),
        issueHumanSession: (accountId, label) => identity.createLinkedHumanSession(accountId, label),
        revokeHumanSessions: (accountId, sessionIds) => identity.revokeLinkedHumanSessions(accountId, sessionIds),
      })
    : undefined;
const server = buildServer(pool, { level: environment.LOG_LEVEL }, undefined, {
  admin: {
    reader: new AdminReader(pool, "pact"),
    provision: new AdminProvisioning(pool, "pact", new LocalCompromisedPasswordChecker(compromisedPasswordDigests)),
    ...(await readFile("/etc/pact/operator/admin-setup.json", "utf8")
      .then((s) => ({ setup: JSON.parse(s) as AdminSetup }))
      .catch((e: NodeJS.ErrnoException) => {
        if (e.code !== "ENOENT") throw e;
        return {};
      })),
  },
  identity,
  onboarding,
  kingdom,
  worldViews,
  kingdomDiscovery: new KingdomDiscoveryReader(pool, "pact", clock.now, publicAgentActivity),
  decisionSupport: new DecisionSupportReader(worldViews, socialOverview),
  privateMemory,
  collections: new CollectionStoriesService(pool, "pact"),
  persistentPlay,
  socialOverview,
  council,
  readCouncil,
  invitations,
  seasons: seasonViews,
  courts,
  politics,
  seals,
  chronicle,
  gameTime: async () => (await world.read()).gameTimeMs,
  reports,
  dispatcher,
  oauth,
  authority,
  mcp,
  a2aEnabled: environment.PACT_A2A_ENABLED === "1",
  a2aBaseUrl: publicBaseUrl,
  approvals,
  inbox,
  ...(process.env.PACT_AGENT_OUTLOOK_ENABLED === "1" ? { agentOutlook } : {}),
  ...(process.env.PACT_AGENT_EVENTS_ENABLED === "1" ? { agentEvents } : {}),
  runs,
  externalActivity,
  openRouter,
  privacy,
  notifications,
  moderation,
  webPushPublicKey: environment.WEB_PUSH_PUBLIC_KEY,
  ...(credentialVault ? { credentialVault } : {}),
  ...(telegram ? { telegram } : {}),
  ...(telegramBot ? { telegramBot } : {}),
  origin: environment.PACT_ORIGIN,
  operatorPreflight,
});

// A restored backup must have deletion tombstones reapplied before the API accepts traffic.
await privacy.replayDeletionRegistry();
const privacyMaintenance = setInterval(
  () =>
    void privacy.runRetention().catch((error: unknown) => server.log.error({ err: error }, "privacy retention failed")),
  24 * 60 * 60_000,
);

const moderationWorkerId = "api-moderation-" + randomUUID();
const moderationMaintenance = setInterval(
  () =>
    void moderation
      .processClosures(moderationWorkerId)
      .catch((error: unknown) => server.log.error({ err: error }, "moderation closure failed")),
  2000,
);
const shutdown = async (): Promise<void> => {
  clearInterval(moderationMaintenance);
  clearInterval(privacyMaintenance);
  await server.close();
  await pool.end();
};
process.once("SIGINT", () => {
  void shutdown();
});
process.once("SIGTERM", () => {
  void shutdown();
});

await server.listen({ host: environment.HOST, port: environment.PORT });

import { DecisionSupportReader } from "@pact/application";
