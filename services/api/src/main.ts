import { readFile } from "node:fs/promises";
import { clearInterval, setInterval } from "node:timers";
import { CommandDispatcher, GameCommandHandler } from "@pact/application";
import { ApprovalService, ApprovalStatusReader } from "@pact/approvals";
import { AuthorityService, ExactHumanPermitService, ExposureService, readReserveFloor } from "@pact/authority";
import { ProductScopeSchema } from "@pact/contracts";
import { CredentialVaultService, RsaOaepPublicKeyWrapper } from "@pact/credential-vault";
import { createPool } from "@pact/db";
import {
  AesGcmSecretBox,
  baselineCompromisedPasswordDigests,
  IdentityService,
  LocalCompromisedPasswordChecker,
  TokenDigester,
} from "@pact/identity";
import { InboxService } from "@pact/inbox";
import {
  ActionLimitService,
  BuildingEngine,
  ConstructionExposureAdapter,
  ConversationReader,
  GarrisonService,
  ImmediateExposureAdapter,
  KingdomRetirementService,
  KingdomService,
  RaidRandomnessService,
  RaidService,
  ScoutService,
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
import { RunError, RunService } from "@pact/runs";
import { TelegramService } from "@pact/telegram";
import { WorldClockService } from "@pact/world";
import { AgentGuideReader } from "./agent-guide.js";
import { readEnvironment } from "./config.js";
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
  productScope: "pact",
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
const worldViews = new WorldViewService(pool, "pact");
const socialOverview = new SocialOverviewReader(pool, "pact");
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
const social = new SocialService(
  "pact",
  new ResourceLedger("pact"),
  new ActionLimitService("pact"),
  clock,
  new ImmediateExposureAdapter(new ExposureService("pact")),
);
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
  clock,
  productScope: ProductScopeSchema.parse("pact"),
  game: {
    admit: async (operation) => world.admitCommand((client, snapshot) => operation(client, snapshot.gameTimeMs)),
    execute: (client, principal, command, gameTimeMs) => gameCommands.execute(client, principal, command, gameTimeMs),
  },
});
const oauth = new OAuthService(pool, {
  productScope: "pact",
  issuer: publicBaseUrl,
  mcpResource: `${publicBaseUrl}/mcp`,
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
  assertAgentWriteLease: (client, accountId, holderId) => runs.assertAgentWriteLease(client, accountId, holderId),
  inbox,
});
const mcp = new McpTransport({
  pool,
  productScope: "pact",
  dispatcher,
  origin: environment.PACT_ORIGIN,
  clock,
  worldViews,
  agentGuide: new AgentGuideReader(worldViews, socialOverview, authority),
  reports,
  inbox,
  conversations: new ConversationReader(pool, "pact"),
  approvals: new ApprovalStatusReader(pool, "pact", clock),
  approvalProposals: approvals,
  runLeases: runs,
});
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
  ...(environment.PACT_DELETION_REGISTRY_FILE
    ? { deletionRegistry: new FileDeletionRegistry(environment.PACT_DELETION_REGISTRY_FILE) }
    : {}),
});
const telegram =
  environment.TELEGRAM_BOT_ID && environment.TELEGRAM_BOT_TOKEN && environment.TELEGRAM_WEBHOOK_SECRET
    ? new TelegramService(pool, {
        productScope: "pact",
        botId: environment.TELEGRAM_BOT_ID,
        botToken: environment.TELEGRAM_BOT_TOKEN,
        webhookSecret: environment.TELEGRAM_WEBHOOK_SECRET,
        clock,
        issueHumanSession: (accountId, label) => identity.createLinkedHumanSession(accountId, label),
        revokeHumanSessions: (accountId, sessionIds) => identity.revokeLinkedHumanSessions(accountId, sessionIds),
      })
    : undefined;
const server = buildServer(pool, { level: environment.LOG_LEVEL }, undefined, {
  identity,
  onboarding,
  kingdom,
  worldViews,
  socialOverview,
  reports,
  dispatcher,
  oauth,
  authority,
  mcp,
  approvals,
  inbox,
  runs,
  openRouter,
  privacy,
  ...(credentialVault ? { credentialVault } : {}),
  ...(telegram ? { telegram } : {}),
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

const shutdown = async (): Promise<void> => {
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
