/** Security delivery must remain available when optional game projection/delivery fails. */
export async function independentNotificationBatch(
  security: () => Promise<number>,
  game: () => Promise<number>,
  failed: (phase: "security" | "game", error: unknown) => void,
): Promise<number> {
  let delivered = 0;
  for (const [phase, operation] of [
    ["security", security],
    ["game", game],
  ] as const) {
    try {
      delivered += await operation();
    } catch (error) {
      failed(phase, error);
    }
  }
  return delivered;
}
