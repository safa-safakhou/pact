import { useEffect, useState } from "react";
import { pactBaseUrl } from "./client-location.js";

type Request = (path: string, method?: string, body?: unknown) => Promise<Record<string, unknown>>;
export function RestoreGuest({ onJoined }: { onJoined: (csrf: string) => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <details className="game-card">
      <summary>Restore a guest kingdom</summary>
      <p>
        Enter the private recovery code saved from Account on your other device. Your nickname is not a recovery code.
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          try {
            const entryKey = code.trim();
            const r = await fetch(`${pactBaseUrl()}v1/play/join`, {
              method: "POST",
              credentials: "include",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ entryKey, existingOnly: true }),
            });
            const result = await r.json();
            if (!r.ok)
              throw Error("Could not restore this kingdom. Check the code, or sign in if you saved it with an email.");
            localStorage.setItem("pact_guest_entry", entryKey);
            localStorage.removeItem("pact_guest_pending");
            localStorage.removeItem("pact_guest_pending_rotation");
            setCode("");
            onJoined(String(result.csrfToken));
          } catch (e) {
            setError(e instanceof Error ? e.message : "Could not restore your kingdom.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Private recovery code
          <input type="password" required autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} />
        </label>
        <button type="submit" disabled={busy}>
          Restore kingdom
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
    </details>
  );
}

export function AccountAccess({
  guest,
  canWrite,
  request,
  onChanged,
}: {
  guest: boolean;
  canWrite: boolean;
  request: Request;
  onChanged: () => void;
}) {
  const [legal, setLegal] = useState<Record<string, unknown> | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCode, setShowCode] = useState(false);
  useEffect(() => {
    void request("/v1/legal/notices")
      .then(setLegal)
      .catch(() => setNotice("Account notices are temporarily unavailable."));
  }, [request]);
  const docs = legal?.documents as { termsVersion?: string; termsUrl?: string; privacyUrl?: string } | undefined;
  const captured = legal?.emailDelivery !== "transactional";
  async function submit(operation: () => Promise<unknown>, message: string) {
    setBusy(true);
    setNotice("");
    try {
      await operation();
      setNotice(message);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not complete this request.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Account access">
      <h2>{guest ? "Save your kingdom" : "Your account"}</h2>
      {guest ? (
        <>
          <article className="game-card">
            <h3>Private recovery code</h3>
            <p>
              Save this code privately to restore the same guest kingdom on another device. Anyone with it can access
              your kingdom. Keep it out of chats and public links.
            </p>
            <button type="button" onClick={() => setShowCode(!showCode)}>
              {showCode ? "Hide recovery code" : "Show recovery code"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void submit(async () => {
                  const currentCode = localStorage.getItem("pact_guest_entry");
                  if (!currentCode)
                    throw new Error("Restore using your current private recovery code before replacing it.");
                  const saved = localStorage.getItem("pact_guest_pending_rotation");
                  const intent = saved
                    ? (JSON.parse(saved) as { currentCode: string; newCode: string })
                    : { currentCode, newCode: crypto.randomUUID() };
                  if (intent.currentCode !== currentCode)
                    throw new Error(
                      "The saved replacement belongs to a different recovery code. Restore this kingdom before retrying.",
                    );
                  localStorage.setItem("pact_guest_pending_rotation", JSON.stringify(intent));
                  const result = await request("/v1/auth/guest/recovery/replace", "POST", intent);
                  if (typeof result.recoveryCode !== "string")
                    throw new Error("Replacement was not confirmed. Restore your kingdom before trying again.");
                  localStorage.setItem("pact_guest_entry", result.recoveryCode);
                  localStorage.removeItem("pact_guest_pending_rotation");
                  setShowCode(true);
                }, "Recovery code replaced. Save the new code; the previous code no longer works.")
              }
            >
              Replace recovery code
            </button>
            {showCode && (
              <label>
                Store this somewhere safe
                <input
                  readOnly
                  autoComplete="off"
                  value={localStorage.getItem("pact_guest_entry") ?? "No recovery code saved in this browser"}
                />
              </label>
            )}
          </article>
          <article className="game-card">
            <h3>Save with email and password</h3>
            <p>
              Keep this kingdom, its history and your agent connections. Verify your email before using password sign-in
              on another device. Completing verification disables the guest recovery code.
            </p>
            {captured && (
              <p role="status">
                This private test server captures email. The operator must provide your verification code; inbox
                delivery is not available yet. Use your private recovery code for immediate access on another device.
              </p>
            )}
            {docs && (
              <p>
                Read the <a href={docs.termsUrl}>terms</a> and <a href={docs.privacyUrl}>privacy notice</a>.
              </p>
            )}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const data = new FormData(form);
                void submit(async () => {
                  await request("/v1/auth/guest/save", "POST", {
                    email: data.get("email"),
                    password: data.get("password"),
                    age18Declared: data.get("age") === "on",
                    acceptedTermsVersion: docs?.termsVersion,
                  });
                  form.reset();
                }, "If this address is available, a verification code has been requested. Existing accounts cannot be merged; use another address if no code arrives.");
              }}
            >
              <label>
                Email
                <input name="email" type="email" required autoComplete="email" />
              </label>
              <label>
                Password (at least 15 characters)
                <input
                  name="password"
                  type="password"
                  minLength={15}
                  maxLength={128}
                  required
                  autoComplete="new-password"
                />
              </label>
              <label>
                <input name="age" type="checkbox" required />I am 18 or older
              </label>
              <label>
                <input type="checkbox" required />I accept the terms and privacy notice
              </label>
              <button
                type="submit"
                disabled={!canWrite || busy || !docs?.termsVersion || legal?.registrationEnabled !== true}
              >
                Request verification
              </button>
            </form>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const token = new FormData(form).get("token");
                void submit(async () => {
                  await request("/v1/auth/verify", "POST", { token });
                  localStorage.removeItem("pact_guest_entry");
                  localStorage.removeItem("pact_guest_pending_rotation");
                  localStorage.removeItem("pact_guest_name");
                  form.reset();
                  onChanged();
                }, "Kingdom saved. You can sign in on another device with your email and password.");
              }}
            >
              <label>
                One-time verification code
                <input name="token" required autoComplete="one-time-code" />
              </label>
              <button type="submit" disabled={!canWrite || busy}>
                Verify and save kingdom
              </button>
            </form>
          </article>
        </>
      ) : (
        <p>Your kingdom is attached to your verified account. Sign in with the same credentials on another device.</p>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}

export function PasswordRecovery({ request }: { request: Request }) {
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function send(path: string, data: unknown, message: string) {
    setBusy(true);
    try {
      await request(path, "POST", data);
      setNotice(message);
    } catch {
      setNotice("Could not complete recovery. Check the code and password, or try again later.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="game-card">
      <summary>Forgot password?</summary>
      <p>
        Request a reset code for your verified account. On the private test server, captured codes must come from the
        operator.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send(
            "/v1/auth/reset/request",
            { email: new FormData(event.currentTarget).get("email") },
            "If an eligible account exists, a reset code has been requested.",
          );
        }}
      >
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <button type="submit" disabled={busy}>
          Request reset code
        </button>
      </form>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const d = new FormData(form);
          void send(
            "/v1/auth/reset/confirm",
            { token: d.get("token"), password: d.get("password") },
            "Password reset. Sign in with your new password. Previous sessions and agent connections were revoked.",
          ).then(() => form.reset());
        }}
      >
        <label>
          Reset code
          <input name="token" required autoComplete="one-time-code" />
        </label>
        <label>
          New password
          <input name="password" type="password" minLength={15} maxLength={128} required autoComplete="new-password" />
        </label>
        <button type="submit" disabled={busy}>
          Reset password
        </button>
      </form>
      {notice && <p role="status">{notice}</p>}
    </details>
  );
}
