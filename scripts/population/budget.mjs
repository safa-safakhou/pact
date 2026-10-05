import fs from "node:fs";
export class RequestBudget {
  constructor(file, cap = 200) {
    this.file = file;
    this.cap = cap;
    this.value = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { requests: 0 };
  }
  take(now, deadline) {
    if (now >= deadline) throw Error("DEADLINE");
    if (this.value.requests >= this.cap) throw Error("BUDGET_EXHAUSTED");
    this.value.requests++;
    fs.writeFileSync(`${this.file}.tmp`, JSON.stringify(this.value), { mode: 0o600 });
    fs.renameSync(`${this.file}.tmp`, this.file);
    return this.value.requests;
  }
}
