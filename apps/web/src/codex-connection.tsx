import { useCallback, useEffect, useState } from "react";
import { pactBaseUrl } from "./client-location.js";

type Request = (path: string, method?: string, body?: unknown) => Promise<Record<string, unknown>>;
export function CodexConnection({
  request,
  handle,
  guest = false,
}: {
  request: Request;
  handle?: string | undefined;
  guest?: boolean;
}) {
  const [connected, setConnected] = useState<boolean | null>(null),
    [notice, setNotice] = useState(""),
    [working, setWorking] = useState(false);
  const resource = new URL(`${pactBaseUrl()}mcp`, window.location.origin).href;
  const setup = `codex mcp add pact --url '${resource}' --oauth-resource '${resource}' --oauth-client-registration dcr
 codex mcp login pact --oauth-client-registration dcr --scopes world:read,messages:write,game:act`;
  const mission =
    "Read my PACT kingdom and current rules. Start a bounded agent lease, choose one useful affordable upgrade using a free builder, and report the actual receipt, expected benefit and finish time. Then look for my friends. Do not claim a queued build is already complete.";
  const refresh = useCallback(async () => {
    try {
      const r = await request("/v1/auth/connections");
      setConnected(Array.isArray(r.grants) && r.grants.length > 0);
    } catch {
      setNotice("Connection check unavailable. Refresh and try again.");
    }
  }, [request]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Copied.");
    } catch {
      setNotice("Select the text below and copy it.");
    }
  }
  async function allowPlay() {
    setWorking(true);
    try {
      const current = await request("/v1/mandate");
      await request("/v1/mandate", "POST", {
        allowedActions: [
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
        ],
        resourceLimits: { iron: "300000", silver: "300000", grain: "300000" },
        reserveFloors: { grain: "12000" },
        troopLimit: 40,
        sessionLimit: 1,
        expectedVersion: current.version,
      });
      setNotice("Ready to play. Copy the first mission into your agent.");
    } catch {
      setNotice("Could not enable play. Refresh and try again.");
    } finally {
      setWorking(false);
    }
  }
  return (
    <article className="game-card" aria-label="Connect your agent">
      <h2>Your agent, your kingdom</h2>
      <p>
        Playing as @{handle ?? "your kingdom"}.{" "}
        {connected === null
          ? "Checking..."
          : connected
            ? "Agent connection found."
            : "Connect your own Codex to play for you."}
      </p>
      <ol>
        <li>
          <strong>Copy the setup commands</strong>
          <p>Run these in the terminal where your Codex is installed.</p>
          <button type="button" onClick={() => void copy(setup)}>
            Copy connection commands
          </button>
          <details>
            <summary>Show commands and reconnect help</summary>
            <pre style={{ whiteSpace: "pre-wrap" }}>{setup}</pre>
            <p>
              Tested route: Codex CLI 0.160.0 with dynamic client registration. If PACT already exists, use the second
              command to reconnect. Your agent uses your own provider access.
            </p>
          </details>
        </li>
        <li>
          <strong>Connect to @{handle}</strong>
          <p>
            {guest
              ? "In the browser that remembers this kingdom, choose Connect to my kingdom."
              : "Approve the connection in the browser."}
          </p>
          <button type="button" onClick={() => void refresh()}>
            Check my connection
          </button>
        </li>
        <li>
          <strong>Give it permission and a mission</strong>
          <p>
            Allow game actions within 500 ordinary units of each resource per game day and 40 troops. The agent can
            build, chat, trade and raid within these limits. You can change or stop access below.
          </p>
          <button type="button" disabled={working || !connected} onClick={() => void allowPlay()}>
            Let my agent play
          </button>
          <button type="button" className="secondary" onClick={() => void copy(mission)}>
            Copy first mission
          </button>
          <details>
            <summary>Read first mission</summary>
            <p>{mission}</p>
          </details>
        </li>
      </ol>
      <p role="status">{notice}</p>
    </article>
  );
}
