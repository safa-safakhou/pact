type Stage = {
  socialAvailable?: boolean;
  farmComplete: boolean;
  farmPending: boolean;
  contacts: number;
  pendingRequests: number;
  pendingOffers: number;
  contracts: number;
};
export function FirstSession({
  stage,
  onArea,
}: {
  stage: Stage;
  onArea: (area: "Kingdom" | "People" | "Chronicle" | "Envoy") => void;
}) {
  const next =
    !stage.farmComplete && !stage.farmPending
      ? "Start your first Farm II upgrade in Kingdom."
      : stage.farmPending && !stage.farmComplete
        ? "Your build is pending. It completes on the game clock; inspect the builder deadline."
        : stage.socialAvailable === false
          ? "Social records are temporarily unavailable. Refresh before judging contacts, offers or agreements."
          : !stage.contacts
            ? "Meet a real player in People. Read actual notices or find an exact handle; no test opponent is invented."
            : stage.pendingOffers
              ? "An offer is pending. Both parties must sign the same version before a contract starts."
              : stage.contracts
                ? "An agreement is recorded. Inspect its actual status, exact terms and recorded installments in People/Chronicle."
                : "Send a message or draft a modest offer to a real contact; a reply is their choice.";
  return (
    <section className="game-card" aria-label="First-session progress">
      <h2>Your next decision</h2>
      <p>{next}</p>
      <ol>
        <li>Kingdom founded — real resources and rules are active.</li>
        <li>
          {stage.farmComplete
            ? "Farm II or later exists."
            : stage.farmPending
              ? "First build queued/working; not completed yet."
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
      <button type="button" onClick={() => onArea("Kingdom")}>
        Inspect builders
      </button>
      <button type="button" onClick={() => onArea("People")}>
        Meet and negotiate
      </button>
      <button type="button" onClick={() => onArea("Chronicle")}>
        Read real consequences
      </button>
      <button type="button" onClick={() => onArea("Envoy")}>
        Set an agent objective
      </button>
      <p>Read sources, not just claims. A message is not a contract and connection is not continuous thinking.</p>
    </section>
  );
}
