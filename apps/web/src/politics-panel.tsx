import { useCallback, useEffect, useRef, useState } from "react";
import { ReportControl } from "./moderation-panel.js";

type Request = (path: string, method?: string, body?: unknown) => Promise<Record<string, unknown>>;
type Article = { id: string; authorKingdomId: string; handle: string; version: number; title: string; body: string };
type Edge = {
  id: string;
  subjectKingdomId: string;
  patronKingdomId: string;
  subjectHandle: string;
  patronHandle: string;
  version: number;
};
type Proposal = {
  id: string;
  subjectKingdomId: string;
  patronKingdomId: string;
  proposerKingdomId: string;
  version: number;
  expiresGameTimeMs: string;
};
type Page = {
  found?: boolean;
  articles?: Article[];
  allegiance?: Edge[];
  pending?: Proposal[];
  articlesNextOffset?: number | null;
  allegianceNextOffset?: number | null;
  pendingNextOffset?: number | null;
};
export function PoliticsPanel({
  request,
  kingdomId,
  canWrite,
}: {
  request: Request;
  kingdomId: string;
  canWrite: boolean;
}) {
  const [page, setPage] = useState<Page>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [offset, setOffset] = useState(0),
    [handle, setHandle] = useState("");
  const retry = useRef<{ key: string; id: string } | null>(null);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    const data = await request(
      `/v1/politics?${new URLSearchParams({ offset: String(offset), ...(handle ? { handle } : {}) })}`,
    );
    if (current === generation.current) setPage(data as Page);
  }, [request, offset, handle]);
  useEffect(() => {
    setPage({});
    void refresh().catch((e) => setError(String(e)));
    return () => {
      generation.current++;
    };
  }, [refresh]);
  async function write(action: Record<string, unknown>) {
    const key = JSON.stringify(action);
    if (retry.current?.key !== key) retry.current = { key, id: crypto.randomUUID() };
    setBusy(true);
    setError("");
    try {
      const result = await request("/v1/social/commands", "POST", {
        schemaVersion: "pact.politics-command.v1",
        commandId: retry.current.id,
        action,
      });
      const receipt = result.receipt as { code: string; commandId: string };
      if (receipt.code !== "COMMITTED") throw new Error(receipt.code);
      retry.current = null;
      setStatus(`Committed · ${receipt.commandId}`);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  const disabled = busy || !canWrite;
  return (
    <section className="court-panel">
      <h2>Articles and allegiance</h2>
      <p>
        Declarations are player claims. Allegiance requires both humans and grants no tribute, troop control,
        intelligence or immunity.
      </p>
      {error && <p role="alert">{error}</p>}
      {status && <p role="status">{status}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setHandle(
            String(new FormData(e.currentTarget).get("handle") ?? "")
              .trim()
              .toLowerCase(),
          );
          setOffset(0);
        }}
      >
        <label>
          Player handle (empty for all)
          <input name="handle" />
        </label>
        <button type="submit" disabled={busy}>
          Find declarations
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setError("");
            void refresh().catch((e) => setError(String(e)));
          }}
        >
          Refresh politics
        </button>
      </form>
      {page.found === false && <p>Player not found.</p>}
      <details>
        <summary>Publish an Article</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fields = Object.fromEntries(new FormData(e.currentTarget));
            void write({ kind: "article.publish", title: fields.title, body: fields.body });
          }}
        >
          <label>
            Title
            <input name="title" required maxLength={120} />
          </label>
          <label>
            Public declaration
            <textarea name="body" required maxLength={2400} />
          </label>
          <label>
            <input type="checkbox" required /> I have reviewed this public text. It creates no executable agreement.
          </label>
          <button type="submit" disabled={disabled}>
            Publish Article
          </button>
        </form>
      </details>
      {page.articles?.map((a) => (
        <article key={a.id}>
          <h3>
            {a.title} · @{a.handle} · v{a.version}
          </h3>
          <p style={{ whiteSpace: "pre-wrap" }}>{a.body}</p>
          <ReportControl kind="article" targetId={a.id} />
          {a.authorKingdomId === kingdomId && (
            <>
              <button
                type="button"
                disabled={disabled}
                onClick={() => void write({ kind: "article.withdraw", articleId: a.id, expectedVersion: a.version })}
              >
                Withdraw Article
              </button>
              <details>
                <summary>Replace declaration</summary>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fields = Object.fromEntries(new FormData(e.currentTarget));
                    void write({
                      kind: "article.replace",
                      articleId: a.id,
                      expectedVersion: a.version,
                      title: fields.title,
                      body: fields.body,
                    });
                  }}
                >
                  <label>
                    Title
                    <input name="title" defaultValue={a.title} required maxLength={120} />
                  </label>
                  <label>
                    Replacement public declaration
                    <textarea name="body" defaultValue={a.body} required maxLength={2400} />
                  </label>
                  <label>
                    <input type="checkbox" required /> Publish this exact replacement as a new version.
                  </label>
                  <button type="submit" disabled={disabled}>
                    Publish replacement
                  </button>
                </form>
              </details>
            </>
          )}
        </article>
      ))}
      <h3>Mutual allegiance</h3>
      {page.allegiance?.map((e) => (
        <p key={e.id}>
          @{e.subjectHandle} → @{e.patronHandle}{" "}
          {[e.subjectKingdomId, e.patronKingdomId].includes(kingdomId) && (
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                void write({
                  kind: "allegiance.end",
                  edgeId: e.id,
                  subjectKingdomId: e.subjectKingdomId,
                  expectedVersion: e.version,
                })
              }
            >
              End allegiance
            </button>
          )}
        </p>
      ))}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const fields = Object.fromEntries(new FormData(e.currentTarget));
          setBusy(true);
          setError("");
          try {
            const result = await request(`/v1/people/${encodeURIComponent(String(fields.handle).trim())}`);
            const profile = (result.kingdom as { profile?: { kingdomId: string } } | undefined)?.profile;
            if (!profile) throw new Error("PLAYER_NOT_FOUND");
            await write({
              kind: "allegiance.propose",
              subjectKingdomId: fields.direction === "subject" ? kingdomId : profile.kingdomId,
              patronKingdomId: fields.direction === "subject" ? profile.kingdomId : kingdomId,
            });
          } catch (e) {
            setError(String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Other player handle
          <input name="handle" required pattern="[a-zA-Z][a-zA-Z0-9_]{2,23}" />
        </label>
        <label>
          Your role
          <select name="direction">
            <option value="subject">I will be the subject</option>
            <option value="patron">I will be the patron</option>
          </select>
        </label>
        <label>
          <input type="checkbox" required /> Sign this proposal. The other human must also agree.
        </label>
        <button type="submit" disabled={disabled}>
          Propose allegiance
        </button>
      </form>
      <h3>Your pending proposals</h3>
      {page.pending?.map((p) => (
        <p key={p.id}>
          Subject {p.subjectKingdomId} → patron {p.patronKingdomId} · v{p.version} · expires at game{" "}
          {p.expiresGameTimeMs} ms{" "}
          {p.proposerKingdomId !== kingdomId && (
            <>
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  void write({ kind: "allegiance.answer", proposalId: p.id, expectedVersion: p.version, accept: true })
                }
              >
                Sign exact allegiance
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  void write({ kind: "allegiance.answer", proposalId: p.id, expectedVersion: p.version, accept: false })
                }
              >
                Decline
              </button>
            </>
          )}
        </p>
      ))}
      {offset > 0 && (
        <button type="button" disabled={busy} onClick={() => setOffset(Math.max(0, offset - 50))}>
          Previous declarations
        </button>
      )}
      {[page.articlesNextOffset, page.allegianceNextOffset, page.pendingNextOffset].some((x) => x != null) && (
        <button type="button" disabled={busy} onClick={() => setOffset(offset + 50)}>
          Next declarations
        </button>
      )}
    </section>
  );
}
