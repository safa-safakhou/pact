import { rulesCatalog } from "@pact/domain/rules-catalog";
import { pactBaseUrl } from "./client-location.js";
export type HarvestCurrent = {
  configured: boolean;
  week?: number | undefined;
  harvestPercent?: number | undefined;
  asOfGameTimeMs?: number | undefined;
  schedule?: number[] | undefined;
};
export function harvestOverlay(current: HarvestCurrent): string | null {
  const week = current.week;
  if (!current.configured || week === undefined || !Number.isInteger(week) || week < 1 || week > 6) return null;
  const expected = rulesCatalog.harvestPercentByWeek[week - 1];
  return current.harvestPercent === expected ? `experience/scene/harvest-${expected}.svg` : null;
}
export function HarvestFields({ current, worldStatus }: { current: HarvestCurrent; worldStatus: string }) {
  const file = harvestOverlay(current);
  return (
    <figure className="harvest-fields" aria-label="Public harvest conditions">
      <figcaption>
        <strong>Public harvest conditions</strong>
      </figcaption>
      <p>
        {file
          ? `Week ${current.week}: ${current.harvestPercent}% Grain production.`
          : "Current harvest unavailable or inconsistent; refresh before planning from it."}
      </p>
      <p>
        {worldStatus === "active"
          ? "Clock active; facts as of last refresh."
          : worldStatus === "paused"
            ? "Clock paused; these conditions do not advance."
            : "Clock status unavailable; no change is inferred."}
      </p>
      {file && <img src={`${pactBaseUrl()}${file}`} width="200" height="90" alt="" />}
      <p>
        Published six-week schedule: {rulesCatalog.harvestPercentByWeek.map((n) => `${n}%`).join(" / ")}. Iron and
        Silver unchanged.
      </p>
    </figure>
  );
}
