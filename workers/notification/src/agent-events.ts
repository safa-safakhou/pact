/** Projection is independent of SMTP/push and never dispatches inference. */
export async function agentEventBatch(
  enabled: boolean,
  project: () => Promise<{ delivered: number }>,
  failed: (error: unknown) => void,
): Promise<number> {
  if (!enabled) return 0;
  try {
    return (await project()).delivered;
  } catch (error) {
    failed(error);
    return 0;
  }
}
