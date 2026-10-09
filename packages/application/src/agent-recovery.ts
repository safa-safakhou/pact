/** Recovery is advice, never a grant or a claim that a game effect succeeded. */
export function agentRecovery(code: string, detail?: string): string {
  if (detail === "CONTRACT_CAPACITY")
    return "The contract was not activated: one party has reached the normal incoming/outgoing contract limit. Wait for a contract to end, then re-read the still-open offer and exact version. Approval cannot increase capacity.";
  if (detail === "OFFER_CLOSED" || code === "EXPIRED")
    return "This offer cannot be signed now. Re-read open offers and their exact versions; an expired or closed offer is not an active agreement. Create new terms only if still wanted and available.";
  if (code === "RATE_LIMITED")
    return "This action was not committed because its normal game quota is exhausted. Wait for the game-time rolling window to free allowance. Rewriting terms, approval or faster inference cannot bypass the limit.";
  if (code === "TICK_PENDING")
    return "The next world tick is due; this command was not committed. This is a temporary admission wait, not a paused world. Wait briefly, re-read current state, and retry the same command ID and exact action if it is still intended.";
  if (code === "MESSAGE_QUEUE_FULL")
    return "This message was not sent. The recipient has unread messages at the per-thread or total queue limit. Wait for the recipient to read them; repeating or rewriting the message cannot bypass the limit.";
  if (code === "CONTACT_QUEUE_FULL")
    return "The recipient already has eight pending contact requests. This request was not sent or charged. Wait for their owner to answer requests, or approach a different known player; changing the note or requesting approval cannot bypass the inbox limit.";
  if (code === "REQUEST_EXISTS")
    return "A contact request between these players is already pending. Read current incoming and outgoing requests. The recipient human must accept the existing request; do not send another or treat it as accepted.";
  if (code === "ALREADY_CONTACT")
    return "These players are already contacts. Read the current contact list and message the existing contact instead of requesting contact again.";
  if (code === "INSUFFICIENT_STOCK")
    return "No successful move is established. Read current stock and development costs: founding allowances only cover their eligible uses; cold contacts and trade need ordinary stock. Wait for game production or choose an affordable move. Approval cannot create resources.";
  if (["INVALID_REQUEST", "INVALID_INPUT", "INVALID_COMMAND", "MALFORMED_TOOL_CALL"].includes(code))
    return "Read this tool's input schema and the relevant pact_agent_guide_v1 lesson. Correct the arguments; no successful move is established by this denial.";
  if (["RUN_ALREADY_ACTIVE", "LEASE_HELD", "IN_FLIGHT"].includes(code))
    return "Another bounded write holder is active. Read current state; wait for that holder to stop or expire. Do not open competing sessions to bypass the lease.";
  if (code === "APPROVAL_REQUIRED")
    return "Show the exact returned human approval link. The agent cannot approve it. Re-read approval status after explicit human action.";
  if (code === "IDEMPOTENCY_CONFLICT")
    return "Read the original command receipt before doing anything else. This ID already belongs to different terms; do not claim the new terms committed.";
  if (code === "FORBIDDEN")
    return "Read authority and the exact humanDecision/approval handoff. A read grant is not permission to act; an agent cannot expand authority or impersonate the human.";
  return "Read current authorized state and the exact record version before replanning. For an uncertain response, reconcile the original commandId with pact_receipt_read_v1; never blindly retry with a fresh ID. A committed instruction may still be pending.";
}
