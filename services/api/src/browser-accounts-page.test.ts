import { Script } from "node:vm";
import { expect, it } from "vitest";
import { browserAccountsPage } from "./browser-accounts-page.js";

it("keeps untrusted client names and query text inside escaped HTML/script data", () => {
  const page = browserAccountsPage({
    clientName: '</h1><script>alert("fixture")</script>',
    scopes: ["world:read"],
    query: { state: "</script><script>fixture</script>", redirect_uri: "https://client.example/cb" },
    issuer: "https://pact.example",
  });
  expect(page.match(/<script>/g)).toHaveLength(1);
  expect(page).toContain("&lt;script&gt;");
  const source = page.split("<script>")[1]?.split("</script>")[0];
  expect(source).toBeDefined();
  expect(() => new Script(source ?? "")).not.toThrow();
  expect(() => new Script(browserAccountsPage().split("<script>")[1]?.split("</script>")[0] ?? "")).not.toThrow();
});
