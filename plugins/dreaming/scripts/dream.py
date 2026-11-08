"""ClaudeDream entry script, run by the lead of /dreaming:dream.

  python dream.py start  <session_id> [--projects-dir PATH] [--project DIR]... [--session ID]... [--sandbox]
  python dream.py finish <session_id>
  python dream.py plan   <session_id> [--projects-dir PATH]

start: prepare the transcripts (prepare.py), copy each target memory directory into the run's
staging area, generate the workflow script with every part in it, and turn the guard on.
finish: check from the workflow's own journal that every part was analyzed and every memory
directory organized, check the staged MEMORY.md files, write the report, turn the guard off.
Writing the staged memory back (and the rollback copy) comes in a later work item; until then
every run is a sandbox run.
"""
import argparse
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

HERE = os.path.dirname(os.path.abspath(__file__))
PLUGIN_ROOT = os.path.dirname(HERE)
INDEX_LINES, INDEX_BYTES = 200, 25 * 1024


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
    print(f"run: {run_id}\nworkdir: {workdir}")
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
        key = routing.sanitize(os.path.normpath(mem))[-120:]
        stage = os.path.join(workdir, "stage", key)
        if os.path.isdir(mem):
            shutil.copytree(mem, stage)
        else:
            os.makedirs(stage)
        g["parts"].sort(key=lambda p: (p["created"], p["id"]))
        plan.append({"key": key, "memory_dir": mem, "stage": fwd(stage),
                     "parts": [{"id": p["id"], "path": p["path"]} for p in g["parts"]]})
    run = {"run_id": run_id, "session_id": a.session_id, "sandbox": True,  # every run is a sandbox run until write-back exists (work item 6)
           "workdir": workdir, "groups": plan}
    with open(os.path.join(workdir, "run.json"), "w", encoding="utf-8") as f:
        json.dump(run, f, ensure_ascii=False, indent=1)
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


def index_status(stage):
    p = os.path.join(stage, "MEMORY.md")
    if not os.path.exists(p):
        return {"exists": False}
    with open(p, encoding="utf-8") as f:
        text = f.read()
    lines, size = text.count("\n") + (0 if text.endswith("\n") else 1), len(text.encode("utf-8"))
    return {"exists": True, "lines": lines, "bytes": size, "within_limits": lines <= INDEX_LINES and size <= INDEX_BYTES}


def finish_cmd(a):
    state = common.active_state(a.session_id)
    if not state:
        print("no active dream run for this session")
        return 2
    workdir = state["workdir"]
    with open(os.path.join(workdir, "run.json"), encoding="utf-8") as f:
        run = json.load(f)
    results = journal_results(a.session_id)
    report = {"run_id": run["run_id"], "groups": [], "missing_parts": [], "unorganized": []}
    for g in run["groups"]:
        missing = [p["id"] for p in g["parts"] if not results.get(f"analyze {p['id']}")]
        org = results.get(f"organize {g['key']}")
        organized = bool(org)
        report["missing_parts"] += missing
        if not organized:
            report["unorganized"].append(g["memory_dir"])
        fmt = memcheck.check_dir(g["stage"])
        report["groups"].append({"memory_dir": g["memory_dir"], "parts": len(g["parts"]),
                                 "analyzed": len(g["parts"]) - len(missing), "organized": organized,
                                 "index": index_status(g["stage"]), "format": fmt,
                                 "organizer": org if isinstance(org, dict) else None})
    report["complete"] = not report["missing_parts"] and not report["unorganized"]
    report["written_back"] = False
    with open(os.path.join(workdir, "run-report.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=1)
    common.deactivate(a.session_id)
    print(f"run {run['run_id']}: {'complete' if report['complete'] else 'INCOMPLETE'}")
    for g in report["groups"]:
        ix = g["index"]
        idx = (f"MEMORY.md {ix['lines']} lines / {ix['bytes']} bytes{'' if ix['within_limits'] else ' OVER LIMIT'}"
               if ix.get("exists") else "no MEMORY.md")
        print(f"  {g['analyzed']}/{g['parts']} analyzed, organized={g['organized']}, {idx}: {g['memory_dir']}")
        if g["organizer"]:
            print(f"    organizer: {g['organizer'].get('index_entries')} index entries, "
                  f"{len(g['organizer'].get('changes') or [])} changes")
        nprob = len(g["format"]["index"]) + len(g["format"]["files"])
        if nprob:
            print(f"    format problems: {nprob}")
            for x in g["format"]["index"][:5]:
                print(f"      MEMORY.md: {x}")
            for name, probs in list(g["format"]["files"].items())[:5]:
                print(f"      {name}: {'; '.join(probs)}")
    if report["missing_parts"]:
        print(f"parts with no analyzer result: {', '.join(report['missing_parts'][:20])}")
    print(f"sandbox run: memory not written back. Staged results: {fwd(os.path.join(workdir, 'stage'))}")
    return 0 if report["complete"] else 1


def main(argv):
    ap = argparse.ArgumentParser(prog="dream.py")
    ap.add_argument("command", choices=["plan", "start", "finish"])
    ap.add_argument("session_id")
    ap.add_argument("--projects-dir", default=None,
                    help="where to read session transcripts; default: <Claude Code config dir>/projects")
    ap.add_argument("--project", action="append", default=None)
    ap.add_argument("--session", action="append", default=None)
    ap.add_argument("--sandbox", action="store_true", help="do not write the results back to the memory dirs")
    a = ap.parse_args(argv)
    return {"plan": plan_cmd, "start": start_cmd, "finish": finish_cmd}[a.command](a)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
