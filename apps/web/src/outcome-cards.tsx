import { wholeUnitText } from "@pact/domain/resource-facts";
import { useEffect, useMemo, useRef, useState } from "react";
import copy from "../public/experience/copy.json" with { type: "json" };
import { pactBaseUrl } from "./client-location.js";
import type { ConsequenceView } from "./consequences.js";
import type { ExperienceAudio } from "./experience-audio.js";
import { remainingGameTime } from "./game-time.js";
import { MilestoneMemory } from "./milestone-reveals.js";

export type OutcomeKind = "build" | "contact" | "delivery" | "signature" | "raid" | "default" | "waiting";
export type OutcomeCard = { key: string; kind: OutcomeKind; text: string; href: string; recordId: string };
export type OutcomeOwner = {
  audience: string;
  profile: { kingdomId: string };
  asOfGameTimeMs: number;
  worldStatus: string;
  consequences?: ConsequenceView;
  threats: { kind: string; id: string; dueGameTimeMs: number }[];
  raids: { raidId: string; status: string; dueGameTimeMs: number }[];
  builders: { instructionId: string | null; kind: string | null; state: string | null; dueGameTimeMs: number | null }[];
};
export type OutcomeOffer = { id: string; version: number; signedBy: string[] };
export type OutcomeRequest = {
  id: string;
  direction: "incoming" | "outgoing";
  handle: string;
  expiresGameTimeMs: string;
};
export const outcomeCue: Partial<Record<OutcomeKind, string>> = {
  build: "build.wav",
  contact: "paper.wav",
  delivery: "delivery.wav",
  signature: "seal.wav",
  raid: "raid.wav",
  default: "default.wav",
};
const character: Record<OutcomeKind, string> = {
  build: "pebble-pleased",
  contact: "moth-pleased",
  delivery: "bean-pleased",
  signature: "honk-pleased",
  raid: "honk-concerned",
  default: "bean-concerned",
  waiting: "moth-idle",
};
const marked = (n: string) => /^\d+$/.test(n);
const source = (route: string) => `${pactBaseUrl()}v1/${route}`;
export function outcomeCards(input: {
  onNotice?: (text: string) => void;
  owner: string;
  view?: OutcomeOwner | undefined;
  stale: boolean;
  offers?: OutcomeOffer[] | undefined;
  requests?: OutcomeRequest[] | undefined;
  approvals?: { approvalId: string; status: string; deepLinkPath: string }[] | undefined;
}): OutcomeCard[] {
  const { owner, view, stale, offers, requests, approvals } = input;
  if (
    !view ||
    stale ||
    view.audience !== "owner" ||
    view.profile.kingdomId !== owner ||
    !view.consequences ||
    view.consequences.asOfGameTimeMs !== view.asOfGameTimeMs
  )
    return [];
  const data = view.consequences,
    cards: OutcomeCard[] = [];
  const add = (
    kind: OutcomeKind,
    key: string,
    text: string,
    recordId: string,
    href = source(`world/kingdoms/${encodeURIComponent(owner)}`),
  ) => cards.push({ kind, key, text, recordId, href });
  for (const b of data.builds)
    if (b.id && b.state === "completed" && b.settledGameTimeMs !== null)
      add(
        "build",
        `build:${b.id}`,
        `${b.building} ${b.targetLevel} completed at game time ${b.settledGameTimeMs}.`,
        b.id,
      );
  for (const c of data.contacts)
    if (c.kingdomId && marked(c.acceptedGameTimeMs))
      add(
        "contact",
        `contact:${c.kingdomId}:${c.acceptedGameTimeMs}`,
        `Contact with @${c.handle} accepted at game time ${c.acceptedGameTimeMs}.`,
        c.kingdomId,
      );
  const signature = (id: string, version: number, signedBy: string[]) => {
    if (!id || !Number.isInteger(version) || version < 1) return;
    for (const signer of new Set(signedBy))
      if (signer)
        add(
          "signature",
          `signature:${id}:${version}:${signer}`,
          `Supply offer version ${version}: recorded signature by ${signer === owner ? "your kingdom" : "the counterparty"}. A signature does not prove delivery.`,
          id,
          source("game/social"),
        );
  };
  for (const c of data.supplyContracts) {
    if (!c.id) continue;
    if (c.offerId) signature(c.offerId, c.offerVersion, c.signedBy);
    const actual = c.deliveries.filter(
      (d) => d.installments > 0 && marked(d.deliveredMarked) && BigInt(d.deliveredMarked) > 0n,
    );
    if (actual.length)
      add(
        "delivery",
        `delivery:${c.id}`,
        `Recorded positive delivery with @${c.counterparty.handle}: ${actual
          .map(
            (d) =>
              `${d.direction} ${wholeUnitText(d.deliveredMarked)} whole ${d.resource} (${d.deliveredMarked} marked); overflow ${d.overflowMarked} marked; ${d.failedInstallments} failed installments`,
          )
          .join("; ")}. These are retained cumulative amounts; overflow is not credited to the recipient.`,
        c.id,
      );
    if (c.status === "defaulted")
      add(
        "default",
        `default:${c.id}`,
        `Supply contract with @${c.counterparty.handle}: ${c.status}. Recorded consequence: ${c.closeReason ?? "reason unavailable; inspect the contract"}. Future deliveries are not promised.`,
        c.id,
      );
  }
  for (const o of offers ?? []) signature(o.id, o.version, o.signedBy);
  for (const t of view.threats) {
    const raid = view.raids.find((r) => r.raidId === t.id && ["declared", "locked"].includes(r.status));
    if (t.kind === "raid" && t.id)
      add(
        "raid",
        `raid:${t.id}:${raid?.status ?? "pending"}`,
        `Incoming raid ${raid?.status ?? "pending; phase unavailable"}. ${remainingGameTime(t.dueGameTimeMs, view)}. Resolution is not yet recorded.`,
        t.id,
      );
  }
  const a = approvals?.find((a) => a.status === "pending" && a.approvalId),
    r = requests?.[0];
  const b = view.builders.find((b) => b.instructionId && ["active", "waiting"].includes(b.state ?? ""));
  if (a)
    add(
      "waiting",
      `waiting:approval:${a.approvalId}`,
      "Waiting for your exact human approval. Your agent cannot decide this for you; inspect the request and deadline.",
      a.approvalId,
      a.deepLinkPath,
    );
  else if (r)
    add(
      "waiting",
      `waiting:request:${r.id}`,
      `Contact with @${r.handle} remains pending. ${r.direction === "incoming" ? "You are the recipient who must decide." : "The recipient human must decide."} Response time unknown. Recorded deadline: ${r.expiresGameTimeMs} game ms; acceptance or expiry is not inferred.`,
      r.id,
      source("game/social"),
    );
  else if (b?.instructionId)
    add(
      "waiting",
      `waiting:build:${b.instructionId}`,
      `${b.kind ?? "Build"} remains ${b.state}. ${b.dueGameTimeMs === null ? "Waiting for prerequisites and a builder; timing unknown." : remainingGameTime(b.dueGameTimeMs, view)} Completion is not inferred.`,
      b.instructionId,
    );
  return [...new Map(cards.map((c) => [c.key, c])).values()];
}
export function OutcomeCards({
  owner,
  view,
  stale,
  offers,
  requests,
  approvals,
  audio,
  onNotice,
}: {
  onNotice?: (text: string) => void;
  owner: string;
  view?: OutcomeOwner | undefined;
  stale: boolean;
  offers?: OutcomeOffer[] | undefined;
  requests?: OutcomeRequest[] | undefined;
  approvals?: { approvalId: string; status: string; deepLinkPath: string }[] | undefined;
  audio?: ExperienceAudio | null | undefined;
}) {
  const cards = useMemo(
    () => outcomeCards({ owner, view, stale, offers, requests, approvals }),
    [owner, view, stale, offers, requests, approvals],
  );
  const memories = useRef<{ owner: string; records: MilestoneMemory; offers: MilestoneMemory } | null>(null);
  const quietResume = useRef(false);
  const [freshKeys, setFreshKeys] = useState<string[]>([]);
  useEffect(() => {
    if (!memories.current || memories.current.owner !== owner)
      memories.current = {
        owner,
        records: new MilestoneMemory(owner, localStorage),
        offers: new MilestoneMemory(owner, localStorage),
      };
    if (
      stale ||
      !view?.consequences ||
      view.profile.kingdomId !== owner ||
      view.audience !== "owner" ||
      view.consequences.asOfGameTimeMs !== view.asOfGameTimeMs
    ) {
      quietResume.current = true;
      setFreshKeys([]);
      return;
    }
    const records = cards.filter(
      (c) =>
        c.kind !== "signature" ||
        view.consequences?.supplyContracts.some((contract) => contract.offerId === c.recordId),
    );
    const signatures = cards.filter((c) => c.kind === "signature");
    const fresh = memories.current.records.observe(records, quietResume.current);
    if (offers !== undefined) fresh.push(...memories.current.offers.observe(signatures, quietResume.current));
    quietResume.current = false;
    const keys = [...new Set(fresh.filter((c) => c.kind !== "waiting").map((c) => c.key))];
    setFreshKeys(keys);
    const latest = cards.find((c) => keys.includes(c.key));
    if (latest) onNotice?.(latest.text);
    for (const c of cards) if (keys.includes(c.key) && outcomeCue[c.kind]) audio?.cue(c.key, outcomeCue[c.kind] ?? "");
  }, [owner, view, stale, offers, cards, audio, onNotice]);
  const rank: Record<OutcomeKind, number> = {
    raid: 0,
    default: 1,
    waiting: 2,
    build: 3,
    contact: 4,
    delivery: 5,
    signature: 6,
  };
  const visible = [...cards].sort((a, b) => rank[a.kind] - rank[b.kind]).slice(0, 8);
  return (
    <section className="outcome-cards" aria-label="Recorded game moments">
      <h2>Recorded game moments</h2>
      {!view?.consequences ||
      stale ||
      view.profile.kingdomId !== owner ||
      view.audience !== "owner" ||
      view.consequences.asOfGameTimeMs !== view.asOfGameTimeMs ? (
        <p>
          Current outcome records unavailable or stale. Refresh before drawing a conclusion. No success is inferred.
        </p>
      ) : !cards.length ? (
        <p>No retained milestone or current wait to show yet. You can leave and return later.</p>
      ) : null}
      {visible.map((c) => {
        const template = copy.templates[c.kind];
        return (
          <article
            key={c.key}
            data-outcome={c.kind}
            className={`game-card ${freshKeys.includes(c.key) && ["build", "contact", "delivery"].includes(c.kind) ? `experience-reveal ${c.kind}` : ""}`}
          >
            <h3>
              <img src={`${pactBaseUrl()}experience/icons/${c.kind}.svg`} width="32" height="32" alt="" />{" "}
              {template.title}
            </h3>
            <p data-outcome-fact>{c.text}</p>
            <a href={c.href}>Inspect source record</a> <code>{c.recordId}</code>
            <div data-flavour>
              <img
                loading="lazy"
                src={`${pactBaseUrl()}experience/characters/${character[c.kind]}.png`}
                width="64"
                height="72"
                alt="Cosmetic court character"
              />
              <p>{template.flavour}</p>
            </div>
          </article>
        );
      })}
      {cards.length > visible.length && (
        <p>
          Showing {visible.length} of {cards.length} retained moments.{" "}
          <a href={source(`world/kingdoms/${encodeURIComponent(owner)}`)}>Read the full bounded source projection</a>.
        </p>
      )}
    </section>
  );
}
