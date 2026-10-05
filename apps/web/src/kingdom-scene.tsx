import type React from "react";
import { pactBaseUrl } from "./client-location.js";
export type SceneFacts = {
  audience?: string;
  buildings: { kind: string; level: number }[];
  builders: { kind: string | null; state: string | null; instructionId: string | null }[];
};
const kinds = ["hall", "farm", "mine", "market", "storehouse", "barracks", "wall"] as const;
export function sceneState(facts: SceneFacts) {
  if (facts.audience !== "owner") return [];
  return kinds.flatMap((kind) => {
    const building = facts.buildings.find((b) => b.kind === kind);
    if (!building) return [];
    const illustratedLevel = (kind === "farm" || kind === "mine") && building.level === 2 ? 2 : 1;
    return [
      {
        kind,
        level: building.level,
        illustratedLevel,
        working: facts.builders.some((b) => b.kind === kind && b.state === "active" && b.instructionId !== null),
        file: `experience/scene/${kind}-${illustratedLevel}.svg`,
      },
    ];
  });
}
export function KingdomScene({ facts }: { facts: SceneFacts }): React.JSX.Element | null {
  const states = sceneState(facts);
  if (!states.length) return null;
  return (
    <figure className="kingdom-scene" aria-label="Your recorded settlement">
      <figcaption>
        <strong>Your recorded settlement</strong>
        <span>Static art follows completed building levels. Scaffolding means active work.</span>
      </figcaption>
      <img
        className="settlement-banner"
        src={`${pactBaseUrl()}experience/scene/banner.svg`}
        alt=""
        width="48"
        height="38"
      />
      <div className="settlement-buildings">
        {states.map((b) => (
          <div className="settlement-building" key={b.kind}>
            <div className="building-picture">
              <img src={`${pactBaseUrl()}${b.file}`} alt="" width="180" height="140" />
              {b.working && (
                <svg className="building-scaffold" viewBox="0 0 180 140" aria-hidden="true">
                  <g fill="none" stroke="#A83F38" strokeWidth="4" strokeLinecap="round">
                    <path d="M20 132V38M160 132V38M20 48h140M20 88h140M20 126h140M20 88l140-40M20 126l140-38" />
                  </g>
                </svg>
              )}
            </div>
            <strong>
              {b.kind} {b.level}
            </strong>
            {b.working && <small>Active construction</small>}
            {b.level !== b.illustratedLevel && <small>Base illustration; actual level {b.level}</small>}
          </div>
        ))}
      </div>
    </figure>
  );
}
