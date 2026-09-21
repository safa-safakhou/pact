import { describe, expect, it } from "vitest";
import { readEnvironment } from "./config.js";

describe("environment validation", () => {
  it("accepts unrelated process variables and applies safe defaults", () => {
    expect(readEnvironment({ DATABASE_URL: "postgres://localhost/pact", SHELL: "/bin/zsh" })).toMatchObject({
      NODE_ENV: "development",
      HOST: "127.0.0.1",
      PORT: 3000,
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
});
