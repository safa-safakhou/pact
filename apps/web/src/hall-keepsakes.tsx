import { pactBaseUrl } from "./client-location.js";
import type { ConsequenceView } from "./consequences.js";
export function HallKeepsakes({
  owner,
  view,
  stale = false,
}: {
  owner: string;
  view?:
    | {
        audience: string;
        profile: { kingdomId: string };
        consequences?: ConsequenceView;
      }
    | undefined;
  stale?: boolean;
}) {
  const authorized = !stale && view?.audience === "owner" && view.profile.kingdomId === owner;
  const records = authorized ? view?.consequences?.firstRetained : undefined;
  const titles = {
    build: "First retained completed build",
    contact: "First retained accepted contact",
    delivery: "First retained delivered trade",
  };
  return (
    <section aria-label="Private Hall keepsakes" className="game-grid">
      <h2>Hall keepsakes</h2>
      <p>
        Private, read-only memories from the earliest retained records. Earlier purged history cannot be reconstructed.
        These grant no game currency, strength or catalog entitlement.
      </p>
      {(["build", "contact", "delivery"] as const).map((kind) => {
        const r = records?.[kind];
        return (
          <article className="game-card" key={kind} data-keepsake={kind}>
            <h3>{titles[kind]}</h3>
            {r ? (
              <>
                <img src={`${pactBaseUrl()}experience/keepsakes/${kind}.svg`} alt="" width="112" height="88" />
                <p>{r.summary}</p>
                <p>
                  Recorded game time: {new Date(r.occurredGameTimeMs).toISOString()} ({r.occurredGameTimeMs} ms).
                </p>
                <code>{r.recordId}</code>
              </>
            ) : (
              <p>Retained accomplishment unavailable. No queued, proposed or purged event is reconstructed.</p>
            )}
            <p>
              <a href={`${pactBaseUrl()}v1/world/kingdoms/${encodeURIComponent(owner)}`}>
                Inspect retained owner history
              </a>
            </p>
          </article>
        );
      })}
    </section>
  );
}
