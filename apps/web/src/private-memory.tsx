import { MemoryKindSchema, type MemorySourceSchema, MemoryWriteSchema } from "@pact/contracts";
import { useCallback, useEffect, useState } from "react";
import type { z } from "zod";

type Request = (path: string, method?: string, body?: unknown) => Promise<Record<string, unknown>>;
type Command = z.infer<typeof MemoryWriteSchema>;
type Source = z.infer<typeof MemorySourceSchema>;
type Entry = {
  entryId: string;
  version: number;
  kind: Command["kind"];
  topic: string;
  text: string;
  authorKind: string;
  peerKingdomId?: string;
  observedGameTimeMs: string;
  sources: Source[];
  deleted?: boolean;
  contentPruned?: boolean;
};
type Cursor = { beforeGameTimeMs: string; beforeEntryId: string };
const path = "/v1/game/private-memory";
export function PrivateMemory({
  request,
  canWrite,
  ownerId,
  contacts,
}: {
  request: Request;
  canWrite: boolean;
  ownerId: string;
  contacts: { kingdomId: string; displayName: string }[];
}) {
  const key = `pact_private_memory_pending:${ownerId}`;
  const [open, setOpen] = useState(false),
    [entries, setEntries] = useState<Entry[]>([]),
    [next, setNext] = useState<Cursor | null>(null),
    [peer, setPeer] = useState(""),
    [filter, setFilter] = useState(""),
    [history, setHistory] = useState<Entry[] | null>(null),
    [historyNext, setHistoryNext] = useState<number | null>(null),
    [editing, setEditing] = useState<Entry | null>(null),
    [kind, setKind] = useState<Command["kind"]>("assessment"),
    [topic, setTopic] = useState(""),
    [text, setText] = useState(""),
    [sources, setSources] = useState<Source[]>([]),
    [sourceKind, setSourceKind] = useState<Source["kind"]>("message"),
    [sourceId, setSourceId] = useState(""),
    [sourceVersion, setSourceVersion] = useState(""),
    [sourceResult, setSourceResult] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState<Command | null>(() => {
      try {
        const parsed = MemoryWriteSchema.safeParse(JSON.parse(sessionStorage.getItem(key) ?? "null"));
        return parsed.success ? parsed.data : null;
      } catch {
        return null;
      }
    });
  const load = useCallback(
    async (cursor?: Cursor) => {
      const query = new URLSearchParams({
        ...(peer ? { peerKingdomId: peer } : {}),
        ...(filter ? { topic: filter } : {}),
        ...cursor,
      });
      const result = await request(`${path}?${query}`),
        rows = result.entries as Entry[];
      setEntries((old) =>
        cursor ? [...old, ...rows.filter((row) => !old.some((x) => x.entryId === row.entryId))] : rows,
      );
      setNext(result.next as Cursor | null);
    },
    [request, peer, filter],
  );
  useEffect(() => {
    if (open) void load().catch(() => setNotice("Memory could not be loaded. Reconnect and retry."));
  }, [open, load]);
  async function revisions(entry: Entry, beforeVersion?: number) {
    try {
      const result = await request(
        `${path}?entryId=${entry.entryId}${beforeVersion ? `&beforeVersion=${beforeVersion}` : ""}`,
      );
      setHistory((old) =>
        beforeVersion ? [...(old ?? []), ...(result.entries as Entry[])] : (result.entries as Entry[]),
      );
      setHistoryNext(result.nextBeforeVersion as number | null);
    } catch {
      setNotice("Revision history could not be loaded.");
    }
  }
  function edit(entry: Entry | null) {
    setEditing(entry);
    setKind(entry?.kind ?? "assessment");
    setTopic(entry?.topic ?? "");
    setText(entry?.text ?? "");
    setSources(entry?.sources ?? []);
    setHistory(null);
    setNotice("");
  }
  async function save(command?: Command, deleted = false) {
    const exact = command ?? {
      schemaVersion: "pact.memory-command.v2",
      commandId: crypto.randomUUID(),
      entryId: editing?.entryId ?? crypto.randomUUID(),
      expectedVersion: editing?.version ?? 0,
      kind,
      topic,
      text,
      sources,
      peerKingdomId: editing?.peerKingdomId ?? (peer || null),
      deleted,
    };
    setBusy(true);
    setNotice("");
    try {
      sessionStorage.setItem(key, JSON.stringify(exact));
      setPending(exact);
      await request(path, "POST", exact);
      sessionStorage.removeItem(key);
      setPending(null);
      edit(null);
      await load();
      setNotice(deleted ? "Note deleted. Earlier content follows the retention period." : "Private note saved.");
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : error instanceof Error
            ? error.message
            : "";
      if (
        ["STALE_VERSION", "SOURCE_UNAVAILABLE", "NOTE_TOO_LARGE", "PRIVATE_MEMORY_FULL", "INVALID_INPUT"].includes(code)
      ) {
        sessionStorage.removeItem(key);
        setPending(null);
        setNotice(
          code === "STALE_VERSION"
            ? "A newer revision exists. Reload and select it before editing again."
            : `Note refused: ${code}.`,
        );
      } else setNotice("Save result is uncertain. Retry the original request before editing this note.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="game-card" aria-label="Private strategy memory">
      <h3>Private strategy & relationships</h3>
      <p>
        Your goals, questions and assessments persist across models and devices. Linked facts stay in their original
        game records.
      </p>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? "Close memory" : "Open memory"}
      </button>
      {open && (
        <>
          <p>
            Notes are private interpretations. Saving one changes no permissions, resources or owner objective. Current
            notes persist; superseded/deleted content expires after 30 days.
          </p>
          <label>
            Relationship
            <select
              value={peer}
              onChange={(e) => {
                setPeer(e.target.value);
                edit(null);
              }}
            >
              <option value="">All relationships</option>
              {contacts.map((p) => (
                <option key={p.kingdomId} value={p.kingdomId}>
                  {p.displayName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Exact topic filter
            <input value={filter} maxLength={80} onChange={(e) => setFilter(e.target.value)} />
          </label>
          <button type="button" onClick={() => void load().catch(() => setNotice("Reload failed."))}>
            Reload notes
          </button>
          {entries.length === 0 && <p>No retained notes match this view.</p>}
          <ul>
            {entries.map((entry) => (
              <li key={entry.entryId}>
                <strong>{entry.topic}</strong> · {entry.kind} · {entry.authorKind} · revision {entry.version}
                <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{entry.text}</p>
                <button type="button" disabled={Boolean(pending)} onClick={() => edit(entry)}>
                  Revise {entry.topic}
                </button>
                <button type="button" onClick={() => void revisions(entry)}>
                  History {entry.topic}
                </button>
                {entry.sources.map((source) => (
                  <button
                    type="button"
                    key={`${source.kind}:${source.id}:${source.version ?? ""}`}
                    onClick={async () => {
                      try {
                        setSourceResult(
                          JSON.stringify(
                            await request(
                              `${path}/source?${new URLSearchParams({ kind: source.kind, id: source.id, ...(source.version ? { version: String(source.version) } : {}) })}`,
                            ),
                          ),
                        );
                      } catch {
                        setSourceResult("Source is unavailable or no longer authorized.");
                      }
                    }}
                  >
                    Check {source.kind} source
                  </button>
                ))}
              </li>
            ))}
          </ul>
          {next && (
            <button
              type="button"
              onClick={() => void load(next).catch(() => setNotice("Earlier notes could not be loaded."))}
            >
              Earlier notes
            </button>
          )}
          {history && (
            <section aria-label="Memory revision history">
              <h4>Revision history</h4>
              {history.map((entry) => (
                <p key={entry.version}>
                  Revision {entry.version} · {entry.authorKind}:{" "}
                  {entry.contentPruned
                    ? "Earlier content is no longer retained."
                    : entry.deleted
                      ? "Deleted."
                      : entry.text}
                </p>
              ))}
              {historyNext && history[0] && (
                <button type="button" onClick={() => void revisions(history[0] as Entry, historyNext)}>
                  Earlier revisions
                </button>
              )}
            </section>
          )}
          {sourceResult && <p style={{ overflowWrap: "anywhere" }}>{sourceResult}</p>}
          {pending ? (
            <section aria-label="Pending private note">
              <p>The original note save is pending. Editing is locked until its result is known.</p>
              <button type="button" disabled={busy || !canWrite} onClick={() => void save(pending, pending.deleted)}>
                Retry original note
              </button>
            </section>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <h4>{editing ? `Revise ${editing.topic}` : "New private note"}</h4>
              <label>
                Note type
                <select value={kind} onChange={(e) => setKind(e.target.value as Command["kind"])}>
                  {MemoryKindSchema.options.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Topic
                <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={80} required />
              </label>
              <label>
                Private assessment or strategy
                <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={8000} required rows={5} />
              </label>
              <fieldset>
                <legend>Optional factual source pointer</legend>
                <label>
                  Record kind
                  <select value={sourceKind} onChange={(e) => setSourceKind(e.target.value as Source["kind"])}>
                    {[
                      "message",
                      "supply-offer",
                      "supply-contract",
                      "garrison-offer",
                      "garrison-contract",
                      "raid",
                      "scout",
                      "building",
                      "receipt",
                    ].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Record ID
                  <input value={sourceId} onChange={(e) => setSourceId(e.target.value)} />
                </label>
                {sourceKind.endsWith("offer") && (
                  <label>
                    Term version
                    <input
                      type="number"
                      min={1}
                      value={sourceVersion}
                      onChange={(e) => setSourceVersion(e.target.value)}
                    />
                  </label>
                )}
                <button
                  type="button"
                  disabled={sources.length >= 8}
                  onClick={() => {
                    if (!/^[0-9a-f-]{36}$/i.test(sourceId)) {
                      setNotice("Use the original record UUID.");
                      return;
                    }
                    setSources([
                      ...sources,
                      {
                        kind: sourceKind,
                        id: sourceId,
                        ...(sourceVersion && sourceKind.endsWith("offer") ? { version: Number(sourceVersion) } : {}),
                      },
                    ]);
                    setSourceId("");
                  }}
                >
                  Attach source
                </button>
                {sources.map((s, i) => (
                  <p key={`${s.kind}:${s.id}:${s.version ?? ""}`}>
                    {s.kind} · {s.id}
                    <button type="button" onClick={() => setSources(sources.filter((_, n) => n !== i))}>
                      Remove pointer
                    </button>
                  </p>
                ))}
              </fieldset>
              <button disabled={busy || !canWrite} type="submit">
                Save private note
              </button>
              <button type="button" disabled={busy} onClick={() => edit(null)}>
                New note
              </button>
              {editing && (
                <button type="button" disabled={busy || !canWrite} onClick={() => void save(undefined, true)}>
                  Delete note
                </button>
              )}
            </form>
          )}
          {notice && <p role="status">{notice}</p>}
        </>
      )}
    </section>
  );
}
