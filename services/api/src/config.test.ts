import { describe, expect, it } from "vitest";
import { readEnvironment } from "./config.js";

describe("environment validation", () => {
  it("accepts unrelated process variables and applies safe defaults", () => {
    expect(readEnvironment({ DATABASE_URL: "postgres://localhost/pact", SHELL: "/bin/zsh" })).toMatchObject({
      NODE_ENV: "development",
      HOST: "127.0.0.1",
      PORT: 3000,
      PACT_A2A_ENABLED: "0",
    });
  });

  it("rejects a non-PostgreSQL database URL", () => {
    expect(() => readEnvironment({ DATABASE_URL: "https://example.com" })).toThrow();
  });

  it("accepts a same-origin public path prefix", () => {
    expect(
      readEnvironment({
        DATABASE_URL: "postgres://localhost/pact",
        PACT_ORIGIN: "https://pact.example/",
        PACT_PUBLIC_BASE_URL: "https://pact.example/pact",
      }).PACT_PUBLIC_BASE_URL,
    ).toBe("https://pact.example/pact");
  });

  it("rejects a cross-origin public base URL", () => {
    expect(() =>
      readEnvironment({
        DATABASE_URL: "postgres://localhost/pact",
        PACT_ORIGIN: "https://pact.example",
        PACT_PUBLIC_BASE_URL: "https://attacker.example/pact",
      }),
    ).toThrow();
  });

  it("rejects development identity secrets and a missing compromised-password set in production", () => {
    expect(() => readEnvironment({ DATABASE_URL: "postgres://localhost/pact", NODE_ENV: "production" })).toThrow();
  });

  it("validates the shared raid-seed encryption key", () => {
    expect(() =>
      readEnvironment({ DATABASE_URL: "postgres://localhost/pact", RAID_SEED_ENCRYPTION_KEY_BASE64: "bad" }),
    ).toThrow();
    expect(
      readEnvironment({
        DATABASE_URL: "postgres://localhost/pact",
        RAID_SEED_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 7).toString("base64"),
      }).RAID_SEED_ENCRYPTION_KEY_BASE64,
    ).toBe(Buffer.alloc(32, 7).toString("base64"));
  });
  it("optional A2A accepts explicit enablement, rejects invalid flags and requires production HTTPS", () => {
    expect(readEnvironment({ DATABASE_URL: "postgres://localhost/pact", PACT_A2A_ENABLED: "1" }).PACT_A2A_ENABLED).toBe(
      "1",
    );
    expect(() => readEnvironment({ DATABASE_URL: "postgres://localhost/pact", PACT_A2A_ENABLED: "yes" })).toThrow();
    const production = {
      DATABASE_URL: "postgres://localhost/pact",
      NODE_ENV: "production",
      IDENTITY_TOKEN_PEPPER: "a".repeat(43),
      IDENTITY_ENCRYPTION_KEY: "b".repeat(43),
      COMPROMISED_PASSWORD_SHA256_FILE: "/fixture/digests",
      MODEL_CREDENTIAL_WRAPPING_PUBLIC_KEY_FILE: "/fixture/public",
      PACT_DELETION_REGISTRY_FILE: "/fixture/deletions",
      RAID_SEED_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 7).toString("base64"),
      PACT_A2A_ENABLED: "1",
    };
    expect(() => readEnvironment({ ...production, PACT_ORIGIN: "http://pact.example" })).toThrow(
      "Production A2A requires",
    );
    expect(readEnvironment({ ...production, PACT_ORIGIN: "https://pact.example" }).PACT_A2A_ENABLED).toBe("1");
  });
});
