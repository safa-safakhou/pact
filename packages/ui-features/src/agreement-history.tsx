export interface AgreementVersion {
  version: number;
  terms: Record<string, unknown>;
  gameTimeMs: string;
  proposedBy: string | null;
  historicalBaseline: boolean;
}
export interface AgreementHistoryItem {
  id: string;
  kind: string;
  version: number;
  status: string;
  terms: Record<string, unknown>;
  gameTimeMs: string;
  expiresGameTimeMs: string;
  versions: AgreementVersion[];
  versionsNextBefore: number | null;
  signatures: { version: number; kingdomId: string; actorKind: string; gameTimeMs: string }[];
  contract: {
    id: string;
    status: string;
    startGameTimeMs: string;
    endGameTimeMs: string;
    closeReason?: string | null;
    closedGameTimeMs?: string | null;
    noticeEndGameTimeMs?: string | null;
    exitRequestedGameTimeMs?: string | null;
    lenderDefault?: boolean;
    hostDefault?: boolean;
  } | null;
  deliveries: {
    payerKingdomId: string;
    resource: string;
    dueMarkedUnits: string;
    deliveredMarkedUnits: string;
    overflowMarkedUnits: string;
    installments: number;
    failedInstallments: number;
  }[];
}
function flatten(value: Record<string, unknown>, prefix = ""): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) =>
      item && typeof item === "object" && !Array.isArray(item)
        ? Object.entries(flatten(item as Record<string, unknown>, `${prefix}${key}.`))
        : [[`${prefix}${key}`, JSON.stringify(item)]],
    ),
  );
}
export function changedAgreementTerms(older: Record<string, unknown>, newer: Record<string, unknown>) {
  const a = flatten(older),
    b = flatten(newer);
  return [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .sort()
    .filter((k) => a[k] !== b[k])
    .map((k) => ({ field: k, before: a[k] ?? "absent", after: b[k] ?? "absent" }));
}
const time = (ms: string) => new Date(Number(ms)).toLocaleString();
export function EngineAgreementHistory({
  items,
  ownerId,
  onMoreVersions,
}: {
  items: AgreementHistoryItem[];
  ownerId: string;
  onMoreVersions: (item: AgreementHistoryItem) => void;
}) {
  return (
    <section aria-label="Retained agreement history">
      <h3>History and consequences</h3>
      <p>
        Only engine records below establish signatures and delivery. Older overwritten terms cannot be reconstructed.
      </p>
      {items.map((o) => {
        const versions = [...o.versions].sort((a, b) => b.version - a.version),
          earliest = versions.at(-1),
          end = o.contract?.startGameTimeMs ?? o.gameTimeMs;
        return (
          <article className="cw-agreement" key={o.id}>
            <span className="cw-tag">
              {o.kind} · {o.status} · current v{o.version}
            </span>
            <p>
              {earliest
                ? `${earliest.historicalBaseline ? "Observed portion of negotiation" : "Recorded negotiation"}: ${Math.max(0, Math.floor((Number(end) - Number(earliest.gameTimeMs)) / 60000))} game minutes`
                : "Negotiation origin unavailable"}
            </p>
            {o.contract && (
              <div>
                <strong>Engine activation · {o.contract.status}</strong>
                <p>
                  Activated {time(o.contract.startGameTimeMs)} · ends {time(o.contract.endGameTimeMs)}
                </p>
                {o.contract.noticeEndGameTimeMs && <p>Notice ends {time(o.contract.noticeEndGameTimeMs)}</p>}
                {o.contract.exitRequestedGameTimeMs && <p>Exit requested {time(o.contract.exitRequestedGameTimeMs)}</p>}
                {o.contract.closeReason && (
                  <p>
                    Closure: {o.contract.closeReason}
                    {o.contract.closedGameTimeMs ? ` · ${time(o.contract.closedGameTimeMs)}` : ""}
                  </p>
                )}
                {(o.contract.lenderDefault || o.contract.hostDefault) && (
                  <p>
                    Recorded default: {o.contract.lenderDefault ? "lender " : ""}
                    {o.contract.hostDefault ? "host" : ""}
                  </p>
                )}
              </div>
            )}
            {o.deliveries.map((d) => (
              <p key={`${d.payerKingdomId}:${d.resource}`}>
                {d.payerKingdomId === ownerId ? "You" : "Peer"} sent {d.deliveredMarkedUnits} / {d.dueMarkedUnits}{" "}
                marked {d.resource} units · {d.installments} installments · {d.failedInstallments} failed ·{" "}
                {d.overflowMarkedUnits} overflow. 600 marked units = 1 whole resource.
              </p>
            ))}
            {versions.map((v, i) => {
              const old = versions[i + 1],
                diff = old ? changedAgreementTerms(old.terms, v.terms) : [];
              const signatures = o.signatures.filter((s) => s.version === v.version);
              return (
                <details key={v.version}>
                  <summary>
                    v{v.version} ·{" "}
                    {v.historicalBaseline
                      ? "retained baseline"
                      : v.proposedBy === null
                        ? "actor unavailable"
                        : v.proposedBy === ownerId
                          ? "your proposal"
                          : "peer proposal"}{" "}
                    · {time(v.gameTimeMs)}
                  </summary>
                  {v.historicalBaseline && <p>The original actor and earlier overwritten terms are unavailable.</p>}
                  {v.version < o.version && <p>Superseded: these signatures do not sign current terms.</p>}
                  <p>
                    {signatures.length
                      ? signatures
                          .map(
                            (s) =>
                              `${s.kingdomId === ownerId ? "You" : "Peer"} · ${s.actorKind} · ${time(s.gameTimeMs)}`,
                          )
                          .join("; ")
                      : "No recorded signatures on this version."}
                  </p>
                  {old && (
                    <ul>
                      {diff.length ? (
                        diff.map((d) => (
                          <li key={d.field}>
                            {d.field}: {d.before} → {d.after}
                          </li>
                        ))
                      ) : (
                        <li>No term change recorded.</li>
                      )}
                    </ul>
                  )}
                  <pre>{JSON.stringify(v.terms, null, 2)}</pre>
                </details>
              );
            })}
            {o.versionsNextBefore !== null && (
              <button type="button" onClick={() => onMoreVersions(o)}>
                Earlier versions
              </button>
            )}
          </article>
        );
      })}
      {!items.length && <p>No retained structured negotiations for this pair.</p>}
    </section>
  );
}
