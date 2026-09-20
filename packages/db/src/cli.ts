import { migrate } from "./migrate.js";
import { createPool } from "./pool.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const pool = createPool(connectionString);
try {
  const applied = await migrate(pool);
  console.log(applied.length === 0 ? "Database is current." : `Applied: ${applied.join(", ")}`);
} finally {
  await pool.end();
}
