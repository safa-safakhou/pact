"""Render and check local planning documents; no application or network actions."""

import csv
import hashlib
import io
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent
PHASES = {
    0: ("phase-0-connections.md", "Connection experiment"),
    1: ("phase-1-rules.md", "Transactional rules prototype"),
    2: ("phase-2-social.md", "Social slice"),
    3: ("phase-3-season-one.md", "Season One release"),
}
GATES = {0: "PACT-027", 1: "PACT-053", 2: "PACT-068", 3: "PACT-081"}


def validate(data):
    tasks = data["tasks"]
    by_id = {task["id"]: task for task in tasks}
    assert len(by_id) == len(tasks), "Duplicate task IDs"
    criteria = set(re.findall(r"\*\*([ARSL]\d{2}) —", (ROOT / "../pact/delivery.md").read_text()))
    coverage = set()
    for task in tasks:
        assert task["phase"] in PHASES, task["id"]
        assert task["status"] in data["task_status_values"], task["id"]
        for field in ("title", "owner_role", "size", "sources", "scope", "acceptance", "covers"):
            assert task[field], f"Empty {field}: {task['id']}"
        assert len(task["acceptance"]) >= 2, task["id"]
        assert task["size"] in data["size_legend"], task["id"]
        assert len(task["depends_on"]) == len(set(task["depends_on"])), task["id"]
        for dependency in task["depends_on"]:
            assert dependency in by_id, f"Missing dependency {dependency}"
            assert by_id[dependency]["phase"] <= task["phase"], "Dependency on a later milestone"
        if task["phase"]:
            assert GATES[task["phase"] - 1] in task["depends_on"], f"Missing phase gate: {task['id']}"
        for source in task["sources"]:
            assert (ROOT / f"../pact/{source}.md").exists(), f"Missing source {source}"
        assert set(task["covers"]) <= criteria, f"Unknown criterion: {task['id']}"
        if task["kind"] != "gate":
            coverage.update(task["covers"])
        if task["status"] == "done":
            assert task["evidence"], f"Missing completion evidence: {task['id']}"
            assert all(by_id[d]["status"] == "done" for d in task["depends_on"]), task["id"]
    assert coverage == criteria, f"Uncovered criteria: {criteria - coverage}"
    visiting, visited = set(), set()

    def visit(task_id):
        assert task_id not in visiting, f"Dependency cycle at {task_id}"
        if task_id in visited:
            return
        visiting.add(task_id)
        for dependency in by_id[task_id]["depends_on"]:
            visit(dependency)
        visiting.remove(task_id)
        visited.add(task_id)

    for task_id in by_id:
        visit(task_id)
    for phase, gate_id in GATES.items():
        phase_tasks = {t["id"] for t in tasks if t["phase"] == phase and t["id"] != gate_id}
        assert phase_tasks <= set(by_id[gate_id]["depends_on"]), f"Incomplete gate {gate_id}"
    for source, expected in data["source_sha256"].items():
        actual = hashlib.sha256((ROOT / source).read_bytes()).hexdigest()
        assert actual == expected, f"Specification changed: {source}; review affected tickets and update snapshot"
    return by_id, criteria


def render(data, by_id, criteria):
    tasks = data["tasks"]
    outputs = {}

    def link(task_id):
        task = by_id[task_id]
        return f"[{task_id}]({PHASES[task['phase']][0]}#{task_id.lower()})"

    for phase, (filename, title) in PHASES.items():
        selected = [t for t in tasks if t["phase"] == phase]
        completed = sum(t["status"] == "done" for t in selected)
        lines = [f"# Phase {phase} — {title}", "",
                 f"**{len(selected)} tickets · {completed} completed.** [Backlog overview](README.md) · [Machine-readable tickets](tasks.json)", "",
                 "Dependencies are completion requirements. Later phases also depend on the preceding gate. Owner roles are disciplines, not assigned people. Size is complexity, not a time commitment.", ""]
        for task in selected:
            lines += [f'<a id="{task["id"].lower()}"></a>', f"## {task['id']} — {task['title']}", "",
                      f"**Status:** {task['status']} · **Role:** {task['owner_role']} · **Size:** {task['size']} · **Type:** {task['kind']}", "",
                      "**Depends on:** " + (", ".join(link(d) for d in task["depends_on"]) or "None — start here."), "",
                      "**Components:** " + ", ".join(task["components"]) + ".", "",
                      "**Specification:** " + ", ".join(f"[{s}](../pact/{s}.md)" for s in task["sources"]) + " · **Release checks:** " + ", ".join(task["covers"]), "",
                      "**Implement / deliver**", ""]
            lines += ["- " + item for item in task["scope"]]
            checked = "x" if task["status"] == "done" else " "
            lines += ["", "**Acceptance**", ""] + [f"- [{checked}] {item}" for item in task["acceptance"]]
            if task["blocked_by_external"]:
                lines += ["", "**External prerequisites:** " + "; ".join(task["blocked_by_external"]) + "."]
            if task.get("assignee"):
                lines += ["", "**Assignee:** " + task["assignee"]]
            if task.get("block_reason"):
                lines += ["", "**Block reason:** " + task["block_reason"]]
            if task["evidence"]:
                lines += ["", "**Evidence**", ""] + ["- " + item for item in task["evidence"]]
            lines += [""]
        outputs[filename] = "\n".join(lines)

    stream = io.StringIO(newline="")
    fields = ["id", "title", "phase", "status", "kind", "owner_role", "size", "depends_on", "covers", "document"]
    writer = csv.DictWriter(stream, fieldnames=fields, lineterminator="\n")
    writer.writeheader()
    for task in tasks:
        row = {key: task[key] for key in fields[:7]}
        row.update(depends_on=";".join(task["depends_on"]), covers=";".join(task["covers"]),
                   document=PHASES[task["phase"]][0] + "#" + task["id"].lower())
        writer.writerow(row)
    outputs["tasks.csv"] = stream.getvalue()

    lines = ["# Release-criterion coverage", "", "Every criterion in the [design delivery checklist](../pact/delivery.md) is mapped below. Links assign work; they are not completed test evidence.", ""]
    for phase, (_, title) in PHASES.items():
        prefix = ("A", "R", "S", "L")[phase]
        lines += [f"## Phase {phase} — {title}", "", "| Criterion | Implementation / verification tickets | Closing gate |", "| --- | --- | --- |"]
        for criterion in sorted(c for c in criteria if c.startswith(prefix)):
            members = [t for t in tasks if criterion in t["covers"] and t["kind"] != "gate"]
            lines += [f"| {criterion} | " + ", ".join(link(t["id"]) for t in members) + f" | {link(GATES[phase])} |"]
        lines += [""]
    outputs["coverage.md"] = "\n".join(lines)
    return outputs


def main():
    assert len(sys.argv) == 2 and sys.argv[1] in {"render", "check"}, "Usage: backlog.py render|check"
    data = json.loads((ROOT / "tasks.json").read_text())
    by_id, criteria = validate(data)
    outputs = render(data, by_id, criteria)
    for filename, contents in outputs.items():
        path = ROOT / filename
        if sys.argv[1] == "render":
            path.write_text(contents)
        else:
            assert path.exists() and path.read_text() == contents, f"Stale generated file: {filename}"
    print(f"PASS: {len(by_id)} unique tickets, acyclic dependencies, all {len(criteria)} release criteria covered, source snapshots match; {len(outputs)} views {sys.argv[1]}ed.")


if __name__ == "__main__":
    main()
