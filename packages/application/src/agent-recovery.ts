/** Recovery is advice, never a grant or a claim that a game effect succeeded. */
export function agentRecovery(code: string): string {
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
