import type { SetupStep } from "@pact/client-sdk";
import { readInvitationDestination } from "@pact/client-sdk";
import { SetupFlow } from "@pact/ui-features";
import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createWebPactClient } from "./pact-client.js";
import "./styles.css";
import { confirmTelegramLink, readTelegramBootstrap, TelegramLinkError } from "./telegram-link.js";

const DEMO_PROVIDERS = [
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "openrouter", label: "OpenRouter" },
] as const;

const DEMO_MODELS = [
  { id: "sandbox-small", label: "Sandbox small" },
  { id: "sandbox-medium", label: "Sandbox medium" },
] as const;

function readCsrfToken(): string | undefined {
  const match = document.cookie.match(/(?:^|; )pact_csrf=([^;]*)/);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function App(): React.JSX.Element {
  const apiOrigin = useMemo(() => new URL(import.meta.env.BASE_URL, window.location.origin), []);
  const telegramBootstrap = useMemo(() => readTelegramBootstrap(window.location.search), []);
  const invitation = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return readInvitationDestination({
      invite: params.get("invite"),
      destination: params.get("destination"),
    });
  }, []);

  const client = useMemo(
    () =>
      createWebPactClient({
        apiOrigin: apiOrigin.toString(),
        csrfToken: readCsrfToken,
        fetch: window.fetch.bind(window),
      }),
    [apiOrigin],
  );

  const [step, setStep] = useState<SetupStep>("account");
  const [providerId, setProviderId] = useState<string>("openai");
  const [modelId, setModelId] = useState<string>("sandbox-small");
  const [runStatus, setRunStatus] = useState("stopped");
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);
  const [telegramEmail, setTelegramEmail] = useState("");
  const [telegramPassword, setTelegramPassword] = useState("");
  const [telegramStatus, setTelegramStatus] = useState<"idle" | "working" | "linked">("idle");
  const [telegramError, setTelegramError] = useState<string>();
  const [privacyPassword, setPrivacyPassword] = useState("");
  const [privacyCsrf, setPrivacyCsrf] = useState<string | undefined>(() => readCsrfToken());
  const [privacyStatus, setPrivacyStatus] = useState<string>();
  const [privacyDownload, setPrivacyDownload] = useState<string>();

  const privacyRequest = async (path: string): Promise<Record<string, unknown>> => {
    if (!privacyCsrf) throw new Error("Sign in before using privacy settings.");
    const response = await window.fetch(new URL(path, apiOrigin), {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", "x-csrf-token": privacyCsrf },
      body: JSON.stringify({ password: privacyPassword }),
    });
    const body = (await response.json()) as Record<string, unknown>;
    if (!response.ok) throw new Error(String((body.error as { code?: string } | undefined)?.code ?? "REQUEST_FAILED"));
    return body;
  };

  return (
    <main data-pact-audience={client.audience}>
      {telegramBootstrap ? (
        <section className="telegram-link-card" aria-labelledby="telegram-link-title">
          <h1 id="telegram-link-title">Confirm your Telegram link</h1>
          {telegramStatus === "linked" ? (
            <p className="telegram-link-success">
              Telegram is linked. Return to the Mini App and press <strong>Exchange confirmed link</strong>.
            </p>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setTelegramStatus("working");
                setTelegramError(undefined);
                void confirmTelegramLink(window.fetch.bind(window), apiOrigin, telegramBootstrap, {
                  email: telegramEmail,
                  password: telegramPassword,
                })
                  .then(() => {
                    setTelegramStatus("linked");
                    setTelegramPassword("");
                    const cleanUrl = new URL(window.location.href);
                    cleanUrl.searchParams.delete("telegram_bootstrap");
                    window.history.replaceState(null, "", cleanUrl);
                  })
                  .catch((error: unknown) => {
                    setTelegramStatus("idle");
                    setTelegramError(error instanceof TelegramLinkError ? error.code : "TELEGRAM_LINK_FAILED");
                  });
              }}
            >
              <p>Sign in to the PACT account you want to use from this private Telegram chat.</p>
              <label>
                Email
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={telegramEmail}
                  onChange={(event) => setTelegramEmail(event.target.value)}
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={telegramPassword}
                  onChange={(event) => setTelegramPassword(event.target.value)}
                />
              </label>
              <button type="submit" disabled={telegramStatus === "working"}>
                {telegramStatus === "working" ? "Confirming…" : "Sign in and confirm"}
              </button>
              {telegramError ? <p role="alert">Link failed: {telegramError}</p> : null}
            </form>
          )}
        </section>
      ) : null}
      <SetupFlow
        step={step}
        onStepChange={setStep}
        invitation={invitation}
        serverHydrated
        {...(errorCode !== undefined ? { errorCode } : {})}
        accountEmail="founder@example.test"
        draftDisplayName="Rowan"
        draftHandle="rowan"
        providers={DEMO_PROVIDERS}
        selectedProviderId={providerId}
        onSelectProvider={setProviderId}
        models={DEMO_MODELS}
        selectedModelId={modelId}
        onSelectModel={setModelId}
        allowanceTokens={4000}
        pricingAvailable={false}
        runStatus={runStatus}
        externalHostMessage="External-host usage and billing stay with the connector account."
        connectorPrerequisiteMessage="Install a certified connector before linking an external host."
        onStartRun={() => {
          setErrorCode(undefined);
          setRunStatus("running");
        }}
        onStopRun={() => setRunStatus("stopped")}
        approvals={[
          { id: "apr-live", summary: "sandbox.counter.increment amount 1", status: "pending" },
          { id: "apr-old", summary: "Expired sandbox write", status: "expired" },
        ]}
        onApprove={() => setErrorCode(undefined)}
        onDeny={() => setErrorCode(undefined)}
      />
      <section className="privacy-card" aria-labelledby="privacy-title">
        <h2 id="privacy-title">Privacy and account data</h2>
        <p>Export your phase-0 account data or close the account. Both actions require your current password.</p>
        <label>
          Current password
          <input
            type="password"
            autoComplete="current-password"
            value={privacyPassword}
            onChange={(event) => setPrivacyPassword(event.target.value)}
          />
        </label>
        <div className="privacy-actions">
          <button
            type="button"
            onClick={() => {
              setPrivacyStatus("Preparing export…");
              void privacyRequest("/v1/privacy/exports")
                .then((body) => {
                  if (typeof body.csrfToken === "string") setPrivacyCsrf(body.csrfToken);
                  if (typeof body.downloadUrl === "string") setPrivacyDownload(body.downloadUrl);
                  setPrivacyPassword("");
                  setPrivacyStatus("Export ready for seven days.");
                })
                .catch((error: unknown) => setPrivacyStatus(error instanceof Error ? error.message : "Export failed."));
            }}
          >
            Prepare data export
          </button>
          <button
            type="button"
            className="danger-button"
            onClick={() => {
              if (!window.confirm("Close this PACT account now? Access will be revoked immediately.")) return;
              setPrivacyStatus("Closing account…");
              void privacyRequest("/v1/privacy/deletion")
                .then(() => {
                  setPrivacyPassword("");
                  setPrivacyDownload(undefined);
                  setPrivacyStatus("Account closed. Access has been revoked.");
                })
                .catch((error: unknown) =>
                  setPrivacyStatus(error instanceof Error ? error.message : "Closure failed."),
                );
            }}
          >
            Close account
          </button>
        </div>
        {privacyDownload ? (
          <a className="privacy-download" href={privacyDownload}>
            Download JSON export
          </a>
        ) : null}
        {privacyStatus ? <p role="status">{privacyStatus}</p> : null}
      </section>
      <p className="shell-note">
        Demo shell for PACT-023. Cookie/CSRF transport lives in the web host via <code>createWebPactClient</code>;{" "}
        <code>@pact/ui-features</code> stays reusable for Telegram.{" "}
        <button type="button" className="shell-link" onClick={() => setErrorCode("REVOKED")}>
          Simulate revoked key
        </button>
        {" · "}
        <button type="button" className="shell-link" onClick={() => setErrorCode("UNSUPPORTED_HOST")}>
          Simulate unsupported host
        </button>
      </p>
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing root element");
createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
