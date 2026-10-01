import { useCallback, useEffect, useRef, useState } from "react";

type InvitationView = {
  invitationId: string | null;
  status: string;
  destination: { type: string; id: string; title: string } | null;
  expiresAt: string | null;
  remainingUses: number;
  accepted: boolean;
};

type Request = (path: string, method?: string, body?: unknown) => Promise<Record<string, unknown>>;
/** Ordinary links preview without login; no open, refresh or signup accepts a relationship. */
export function InvitationPanel({
  request,
  authenticated,
  canWrite,
  kingdomId,
}: {
  request: Request;
  authenticated: boolean;
  canWrite: boolean;
  kingdomId?: string;
}): React.JSX.Element | null {
  const token = useRef(new URLSearchParams(window.location.search).get("invite"));
  const [view, setView] = useState<InvitationView | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<{ invitationId: string; token: string } | null>(null);
  const retry = useRef<{ key: string; id: string } | null>(null);
  const command = useCallback(
    async (action: Record<string, unknown>) => {
      const key = JSON.stringify(action);
      if (retry.current?.key !== key) retry.current = { key, id: crypto.randomUUID() };
      const result = await request("/v1/social/commands", "POST", {
        schemaVersion: "pact.social-command.v1",
        commandId: retry.current.id,
        action,
      });
      const receipt = result.receipt as { code?: string };
      if (receipt.code !== "COMMITTED") throw new Error(receipt.code ?? "COMMAND_NOT_COMMITTED");
      retry.current = null;
      return result.result;
    },
    [request],
  );
  useEffect(() => {
    let current = true;
    void (async () => {
      try {
        if (token.current) {
          if (current) setSaved(false);
          const preview = (await request(
            `/v1/invitations/${encodeURIComponent(token.current)}`,
          )) as unknown as InvitationView;
          if (current) setView(preview);
          if (authenticated && canWrite && !kingdomId && preview.invitationId) {
            await command({ kind: "invitation.remember", token: token.current });
            const remembered = (await request("/v1/invitations/remembered")).invitation;
            if (current) {
              if (remembered) setView(remembered as InvitationView);
              setSaved(true);
            }
          }
        } else if (authenticated) {
          const result = await request("/v1/invitations/remembered");
          if (current) {
            setView(result.invitation as InvitationView | null);
            setSaved(Boolean(result.invitation));
          }
        }
      } catch (error) {
        if (current) setError(error instanceof Error ? error.message : "Invitation could not load.");
      }
    })();
    return () => {
      current = false;
    };
  }, [request, authenticated, canWrite, kingdomId, command]);
  async function act(action: Record<string, unknown>): Promise<void> {
    setBusy(true);
    setError("");
    try {
      const result = await command(action);
      if (action.kind === "invitation.issue") {
        if (result) setIssued(result as { invitationId: string; token: string });
        else
          setError(
            "The invitation was already created. Its secret link is returned only once; revoke it by its receipt ID if the response was lost.",
          );
      } else if (action.kind === "invitation.revoke") setIssued(null);
      else if (result) setView(result as InvitationView);
      else if (saved) {
        const result = await request("/v1/invitations/remembered");
        setView(result.invitation as InvitationView);
      } else if (token.current) {
        setView((await request(`/v1/invitations/${encodeURIComponent(token.current)}`)) as unknown as InvitationView);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Invitation command failed.");
    } finally {
      setBusy(false);
    }
  }
  if (!view && !token.current && !kingdomId && !error) return null;
  const link = issued ? new URL(`?invite=${encodeURIComponent(issued.token)}`, window.location.href).toString() : "";
  return (
    <section className="invitation-panel" aria-label="Invitations">
      <h2>Invitations</h2>
      {view && (
        <>
          <p>
            {view.destination?.title ?? "Destination unavailable"} · {view.destination?.type ?? "unknown"} ·{" "}
            {view.status}
          </p>
          <p>
            Opening this link makes no agreement. Acceptance only establishes the stated contact or membership, never
            trade, allegiance or troop access.
          </p>
          {view.expiresAt && (
            <p>
              Expires {new Date(view.expiresAt).toLocaleString()} · {view.remainingUses} uses left
            </p>
          )}
          {view.accepted ? (
            <p role="status">You already accepted this invitation.</p>
          ) : kingdomId && canWrite ? (
            <button
              type="button"
              disabled={busy || view.status !== "available"}
              onClick={() => {
                void act(
                  saved
                    ? { kind: "invitation.accept-remembered" }
                    : { kind: "invitation.accept", token: token.current },
                );
              }}
            >
              Accept {view.destination?.type === "contact" ? "contact" : "invitation"}
            </button>
          ) : (
            <p>
              {authenticated
                ? "Found your kingdom before accepting. Your saved destination will remain here."
                : "Sign in or create an account below to continue. Nothing is accepted automatically."}
            </p>
          )}
          {saved && <p>The destination is saved to your account, not just this browser.</p>}
        </>
      )}
      {kingdomId && canWrite && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void act({ kind: "invitation.issue", destinationType: "contact", destinationId: kingdomId });
          }}
        >
          Create contact invitation
        </button>
      )}
      {issued && (
        <>
          <label>
            Contact invitation link
            <input readOnly value={link} onFocus={(event) => event.target.select()} />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void act({ kind: "invitation.revoke", invitationId: issued.invitationId });
            }}
          >
            Revoke link
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
