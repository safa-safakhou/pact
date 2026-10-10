import { createPool, createSchemaPool, createTestSchema, dropTestSchema } from "@pact/db";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildServer } from "../../services/api/src/server.js";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
let admin: Pool;
let pool: Pool;
let schema: string;

beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "smoke");
  pool = createSchemaPool(connectionString, schema);
});

afterAll(async () => {
  await pool.end();
  await dropTestSchema(admin, schema);
  await admin.end();
});

describe("API/database smoke", () => {
  it("reports process and migrated database readiness", async () => {
    const server = buildServer(pool, false);
    const health = await server.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ status: "ok" });
    const ready = await server.inject({ method: "GET", url: "/ready" });
    expect(ready.statusCode).toBe(200);
    expect(ready.json()).toEqual({ status: "ready" });
    expect((await pool.query("SELECT name FROM app_migrations ORDER BY name")).rows).toEqual([
      { name: "0001_platform_foundation.sql" },
      { name: "0002_outbox_delivery_leases.sql" },
      { name: "0003_outbox_correlation.sql" },
      { name: "0004_identity_security.sql" },
      { name: "0005_private_kingdom_drafts.sql" },
      { name: "0006_sandbox_dispatcher.sql" },
      { name: "0007_oauth_authorization.sql" },
      { name: "0008_mandates_authority.sql" },
      { name: "0009_mcp_sessions.sql" },
      { name: "0010_approval_requests.sql" },
      { name: "0011_inbox_acknowledgements.sql" },
      { name: "0012_credential_vault.sql" },
      { name: "0013_envoy_runs.sql" },
      { name: "0013a_run_tool_results.sql" },
      { name: "0014_openrouter_oauth.sql" },
      { name: "0015_telegram_channel.sql" },
      { name: "0016_account_privacy.sql" },
      { name: "0017_world_clock.sql" },
      { name: "0018_resource_ledger.sql" },
      { name: "0019_kingdom_founding.sql" },
      { name: "0020_building_queues.sql" },
      { name: "0021_troop_training.sql" },
      { name: "0022_upkeep_hunger.sql" },
      { name: "0023_action_limits.sql" },
      { name: "0024_social_contacts.sql" },
      { name: "0025_supply_offers.sql" },
      { name: "0026_supply_settlement.sql" },
      { name: "0027_future_exposure.sql" },
      { name: "0028_raid_randomness.sql" },
      { name: "0029_garrison_contracts.sql" },
      { name: "0030_scout_reports.sql" },
      { name: "0031_raids.sql" },
      { name: "0032_fortune.sql" },
      { name: "0033_achievements.sql" },
      { name: "0034_kingdom_retirement.sql" },
      { name: "0035_envoy_context_selection.sql" },
      { name: "0036_destination_invitations.sql" },
      { name: "0037_court_invitation_destinations.sql" },
      { name: "0038_court_management.sql" },
      { name: "0039_articles_allegiance.sql" },
      { name: "0040_evidence_seals.sql" },
      { name: "0041_chronicle.sql" },
      { name: "0042_seasons.sql" },
      { name: "0043_season_honors.sql" },
      { name: "0044_external_agent_activity.sql" },
      { name: "0045_kingdom_ambition.sql" },
      { name: "0046_optional_notifications.sql" },
      { name: "0047_game_notification_projection.sql" },
      { name: "0048_staff_mfa_sessions.sql" },
      { name: "0049_moderation_cases.sql" },
      { name: "0050_bot_controls.sql" },
      { name: "0051_guest_play.sql" },
      { name: "0052_freeform_notes.sql" },
      { name: "0053_mcp_grant_sessions.sql" },
      { name: "0054_council_characters.sql" },
      { name: "0055_guest_account_recovery.sql" },
      { name: "0056_communication_capacity.sql" },
      { name: "0057_revoked_guest_keys.sql" },
      { name: "0058_conversation_tool_capacity.sql" },
      { name: "0059_conversation_history.sql" },
    ]);
    await server.close();
  });
});
