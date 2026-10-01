import { useCallback, useEffect, useRef, useState } from "react";

type Request = (path: string, method?: string, body?: unknown) => Promise<Record<string, unknown>>;
type Summary = { id: string; handle: string; title: string; status: string };
type Member = { kingdomId: string; handle: string | null; displayName: string; role: string };
type Page = {
  found?: boolean;
  courts?: Summary[];
  court?: Summary & { description: string; join_mode: string; version: number };
  roster?: Member[];
  nextOffset?: number | null;
  pins?: { slot: number; body: string }[];
  requests?: { kingdomId: string; handle: string }[];
  requestsNextOffset?: number | null;
  transfers?: { id: string; toKingdomId: string }[];
  viewerRole?: string | null;
  requested?: boolean;
};
export function CourtPanel({
  request,
  kingdomId,
  canWrite,
}: {
  request: Request;
  kingdomId: string;
  canWrite: boolean;
}) {
  const [handle, setHandle] = useState(() => new URLSearchParams(window.location.search).get("court") ?? "");
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<Page>({});
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const retry = useRef<{ key: string; id: string } | null>(null);
  const readGeneration = useRef(0);
  const load = useCallback(async () => {
    const generation = ++readGeneration.current;
    const query = new URLSearchParams({ offset: String(offset), ...(handle ? { handle } : {}) });
    const result = (await request(`/v1/courts?${query}`)) as Page;
    if (generation === readGeneration.current) setPage(result);
  }, [request, handle, offset]);
  useEffect(() => {
    setPage({});
    setError("");
    void load().catch((e) => setError(String(e)));
    return () => {
      readGeneration.current++;
    };
  }, [load]);
  async function command(action: Record<string, unknown>, invitation = false) {
    setBusy(true);
    setError("");
    setStatus("");
    const key = JSON.stringify(action);
    if (retry.current?.key !== key) retry.current = { key, id: crypto.randomUUID() };
    try {
      const result = await request("/v1/social/commands", "POST", {
        schemaVersion: invitation ? "pact.social-command.v1" : "pact.court-command.v1",
        commandId: retry.current.id,
        action,
      });
      const receipt = result.receipt as { code: string; commandId: string };
      if (receipt.code !== "COMMITTED") throw new Error(receipt.code);
      retry.current = null;
      setStatus(`Committed · ${receipt.commandId}`);
      if (invitation) {
        const issued = result.result as { token?: string } | null;
        setStatus(
          issued?.token
            ? `${window.location.origin}/pact/?invite=${issued.token}`
            : `Already committed. Link token is not replayed; revoke using the invitation receipt and issue a new link.`,
        );
      }
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  function form(event: React.FormEvent<HTMLFormElement>, kind: string) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    void command({
      kind,
      ...fields,
      ...(kind === "court.create" ? {} : { courtId: page.court?.id }),
      ...(kind === "court.edit" ? { expectedVersion: page.court?.version } : {}),
      ...(kind === "court.pin" ? { slot: Number(fields.slot) } : {}),
    });
  }
  const court = page.court;
  const active = court?.status === "active";
  const owner = page.viewerRole === "owner";
  const mod = owner || page.viewerRole === "moderator";
  const disabled = !canWrite || busy;
  return (
    <section className="court-panel">
      <h2>Courts</h2>
      <p>Communities, not shared armies or treasuries. Joining and leaving do not change your agreements.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const value = new FormData(e.currentTarget).get("handle");
          setHandle(
            String(value ?? "")
              .trim()
              .toLowerCase(),
          );
          setOffset(0);
        }}
      >
        <label>
          Court handle <input name="handle" defaultValue={handle} pattern="[a-zA-Z][a-zA-Z0-9_]{2,23}" />
        </label>
        <button type="submit" disabled={busy}>
          Find Court
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setHandle("");
            setOffset(0);
          }}
        >
          Browse Courts
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setError("");
            void load().catch((e) => setError(String(e)));
          }}
        >
          Refresh Courts
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {status && (
        <p role="status" className="court-result">
          {status}
        </p>
      )}
      {page.courts?.map((c) => (
        <p key={c.id}>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setHandle(c.handle);
              setOffset(0);
            }}
          >
            {c.title} (@{c.handle}) · {c.status}
          </button>
        </p>
      ))}
      {handle && page.found === false && <p>Court not found.</p>}
      {!handle && (
        <details>
          <summary>Create a Court</summary>
          <form onSubmit={(e) => form(e, "court.create")}>
            <label>
              Handle <input name="handle" required pattern="[a-z][a-z0-9_]{2,23}" />
            </label>
            <label>
              Title <input name="title" required maxLength={60} />
            </label>
            <label>
              Description <textarea name="description" maxLength={1200} />
            </label>
            <label>
              Membership{" "}
              <select name="joinMode">
                <option value="open">Open</option>
                <option value="request">Request approval</option>
                <option value="invitation_only">Invitation only</option>
              </select>
            </label>
            <button type="submit" disabled={disabled}>
              Create Court
            </button>
          </form>
        </details>
      )}
      {court && (
        <>
          <h3>
            {court.title} · @{court.handle}
          </h3>
          <p>{court.description}</p>
          <p>
            {court.status} · {court.join_mode} · your role: {page.viewerRole ?? "not a member"}
          </p>
          {active && !page.viewerRole && court.join_mode === "open" && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => void command({ kind: "court.join", courtId: court.id })}
            >
              Join Court
            </button>
          )}
          {active && !page.viewerRole && court.join_mode === "request" && (
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                void command({ kind: page.requested ? "court.cancel-request" : "court.request", courtId: court.id })
              }
            >
              {page.requested ? "Cancel membership request" : "Request membership"}
            </button>
          )}
          {active && !page.viewerRole && court.join_mode === "invitation_only" && (
            <p>Ask the owner or a moderator for an invitation link.</p>
          )}
          {page.viewerRole && (!owner || !active) && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => void command({ kind: "court.leave", courtId: court.id })}
            >
              Leave Court
            </button>
          )}
          {mod && active && (
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                void command({ kind: "invitation.issue", destinationType: "court", destinationId: court.id }, true)
              }
            >
              Create membership invitation
            </button>
          )}
          <h4>Pinned notices</h4>
          {page.pins?.map((p) => (
            <div key={p.slot}>
              <p>{p.body}</p>
              {owner && active && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => void command({ kind: "court.unpin", courtId: court.id, slot: p.slot })}
                >
                  Unpin notice {p.slot}
                </button>
              )}
            </div>
          ))}
          {owner && active && (
            <form onSubmit={(e) => form(e, "court.pin")}>
              <label>
                Pin slot{" "}
                <select name="slot">
                  <option>1</option>
                  <option>2</option>
                  <option>3</option>
                </select>
              </label>
              <label>
                Public Court notice <textarea name="body" required maxLength={1200} />
              </label>
              <button type="submit" disabled={disabled}>
                Publish pinned notice
              </button>
            </form>
          )}
          <h4>Roster</h4>
          {page.roster?.map((m) => (
            <div key={m.kingdomId}>
              <p>
                {m.displayName} {m.handle ? `(@${m.handle})` : ""} · {m.role}
              </p>
              {active && m.kingdomId !== kingdomId && m.role !== "owner" && (
                <>
                  {mod && (owner || m.role === "member") && (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => void command({ kind: "court.remove", courtId: court.id, kingdomId: m.kingdomId })}
                    >
                      Remove @{m.handle}
                    </button>
                  )}
                  {owner && (
                    <>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() =>
                          void command({
                            kind: "court.role",
                            courtId: court.id,
                            kingdomId: m.kingdomId,
                            role: m.role === "moderator" ? "member" : "moderator",
                          })
                        }
                      >
                        {m.role === "moderator" ? "Demote" : "Appoint moderator"} @{m.handle}
                      </button>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() =>
                          void command({ kind: "court.transfer-propose", courtId: court.id, kingdomId: m.kingdomId })
                        }
                      >
                        Offer ownership to @{m.handle}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          ))}
          {mod && active && (
            <>
              <h4>Membership requests</h4>
              {page.requests?.map((r) => (
                <p key={r.kingdomId}>
                  @{r.handle}{" "}
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      void command({
                        kind: "court.answer-request",
                        courtId: court.id,
                        kingdomId: r.kingdomId,
                        accept: true,
                      })
                    }
                  >
                    Accept @{r.handle}
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      void command({
                        kind: "court.answer-request",
                        courtId: court.id,
                        kingdomId: r.kingdomId,
                        accept: false,
                      })
                    }
                  >
                    Reject @{r.handle}
                  </button>
                </p>
              ))}
            </>
          )}
          {active &&
            page.transfers
              ?.filter((t) => t.toKingdomId === kingdomId)
              .map((t) => (
                <p key={t.id}>
                  The owner offers you this Court.{" "}
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      void command({ kind: "court.transfer-answer", courtId: court.id, proposalId: t.id, accept: true })
                    }
                  >
                    Accept ownership
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      void command({
                        kind: "court.transfer-answer",
                        courtId: court.id,
                        proposalId: t.id,
                        accept: false,
                      })
                    }
                  >
                    Decline ownership
                  </button>
                </p>
              ))}
          {owner && active && (
            <details>
              <summary>Owner controls</summary>
              <form key={court.version} onSubmit={(e) => form(e, "court.edit")}>
                <label>
                  Title <input name="title" defaultValue={court.title} required maxLength={60} />
                </label>
                <label>
                  Description <textarea name="description" defaultValue={court.description} maxLength={1200} />
                </label>
                <label>
                  Membership{" "}
                  <select name="joinMode" defaultValue={court.join_mode}>
                    <option value="open">Open</option>
                    <option value="request">Request approval</option>
                    <option value="invitation_only">Invitation only</option>
                  </select>
                </label>
                <button type="submit" disabled={disabled}>
                  Save Court
                </button>
              </form>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void command({ kind: "court.close", courtId: court.id });
                }}
              >
                <label>
                  <input type="checkbox" required /> Archive this Court for 30 real days; no new memberships or posts.
                </label>
                <button type="submit" disabled={disabled}>
                  Close Court
                </button>
              </form>
            </details>
          )}
        </>
      )}
      {offset > 0 && (
        <button type="button" disabled={busy} onClick={() => setOffset(Math.max(0, offset - 50))}>
          Previous page
        </button>
      )}
      {(page.nextOffset != null || page.requestsNextOffset != null) && (
        <button
          type="button"
          disabled={busy}
          onClick={() => setOffset(page.nextOffset ?? page.requestsNextOffset ?? 0)}
        >
          Next page
        </button>
      )}
    </section>
  );
}
