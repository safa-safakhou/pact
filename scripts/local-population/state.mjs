import fs from "node:fs";
import path from "node:path";
import { effectiveRequestCap } from "./limits.mjs";

export function atomicJson(file, value) {
  fs.writeFileSync(`${file}.tmp`, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(`${file}.tmp`, file);
}

export class RunStore {
  constructor(dir) {
    this.dir = path.resolve(dir);
    fs.mkdirSync(this.dir, { recursive: true, mode: 0o700 });
    this.lock = path.join(this.dir, "runner.lock");
    // Never steal a stale lock automatically: a previous write may still be uncertain.
    fs.writeFileSync(this.lock, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }), {
      flag: "wx",
      mode: 0o600,
    });
    this.file = path.join(this.dir, "private-state.json");
  }
  read() {
    return fs.existsSync(this.file) ? JSON.parse(fs.readFileSync(this.file, "utf8")) : null;
  }
  save(state) {
    atomicJson(this.file, state);
  }
  stopped() {
    return fs.existsSync(path.join(this.dir, "STOP"));
  }
  close() {
    fs.unlinkSync(this.lock);
  }
}

export function reserveRequest(state, now, save) {
  if (now >= state.endsAt) throw Error("DEADLINE");
  if (state.requests >= effectiveRequestCap(state)) throw Error("REQUEST_CAP");
  state.requests++;
  save(); // Count dispatch attempts before the network, including failures and interruption.
}

export function sameConfig(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
