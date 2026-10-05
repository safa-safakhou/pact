import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { configureClientBase } from "../../web/src/client-location.js";
import { GameApp, type GameHost } from "../../web/src/game-app.js";
import "../../web/src/styles.css";
import "./styles.css";
import { bindHost, subscribeBack } from "./host.js";
import { resolvePactOrigin, telegramConfirmationUrl } from "./urls.js";

const apiOrigin = resolvePactOrigin(import.meta.env.BASE_URL, import.meta.env.VITE_PACT_ORIGIN, window.location.origin);
configureClientBase(apiOrigin);
const host = window.Telegram?.WebApp;
async function request(path: string, body: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(new URL(path, apiOrigin), {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const value = (await response.json()) as { error?: { code?: string } };
  if (!response.ok) throw new Error(value.error?.code ?? "REQUEST_FAILED");
  return value as Record<string, unknown>;
}
function App() {
  const [csrf, setCsrf] = useState("");
  const [bootstrap, setBootstrap] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => (host ? bindHost(host, document.documentElement.style) : undefined), []);
  const gameHost = useMemo<GameHost>(
    () => ({
      csrfToken: csrf,
      onAuthenticationRequired: () => {
        setCsrf("");
        setBootstrap("");
        setNotice("Your session ended. Reconnect before continuing.");
      },
      openAccount: () => {
        const url = new URL(apiOrigin);
        url.searchParams.set("approval", "");
        host?.openLink(url.href);
      },
      onTabChange: (tab) => {
        if (tab === "Kingdom") host?.BackButton?.hide();
        else host?.BackButton?.show();
      },
      subscribeBack: (callback) => (host ? subscribeBack(host, callback) : () => {}),
    }),
    [csrf],
  );
  function run(operation: () => Promise<void>) {
    setBusy(true);
    setNotice("");
    void operation()
      .catch((e: unknown) => setNotice(e instanceof Error ? e.message : "Connection failed"))
      .finally(() => setBusy(false));
  }
  if (csrf)
    return (
      <>
        <div className="telegram-controls">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const response = await fetch(new URL("v1/telegram/unlink", apiOrigin), {
                  method: "POST",
                  credentials: "include",
                  headers: { "x-csrf-token": csrf },
                });
                if (!response.ok) throw new Error("UNLINK_FAILED");
                setCsrf("");
                setBootstrap("");
                sessionStorage.removeItem("pact_csrf");
              })
            }
          >
            Unlink Telegram
          </button>
          {notice && <p role="alert">{notice}</p>}
        </div>
        <GameApp host={gameHost} />
      </>
    );
  return (
    <main className="game-shell auth-shell">
      <h1>Bring your kingdom into Telegram</h1>
      <p>Link your PACT account, then play the same world with the same rules and exact approvals.</p>
      {!host?.initData ? (
        <p>Open this app from the private PACT bot chat.</p>
      ) : (
        <>
          <button
            type="button"
            disabled={busy || Boolean(bootstrap)}
            onClick={() =>
              run(async () => {
                const result = await request("v1/telegram/bootstrap", { initData: host.initData });
                if (typeof result.bootstrapToken !== "string") throw new Error("INVALID_RESPONSE");
                if (result.linked === true) {
                  const session = await request("v1/telegram/session", {
                    initData: host.initData,
                    bootstrapToken: result.bootstrapToken,
                  });
                  if (typeof session.csrfToken !== "string") throw new Error("INVALID_RESPONSE");
                  setCsrf(session.csrfToken);
                  return;
                }
                setBootstrap(result.bootstrapToken);
                setNotice("Confirm the link on the secure PACT page, then return here.");
              })
            }
          >
            Connect PACT account
          </button>
          {bootstrap && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => host.openLink(telegramConfirmationUrl(apiOrigin, bootstrap))}
              >
                Confirm in secure PACT
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const result = await request("v1/telegram/session", {
                      initData: host.initData,
                      bootstrapToken: bootstrap,
                    });
                    if (typeof result.csrfToken !== "string") throw new Error("INVALID_RESPONSE");
                    setCsrf(result.csrfToken);
                    setBootstrap("");
                  })
                }
              >
                I confirmed — enter my kingdom
              </button>
            </>
          )}
          <p>Your password stays on the secure PACT page. Expired links need a fresh launch from the bot.</p>
        </>
      )}
      {notice && <p role="status">{notice}</p>}
    </main>
  );
}
const root = document.getElementById("root");
if (!root) throw new Error("Missing root element");
createRoot(root).render(<App />);
