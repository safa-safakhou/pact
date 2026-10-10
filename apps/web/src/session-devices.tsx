import { useEffect, useState } from "react";

type Request = (path: string, method?: string, body?: unknown) => Promise<Record<string, unknown>>;
type Session = { id: string; label: string | null; lastSeenAt: string; absoluteExpiresAt: string; current?: boolean };
export function SessionDevices({ request }: { request: Request }) {
  const [sessions, setSessions] = useState<Session[]>([]),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    void request("/v1/auth/connections")
      .then((r) => {
        if (live) setSessions((r.sessions ?? []) as Session[]);
      })
      .catch(() => {
        if (live) setNotice("Session list unavailable. Refresh to check your devices.");
      });
    return () => {
      live = false;
    };
  }, [request]);
  return (
    <section className="game-card" aria-label="Signed-in devices">
      <h3>Signed-in devices</h3>
      <p>Sessions can share a device. Ending a session does not revoke its separate agent connection.</p>
      {sessions.map((s) => (
        <article key={s.id}>
          <h4>
            {s.label ?? "Browser"}
            {s.current ? " · this session" : ""}
          </h4>
          <p>
            Last seen {new Date(s.lastSeenAt).toLocaleString()} · expires{" "}
            {new Date(s.absoluteExpiresAt).toLocaleString()}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void request("/v1/auth/sessions/revoke", "POST", { sessionId: s.id })
                .then(() => {
                  if (s.current) location.reload();
                  else {
                    setSessions((list) => list.filter((x) => x.id !== s.id));
                    setNotice("Session ended.");
                  }
                })
                .catch(() => setNotice("Could not end this session. Refresh and retry."))
                .finally(() => setBusy(false));
            }}
          >
            End {s.current ? "this" : "device"} session
          </button>
        </article>
      ))}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
