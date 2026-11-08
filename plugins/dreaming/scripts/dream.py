"""ClaudeDream entry script, run by the lead of /dreaming:dream and by /dreaming:restore.

  python dream.py start   <session_id> [--projects-dir PATH] [--project DIR]... [--session ID]... [--sandbox]
  python dream.py finish  <session_id>
  python dream.py restore <session_id> [--run RUN_ID] [--force]
  python dream.py plan    <session_id> [--projects-dir PATH]

start: prepare the transcripts (prepare.py); per target memory directory keep a starting copy
(base) and a working copy (stage); generate the workflow script with every part in it; turn the
guard on.
finish: check each directory before anything touches the real memory -- every part analyzed and
the directory organized (from the workflow's own journal), native format of every file the run
added or changed, MEMORY.md within 200 lines and 25KB, every file that existed at the start still
findable (kept, edited, or moved with a stub), what the hook log shows -- then write back the
directories that passed (unless --sandbox), keeping a rollback copy; a directory with any file
changed elsewhere during the run is not written back at all. Agent self-reports are never
evidence: the organizer's list of changes is checked against the diff and the hook log.
restore: put a run's rollback copies back.
"""
import argparse
import collections
import glob
import json
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402
import memcheck  # noqa: E402
import prepare as prep  # noqa: E402
import routing  # noqa: E402
import writeback as wb  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
PLUGIN_ROOT = os.path.dirname(HERE)
PROTECTED = ("GlobalMemory",)


def fwd(p):
    return p.replace("\\", "/")


def plan_cmd(a):
    projects = common.resolve_projects_dir(a.projects_dir)
    if not os.path.isdir(projects):
        print(f"projects dir not found: {projects}")
        return 2
    mains = glob.glob(os.path.join(projects, "*", "*.jsonl"))
    print(f"projects_dir: {projects}")
    print(f"source: {'--projects-dir' if a.projects_dir else 'default (config dir)'}")
    print(f"project dirs with sessions: {len({os.path.dirname(m) for m in mains})}")
    print(f"main sessions: {len(mains)}")
    return 0


def start_cmd(a):
    run_id, workdir = common.new_run("dream", a.session_id)
    m = prep.prepare(workdir, a.projects_dir, set(a.project) if a.project else None,
                     prep.SEGMENT_CHARS, set(a.session) if a.session else None)
    print(f"run: {run_id}\nworkdir: {workdir}\nmode: {'sandbox (nothing is written back)' if a.sandbox else 'write back'}")
    print(f"sessions found: {m['sessions_found']} {m['counts']}; parts: {m['parts']}")
    if not m["checks"]["passed"]:
        print("prepare checks FAILED; nothing started:")
        for p in m["checks"]["problems"]:
            print("  " + p)
        return 1
    groups = {}
    for e in m["sessions"]:
        if e["status"] != "converted":
            continue
        g = groups.setdefault(e["memory_dir"], {"memory_dir": e["memory_dir"], "parts": [], "first": e["created"] or ""})
        g["parts"] += [{"id": os.path.splitext(os.path.basename(p["file"]))[0], "path": fwd(p["file"]),
                        "created": e["created"] or ""} for p in e["parts"]]
    plan = []
    for mem, g in sorted(groups.items(), key=lambda kv: kv[1]["first"]):
        if any(x in os.path.normpath(mem).split(os.sep) for x in PROTECTED):
            print(f"skipped protected memory dir: {mem}")
            continue
        key = routing.sanitize(os.path.normpath(mem))[-120:]
        base = os.path.join(workdir, "base", key)
        stage = os.path.join(workdir, "stage", key)
        for d in (base, stage):
            if os.path.isdir(mem):
                shutil.copytree(mem, d)
            else:
                os.makedirs(d)
        g["parts"].sort(key=lambda p: (p["created"], p["id"]))
        plan.append({"key": key, "memory_dir": mem, "base": fwd(base), "stage": fwd(stage),
                     "parts": [{"id": p["id"], "path": p["path"]} for p in g["parts"]]})
    run = {"run_id": run_id, "session_id": a.session_id, "sandbox": bool(a.sandbox),
           "workdir": workdir, "groups": plan}
    wb.save(os.path.join(workdir, "run.json"), run)
    with open(os.path.join(HERE, "dream_workflow.tmpl.js"), encoding="utf-8") as f:
        tmpl = f.read()
    wf_plan = {"groups": [{"key": g["key"], "stage": g["stage"], "parts": g["parts"]} for g in plan]}
    script = tmpl.replace("__PLAN__", json.dumps(wf_plan, ensure_ascii=False))
    wf_path = os.path.join(workdir, "dream-run.js")
    with open(wf_path, "w", encoding="utf-8", newline="\n") as f:
        f.write(script)
    common.activate(a.session_id, workdir, [workdir], PLUGIN_ROOT)
    print(f"memory dirs: {len(plan)}")
    for g in plan:
        print(f"  {len(g['parts']):4d} parts -> {g['memory_dir']}")
    print(f"WORKFLOW_SCRIPT: {fwd(wf_path)}")
    return 0


def journal_results(session_id):
    """Every agent result the workflow runs of this session recorded: {label: result or None}."""
    out = {}
    pattern = os.path.join(common.config_dir(), "projects", "*", session_id, "subagents", "workflows", "*", "journal.jsonl")
    for j in sorted(glob.glob(pattern), key=os.path.getmtime):
        labels = {}
        with open(j, encoding="utf-8") as f:
            for line in f:
                try:
                    r = json.loads(line)
                except ValueError:
                    continue
                if r.get("type") == "started":
                    labels[r.get("key")] = r.get("label")
                elif r.get("type") == "result" and labels.get(r.get("key")):
                    lab = labels[r["key"]]
                    if r.get("result") is not None or lab not in out:
                        out[lab] = r.get("result")
    return out


WRITE_TOOLS = ("Write", "Edit", "MultiEdit", "NotebookEdit")


def agent_activity(session_id):
    """What the run's agents actually did, from their own transcripts: per file name, the write
    calls and the errors they got back; plus the total number of write calls."""
    per_file, total = collections.defaultdict(lambda: {"calls": 0, "errors": []}), 0
    pattern = os.path.join(common.config_dir(), "projects", "*", session_id, "subagents", "workflows", "*", "agent-*.jsonl")
    for path in glob.glob(pattern):
        calls = {}
        with open(path, encoding="utf-8", errors="replace") as f:
            for line in f:
                try:
                    o = json.loads(line)
                except ValueError:
                    continue
                content = (o.get("message") or {}).get("content")
                for b in content if isinstance(content, list) else []:
                    if not isinstance(b, dict):
                        continue
                    if b.get("type") == "tool_use" and b.get("name") in WRITE_TOOLS and b.get("id") not in calls:
                        # a transcript can hold the same assistant record more than once: count ids
                        name = os.path.basename(str((b.get("input") or {}).get("file_path") or ""))
                        calls[b.get("id")] = name
                        per_file[name]["calls"] += 1
                        total += 1
                    elif b.get("type") == "tool_result" and b.get("tool_use_id") in calls and b.get("is_error"):
                        c = b.get("content")
                        per_file[calls[b["tool_use_id"]]]["errors"].append(
                            (c if isinstance(c, str) else json.dumps(c, ensure_ascii=False))[:200])
    return dict(per_file), total


def load_hooklog(workdir):
    p = os.path.join(workdir, "hooklog.jsonl")
    if not os.path.exists(p):
        return []
    with open(p, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def hook_evidence(log, workdir, transcript_writes):
    """What the hook log shows for PBI-002 acceptance criterion 3, and whether it saw every write
    call the agents' transcripts show (a hook that fails to read its input decides nothing)."""
    lead_shell = [r.get("command") for r in log if not r.get("agent_id") and r.get("tool") in ("Bash", "PowerShell")]
    agent_shell = [r for r in log if r.get("agent_id") and r.get("tool") in ("Bash", "PowerShell")]
    network = [r for r in log if r.get("tool") in ("WebFetch", "WebSearch") or str(r.get("tool", "")).startswith("mcp__")]
    writes = [r for r in log if r.get("tool") in ("Write", "Edit", "MultiEdit", "NotebookEdit")]
    allowed_outside = [r for r in writes if r.get("decision") == "allow" and not common.within(r.get("path"), [workdir])]
    lead_ok = all(d == "allow" for d in (r.get("decision") for r in log if not r.get("agent_id") and r.get("tool") in ("Bash", "PowerShell")))
    return {
        "calls": len(log), "decisions": dict(collections.Counter(str(r.get("decision")) for r in log)),
        "lead_shell_commands": lead_shell, "lead_ran_only_plugin_scripts": lead_ok,
        "agent_shell_attempts_blocked": len(agent_shell), "network_or_mcp_attempts_blocked": len(network),
        "writes": len(writes), "writes_allowed_outside_workdir": len(allowed_outside),
        "write_calls_in_agent_transcripts": transcript_writes,
        "unreadable_inputs": sum(1 for r in log if r.get("error")),
        "ok": lead_ok and not allowed_outside and all(r.get("decision") == "deny" for r in agent_shell + network)
              and transcript_writes <= len([r for r in writes if r.get("agent_id")]),
    }


def check_group(g, results, attempts):
    missing = [p["id"] for p in g["parts"] if not results.get(f"analyze {p['id']}")]
    org = results.get(f"organize {g['key']}")
    diff = wb.compare(g["base"], g["stage"])
    fmt = memcheck.check_dir(g["stage"])
    touched = set(diff["added"]) | set(diff["modified"])
    fmt_touched = {f: p for f, p in fmt["files"].items() if f in touched}
    index_probs = [p for p in fmt["index"] if "MEMORY.md" in touched or "over" in p]
    contradicted = wb.claims_vs_diff((org or {}).get("changes") if isinstance(org, dict) else [], diff, attempts)
    problems = []
    if missing:
        problems.append(f"{len(missing)} parts have no analyzer result")
    if not org:
        problems.append("not organized")
    if fmt_touched:
        problems.append(f"{len(fmt_touched)} files the run added or changed are not in the native format")
    if index_probs:
        problems.append("MEMORY.md: " + "; ".join(index_probs[:3]))
    if diff["lost"]:
        problems.append(f"{len(diff['lost'])} files that existed at the start cannot be found: {', '.join(diff['lost'][:5])}")
    if diff["removed"]:
        problems.append(f"{len(diff['removed'])} files were removed")
    return {
        "memory_dir": g["memory_dir"], "parts": len(g["parts"]), "analyzed": len(g["parts"]) - len(missing),
        "missing_parts": missing, "organized": bool(org),
        "organizer_self_report": {"note": "agent self-report, not verified",
                                  "index_entries": (org or {}).get("index_entries") if isinstance(org, dict) else None,
                                  "changes": (org or {}).get("changes") if isinstance(org, dict) else None},
        "self_report_contradicted": contradicted,
        "diff": {k: diff[k] for k in ("added", "modified", "removed")},
        "whereabouts": diff["whereabouts"], "moved_with_missing_lines": diff["moved_with_missing_lines"],
        "format_problems_in_changed_files": fmt_touched,
        "format_problems_untouched": {f: p for f, p in fmt["files"].items() if f not in touched},
        "index": fmt["stats"], "problems": problems, "passed": not problems,
    }


def finish_cmd(a):
    state = common.active_state(a.session_id)
    if not state:
        print("no active dream run for this session")
        return 2
    workdir = state["workdir"]
    with open(os.path.join(workdir, "run.json"), encoding="utf-8") as f:
        run = json.load(f)
    common.deactivate(a.session_id)  # the guard is off before anything is written back
    results = journal_results(a.session_id)
    log = load_hooklog(workdir)
    attempts, transcript_writes = agent_activity(a.session_id)
    hooks = hook_evidence(log, workdir, transcript_writes)
    report = {"run_id": run["run_id"], "sandbox": run["sandbox"], "hook_log": hooks, "groups": []}
    for g in run["groups"]:
        c = check_group(g, results, attempts)
        if not hooks["ok"]:
            c["problems"].append("the hook log shows a shell, network or out-of-bounds write that was not blocked, "
                                 "or it missed write calls the agents' transcripts show")
            c["passed"] = False
        c["written_back"] = False
        if c["passed"] and not run["sandbox"]:
            res = wb.apply(g["base"], g["stage"], g["memory_dir"], os.path.join(workdir, "backup", g["key"]))
            c.update(written_back=res["written_back"], written=res["written"], conflicts=res["conflicts"])
            if res["written_back"]:
                g["after"] = res["after"]
            else:
                c["not_written_back"] = {
                    "why": "whole directory not written back: files the run would write were changed elsewhere during the run",
                    "conflicts": res["conflicts"], "undone": res.get("undone", []), "staged_result": g["stage"]}
        report["groups"].append(c)
    wb.save(os.path.join(workdir, "run.json"), run)
    report["complete"] = all(c["passed"] and (run["sandbox"] or c["written_back"]) for c in report["groups"])
    wb.save(os.path.join(workdir, "run-report.json"), report)
    print(f"run {run['run_id']}: {'all checks passed' if report['complete'] else 'SOME CHECKS FAILED'}"
          f"{' (sandbox: nothing written back)' if run['sandbox'] else ''}")
    print(f"hook log: {hooks['calls']} calls, lead ran only plugin scripts={hooks['lead_ran_only_plugin_scripts']}, "
          f"blocked agent shell={hooks['agent_shell_attempts_blocked']}, blocked network/MCP={hooks['network_or_mcp_attempts_blocked']}, "
          f"writes allowed outside the work dir={hooks['writes_allowed_outside_workdir']}, "
          f"agent write calls: {hooks['write_calls_in_agent_transcripts']} in transcripts, "
          f"{len([r for r in log if r.get('agent_id') and r.get('tool') in WRITE_TOOLS])} seen by the hook")
    for c in report["groups"]:
        d = c["diff"]
        moved = sum(1 for v in c["whereabouts"].values() if v.startswith("moved"))
        print(f"  {c['memory_dir']}: {c['analyzed']}/{c['parts']} analyzed, organized={c['organized']}, "
              f"+{len(d['added'])} new, {len(d['modified'])} changed, {moved} moved, "
              f"MEMORY.md {c['index'].get('lines')} lines/{c['index'].get('bytes')} bytes")
        for p in c["problems"]:
            print(f"    PROBLEM: {p}")
        for x in c["self_report_contradicted"][:5]:
            print(f"    organizer claim not borne out ({x['why']}): {str(x['claim'])[:140]}")
        for x in c["moved_with_missing_lines"][:5]:
            print(f"    moved file with lines not found in its target: {x['file']} -> {x['target']} ({x['not_found']}/{x['lines']})")
        if c["written_back"]:
            print(f"    written back: {len(c['written'])} files")
        elif "not_written_back" in c:
            nw = c["not_written_back"]
            print(f"    WHOLE DIRECTORY NOT WRITTEN BACK: changed elsewhere during the run: {', '.join(nw['conflicts'][:10])}; "
                  f"the staged result is kept at {nw['staged_result']} for the PO to decide")
    print(f"report: {fwd(os.path.join(workdir, 'run-report.json'))}")
    if any(c["written_back"] for c in report["groups"]):
        print(f"to undo: /dreaming:restore {run['run_id']}")
    return 0 if report["complete"] else 1


def restore_cmd(a):
    runs = sorted(glob.glob(os.path.join(common.RUNS_DIR, "dream-*", "run.json")), key=os.path.getmtime)
    if a.run:
        runs = [r for r in runs if os.path.basename(os.path.dirname(r)) == a.run]
    runs = [r for r in runs if any("after" in g for g in json.load(open(r, encoding="utf-8"))["groups"])]
    if not runs:
        print("no written-back dream run found" + (f" named {a.run}" if a.run else ""))
        return 2
    path = runs[-1]
    with open(path, encoding="utf-8") as f:
        run = json.load(f)
    print(f"restoring run {run['run_id']}")
    ok = True
    for g in run["groups"]:
        if "after" not in g:
            continue
        res = wb.restore(g["memory_dir"], os.path.join(run["workdir"], "backup", g["key"]), g["after"], a.force)
        if not res["restored"]:
            ok = False
            print(f"  NOT restored {g['memory_dir']}: changed after the dream wrote it back: "
                  f"{', '.join(res['changed_since_write_back'][:10])} (run again with --force to overwrite)")
        else:
            print(f"  restored {g['memory_dir']}: identical to before the run={res['identical']}")
    return 0 if ok else 1


def main(argv):
    ap = argparse.ArgumentParser(prog="dream.py")
    ap.add_argument("command", choices=["plan", "start", "finish", "restore"])
    ap.add_argument("session_id")
    ap.add_argument("--projects-dir", default=None,
                    help="where to read session transcripts; default: <Claude Code config dir>/projects")
    ap.add_argument("--project", action="append", default=None)
    ap.add_argument("--session", action="append", default=None)
    ap.add_argument("--sandbox", action="store_true", help="do not write the results back to the memory dirs")
    ap.add_argument("--run", default=None, help="restore: which run (default: the latest written-back run)")
    ap.add_argument("--force", action="store_true", help="restore: overwrite files changed after write-back")
    a = ap.parse_args(argv)
    return {"plan": plan_cmd, "start": start_cmd, "finish": finish_cmd, "restore": restore_cmd}[a.command](a)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
