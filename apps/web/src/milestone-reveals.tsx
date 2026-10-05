import { useEffect, useRef, useState } from "react";
import { pactBaseUrl } from "./client-location.js";
import type { ConsequenceView } from "./consequences.js";
export type Milestone = { key: string; kind: "build" | "contact" | "delivery"; text: string };
export function milestoneEvents(data: ConsequenceView | undefined): Milestone[] {
  if (!data) return [];
  const builds = data.builds
    .filter((b) => b.state === "completed" && b.settledGameTimeMs !== null)
    .map((b) => ({
      key: `build:${b.id}`,
      kind: "build" as const,
      text: `${b.building} ${b.targetLevel} completed in the recorded state.`,
    }));
  const contacts = data.contacts
    .filter((c) => /^\d+$/.test(c.acceptedGameTimeMs))
    .map((c) => ({
      key: `contact:${c.kingdomId}:${c.acceptedGameTimeMs}`,
      kind: "contact" as const,
      text: `Contact with @${c.handle} is accepted.`,
    }));
  const deliveries = data.supplyContracts
    .filter((c) =>
      c.deliveries.some((d) => d.installments > 0 && /^\d+$/.test(d.deliveredMarked) && BigInt(d.deliveredMarked) > 0n),
    )
    .map((c) => ({
      key: `delivery:${c.id}`,
      kind: "delivery" as const,
      text: "A recorded positive delivery exists for this contract. Inspect actual amounts and direction.",
    }));
  return [...builds, ...contacts, ...deliveries];
}
export class MilestoneMemory {
  private initialized = false;
  private seen = new Set<string>();
  private readonly key: string;
  constructor(
    owner: string,
    private readonly storage: Pick<Storage, "getItem" | "setItem">,
  ) {
    this.key = `pact_experience:${owner}:milestones`;
  }
  observe<T extends { key: string }>(events: T[], quiet = false): T[] {
    try {
      const saved = JSON.parse(this.storage.getItem(this.key) ?? "[]");
      if (Array.isArray(saved)) for (const key of saved) if (typeof key === "string") this.seen.add(key);
    } catch {}
    const fresh = events.filter((e) => !this.seen.has(e.key));
    for (const e of events) this.seen.add(e.key);
    try {
      this.storage.setItem(this.key, JSON.stringify(Array.from(this.seen)));
    } catch {}
    if (!this.initialized || quiet) {
      this.initialized = true;
      return [];
    }
    return fresh;
  }
}
export function MilestoneReveals({ owner, data }: { owner: string; data: ConsequenceView | undefined }) {
  const memory = useRef<MilestoneMemory | null>(null);
  const [reveals, setReveals] = useState<Milestone[]>([]);
  useEffect(() => {
    if (!memory.current) memory.current = new MilestoneMemory(owner, localStorage);
    if (data) setReveals(memory.current.observe(milestoneEvents(data)));
  }, [owner, data]);
  if (!reveals.length) return null;
  return (
    <section aria-label="New recorded milestones">
      {reveals.map((e) => (
        <article className={`game-card experience-reveal ${e.kind}`} key={e.key}>
          <p>{e.text}</p>
          <a href={`${pactBaseUrl()}v1/world/kingdoms/${encodeURIComponent(owner)}`}>Read current source records</a>
        </article>
      ))}
    </section>
  );
}
