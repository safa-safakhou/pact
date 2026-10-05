import { useEffect, useState } from "react";
import { pactBaseUrl } from "./client-location.js";

type Person = { kingdomId: string; handle: string; displayName: string };
export function FriendsLobby({
  request,
  contacts,
  requests,
  onChoose,
}: {
  request: (path: string) => Promise<Record<string, unknown>>;
  contacts: Person[];
  requests: (Person & { direction: string })[];
  onChoose: (id: string, text: string) => void;
}) {
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(0),
    [people, setPeople] = useState<Person[] | null>(null),
    [more, setMore] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    let current = true;
    setPeople(null);
    setError("");
    const refresh = async () => {
      if (document.hidden) return;
      try {
        const result = await request(`/v1/play/people?offset=${page * 20}&refresh=${revision}`);
        if (current) {
          setPeople(result.players as Person[]);
          setMore(Boolean(result.hasMore));
          setError("");
        }
      } catch {
        if (current) setError("The player list is unavailable. Try Refresh; your kingdom is still here.");
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 10000);
    return () => {
      current = false;
      clearInterval(timer);
    };
  }, [request, page, revision]);
  async function copy() {
    const url = new URL(pactBaseUrl(), location.origin).href;
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Game link copied. Your friend can pick a nickname and join.");
    } catch {
      setNotice(url);
    }
  }
  return (
    <section className="game-card" aria-label="Friends in this world">
      <h3>Friends in this world</h3>
      <button type="button" onClick={() => void copy()}>
        Copy game link
      </button>
      <button type="button" className="secondary" onClick={() => setRevision((r) => r + 1)}>
        Refresh players
      </button>
      <p role="status">{notice}</p>
      {error ? (
        <p role="alert">{error}</p>
      ) : people === null ? (
        <p>Loading kingdoms…</p>
      ) : !people.length ? (
        <p>No other guest kingdoms here yet. Send a friend the game link.</p>
      ) : (
        <div className="game-grid">
          {people.map((p) => {
            const contact = contacts.some((c) => c.kingdomId === p.kingdomId),
              pending = requests.find((c) => c.kingdomId === p.kingdomId);
            return (
              <article className="game-card" key={p.kingdomId}>
                <h4>{p.displayName}</h4>
                <p>@{p.handle}</p>
                {pending ? (
                  <p>
                    {pending.direction === "incoming"
                      ? "Their request is below. Accept it to start chatting."
                      : "Contact requested — waiting for them to accept."}
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={Boolean(pending) && !contact}
                  onClick={() => onChoose(p.kingdomId, "Hello! I just arrived. What are you building?")}
                >
                  {contact ? "Say hello" : "Request contact"}
                </button>
                {contact && (
                  <button
                    type="button"
                    onClick={() => onChoose(p.kingdomId, "Want to trade? I can check my resources — what do you need?")}
                  >
                    Discuss a trade
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
      <div className="game-inline-actions">
        <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
          Previous
        </button>
        <button type="button" disabled={!more} onClick={() => setPage((p) => p + 1)}>
          Next
        </button>
      </div>
      <p>Choose a player to draft a message below. Nothing is sent until you press the send or request button.</p>
    </section>
  );
}
