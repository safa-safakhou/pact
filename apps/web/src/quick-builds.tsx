import { type BuildingKind, type BuildingLevels, checkUpgrade } from "@pact/domain/rules-catalog";
import { useState } from "react";
import { developmentChoices } from "./development-choices.js";
import type { OwnerView } from "./game-app.js";
import { remainingGameTime } from "./game-time.js";
export function suggestedBuilds(view: OwnerView) {
  const levels = Object.fromEntries(view.buildings.map((b) => [b.kind, b.level])) as BuildingLevels;
  const desired = view.ambition === "farmer" ? "farm" : view.ambition === "defender" ? "wall" : "mine";
  return developmentChoices(view)
    .filter((c) => !view.builders.some((b) => b.instructionId && b.kind === c.building))
    .map((c) => ({
      ...c,
      blocker:
        checkUpgrade(levels, c.building as BuildingKind, c.to) !== "ready"
          ? "Upgrade your Hall first"
          : !c.affordable
            ? "Need more Iron or Silver"
            : null,
    }))
    .sort(
      (a, b) =>
        Number(Boolean(a.blocker)) - Number(Boolean(b.blocker)) ||
        Number(b.building === desired) - Number(a.building === desired),
    )
    .slice(0, 3);
}
export function BuilderStatus({ view }: { view: OwnerView }) {
  return (
    <section className="builder-strip" aria-label="Your builders">
      {view.builders.map((b) => (
        <div key={b.slot}>
          <strong>Builder {b.slot}</strong>
          <span>
            {!b.instructionId
              ? "Free"
              : b.kind +
                " · " +
                (b.state === "active" && b.dueGameTimeMs !== null
                  ? remainingGameTime(b.dueGameTimeMs, view)
                  : "waiting")}
          </span>
        </div>
      ))}
    </section>
  );
}
export function QuickBuilds({
  view,
  disabled,
  onBuild,
}: {
  view: OwnerView;
  disabled: boolean;
  onBuild: (building: string, level: number) => void;
}) {
  const choices = suggestedBuilds(view),
    free = view.builders.find((b) => !b.instructionId);
  const [notice, setNotice] = useState("");
  async function copy(building: string, level: number) {
    const prompt = `Read my current PACT kingdom. If affordable and permitted, use a free builder to upgrade ${building} to level ${level}. Check live costs, prerequisites and both slots first. Report the real receipt and finish time.`;
    try {
      await navigator.clipboard.writeText(prompt);
      setNotice("Copied. Paste into your agent.");
    } catch {
      setNotice(prompt);
    }
  }
  return (
    <section className="quick-builds" aria-label="Suggested upgrades">
      <h2>Make your next move</h2>
      <p>
        {free ? "A builder is free. Put the tiny hard hat to work." : "Both builders are busy. Time for diplomacy."}
      </p>
      <div className="game-grid">
        {choices.map((c) => (
          <article className="game-card" key={c.building}>
            <h3>
              {c.building} {c.from} → {c.to}
            </h3>
            <p>
              <strong>
                {c.before} → {c.after}
              </strong>{" "}
              {c.benefit}
            </p>
            <p>
              {c.iron} Iron · {c.silver} Silver · {c.minutes} game minutes
            </p>
            {c.blocker && <p>{c.blocker}</p>}
            <button
              type="button"
              disabled={disabled || !free || Boolean(c.blocker)}
              onClick={() => onBuild(c.building, c.to)}
            >
              Upgrade {c.building}
            </button>
            <button type="button" className="secondary" onClick={() => void copy(c.building, c.to)}>
              Ask my agent
            </button>
          </article>
        ))}
      </div>
      {!choices.length && (
        <p>These buildings are upgraded or already queued. Meet someone in People, or inspect All buildings.</p>
      )}
      <p role="status">{notice}</p>
    </section>
  );
}
