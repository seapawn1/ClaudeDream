"""ClaudeDream entry script, run by the lead of /dreaming:dream and by /dreaming:restore.

  python dream.py start   <session_id> [--projects-dir PATH] [--project DIR]... [--skip-project TEXT]... [--session ID]... [--sandbox]
  python dream.py start   <session_id> --continue RUN_ID
  python dream.py finish  <session_id>
  python dream.py restore <session_id> [--run RUN_ID] [--force]
  python dream.py plan    <session_id> [--projects-dir PATH]

start: prepare the transcripts (prepare.py); per target memory directory keep a starting copy
(base) and a working copy (stage); generate the workflow script with every part in it; turn the
guard on. With --continue, pick up an unfinished run, in the same session or a new one: only the
parts and directories that have no result yet go into the new workflow; the work dir, the staged
copies and the rendered transcripts are the run's own.
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
import time

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


def write_workflow(workdir, groups):
    with open(os.path.join(HERE, "dream_workflow.tmpl.js"), encoding="utf-8") as f:
        tmpl = f.read()
    wf_plan = {"groups": [{"key": g["key"], "stage": g["stage"], "parts": g["parts"]} for g in groups]}
    wf_path = os.path.join(workdir, "dream-run.js")
    with open(wf_path, "w", encoding="utf-8", newline="\n") as f:
        f.write(tmpl.replace("__PLAN__", json.dumps(wf_plan, ensure_ascii=False)))
    return wf_path


def run_sessions(run):
    """The sessions a run has worked in, each with the time it started there."""
    return run.get("sessions") or [{"session_id": run["session_id"], "started_at": run.get("started_at")}]


def journal_runs(session_id, since=None):
    """Each workflow run of a session: (when it started, {label: result, or None while it has none}).
    Every label that started is there, so a part that was started again in a later run shows up."""
    runs = []
    for d in workflow_dirs(session_id, since):
        j = os.path.join(d, "journal.jsonl")
        if not os.path.exists(j):
            continue
        labels, out = {}, {}
        with open(j, encoding="utf-8") as f:
            for line in f:
                try:
                    r = json.loads(line)
                except ValueError:
                    continue
                if r.get("type") == "started":
                    labels[r.get("key")] = r.get("label")
                    out.setdefault(r.get("label"), None)
                elif r.get("type") == "result" and labels.get(r.get("key")) and r.get("result") is not None:
                    out[labels[r["key"]]] = r["result"]
        runs.append((min(os.path.getmtime(os.path.join(d, n)) for n in os.listdir(d)), out))
    return runs


def run_journal(run):
    """The workflow runs of every session of the run, oldest first."""
    return sorted((x for s in run_sessions(run) for x in journal_runs(s["session_id"], s["started_at"])),
                  key=lambda x: x[0])


def run_results(run, runs=None):
    """One result per label over all the runs: the latest result; None if it never got one."""
    out = {}
    for _, labels in runs if runs is not None else run_journal(run):
        for lab, r in labels.items():
            if r is not None or lab not in out:
                out[lab] = r
    return out


def organized(g, runs):
    """A directory counts as organized only if an organizer finished in a workflow run no earlier than
    the last run that analyzed any of its parts: parts analyzed again need organizing again."""
    ids = {f"analyze {p['id']}" for p in g["parts"]}
    last = max((i for i, (_, labels) in enumerate(runs) if ids & set(labels)), default=-1)
    return any(labels.get(f"organize {g['key']}") for i, (_, labels) in enumerate(runs) if i >= last)


def last_activity(run):
    """The latest write time in the run's workflow dirs or its hook log, or None."""
    times = [os.path.getmtime(os.path.join(d, n)) for s in run_sessions(run)
             for d in workflow_dirs(s["session_id"], s["started_at"]) for n in os.listdir(d)]
    log = os.path.join(run["workdir"], "hooklog.jsonl")
    if os.path.exists(log):
        times.append(os.path.getmtime(log))
    return max(times) if times else None


def run_activity(run):
    per, ids = collections.defaultdict(lambda: {"calls": 0, "errors": []}), set()
    for s in run_sessions(run):
        p, _, i = agent_activity(s["session_id"], s["started_at"])
        for name, v in p.items():
            per[name]["calls"] += v["calls"]
            per[name]["errors"] += v["errors"]
        ids |= i
    return dict(per), len(ids), ids


BUSY_SECONDS = 300


def continue_cmd(a, started):
    path = os.path.join(common.RUNS_DIR, a.continue_run, "run.json")
    if not a.continue_run.startswith("dream-") or not os.path.exists(path):
        print(f"no dream run named {a.continue_run}")
        return 2
    with open(path, encoding="utf-8") as f:
        run = json.load(f)
    workdir = run["workdir"]
    if os.path.exists(os.path.join(workdir, "run-report.json")):
        print(f"run {run['run_id']} is already finished; start a new run instead")
        return 2
    busy = last_activity(run)
    if busy and time.time() - busy < BUSY_SECONDS:
        print(f"run {run['run_id']} wrote something {int(time.time() - busy)} s ago, so its workflow may still be "
              f"running in session {run['session_id']}: stop it there (or wait until nothing has happened for "
              f"{BUSY_SECONDS // 60} minutes), then continue")
        return 2
    runs = run_journal(run)
    results = run_results(run, runs)
    todo, done_parts, total_parts = [], 0, 0
    for g in run["groups"]:
        left = [p for p in g["parts"] if not results.get(f"analyze {p['id']}")]
        total_parts += len(g["parts"])
        done_parts += len(g["parts"]) - len(left)
        if left or not organized(g, runs):
            gone = [p["id"] for p in left if not os.path.exists(p["path"])]
            if gone:
                print(f"the rendered transcripts of this run are gone ({len(gone)} parts, e.g. {gone[0]}); "
                      f"start a new run instead")
                return 1
            todo.append({"key": g["key"], "stage": g["stage"], "parts": left})
    sessions = run_sessions(run)
    for s in sessions:  # the run moves to this session: its guard elsewhere goes off
        st = common.active_state(s["session_id"])
        if s["session_id"] != a.session_id and st and os.path.normcase(st["workdir"]) == os.path.normcase(workdir):
            common.deactivate(s["session_id"])
    old = common.active_state(a.session_id)
    if old and os.path.normcase(old["workdir"]) != os.path.normcase(workdir):
        print(f"note: an unfinished run in this session is abandoned, nothing of it written back: {old['workdir']}")
        shutil.rmtree(os.path.join(old["workdir"], "transcripts"), ignore_errors=True)
    if all(s["session_id"] != a.session_id for s in sessions):
        sessions.append({"session_id": a.session_id, "started_at": started})
        common.register({"kind": "dream-continue", "run_id": run["run_id"], "session_id": a.session_id,
                         "workdir": workdir})
    run.update(sessions=sessions, session_id=a.session_id)
    wb.save(path, run)
    print(f"run: {run['run_id']} (continued)\nworkdir: {workdir}\n"
          f"mode: {'sandbox (nothing is written back)' if run['sandbox'] else 'write back'}")
    print(f"parts analyzed before: {done_parts}/{total_parts}; left: {total_parts - done_parts}; "
          f"memory dirs still to organize: {len(todo)}")
    if not todo:
        print("NOTHING_TO_RUN: every part is analyzed and every directory organized; go straight to finish")
        common.activate(a.session_id, workdir, [workdir], PLUGIN_ROOT)
        return 0
    wf_path = write_workflow(workdir, todo)
    common.activate(a.session_id, workdir, [workdir], PLUGIN_ROOT)
    for g in todo:
        print(f"  {len(g['parts']):4d} parts left -> {g['key']}")
    print(f"WORKFLOW_SCRIPT: {fwd(wf_path)}")
    return 0


def start_cmd(a):
    started = time.time()
    if a.continue_run:
        return continue_cmd(a, started)
    old = common.active_state(a.session_id)
    if old:
        print(f"note: an unfinished run in this session is abandoned, nothing of it written back: {old['workdir']}")
        shutil.rmtree(os.path.join(old["workdir"], "transcripts"), ignore_errors=True)  # may hold secrets
    run_id, workdir = common.new_run("dream", a.session_id)
    m = prep.prepare(workdir, a.projects_dir, set(a.project) if a.project else None,
                     prep.SEGMENT_CHARS, set(a.session) if a.session else None, a.skip_project, a.skip_session)
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
           "started_at": started, "workdir": workdir, "groups": plan}
    wb.save(os.path.join(workdir, "run.json"), run)
    wf_path = write_workflow(workdir, plan)
    common.activate(a.session_id, workdir, [workdir], PLUGIN_ROOT)
    print(f"memory dirs: {len(plan)}")
    for g in plan:
        print(f"  {len(g['parts']):4d} parts -> {g['memory_dir']}")
    print(f"WORKFLOW_SCRIPT: {fwd(wf_path)}")
    return 0


def workflow_dirs(session_id, since=None):
    """The workflow run dirs of a session; with `since` (epoch seconds), only runs launched after it,
    so a check and a dream run one after the other in one session do not read each other's agents."""
    out = []
    for d in glob.glob(os.path.join(common.config_dir(), "projects", "*", session_id, "subagents", "workflows", "*")):
        if not os.path.isdir(d):
            continue
        if since is not None:
            times = [os.path.getmtime(os.path.join(d, n)) for n in os.listdir(d)]
            if not times or min(times) < since - 1:
                continue
        out.append(d)
    return out


def journal_results(session_id, since=None):
    """Every agent result the session's workflow runs recorded: {label: result or None}."""
    out = {}
    journals = [os.path.join(d, "journal.jsonl") for d in workflow_dirs(session_id, since)]
    for j in sorted((j for j in journals if os.path.exists(j)), key=os.path.getmtime):
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


VALIDATION_ERROR = "<tool_use_error>"


def agent_activity(session_id, since=None):
    """What the run's agents actually did, from their own transcripts: per file name, the write
    calls and the errors they got back; the number of write calls that got past Claude Code's input
    checks, and their ids. A call refused by those checks (file changed since read, string not found,
    file not read yet: results starting with <tool_use_error>) never reaches the PreToolUse hook, so
    it is not counted against the hook log; it still counts as a failed write of that file."""
    per_file = collections.defaultdict(lambda: {"calls": 0, "errors": []})
    executed = set()
    paths = [p for d in workflow_dirs(session_id, since) for p in glob.glob(os.path.join(d, "agent-*.jsonl"))]
    for path in paths:
        calls, refused = {}, set()
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
                    elif (b.get("type") == "tool_result" and b.get("tool_use_id") in calls and b.get("is_error")
                          and b["tool_use_id"] not in refused):
                        c = b.get("content")
                        text = c if isinstance(c, str) else json.dumps(c, ensure_ascii=False)
                        per_file[calls[b["tool_use_id"]]]["errors"].append(text[:200])
                        if text.lstrip().startswith(VALIDATION_ERROR):
                            refused.add(b["tool_use_id"])
        executed |= set(calls) - refused
    return dict(per_file), len(executed), executed


def load_hooklog(workdir):
    p = os.path.join(workdir, "hooklog.jsonl")
    if not os.path.exists(p):
        return []
    with open(p, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def hook_evidence(log, workdir, transcript_writes, executed_ids=None):
    """What the hook log shows for PBI-002 acceptance criterion 3, and whether it saw every write
    call the agents' transcripts show (a hook that fails to read its input decides nothing). With the
    calls' ids (the guard logs tool_use_id), every executed write call must be in the log by id."""
    lead_shell = [r.get("command") for r in log if not r.get("agent_id") and r.get("tool") in ("Bash", "PowerShell")]
    agent_shell = [r for r in log if r.get("agent_id") and r.get("tool") in ("Bash", "PowerShell")]
    network = [r for r in log if r.get("tool") in ("WebFetch", "WebSearch") or str(r.get("tool", "")).startswith("mcp__")]
    writes = [r for r in log if r.get("tool") in ("Write", "Edit", "MultiEdit", "NotebookEdit")]
    allowed_outside = [r for r in writes if r.get("decision") == "allow" and not common.within(r.get("path"), [workdir])]
    lead_ok = all(d == "allow" for d in (r.get("decision") for r in log if not r.get("agent_id") and r.get("tool") in ("Bash", "PowerShell")))
    agent_writes = [r for r in writes if r.get("agent_id")]
    if executed_ids is not None and agent_writes and all(r.get("tool_use_id") for r in agent_writes):
        missing = sorted(set(executed_ids) - {r["tool_use_id"] for r in agent_writes})
    else:  # a hook log without ids (or written partly by an older guard): compare counts
        missing = ["(count)"] * max(0, transcript_writes - len(agent_writes))
    return {
        "calls": len(log), "decisions": dict(collections.Counter(str(r.get("decision")) for r in log)),
        "lead_shell_commands": lead_shell, "lead_ran_only_plugin_scripts": lead_ok,
        "agent_shell_attempts_blocked": len(agent_shell), "network_or_mcp_attempts_blocked": len(network),
        "writes": len(writes), "writes_allowed_outside_workdir": len(allowed_outside),
        "write_calls_in_agent_transcripts": transcript_writes,
        "write_calls_missing_from_hook_log": len(missing), "missing_ids": missing[:10],
        "unreadable_inputs": sum(1 for r in log if r.get("error")),
        "ok": lead_ok and not allowed_outside and all(r.get("decision") == "deny" for r in agent_shell + network)
              and not missing,
    }


def check_group(g, results, attempts, is_organized=True):
    missing = [p["id"] for p in g["parts"] if not results.get(f"analyze {p['id']}")]
    org = results.get(f"organize {g['key']}") if is_organized else None
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
        shown = "; ".join(f"{f}: {', '.join(p[:2])}" for f, p in list(fmt_touched.items())[:5])
        problems.append(f"{len(fmt_touched)} files the run added or changed are not in the native format ({shown})")
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
    runs = run_journal(run)
    results = run_results(run, runs)
    log = load_hooklog(workdir)
    attempts, transcript_writes, executed = run_activity(run)
    hooks = hook_evidence(log, workdir, transcript_writes, executed)
    report = {"run_id": run["run_id"], "sandbox": run["sandbox"], "hook_log": hooks, "groups": []}
    for g in run["groups"]:
        c = check_group(g, results, attempts, organized(g, runs))
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
    shutil.rmtree(os.path.join(workdir, "transcripts"), ignore_errors=True)  # rendered copies may hold secrets
    print(f"run {run['run_id']}: {'all checks passed' if report['complete'] else 'SOME CHECKS FAILED'}"
          f"{' (sandbox: nothing written back)' if run['sandbox'] else ''}")
    print(f"hook log: {hooks['calls']} calls, lead ran only plugin scripts={hooks['lead_ran_only_plugin_scripts']}, "
          f"blocked agent shell={hooks['agent_shell_attempts_blocked']}, blocked network/MCP={hooks['network_or_mcp_attempts_blocked']}, "
          f"writes allowed outside the work dir={hooks['writes_allowed_outside_workdir']}, "
          f"agent write calls: {hooks['write_calls_in_agent_transcripts']} in transcripts (past input checks), "
          f"{len([r for r in log if r.get('agent_id') and r.get('tool') in WRITE_TOOLS])} seen by the hook, "
          f"{hooks['write_calls_missing_from_hook_log']} missing from it")
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
    ap.add_argument("--skip-project", action="append", default=None,
                    help="skip every project dir whose name contains this text (repeatable)")
    ap.add_argument("--skip-session", action="append", default=None,
                    help="skip the session whose id starts with this text (repeatable)")
    ap.add_argument("--sandbox", action="store_true", help="do not write the results back to the memory dirs")
    ap.add_argument("--run", default=None, help="restore: which run (default: the latest written-back run)")
    ap.add_argument("--force", action="store_true", help="restore: overwrite files changed after write-back")
    ap.add_argument("--continue", dest="continue_run", default=None,
                    help="start: pick up this unfinished run (same session or a new one); parts already analyzed are not redone")
    a = ap.parse_args(argv)
    return {"plan": plan_cmd, "start": start_cmd, "finish": finish_cmd, "restore": restore_cmd}[a.command](a)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
