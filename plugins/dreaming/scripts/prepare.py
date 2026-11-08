"""Prepare a dream run: find the sessions, leave out dream sessions, route each session to its
memory directory, and render it in the cookbook's plain-text format.

  python prepare.py <workdir> [--projects-dir PATH] [--project DIRNAME ...]

Writes <workdir>/transcripts/<project dir>/<session id>.txt and <workdir>/manifest.json, which
lists every session found: converted, excluded (a dream session or a registered test) or
skipped (no conversation), each with its reason.
"""
import argparse
import collections
import glob
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402
import routing  # noqa: E402
import transcripts as tx  # noqa: E402

DREAM_MARKER = "<command-name>/dreaming:"


def load_registry():
    sessions, dirs = set(), set()
    if os.path.exists(common.REGISTRY):
        with open(common.REGISTRY, encoding="utf-8") as f:
            for line in f:
                try:
                    e = json.loads(line)
                except ValueError:
                    continue
                if e.get("session_id"):
                    sessions.add(e["session_id"])
                if e.get("dir"):
                    dirs.add(os.path.normcase(os.path.normpath(e["dir"])))
    return sessions, dirs


def is_dream_session(records):
    """A session where the user invoked one of this plugin's commands.

    Only the user's own messages count (a string, or text blocks), and the marker must open the
    message: a tool result that merely shows the marker (say, reading this file) does not count.
    """
    for o in records:
        if o.get("type") != "user" or o.get("isCompactSummary"):
            continue
        c = (o.get("message") or {}).get("content")
        texts = [c] if isinstance(c, str) else [
            b.get("text", "") for b in c or [] if isinstance(b, dict) and b.get("type") == "text"]
        if any(DREAM_MARKER in t[:300] for t in texts):
            return True
    return False


def thread_name(meta):
    return meta.get("agentType") or meta.get("description") or "subagent"


def convert_session(path, out_dir, reg_sessions):
    """Render one session and its sub-threads; return its manifest entry."""
    records, bad = tx.read_records(path)
    info = tx.session_info(records, path)
    entry = {"id": info["id"], "path": path, "title": info["title"], "cwd": info["cwd"],
             "created": info["created"], "updated": info["updated"], "bad_lines": bad}
    if info["id"] in reg_sessions:
        return dict(entry, status="excluded", reason="registered dream or test run")
    if is_dream_session(records):
        return dict(entry, status="excluded", reason="dream command session (marker)")
    stats = tx.new_stats()
    main_events = tx.events(records, stats)
    threads, subs = [], []
    if main_events:
        threads.append((f"=== primary thread {info['id']}: claude-code ===", main_events))
    for sp in tx.subagent_files(path):
        meta = tx.subagent_meta(sp)
        name = thread_name(meta)
        sid = os.path.splitext(os.path.basename(sp))[0]
        if str(name).startswith("dreaming:"):
            subs.append({"id": sid, "agent": name, "status": "excluded", "reason": "dream agent"})
            continue
        srecs, sbad = tx.read_records(sp)
        sev = tx.events(srecs, stats)
        subs.append({"id": sid, "agent": name, "status": "converted" if sev else "skipped",
                     "events": len(sev), "bad_lines": sbad})
        if sev:
            threads.append((f"=== sub-thread {sid}: {name} ===", sev))
    entry["subthreads"] = subs
    entry["stats"] = dict(stats)
    if not threads:
        return dict(entry, status="skipped", reason="no conversation")
    mem, rule = routing.memory_dir(info["cwd"]) if info["cwd"] else (None, "no cwd recorded")
    entry.update(memory_dir=mem, route_rule=rule)
    if not mem:
        return dict(entry, status="skipped", reason="no working directory, cannot route")
    notes = [
        f"A Claude Code session started in {info['cwd']} (git branch {info['branch']}), "
        f"from {info['created']} to {info['updated']}.",
        "Thinking is not exported. Harness context (system reminders, hook output, tool and skill "
        "listings) is left out.",
    ]
    text = tx.render(info, threads, notes)
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, info["id"] + ".txt")
    with open(out, "w", encoding="utf-8") as f:
        f.write(text)
    n_events = sum(len(evs) for _, evs in threads)
    return dict(entry, status="converted", output=out, events=n_events, bytes=len(text.encode("utf-8")))


def prepare(workdir, projects_dir=None, only=None):
    projects = common.resolve_projects_dir(projects_dir)
    reg_sessions, reg_dirs = load_registry()
    entries = []
    for pdir in sorted(glob.glob(os.path.join(projects, "*"))):
        if not os.path.isdir(pdir):
            continue
        name = os.path.basename(pdir)
        if only and name not in only:
            continue
        mains = sorted(glob.glob(os.path.join(pdir, "*.jsonl")))
        if os.path.normcase(os.path.normpath(pdir)) in reg_dirs:
            entries += [{"id": os.path.splitext(os.path.basename(m))[0], "path": m, "project_dir": name,
                         "status": "excluded", "reason": "registered test directory"} for m in mains]
            continue
        for m in mains:
            e = convert_session(m, os.path.join(workdir, "transcripts", name), reg_sessions)
            e["project_dir"] = name
            entries.append(e)
    counts = collections.Counter(e["status"] for e in entries)
    reasons = collections.Counter(f"{e['status']}: {e.get('reason')}" for e in entries if e["status"] != "converted")
    unknown = collections.Counter()
    for e in entries:
        for k, v in (e.get("stats") or {}).items():
            if k.startswith("unknown:"):
                unknown[k] += v
    by_memory = collections.Counter(e["memory_dir"] for e in entries if e["status"] == "converted")
    manifest = {"projects_dir": projects, "sessions_found": len(entries), "counts": dict(counts),
                "reasons": dict(reasons), "unknown_record_types": dict(unknown),
                "memory_dirs": dict(by_memory), "sessions": entries}
    os.makedirs(workdir, exist_ok=True)
    with open(os.path.join(workdir, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    return manifest


def main(argv):
    ap = argparse.ArgumentParser(prog="prepare.py")
    ap.add_argument("workdir")
    ap.add_argument("--projects-dir", default=None)
    ap.add_argument("--project", action="append", default=None, help="only this project dir (repeatable)")
    a = ap.parse_args(argv)
    m = prepare(a.workdir, a.projects_dir, set(a.project) if a.project else None)
    print(f"projects_dir: {m['projects_dir']}")
    print(f"sessions found: {m['sessions_found']}  {m['counts']}")
    for k, v in sorted(m["reasons"].items()):
        print(f"  {v:4d}  {k}")
    print(f"memory dirs: {len(m['memory_dirs'])}")
    for k, v in sorted(m["memory_dirs"].items(), key=lambda x: -x[1]):
        print(f"  {v:4d}  {k}")
    if m["unknown_record_types"]:
        print(f"unknown record types: {m['unknown_record_types']}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
