import { useCallback, useEffect, useState } from "react";

export type SeasonView = {
  current: {
    configured: boolean;
    number?: number;
    week?: number;
    harvestPercent?: number;
    schedule?: number[];
    asOfGameTimeMs?: number;
    nextTransitionGameTimeMs?: number;
  };
  standings: {
    kingdomId: string;
    handle: string;
    rank: number;
    fortuneQuarterUnits: string;
    denominator: string;
    band: string;
  }[];
  cohorts: {
    kingdomId: string;
    handle: string;
    status: string;
    rank: number | null;
    fortuneQuarterUnits: string | null;
    denominator: string;
    dueGameTimeMs: number;
    finalized: boolean;
  }[];
  honors?: {
    seasonNumber: number | null;
    ownMeaningfulDays: number;
    requiredMeaningfulDays: number;
    ownCosmetics: string[];
    results: {
      kingdomId: string;
      handle: string;
      overallRank: number;
      band: string;
      bandRank: number;
      eligible: boolean;
      meaningfulDays: number;
      provisionalBorder: string | null;
      provisionalPlaque: boolean;
      eligibleBandPopulation: number;
    }[];
  };
};
export function SeasonSummary({ view, kingdomId }: { view: SeasonView; kingdomId: string }) {
  if (!view.current.configured) return <p>Season opens with the next committed game tick.</p>;
  const own = view.standings.find((p) => p.kingdomId === kingdomId);
  const newcomer = view.cohorts.find((p) => p.kingdomId === kingdomId);
  const minutes = Math.max(
    0,
    Math.ceil(((view.current.nextTransitionGameTimeMs ?? 0) - (view.current.asOfGameTimeMs ?? 0)) / 60000),
  );
  return (
    <>
      <h3>
        Season {view.current.number} · Week {view.current.week}/6
      </h3>
      <p>
        Grain harvest: {view.current.harvestPercent}% · Next transition in {minutes.toLocaleString()} game minutes.
      </p>
      <p>
        Six-week harvest: {view.current.schedule?.map((n) => `${n}%`).join(" → ")}. Iron and Silver are unchanged.
        Pauses freeze this clock.
      </p>
      {own && (
        <p>
          Your Fortune: {(Number(own.fortuneQuarterUnits) / Number(own.denominator)).toFixed(2)} · provisional rank{" "}
          {own.rank} · Hall band {own.band}.
        </p>
      )}
      <p>
        Fortune measures gain over your season-opening wealth, not total stock. Resources, buildings, troops and signed
        agreements carry over.
      </p>
      {newcomer && (
        <p>
          Arrival cohort:{" "}
          {newcomer.status === "captured"
            ? `${newcomer.finalized ? "closed" : "provisional"} age-seven-day rank ${newcomer.rank}, Fortune ${(Number(newcomer.fortuneQuarterUnits) / Number(newcomer.denominator)).toFixed(2)}`
            : newcomer.status === "pending"
              ? "pending — scored at exactly seven game days, not zero"
              : "unavailable — exact snapshot predates season installation"}
          .
        </p>
      )}
      <p>Ranks are provisional, not finalized competitive honors.</p>
      {view.honors && (
        <>
          <h3>Participation & results</h3>
          <p>
            Your meaningful days this season: {view.honors.ownMeaningfulDays}/3. Completed builds, player exchanges,
            scouts and resolved raids count; logins, messages and training alone do not.
          </p>
          <p>
            Earned display cosmetics: {view.honors.ownCosmetics.join(", ") || "None yet"}. They give no game advantage.
          </p>
          {view.honors.seasonNumber !== null && (
            <h4>Season {view.honors.seasonNumber} · provisional closing results</h4>
          )}
          {view.honors.results.map((r) => (
            <p key={r.kingdomId}>
              @{r.handle} · rank {r.overallRank} · band {r.band} rank {r.bandRank} · {r.meaningfulDays} meaningful days
              · {r.eligible ? "eligible" : "needs three meaningful days"}
              {r.provisionalPlaque ? " · provisional top-three plaque" : ""}
              {r.provisionalBorder
                ? ` · provisional ${r.provisionalBorder} border`
                : r.eligibleBandPopulation < 100
                  ? " · no percentile honor (fewer than 100 eligible players)"
                  : ""}
            </p>
          ))}
          <p>Competitive borders and plaques are not issued as final entitlements during Alpha.</p>
        </>
      )}
    </>
  );
}
export function SeasonPanel({
  request,
  kingdomId,
}: {
  request: (path: string) => Promise<Record<string, unknown>>;
  kingdomId: string;
}) {
  const [view, setView] = useState<SeasonView | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setView((await request("/v1/seasons")) as unknown as SeasonView);
      setError("");
    } catch {
      setError("Season data could not be refreshed.");
    }
  }, [request]);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const next = await request("/v1/seasons");
        if (active) {
          setView(next as unknown as SeasonView);
          setError("");
        }
      } catch {
        if (active) setError("Season data could not be refreshed.");
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [request]);
  return (
    <section className="game-card">
      <h2>Season & Fortune</h2>
      {view ? <SeasonSummary view={view} kingdomId={kingdomId} /> : <p>Loading season…</p>}
      {error && <p role="alert">{error}</p>}
      <button type="button" onClick={() => void load()}>
        Refresh season
      </button>
    </section>
  );
}
