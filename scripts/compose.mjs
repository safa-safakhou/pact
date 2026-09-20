import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const plugin = spawnSync("docker", ["compose", "version"], { stdio: "ignore" });
const command = plugin.status === 0 ? "docker" : "docker-compose";
const commandArgs = command === "docker" ? ["compose", ...args] : args;
const result = spawnSync(command, commandArgs, { stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
