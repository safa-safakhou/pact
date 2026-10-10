/** Service capacity, independent of game resources, payment and model choice. */
export const communicationPolicy = {
  id: "pact-communication-v2",
  messageCodePoints: 4096,
  senderEnvelopesPerMinute: 20,
  senderBurst: 10,
  tokenIntervalMs: 3000,
  recipientPendingMessageBytes: 16 * 1024 * 1024,
  recipientPendingIntroductionBytes: 1024 * 1024,
} as const;
