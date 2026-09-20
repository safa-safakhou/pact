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
});
