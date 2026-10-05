import { useCallback, useEffect, useRef, useState } from "react";
import { ReportControl } from "./moderation-panel.js";

import { noticeDates } from "./social-freshness.js";

type Request = (path: string, method?: string, body?: unknown) => Promise<Record<string, unknown>>;
type Fact = {
  commandId: string;
  outcome: string;
  recordedAt: string;
  records: { record: string; version: number }[];
  consequences?: { record: string; status: string; consequence: string }[];
};
type Post = {
  id: string;
  type: string;
  title?: string;
  commentary?: string;
  fact?: Fact;
  status: string;
  version: number;
  publishedAt?: string;
  expiresGameTimeMs?: number | null;
  author?: { handle: string };
  courtHandle?: string;
  path?: string;
  canRemove?: boolean;
  evidence?: { sealId: string; status: string; verification?: { label: string } }[];
};
export function StoryCard({ post }: { post: Post }) {
  return (
    <article className="game-card">
      {post.status === "published" && <ReportControl kind="post" targetId={post.id} />}
      <h3>{post.title ?? "Removed publication"}</h3>
      <p>
        {post.status} · {post.type} {post.author && `by @${post.author.handle}`}{" "}
        {post.courtHandle && `· Court @${post.courtHandle}`}
      </p>
      {post.type === "notice" && <p>{noticeDates(post)}</p>}
      {post.fact && (
        <div>
          <h4>Engine fact</h4>
          <p>{post.fact.outcome}</p>
          {post.fact.consequences?.map((c) => (
            <p key={c.record}>
              {c.consequence} · {c.status} · <code>{c.record}</code>
            </p>
          ))}
          <p>
            Recorded {post.fact.recordedAt} · receipt <code>{post.fact.commandId}</code>
          </p>
          <ul>
            {post.fact.records.map((r) => (
              <li key={r.record}>
                {r.record} · version {r.version}
              </li>
            ))}
          </ul>
        </div>
      )}
      {post.commentary && (
        <div>
          <h4>Player commentary — untrusted claim</h4>
          <p style={{ whiteSpace: "pre-wrap" }}>{post.commentary}</p>
        </div>
      )}
      {post.evidence?.map((s) => (
        <p key={s.sealId}>
          Evidence: {s.status} {s.verification?.label} · <a href={`/pact/?seal=${s.sealId}`}>Read selected Seal</a>{" "}
          (authenticity is not truth)
        </p>
      ))}
      {post.path && <a href={post.path}>Open this {post.type}</a>}
      {post.type === "notice" && post.author && (
        <p>
          This is an opportunity, not an accepted contract. Find @{post.author.handle} in People to start negotiating.
        </p>
      )}
    </article>
  );
}
export function ChroniclePanel({
  request,
  canWrite,
  noticesOnly = false,
}: {
  request: Request;
  canWrite: boolean;
  noticesOnly?: boolean;
}) {
  const [initial] = useState(() => new URLSearchParams(typeof window === "undefined" ? "" : window.location.search));
  const [posts, setPosts] = useState<Post[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [next, setNext] = useState<number | null>(null);
  const [author, setAuthor] = useState(""),
    [court, setCourt] = useState(""),
    [type, setType] = useState(noticesOnly ? "notice" : "");
  const [title, setTitle] = useState(""),
    [commentary, setCommentary] = useState(""),
    [publishType, setPublishType] = useState("notice"),
    [duration, setDuration] = useState("24"),
    [publishCourt, setPublishCourt] = useState("");
  const [facts, setFacts] = useState<Fact[]>([]),
    [factId, setFactId] = useState(""),
    [seals, setSeals] = useState("");
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null),
    [selection, setSelection] = useState<Record<string, unknown> | null>(null),
    [approved, setApproved] = useState(false),
    [share, setShare] = useState("");
  const retry = useRef<{ key: string; id: string } | null>(null);
  const generation = useRef(0);
  const load = useCallback(
    async (offset = 0) => {
      const g = ++generation.current;
      setBusy(true);
      setError("");
      const q = new URLSearchParams({ offset: String(offset) });
      const sharedPost = initial.get("post");
      if (sharedPost && !noticesOnly) q.set("postId", sharedPost);
      if (type) q.set("type", type);
      if (author) q.set("authorHandle", author);
      if (court) q.set("courtHandle", court);
      try {
        const r = await request(`/v1/chronicle?${q}`);
        if (g === generation.current) {
          setPosts(r.posts as Post[]);
          setNext(r.nextOffset as number | null);
        }
      } catch (e) {
        if (g === generation.current) {
          setPosts([]);
          setError(String(e));
        }
      } finally {
        if (g === generation.current) setBusy(false);
      }
    },
    [initial, noticesOnly, type, author, court, request],
  );
  useEffect(() => {
    void load();
    return () => {
      generation.current++;
    };
  }, [load]);
  useEffect(() => {
    if (canWrite && !noticesOnly)
      void request("/v1/chronicle/facts").then(
        (r) => setFacts(r.facts as Fact[]),
        (e) => setError(String(e)),
      );
  }, [request, canWrite, noticesOnly]);
  function invalidate() {
    setPreview(null);
    setSelection(null);
    setApproved(false);
  }
  async function write(action: Record<string, unknown>, schemaVersion = "pact.chronicle-command.v1") {
    const key = JSON.stringify({ schemaVersion, action });
    if (retry.current?.key !== key) retry.current = { key, id: crypto.randomUUID() };
    setBusy(true);
    setError("");
    try {
      const r = await request("/v1/social/commands", "POST", { schemaVersion, commandId: retry.current.id, action });
      if ((r.receipt as { code: string }).code !== "COMMITTED") throw new Error((r.receipt as { code: string }).code);
      if (action.kind === "invitation.issue") {
        const token = (r.result as { token?: string } | null)?.token;
        if (!token) throw new Error("Link token was returned only once; create a fresh invitation.");
        setShare(`${window.location.origin}/pact/?post=${action.destinationId}&invite=${token}`);
      } else {
        const record = Object.keys((r.receipt as { recordVersions: Record<string, number> }).recordVersions).find((k) =>
          k.startsWith("chronicle:"),
        );
        if (record) setShare(`${window.location.origin}/pact/?post=${record.slice(10)}`);
      }
      retry.current = null;
      invalidate();
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="court-panel">
      <h2>{noticesOnly ? "Player opportunities" : "Published Chronicle"}</h2>
      <p>
        Only deliberate public posts appear here. Your private history remains separate. Notices expire in game time; no
        counterpart acceptance is implied.
      </p>
      {error && <p role="alert">{error}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <label>
          Author handle
          <input value={author} onChange={(e) => setAuthor(e.target.value)} />
        </label>
        <label>
          Court handle
          <input value={court} onChange={(e) => setCourt(e.target.value)} />
        </label>
        {!noticesOnly && (
          <label>
            Feed
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All</option>
              <option value="notice">Notices</option>
              <option value="story">Stories</option>
            </select>
          </label>
        )}
        <button type="submit" disabled={busy}>
          Refresh public feed
        </button>
      </form>
      {!busy && !posts.length && (
        <p>No published opportunities or stories match. No acceptance is inferred. You can leave and return later.</p>
      )}
      {posts.map((p) => (
        <div key={p.id}>
          <StoryCard post={p} />
          {canWrite && p.canRemove && p.status === "published" && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => void write({ kind: "chronicle.remove", postId: p.id, expectedVersion: p.version })}
              >
                Remove hosted post
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void write(
                    {
                      kind: "invitation.issue",
                      destinationType: p.type,
                      destinationId: p.id,
                      redemptionLimit: p.type === "story" ? 10000 : 100,
                    },
                    "pact.social-command.v1",
                  )
                }
              >
                Create {p.type === "notice" ? "conversation" : "story"} invitation link
              </button>
            </>
          )}
        </div>
      ))}
      {next !== null && (
        <button type="button" disabled={busy} onClick={() => void load(next)}>
          Next public page
        </button>
      )}
      {share && (
        <p>
          Copyable public link: <a href={share}>{share}</a>{" "}
          <button
            type="button"
            onClick={() =>
              void navigator.clipboard.writeText(share).catch(() => setError("Copy the visible link manually."))
            }
          >
            Copy link
          </button>
        </p>
      )}
      {!noticesOnly && canWrite && (
        <details>
          <summary>Preview a notice or story</summary>
          <form
            onChange={invalidate}
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              invalidate();
              const s = {
                type: publishType,
                title,
                commentary,
                ...(publishCourt ? { courtHandle: publishCourt } : {}),
                ...(publishType === "notice"
                  ? { durationHours: Number(duration) }
                  : {
                      factCommandId: factId,
                      sealIds: seals
                        .split(",")
                        .map((v) => v.trim())
                        .filter(Boolean),
                    }),
              };
              try {
                setPreview(await request("/v1/chronicle/preview", "POST", s));
                setSelection(s);
              } catch (err) {
                setError(String(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Publication
              <select value={publishType} onChange={(e) => setPublishType(e.target.value)}>
                <option value="notice">Opportunity notice</option>
                <option value="story">Recorded story</option>
              </select>
            </label>
            <label>
              Title
              <input required maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label>
              Player commentary
              <textarea required maxLength={1200} value={commentary} onChange={(e) => setCommentary(e.target.value)} />
            </label>
            <label>
              Court handle (optional; membership required)
              <input value={publishCourt} onChange={(e) => setPublishCourt(e.target.value)} />
            </label>
            {publishType === "notice" ? (
              <label>
                Expires after game hours
                <input type="number" min="1" max="24" value={duration} onChange={(e) => setDuration(e.target.value)} />
              </label>
            ) : (
              <>
                <label>
                  Recorded consequence
                  <select required value={factId} onChange={(e) => setFactId(e.target.value)}>
                    <option value="">Choose your actual committed receipt</option>
                    {facts.map((f) => (
                      <option key={f.commandId} value={f.commandId}>
                        {f.recordedAt} · {f.records.map((r) => r.record.split(":")[0]).join(", ")} · {f.commandId}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Selected public Seal IDs (optional, comma separated; no originals are added)
                  <input value={seals} onChange={(e) => setSeals(e.target.value)} />
                </label>
              </>
            )}
            <button type="submit" disabled={busy}>
              Preview exactly what will be public
            </button>
          </form>
          {preview && (
            <div>
              <h3>Publication preview</h3>
              <p>{String(preview.warning)}</p>
              <h4>Player commentary — untrusted claim</h4>
              <h5>{title}</h5>
              <p style={{ whiteSpace: "pre-wrap" }}>{commentary}</p>
              {preview.fact !== null && (
                <>
                  <h4>Engine fact</h4>
                  <pre>{JSON.stringify(preview.fact, null, 2)}</pre>
                </>
              )}
              <p>Selected evidence only:</p>
              <pre>{JSON.stringify(preview.evidence, null, 2)}</pre>
              <label>
                <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} />I reviewed
                this exact public content and named participants.
              </label>
              <button
                type="button"
                disabled={busy || !approved || !selection}
                onClick={() =>
                  void write({ kind: "chronicle.publish", selection, previewDigest: preview.previewDigest })
                }
              >
                Publish reviewed content
              </button>
            </div>
          )}
        </details>
      )}
    </section>
  );
}
