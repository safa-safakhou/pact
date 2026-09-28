import { BaselineMcpClient } from "./lib/baseline-mcp.js";
import { BaselineWriteError, playBaseline } from "./lib/baseline-player.js";

const endpoint = process.env.PACT_BASELINE_MCP_URL;
const token = process.env.PACT_BASELINE_ACCESS_TOKEN;
if (!endpoint || !token)
  throw new Error("Set PACT_BASELINE_MCP_URL and PACT_BASELINE_ACCESS_TOKEN in the process environment.");
const client = new BaselineMcpClient(endpoint, token);
try {
  await client.initialize();
  const partnerKingdomId = process.env.PACT_BASELINE_PARTNER_ID;
  const result = await playBaseline(client, partnerKingdomId ? { partnerKingdomId } : {});
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  // Never print token, raw remote content, request headers or private correspondence.
  process.stderr.write(
    `${JSON.stringify({
      code: "BASELINE_STOPPED",
      ...(error instanceof BaselineWriteError ? { uncertainCommandId: error.commandId } : {}),
    })}\n`,
  );
  process.exitCode = 1;
} finally {
  try {
    await client.close();
  } catch {
    process.stderr.write(
      '{"code":"SESSION_CLOSE_FAILED","note":"Write lease remains bounded by its server expiry."}\n',
    );
    process.exitCode = 1;
  }
}
