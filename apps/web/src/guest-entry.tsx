import { useCallback, useEffect, useRef, useState } from "react";
import { RestoreGuest } from "./account-access.js";
import { pactBaseUrl } from "./client-location.js";

const names = ["Professor Turnip", "Duke of Noodles", "Captain Goose", "Lady Circuit", "Sir Potato"];
export function GuestEntry({ onJoined, onSignIn }: { onJoined: (csrf: string) => void; onSignIn?: () => void }) {
  const [nickname, setNickname] = useState(
    () =>
      localStorage.getItem("pact_guest_name") ?? names[Math.floor(Math.random() * names.length)] ?? "Professor Turnip",
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const joining = useRef(false),
    auto = useRef(false);
  const join = useCallback(async () => {
    if (joining.current) return;
    joining.current = true;
    setBusy(true);
    setError("");
    const entryKey = localStorage.getItem("pact_guest_entry") ?? crypto.randomUUID();
    // Previously saved keys may only resume; never silently found a replacement kingdom.
    const existingOnly =
      localStorage.getItem("pact_guest_entry") === entryKey && localStorage.getItem("pact_guest_pending") !== entryKey;
    if (!existingOnly) localStorage.setItem("pact_guest_pending", entryKey);
    localStorage.setItem("pact_guest_entry", entryKey);
    localStorage.setItem("pact_guest_name", nickname);
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const response = await fetch(`${pactBaseUrl()}v1/play/join`, {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ entryKey, nickname, existingOnly }),
        });
        const result = await response.json();
        if (response.ok) {
          localStorage.removeItem("pact_guest_pending");
          onJoined(String(result.csrfToken));
          return;
        }
        const code = result.error?.code;
        if (!["TICK_PENDING", "JOIN_RETRY"].includes(code))
          throw Error(
            code === "WORLD_PAUSED"
              ? "The world is taking a breather. Try again shortly."
              : "Could not restore this kingdom. Sign in if you saved it with email, or check your recovery code.",
          );
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
      throw Error("The world is updating. Tap Play again in a moment.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join. Try again.");
    } finally {
      joining.current = false;
      setBusy(false);
    }
  }, [nickname, onJoined]);
  useEffect(() => {
    if (!auto.current && localStorage.getItem("pact_guest_entry")) {
      auto.current = true;
      void join();
    }
  }, [join]);
  return (
    <main className="game-shell guest-entry">
      <p className="eyebrow">PACT · a tiny kingdom, questionable leadership</p>
      <h1>Your friends. Your agents. Mild diplomatic chaos.</h1>
      <p>Build a kingdom, send your agent on a mission, and make friends or deeply unnecessary plans.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void join();
        }}
      >
        <label>
          Your nickname
          <input
            maxLength={40}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            autoComplete="nickname"
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? "Preparing your kingdom..." : "Play"}
        </button>
      </form>
      <p className="quiet">This browser remembers your kingdom. Everyone with this link plays in the same world.</p>
      {onSignIn && (
        <button type="button" className="secondary" onClick={onSignIn}>
          Sign in to an existing kingdom
        </button>
      )}
      <RestoreGuest onJoined={onJoined} />
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
