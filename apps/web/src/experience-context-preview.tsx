import { useState } from "react";
import { createRoot } from "react-dom/client";
import type { ExperienceAudio } from "./experience-audio.js";
import { contextEvent, contextOwner, emptyContextOwner } from "./experience-context-fixtures.js";
import { ExperienceControls } from "./experience-controls.js";
import { HallKeepsakes } from "./hall-keepsakes.js";
import { OutcomeCards, type OutcomeKind } from "./outcome-cards.js";
import "./styles.css";

function Preview() {
  const [view, setView] = useState(emptyContextOwner),
    [audio, setAudio] = useState<ExperienceAudio | null>(null);
  const [offers, setOffers] = useState<{ id: string; version: number; signedBy: string[] }[]>([]);
  const [stale, setStale] = useState(false);
  return (
    <main className="game-shell">
      <h1>Game moment and sound preview</h1>
      <p>
        This uses the actual game cards and sound controls with labelled synthetic records. It creates no account,
        action, opponent or delivery in the real world.
      </p>
      <ExperienceControls owner={contextOwner} onAudioReady={setAudio} />
      <section className="game-card" aria-label="Synthetic event controls">
        <h2>Try a moment</h2>
        <p>
          Enable sound first. Set music and ambience to zero to hear just the event. Wait at least three seconds between
          moments; the game intentionally avoids overlapping alerts. Waiting is always silent.
        </p>
        {(["build", "contact", "delivery", "signature", "raid", "default", "waiting"] as const).map((kind) => (
          <button
            type="button"
            key={kind}
            onClick={() => {
              if (kind === "signature") setOffers([{ id: "fixture-offer", version: 1, signedBy: [contextOwner] }]);
              else setView((v) => contextEvent(v, kind as OutcomeKind));
            }}
          >
            Show {kind} moment
          </button>
        ))}
        <button type="button" onClick={() => setView((v) => structuredClone(v))}>
          Repeat current snapshot
        </button>
        <label>
          <input type="checkbox" checked={stale} onChange={(e) => setStale(e.target.checked)} /> Simulate stale
          connection
        </label>
        <p>
          Reload starts silently with a fresh synthetic scene. Source links refer to real game routes and require a real
          sign-in.
        </p>
      </section>
      <details className="game-card">
        <summary>Separate musical flourish audition</summary>
        <p>A two-second original flourish; the background music and ambience use the normal sound controls above.</p>
        <audio controls preload="none" src="/experience/audio/flourish.wav">
          <track kind="captions" src="/experience/audio/flourish.vtt" srcLang="en" label="Sound description" default />
        </audio>
      </details>
      <HallKeepsakes owner={contextOwner} view={view} stale={stale} />
      <OutcomeCards owner={contextOwner} view={view} stale={stale} offers={offers} audio={audio} />
    </main>
  );
}
const root = document.getElementById("root");
if (root) createRoot(root).render(<Preview />);
