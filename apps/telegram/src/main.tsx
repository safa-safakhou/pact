import { useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { resolvePactOrigin, telegramConfirmationUrl } from "./urls.js";

const apiOrigin = resolvePactOrigin(import.meta.env.BASE_URL, import.meta.env.VITE_PACT_ORIGIN, window.location.origin);

async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(new URL(path.replace(/^\//, ""), apiOrigin), { ...init, credentials: "include" });
  const body = (await response.json()) as unknown;
  if (!response.ok) throw new Error(JSON.stringify(body));
  return body;
}

function App() {
  const [csrf, setCsrf] = useState<string>();
  const [bootstrap, setBootstrap] = useState<string>();
  const [approvalId, setApprovalId] = useState("");
  const [output, setOutput] = useState("Open this page from the private PACT bot chat.");
  const initData = window.Telegram?.WebApp?.initData ?? "";

  const show = (operation: () => Promise<unknown>) => {
    void operation()
      .then((value) => setOutput(JSON.stringify(value, null, 2)))
      .catch((error: unknown) => {
        setOutput(error instanceof Error ? error.message : "Request failed");
      });
  };
  const writeHeaders = () => ({ "content-type": "application/json", "x-csrf-token": csrf ?? "" });

  return (
    <main>
      <h1>PACT</h1>
      <p>Telegram Mini App authentication proof</p>
      <section>
        <button
          type="button"
          disabled={!initData}
          onClick={() =>
            show(async () => {
              const result = (await request("/v1/telegram/bootstrap", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ initData }),
              })) as { bootstrapToken: string };
              setBootstrap(result.bootstrapToken);
              return { bootstrapCreated: true, next: "Confirm this link in your signed-in PACT account." };
            })
          }
        >
          Begin account link
        </button>
        <button
          type="button"
          disabled={!bootstrap}
          onClick={() => {
            if (!bootstrap) return;
            const url = telegramConfirmationUrl(apiOrigin, bootstrap);
            if (window.Telegram?.WebApp) window.Telegram.WebApp.openLink(url);
            else window.open(url, "_blank", "noopener,noreferrer");
            setOutput("Sign in and confirm the link in the opened PACT page, then return here.");
          }}
        >
          Confirm in PACT
        </button>
        <button
          type="button"
          disabled={!bootstrap}
          onClick={() =>
            show(async () => {
              const result = (await request("/v1/telegram/session", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ initData, bootstrapToken: bootstrap }),
              })) as { csrfToken: string };
              setCsrf(result.csrfToken);
              return { authenticated: true };
            })
          }
        >
          Exchange confirmed link
        </button>
      </section>
      <section>
        <button type="button" disabled={!csrf} onClick={() => show(() => request("/v1/setup/draft"))}>
          Read private draft
        </button>
        <button
          type="button"
          disabled={!csrf}
          onClick={() =>
            show(() => request("/v1/setup/sandbox-activation", { method: "POST", headers: writeHeaders() }))
          }
        >
          Activate sandbox
        </button>
      </section>
      <section>
        <input aria-label="Approval ID" value={approvalId} onChange={(event) => setApprovalId(event.target.value)} />
        <button
          type="button"
          disabled={!csrf || !approvalId}
          onClick={() => show(() => request(`/v1/approvals/${encodeURIComponent(approvalId)}`))}
        >
          Review
        </button>
        <button
          type="button"
          disabled={!csrf || !approvalId}
          onClick={() =>
            show(() =>
              request(`/v1/approvals/${encodeURIComponent(approvalId)}/approve`, {
                method: "POST",
                headers: writeHeaders(),
              }),
            )
          }
        >
          Approve exact action
        </button>
      </section>
      <button
        type="button"
        disabled={!csrf}
        onClick={() =>
          show(() =>
            request("/v1/telegram/unlink", { method: "POST", headers: writeHeaders() }).then((value) => {
              setCsrf(undefined);
              return value;
            }),
          )
        }
      >
        Unlink Telegram
      </button>
      <pre aria-live="polite">{output}</pre>
    </main>
  );
}

window.Telegram?.WebApp?.ready();
window.Telegram?.WebApp?.expand();
const root = document.getElementById("root");
if (!root) throw new Error("Missing root element");
createRoot(root).render(<App />);
