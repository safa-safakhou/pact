import { pactBaseUrl } from "./client-location.js";
import type { DevelopmentChoice } from "./development-choices.js";
import { remainingGameTime } from "./game-time.js";
export type Stage = {
  freeBuilders?: number;
  founded?: boolean | undefined;
  stale?: boolean | undefined;
  approvalsAvailable?: boolean | undefined;
  socialAvailable?: boolean | undefined;
  farmComplete: boolean;
  farmPending: boolean;
  contacts: number;
  pendingRequests: number;
  pendingOffers: number;
  contracts: number;
  ambition?: string | undefined;
  asOfGameTimeMs?: number | undefined;
  worldStatus?: string | undefined;
  approvals?: { status: string; deepLinkPath: string }[] | undefined;
  failure?: { code: string; commandId?: string } | undefined;
  requests?: { id: string; direction: string; handle: string; expiresGameTimeMs: string }[] | undefined;
  contactOutcome?: { id: string; status: string; handle: string } | undefined;
  build?: { kind: string; instructionId: string; state: string; dueGameTimeMs: number | null } | undefined;
  choices?: DevelopmentChoice[] | undefined;
  ownerSource?: string | undefined;
};
export function nextDecision(stage: Stage): {
  kind: string;
  text: string;
  area: "Kingdom" | "People" | "Chronicle" | "Envoy";
  href?: string;
} {
  if (stage.founded === false)
    return { kind: "unfounded", text: "Finish human setup and found your kingdom before gameplay.", area: "Kingdom" };
  if (stage.stale || stage.approvalsAvailable === false)
    return {
      kind: "unknown",
      text: "Current decision facts are stale or unavailable. Refresh before acting; no success or absence is assumed.",
      area: "Kingdom",
    };
  const approval = stage.approvals?.find((a) => a.status === "pending");
  if (approval)
    return {
      kind: "approval",
      text: "Human: review this exact pending approval. No command completion is assumed.",
      area: "Envoy",
      href: approval.deepLinkPath,
    };
  if (stage.failure)
    return {
      kind: "failure",
      text: `The last action needs attention: ${stage.failure.code}. Inspect its receipt and current permissions before trying again.`,
      area: "Envoy",
      ...(stage.failure.commandId ? { href: `${pactBaseUrl()}v1/receipts/${stage.failure.commandId}` } : {}),
    };
  if (stage.socialAvailable === false)
    return {
      kind: "unknown",
      text: "Social records are temporarily unavailable. Refresh before judging contacts, offers or agreements.",
      area: "People",
    };
  const requests = stage.requests?.filter(
    (r) => stage.asOfGameTimeMs === undefined || Number(r.expiresGameTimeMs) > stage.asOfGameTimeMs,
  );
  const incoming = requests?.find((r) => r.direction === "incoming"),
    outgoing = requests?.find((r) => r.direction === "outgoing");
  if (incoming)
    return {
      kind: "recipient",
      text: `Human: review the incoming contact request from @${incoming.handle} in People.`,
      area: "People",
      href: `${pactBaseUrl()}v1/game/social`,
    };
  if (outgoing || (stage.pendingRequests > 0 && stage.requests === undefined))
    return {
      kind: "recipient",
      text: `Waiting for ${outgoing ? `@${outgoing.handle}` : "the recipient human"} to answer your contact request. No reply or agreement is assumed.`,
      area: "People",
      href: `${pactBaseUrl()}v1/game/social`,
    };
  if (stage.pendingOffers)
    return {
      kind: "recipient",
      text: "An offer is pending. Both parties must sign the same version before a contract starts. An agent may sign within current authority; contact acceptance remains human-only.",
      area: "People",
      href: `${pactBaseUrl()}v1/game/social`,
    };
  if (
    stage.requests?.some(
      (r) => stage.asOfGameTimeMs !== undefined && Number(r.expiresGameTimeMs) <= stage.asOfGameTimeMs,
    )
  )
    return {
      kind: "unknown",
      text: "A contact deadline has passed; refresh its actual status. No reply or acceptance is inferred.",
      area: "People",
    };
  if (stage.build || (stage.farmPending && !stage.farmComplete)) {
    const clock =
      stage.asOfGameTimeMs === undefined
        ? null
        : { asOfGameTimeMs: stage.asOfGameTimeMs, worldStatus: stage.worldStatus ?? "paused" };
    const timing =
      stage.build?.dueGameTimeMs != null
        ? remainingGameTime(stage.build.dueGameTimeMs, clock)
        : "No game deadline assigned yet; inspect the builder queue.";
    return {
      kind: "build",
      text: `Your build is pending. ${timing} ${stage.freeBuilders ? "Your other builder is free: choose another upgrade below, or meet friends in People." : "Meet friends in People while the builders work."} Completion appears after the world updates.`,
      area: "Kingdom",
      ...(stage.ownerSource ? { href: stage.ownerSource } : {}),
    };
  }
  if (!stage.farmComplete) {
    const farm = stage.choices?.find((c) => c.building === "farm");
    return {
      kind: "choice",
      text:
        farm && !farm.affordable
          ? "Farm II needs more construction stock. Founding allowance and ordinary stock are separate; inspect the exact cost below."
          : "Start your first Farm II upgrade in Kingdom.",
      area: "Kingdom",
    };
  }
  if (stage.contactOutcome?.status === "declined" || stage.contactOutcome?.status === "expired")
    return {
      kind: "contact-outcome",
      text: `Contact with @${stage.contactOutcome.handle} ${stage.contactOutcome.status}. Respect the decision; choose another goal or real player.`,
      area: "People",
    };
  if (!stage.contacts)
    return {
      kind: "choice",
      text: "Meet the other kingdoms in People. Say hello or discuss your first trade.",
      area: "People",
    };

  if (stage.contracts)
    return {
      kind: "choice",
      text: "An agreement is recorded. Inspect its actual status, exact terms and recorded installments in People/Chronicle.",
      area: "People",
    };
  return {
    kind: "choice",
    text: "Your contact is accepted. Send a message or draft a modest offer to a real contact; a reply is their choice.",
    area: "People",
  };
}
export function FirstSession({
  stage,
  onArea,
  compact = false,
}: {
  compact?: boolean;
  stage: Stage;
  onArea: (area: "Kingdom" | "People" | "Chronicle" | "Envoy") => void;
}) {
  const decision = nextDecision(stage);
  return (
    <section className="game-card" aria-label="First-session progress">
      <h2>Your next move</h2>
      <p role="status">{decision.text}</p>
      <button type="button" onClick={() => onArea(decision.area)}>
        Inspect {decision.area}
      </button>
      {decision.href && (
        <p>
          <a href={decision.href}>Read the current source record</a>
        </p>
      )}
      <details open={!compact}>
        <summary>Progress and game areas</summary>
        <ol>
          <li>
            {stage.founded === false
              ? "Kingdom not founded; finish human setup."
              : "Kingdom founded - real resources and rules are active."}
          </li>
          <li>
            {stage.farmComplete
              ? "Farm II or later exists."
              : stage.farmPending
                ? "Your build is pending; first build queued/working, not completed yet."
                : "First build not started."}
          </li>
          <li>
            {stage.socialAvailable === false
              ? "Contacts and pending requests unavailable; refresh to inspect."
              : stage.contacts
                ? `${stage.contacts} accepted real contacts.`
                : `No accepted contacts. ${stage.pendingRequests} requests still pending; no reply is assumed.`}
          </li>
          <li>
            {stage.socialAvailable === false
              ? "Contract status unavailable; no success is assumed."
              : stage.contracts
                ? `${stage.contracts} recorded contracts; inspect actual status and consequences.`
                : "No contract has been accepted yet."}
          </li>
        </ol>
        {stage.choices?.length ? (
          <>
            <h3>Construction choices</h3>
            <p>
              Construction uses Iron/Silver founding allowance before ordinary stock. Ordinary Silver for contacts or
              trade stays separate. Stock affordability below is advisory; the server also checks prerequisites and
              authority.
            </p>
            <ul>
              {stage.choices.map((c) => (
                <li key={c.building}>
                  {c.building} {c.from} to {c.to}: {c.before} to {c.after} {c.benefit}; {c.iron} Iron + {c.silver}{" "}
                  Silver; {c.minutes} game minutes;{" "}
                  {c.affordable ? "construction stock available" : "construction stock short"}.
                </li>
              ))}
            </ul>
            <p>
              Farm supports food; Mine supplies Iron; Market grows ordinary Silver; Wall improves defense without
              producing resources. Current harvest modifies Grain output.
            </p>
          </>
        ) : null}
        <button type="button" onClick={() => onArea("Chronicle")}>
          Read real consequences
        </button>
        <button type="button" onClick={() => onArea("Envoy")}>
          Set an agent objective
        </button>
        <p>Read sources, not just claims. A message is not a contract and connection is not continuous thinking.</p>
      </details>
    </section>
  );
}
