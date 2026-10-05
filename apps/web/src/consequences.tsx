import { remainingGameTime } from "./game-time.js";
import { wholeResourceAmount } from "./resource-units.js";

export interface ConsequenceView {
  firstRetained?: Record<
    "build" | "contact" | "delivery",
    { recordId: string; occurredGameTimeMs: number; summary: string } | null
  >;
  asOfGameTimeMs: number;
  builds: {
    id: string;
    building: string;
    targetLevel: number;
    state: string;
    dueGameTimeMs: number | null;
    settledGameTimeMs: number | null;
  }[];
  contacts: { kingdomId: string; handle: string; displayName: string; acceptedGameTimeMs: string }[];
  supplyContracts: {
    id: string;
    offerId?: string;
    offerVersion: number;
    status: string;
    signedBy: string[];
    counterparty: { handle: string; displayName: string };
    endGameTimeMs: number;
    noticeEndGameTimeMs: number | null;
    closeReason: string | null;
    deliveries: {
      resource: string;
      direction: string;
      installments: number;
      dueMarked: string;
      deliveredMarked: string;
      overflowMarked: string;
      failedInstallments: number;
      lastGameTimeMs: number;
    }[];
  }[];
}
const amount = (marked: string) =>
  `${wholeResourceAmount(marked).toLocaleString(undefined, { maximumFractionDigits: 6 })} whole (${marked} marked)`;
export function Consequences({ data, worldStatus }: { data?: ConsequenceView | undefined; worldStatus: string }) {
  if (!data)
    return (
      <article className="game-card">
        <h3>Your game consequences</h3>
        <p>Current consequences unavailable; refresh. No success or empty history is inferred.</p>
      </article>
    );
  return (
    <article className="game-card" aria-label="Your game consequences">
      <h3>Your game consequences</h3>
      <p>
        Actual committed state as of game time {new Date(data.asOfGameTimeMs).toLocaleString()}. Latest 20 records per
        kind; receipts describe the original command.
      </p>
      {!data.builds.length && !data.contacts.length && !data.supplyContracts.length && (
        <p>No build, accepted contact or signed supply contract yet.</p>
      )}
      {data.builds.map((build) => (
        <div id={`build-${build.id}`} className="game-list-item" key={build.id}>
          <strong>
            {build.building} {build.targetLevel} · {build.state}
          </strong>
          <p>
            {build.state === "completed"
              ? `Finished at ${new Date(build.settledGameTimeMs ?? 0).toLocaleString()} game time.`
              : build.state === "canceled"
                ? "Canceled; no future completion is expected."
                : build.dueGameTimeMs !== null
                  ? remainingGameTime(build.dueGameTimeMs, { asOfGameTimeMs: data.asOfGameTimeMs, worldStatus })
                  : "Waiting for prerequisites and an available builder; no completion assumed."}
          </p>
          <details>
            <summary>Build record</summary>
            <code>{build.id}</code>
          </details>
        </div>
      ))}
      {data.contacts.map((contact) => (
        <p key={contact.kingdomId}>
          Contact accepted: {contact.displayName} (@{contact.handle}) · game time{" "}
          {new Date(Number(contact.acceptedGameTimeMs)).toLocaleString()}
        </p>
      ))}
      {data.supplyContracts.map((contract) => (
        <div id={`contract-${contract.id}`} className="game-list-item" key={contract.id}>
          <strong>
            Supply with {contract.counterparty.displayName} (@{contract.counterparty.handle}) · {contract.status}
          </strong>
          <p>
            Offer version {contract.offerVersion} · {contract.signedBy.length} recorded signatures.{" "}
            {contract.closeReason ?? ""}
          </p>
          {contract.status === "active" && (
            <p>
              {remainingGameTime(contract.noticeEndGameTimeMs ?? contract.endGameTimeMs, {
                asOfGameTimeMs: data.asOfGameTimeMs,
                worldStatus,
              })}
              . Future installments remain pending, not guaranteed.
            </p>
          )}
          {!contract.deliveries.length && (
            <p>No settled delivery yet. A signature or message is not a delivered resource.</p>
          )}
          {contract.deliveries.map((delivery) => (
            <p key={`${delivery.direction}-${delivery.resource}`}>
              {delivery.direction} {delivery.resource}: delivered {amount(delivery.deliveredMarked)} / due{" "}
              {amount(delivery.dueMarked)} across {delivery.installments} settled minutes · overflow{" "}
              {amount(delivery.overflowMarked)} · {delivery.failedInstallments} failed installments. Last settlement:{" "}
              {new Date(delivery.lastGameTimeMs).toLocaleString()} game time. Overflow is not credited to the recipient.
            </p>
          ))}
          <details>
            <summary>Contract record</summary>
            <code>{contract.id}</code>
          </details>
        </div>
      ))}
    </article>
  );
}
