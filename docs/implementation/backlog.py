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
    criteria.update(re.findall(r"\*\*(G\d{2}) —", (ROOT / "../pact/alpha.md").read_text()))
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
        if task.get("delivery_track") in {"alpha", "alpha_followup", "experience", "friends_playtest", "chatgpt", "local_population"}:
            assert "PACT-053" in task["depends_on"], f"Missing rules gate: {task['id']}"
            assert all(by_id[d].get("delivery_track") != "later" for d in task["depends_on"]), f"Alpha blocked by deferred work: {task['id']}"
        elif task["phase"]:
            assert GATES[task["phase"] - 1] in task["depends_on"], f"Missing phase gate: {task['id']}"
        for source in task["sources"]:
            assert (ROOT / f"../pact/{source}.md").exists(), f"Missing source {source}"
        assert set(task["covers"]) <= criteria, f"Unknown criterion: {task['id']}"
        if task["kind"] != "gate":
            coverage.update(task["covers"])
            coverage.update(task.get("original_plan", {}).get("covers", []))
        if task["status"] == "done":
            assert task["evidence"], f"Missing completion evidence: {task['id']}"
            assert all(by_id[d]["status"] == "done" for d in task["depends_on"]), task["id"]
    assert coverage == criteria, f"Uncovered criteria: {criteria - coverage}"
    active = {t["id"] for t in tasks if t.get("delivery_track") == "alpha"}
    assert active == set(data["alpha"]["active_ids"]) and len(active) == 13, "Alpha scope drift"
    assert active - {data["alpha"]["gate"]} <= set(by_id[data["alpha"]["gate"]]["depends_on"]), "Incomplete Alpha checkpoint"
    followups = {t["id"] for t in tasks if t.get("delivery_track") == "alpha_followup"}
    if followups:
        plan = data["alpha_followup"]
        assert followups == set(plan["active_ids"]), "Alpha follow-up scope drift"
        assert all("PACT-099" in by_id[t]["depends_on"] for t in followups), "Missing agent foundation"
        assert followups - {plan["gate"]} <= set(by_id[plan["gate"]]["depends_on"]), "Incomplete follow-up checkpoint"
    experience = {t["id"] for t in tasks if t.get("delivery_track") == "experience"}
    if experience:
        plan = data["experience"]
        assert experience == set(plan["active_ids"]) and len(experience) == 18, "Experience scope drift"
        assert all({"PACT-099", "PACT-108"} <= set(by_id[t]["depends_on"]) for t in experience), "Missing experience foundations"
        assert experience - {plan["gate"]} <= set(by_id[plan["gate"]]["depends_on"]), "Incomplete experience checkpoint"
    friends = {t["id"] for t in tasks if t.get("delivery_track") == "friends_playtest"}
    if friends:
        assert friends == set(data["friends_playtest"]["active_ids"]) and len(friends) == 4, "Friends playtest scope drift"
        assert friends - {"PACT-130"} <= set(by_id["PACT-130"]["depends_on"]), "Incomplete friend walkthrough dependencies"
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
        # New follow-ups have their own checkpoint; do not rewrite historical gate acceptance.
        phase_tasks = {t["id"] for t in tasks if t["phase"] == phase and t["id"] != gate_id
                       and t.get("delivery_track") not in {"alpha_followup", "experience", "friends_playtest", "chatgpt", "local_population"}}
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
                 "Dependencies are completion requirements. The original Alpha track depends on the completed rules gate; new Alpha follow-ups have a separate checkpoint and are completed; the completed experience and friends batches have their own evidence. Postponed production/pilot gates do not block either. Other phases retain their original gates. Owner roles are disciplines, not assigned people; size is not a time commitment.", ""]
        for task in selected:
            lines += [f'<a id="{task["id"].lower()}"></a>', f"## {task['id']} — {task['title']}", "",
                      f"**Status:** {task['status']} · **Role:** {task['owner_role']} · **Size:** {task['size']} · **Type:** {task['kind']}", "",
                      f"**Delivery track:** {task.get('delivery_track', 'completed foundation')} · "
                      + ("[Alpha playtest follow-ups](alpha-playtest-fixes.md)" if task.get("delivery_track") == "alpha_followup"
                         else "[Generated experience](game-experience.md)" if task.get("delivery_track") == "experience"
                         else "[Friends playtest](friends-playtest.md)" if task.get("delivery_track") == "friends_playtest"
                         else "[Approved Alpha scope](../pact/alpha.md)"), "",
                      "**Depends on:** " + (", ".join(link(d) for d in task["depends_on"]) or "None — start here."), "",
                      "**Components:** " + ", ".join(task["components"]) + ".", "",
                      "**Specification:** " + ", ".join(f"[{s}](../pact/{s}.md)" for s in task["sources"]) + " · **Release checks:** " + ", ".join(task["covers"]), "",
                      "**Implement / deliver**", ""]
            lines += ["- " + item for item in task["scope"]]
            if task.get("original_plan"):
                lines += ["", "**Deferred original scope:** Preserved in this ticket's `original_plan` in tasks.json; Alpha completion does not certify its former production/pilot acceptance."]
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
            members = [t for t in tasks if criterion in set(t["covers"] + t.get("original_plan", {}).get("covers", [])) and t["kind"] != "gate"]
            lines += [f"| {criterion} | " + ", ".join(link(t["id"]) for t in members) + f" | {link(GATES[phase])} |"]
        lines += [""]
    lines += ["## Current game-only Alpha", "", "Original A/R/S/L coverage above includes deferred original scope and is not evidence that narrowed Alpha tickets satisfy full production criteria.", "", "| Criterion | Active tickets | Alpha checkpoint |", "| --- | --- | --- |"]
    for criterion in sorted(c for c in criteria if c.startswith("G")):
        members = [t for t in tasks if criterion in t["covers"] and t["id"] != data["alpha"]["gate"]
                   and t.get("delivery_track") not in {"alpha_followup", "experience", "friends_playtest", "chatgpt", "local_population"}]
        lines += [f"| {criterion} | " + (", ".join(link(t["id"]) for t in members) or "Observed final rehearsal") + f" | {link(data['alpha']['gate'])} |"]
    if data.get("alpha_followup"):
        plan = data["alpha_followup"]
        lines += ["", "## Alpha playtest follow-ups — completed", "",
                  "The original 13-ticket checkpoint remains historical. These additional tickets completed through their own follow-up checkpoint. Experience and friends batches have separate completion reports.", "",
                  "| Criterion | Follow-up tickets | Follow-up checkpoint |", "| --- | --- | --- |"]
        for criterion in sorted(c for c in criteria if c.startswith("G")):
            members = [t for t in tasks if criterion in t["covers"] and t.get("delivery_track") == "alpha_followup"
                       and t["id"] != plan["gate"]]
            if members or criterion in by_id[plan["gate"]]["covers"]:
                lines += [f"| {criterion} | " + (", ".join(link(t["id"]) for t in members) or "Observed repeat playtest")
                          + f" | {link(plan['gate'])} |"]
    if data.get("friends_playtest"):
        friends_complete = all(by_id[t]["status"] == "done" for t in data["friends_playtest"]["active_ids"])
        lines += ["", "## Friends playtest - " + ("completed" if friends_complete else "in progress"), "", "Four bounded web/agent improvements; original production gates remain deferred.", "",
                  "| Ticket | Criteria | Evidence |", "| --- | --- | --- |"]
        for task_id in data["friends_playtest"]["active_ids"]:
            task = by_id[task_id]
            evidence = "[Completed checks and integrated walkthrough](reports/friends-playtest-20261004.md)" if task["status"] == "done" else "Pending per-ticket checks and integrated walkthrough"
            lines += ["| " + link(task_id) + " | " + ", ".join(task["covers"]) + " | " + evidence + " |"]
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
