import { createPool } from "@pact/db";
import { readEnvironment } from "./config.js";
import { buildServer } from "./server.js";

const environment = readEnvironment();
const pool = createPool(environment.DATABASE_URL);
const server = buildServer(pool, { level: environment.LOG_LEVEL });

const shutdown = async (): Promise<void> => {
  await server.close();
  await pool.end();
};
process.once("SIGINT", () => {
  void shutdown();
});
process.once("SIGTERM", () => {
  void shutdown();
});

await server.listen({ host: environment.HOST, port: environment.PORT });
