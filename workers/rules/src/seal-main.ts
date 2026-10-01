import { createPool } from "@pact/db";
import { SealSigner } from "./seal-signer.js";

const encoded = process.env.SEAL_ENCRYPTION_KEY_BASE64,
  key = encoded ? Buffer.from(encoded, "base64") : null;
if (!process.env.DATABASE_URL || !key || key.length !== 32 || key.toString("base64") !== encoded) {
  console.error("DATABASE_URL and a 32-byte SEAL_ENCRYPTION_KEY_BASE64 are required by the signing worker");
  process.exitCode = 1;
} else {
  const pool = createPool(process.env.DATABASE_URL),
    signer = new SealSigner(pool, "pact", key, { now: () => new Date() });
  let busy = false,
    stopped = false;
  const poll = async () => {
    if (busy || stopped) return;
    busy = true;
    try {
      for (let n = 0; n < 20; n++) if (!(await signer.signNext())) break;
    } catch {
      console.error("Seal signing failed; publication remains pending. Check worker key/configuration.");
    } finally {
      busy = false;
    }
  };
  await signer.initialize();
  const timer = setInterval(() => void poll(), 1000);
  void poll();
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(signal, () => {
      stopped = true;
      clearInterval(timer);
      void pool.end().then(() => {
        key.fill(0);
        process.exitCode = 0;
      });
    });
}
