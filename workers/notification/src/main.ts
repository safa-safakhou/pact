import { randomUUID } from "node:crypto";
import { claimOutboxDelivery, createPool, markOutboxDelivered } from "@pact/db";
import { AesGcmSecretBox } from "@pact/identity";
import nodemailer from "nodemailer";
import type { PoolClient } from "pg";
import { parseSecurityEmailPayload, renderSecurityEmail } from "./email.js";

const smtpUrl = process.env.SMTP_URL;
const encryptionKey = process.env.IDENTITY_ENCRYPTION_KEY;
const databaseUrl = process.env.DATABASE_URL;
const publicBaseUrl = (process.env.PACT_PUBLIC_BASE_URL ?? process.env.PACT_ORIGIN ?? "").replace(/\/$/, "");
const from = process.env.SMTP_FROM ?? "PACT MVP <noreply@safa.dedyn.io>";

if (!smtpUrl || !encryptionKey || !databaseUrl || !publicBaseUrl) {
  throw new Error("Notification worker requires SMTP_URL, identity encryption, database, and public URL configuration");
}

const pool = createPool(databaseUrl);
const transport = nodemailer.createTransport(smtpUrl);
const secretBox = new AesGcmSecretBox(Buffer.from(encryptionKey, "base64url"));
const workerId = `notification-${randomUUID()}`;
const consumer = "security-email-v1";
let stopping = false;

interface CandidateRow {
  readonly event_id: string;
  readonly payload: unknown;
  readonly account_email: string;
}

async function claim(client: PoolClient, eventId: string): Promise<boolean> {
  await client.query("BEGIN");
  try {
    const claimed = await claimOutboxDelivery(client, {
      consumer,
      eventId,
      workerId,
      leaseMilliseconds: 60_000,
    });
    await client.query("COMMIT");
    return claimed;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function deliverBatch(): Promise<number> {
  const candidates = await pool.query<CandidateRow>(
    `SELECT e.event_id, e.payload, a.email AS account_email
       FROM outbox_events e
       JOIN accounts a ON a.id = (e.payload->>'accountId')::uuid
       LEFT JOIN outbox_deliveries d ON d.outbox_event_id = e.id AND d.consumer = $1
      WHERE e.type = 'security.email.requested.v1'
        AND (d.outbox_event_id IS NULL OR (d.status <> 'delivered' AND d.lease_expires_at <= now()))
      ORDER BY e.id
      LIMIT 20`,
    [consumer],
  );
  let delivered = 0;
  for (const event of candidates.rows) {
    const client = await pool.connect();
    try {
      if (!(await claim(client, event.event_id))) continue;
      const payload = parseSecurityEmailPayload(event.payload);
      const token = payload.sealedToken ? Buffer.from(secretBox.open(payload.sealedToken)).toString("utf8") : undefined;
      await transport.sendMail(
        renderSecurityEmail({
          payload,
          recipient: payload.recipientEmail ?? event.account_email,
          ...(token ? { token } : {}),
          publicBaseUrl,
          from,
        }),
      );
      await client.query("BEGIN");
      const marked = await markOutboxDelivered(client, consumer, event.event_id, workerId);
      await client.query("COMMIT");
      if (!marked) throw new Error("OUTBOX_DELIVERY_LEASE_LOST");
      delivered += 1;
      console.log(JSON.stringify({ event: "security_email.delivered", eventId: event.event_id }));
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      console.error(
        JSON.stringify({
          event: "security_email.failed",
          eventId: event.event_id,
          code: error instanceof Error && /^[A-Z0-9_]+$/.test(error.message) ? error.message : "DELIVERY_FAILED",
        }),
      );
    } finally {
      client.release();
    }
  }
  return delivered;
}

async function run(): Promise<void> {
  await transport.verify();
  console.log(JSON.stringify({ event: "notification.ready", adapter: "smtp" }));
  while (!stopping) {
    const delivered = await deliverBatch();
    if (delivered === 0) await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
}

async function shutdown(): Promise<void> {
  stopping = true;
  transport.close();
  await pool.end();
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => void shutdown());
}

await run();
