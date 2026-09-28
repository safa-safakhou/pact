import { describe, expect, it } from "vitest";
import { readWebResponse } from "./web-response.js";

describe("web API response handling", () => {
  it("reports an empty gateway failure by status instead of a JSON parse error", async () => {
    await expect(readWebResponse(new Response(null, { status: 502 }))).rejects.toThrow("HTTP_502");
  });

  it("preserves a structured server error", async () => {
    await expect(
      readWebResponse(Response.json({ error: { code: "AUTHENTICATION_REQUIRED" } }, { status: 401 })),
    ).rejects.toThrow("AUTHENTICATION_REQUIRED");
  });

  it("rejects malformed successful responses", async () => {
    await expect(readWebResponse(new Response("not JSON", { status: 200 }))).rejects.toThrow("INVALID_RESPONSE");
    await expect(readWebResponse(new Response(null, { status: 200 }))).rejects.toThrow("INVALID_RESPONSE");
  });
});
