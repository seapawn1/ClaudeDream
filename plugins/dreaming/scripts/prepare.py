"""Prepare a dream run: find the sessions, leave out dream sessions, route each session to its
memory directory, drop fork copies, render in the cookbook's plain-text format, cut into parts.

  python prepare.py <workdir> [--projects-dir PATH] [--project DIRNAME ...] [--segment-chars N]

Writes <workdir>/transcripts/<project dir>/<session id>.pNNN.txt and <workdir>/manifest.json,
which lists every session found (converted, excluded or skipped, with the reason), its parts, what
de-duplication dropped, and the checks run on the result.
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
import segments as sg  # noqa: E402
import transcripts as tx  # noqa: E402

DREAM_MARKER = "<command-name>/dreaming:"
SEGMENT_CHARS = 120_000


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


def dream_cut(records):
    """Index of the first record where the user invoked one of this plugin's commands, or None.

    Only the user's own messages count (a string, or text blocks), and the marker must open the
    message: a tool result that merely shows the marker (say, reading this file) does not count.
    Everything from that record on belongs to the dream run; what came before is ordinary work.
    """
    for i, o in enumerate(records):
        if o.get("type") != "user" or o.get("isCompactSummary"):
            continue
        c = (o.get("message") or {}).get("content")
        texts = [c] if isinstance(c, str) else [
            b.get("text", "") for b in c or [] if isinstance(b, dict) and b.get("type") == "text"]
        if any(DREAM_MARKER in t[:300] for t in texts):
            return i
    return None


def _measure_files(paths):
    n = 0
    for p in paths:
        recs, _ = tx.read_records(p)
        n += sum(tx.measure(o) for o in recs)
    return n


def transcript_files(projects, only, sessions=None):
    """Every transcript file under the projects dir, listed once when a run starts."""
    files = []
    for pdir in glob.glob(os.path.join(projects, "*")):
        if os.path.isdir(pdir) and (not only or os.path.basename(pdir) in only):
            for f in glob.glob(os.path.join(pdir, "**", "*.jsonl"), recursive=True):
                rel = os.path.relpath(f, pdir).split(os.sep)[0]
                if not sessions or os.path.splitext(rel)[0] in sessions:
                    files.append(f)
    return files


def thread_name(meta):
    return meta.get("agentType") or meta.get("description") or "subagent"


def scan(projects, only, reg_sessions, reg_dirs, ledger, sessions=None):
    """Pass 1: every session found, with its exclusion status and its uuid index."""
    found = []
    for pdir in sorted(glob.glob(os.path.join(projects, "*"))):
        if not os.path.isdir(pdir):
            continue
        name = os.path.basename(pdir)
        if only and name not in only:
            continue
        test_dir = os.path.normcase(os.path.normpath(pdir)) in reg_dirs
        for m in sorted(glob.glob(os.path.join(pdir, "*.jsonl"))):
            if not tx.listed(m):
                continue  # created after the run started
            sid = os.path.splitext(os.path.basename(m))[0]
            if sessions and sid not in sessions:
                continue
            e = {"id": sid, "path": m, "project_dir": name}
            subs = tx.subagent_files(m)
            if test_dir:
                ledger["excluded_sessions"] += _measure_files([m] + subs)
                found.append(dict(e, status="excluded", reason="registered test directory"))
                continue
            records, bad = tx.read_records(m)
            info = tx.session_info(records, m)
            e.update(title=info["title"], cwd=info["cwd"], created=info["created"],
                     updated=info["updated"], bad_lines=bad)
            cut = dream_cut(records)
            if sid in reg_sessions or cut == 0:
                ledger["excluded_sessions"] += sum(tx.measure(o) for o in records) + _measure_files(subs)
                why = "registered dream or test run" if sid in reg_sessions else "dream command session (marker)"
                found.append(dict(e, status="excluded", reason=why))
                continue
            if cut is not None:
                e["_cut"] = cut
                e["dream_cut_at_record"] = cut
                records = records[:cut]
            e["_index"] = sg.uuid_index(sid, records)
            found.append(e)
    return found


def convert(e, owners, out_dir, budget, ledger):
    """Pass 2: one session -> its parts on disk; returns the manifest entry."""
    records, _ = tx.read_records(e["path"])
    info = tx.session_info(records, e["path"])
    cut = e.pop("_cut", None)
    if cut is not None:  # the dream run started in this session: keep only the work before it
        ledger["dream_command"] += sum(tx.measure(o) for o in records[cut:])
        records = records[:cut]
    kept, dropped, first_summary = sg.dedup(e["id"], records, owners, ledger)
    stats = tx.new_stats()
    main_events = [sg.shape(ev, stats) for ev in tx.events(kept, stats, ledger)]
    threads, subs = [], []
    if main_events:
        threads.append((f"=== primary thread {e['id']}: claude-code ===", main_events))
    for sp in tx.subagent_files(e["path"]):
        meta = tx.subagent_meta(sp)
        name = thread_name(meta)
        sub_id = os.path.splitext(os.path.basename(sp))[0]
        srecs, sbad = tx.read_records(sp)
        if str(name).startswith("dreaming:"):
            ledger["excluded_subthreads"] += sum(tx.measure(o) for o in srecs)
            subs.append({"id": sub_id, "agent": name, "status": "excluded", "reason": "dream agent"})
            continue
        sev = [sg.shape(ev, stats) for ev in tx.events(srecs, stats, ledger)]
        subs.append({"id": sub_id, "agent": name, "status": "converted" if sev else "skipped",
                     "events": len(sev), "bad_lines": sbad})
        if sev:
            threads.append((f"=== sub-thread {sub_id}: {name} ===", sev))
    n = 0
    for _, evs in threads:
        for ev in evs:
            ev["_id"] = n
            n += 1
    e.update(subthreads=subs, dedup_dropped=dict(dropped), events=n)
    if not threads:
        reason = "all messages are copies owned by other sessions" if dropped else "no conversation"
        return dict(e, status="skipped", reason=reason, stats=dict(stats))
    if not info["cwd"]:
        return dict(e, status="skipped", reason="no working directory, cannot route", stats=dict(stats))
    mem, rule = routing.memory_dir(info["cwd"])
    e.update(memory_dir=mem, route_rule=rule)
    parts = sg.pack(threads, budget, first_summary)
    e["_ac3"] = sg.check_carried(parts, first_summary)
    base_notes = [
        f"A Claude Code session started in {info['cwd']} (git branch {info['branch']}), "
        f"from {info['created']} to {info['updated']}.",
        "Thinking is not exported. Harness context (system reminders, hook output, tool and skill "
        "listings) is left out. Very long tool results are cut to their head and tail.",
    ]
    if dropped:
        srcs = ", ".join(f"{n} from session {s}" for s, n in dropped.most_common())
        base_notes.append(f"This session was forked: {sum(dropped.values())} copied messages are left out "
                          f"because another session's file holds them ({srcs}).")
    os.makedirs(out_dir, exist_ok=True)
    plist = []
    for k, p in enumerate(parts, 1):
        notes = list(base_notes)
        if len(parts) > 1:
            notes.append(f"This file is part {k} of {len(parts)} of the session; other parts are "
                         "analyzed separately.")
        if p["carried"]:
            notes.append("The first EVENT compact_summary block below is Claude Code's own summary of the "
                         "session before this part, written when the conversation was compacted. It is "
                         "context for this part, not new material: what it describes was analyzed with "
                         "the earlier parts.")
        text = tx.render(info, p["sections"], notes)
        path = os.path.join(out_dir, f"{e['id']}.p{k:03d}.txt")
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)
        ids = [ev["_id"] for _, evs in p["sections"] for ev in evs if "_id" in ev]
        plist.append({"file": path, "chars": len(text), "events": len(ids), "carried_summary": p["carried"],
                      "_ids": ids})
    return dict(e, status="converted", parts=plist, stats=dict(stats))


def check(entries, budget):
    """Checks for PBI-001 acceptance criteria 2, 3 and 5."""
    problems = []
    for e in entries:
        if e["status"] != "converted":
            continue
        ids = [i for p in e["parts"] for i in p["_ids"]]
        if len(ids) != e["events"] or len(set(ids)) != len(ids):
            problems.append(f"{e['id']}: {e['events']} events but {len(ids)} placed ({len(set(ids))} distinct)")
        for p in e["parts"]:
            if p["chars"] > budget + sg.MAX_SUMMARY + 4_000:
                problems.append(f"{p['file']}: {p['chars']} chars over the budget")
    for e in entries:
        for prob in e.pop("_ac3", ()):
            problems.append(f"{e['id']}: {prob}")
    owners_seen = {}
    for e in entries:
        for u in e.get("_rendered_uuids", ()):
            if u in owners_seen and owners_seen[u] != e["id"]:
                problems.append(f"uuid {u} rendered in {owners_seen[u]} and {e['id']}")
            owners_seen[u] = e["id"]
    return problems


def prepare(workdir, projects_dir=None, only=None, budget=SEGMENT_CHARS, sessions=None):
    projects = common.resolve_projects_dir(projects_dir)
    files = transcript_files(projects, only, sessions)
    tx.reset_reads(files)
    reg_sessions, reg_dirs = load_registry()
    ledger = collections.Counter()
    found = scan(projects, only, reg_sessions, reg_dirs, ledger, sessions)
    live = [e for e in found if "_index" in e]
    owners = sg.owner_map([(e["id"], e.get("created"), e["_index"]) for e in live])
    entries = []
    for e in found:
        idx = e.pop("_index", None)
        if idx is None:
            entries.append(e)
            continue
        e = convert(e, owners, os.path.join(workdir, "transcripts", e["project_dir"]), budget, ledger)
        e["_rendered_uuids"] = {u for u, _, _ in idx if owners.get(u) == e["id"]} if e["status"] == "converted" else set()
        entries.append(e)
    # number events so every placement can be checked
    problems = check(entries, budget)
    for e in entries:
        e.pop("_rendered_uuids", None)
        for p in e.get("parts", ()):
            p.pop("_ids", None)
    counts = collections.Counter(e["status"] for e in entries)
    reasons = collections.Counter(f"{e['status']}: {e.get('reason')}" for e in entries if e["status"] != "converted")
    stats = collections.Counter()
    for e in entries:
        stats.update(e.get("stats") or {})
    conv = [e for e in entries if e["status"] == "converted"]
    total_in, n_files = _measure_files(files), len(files)  # independent of how scan grouped the files
    booked = sum(ledger.values())
    if total_in != booked:
        problems.append(f"reconciliation: {total_in} characters in the files, {booked} booked")
    manifest_ledger = {
        "input_chars": total_in, "input_files": n_files, "booked_chars": booked,
        "reconciled": total_in == booked, "buckets": dict(ledger.most_common()),
        "of_rendered_cut_by_truncation": stats.get("truncated_chars", 0),
        "thinking_chars_not_exported": stats.get("thinking_chars", 0),
    }
    manifest = {
        "projects_dir": projects, "segment_chars": budget, "sessions_found": len(entries),
        "counts": dict(counts), "reasons": dict(reasons),
        "unknown_record_types": {k: v for k, v in stats.items() if k.startswith("unknown:")},
        "dedup_dropped_records": sum(sum(e.get("dedup_dropped", {}).values()) for e in entries),
        "truncated_results": stats.get("truncated_results", 0), "truncated_chars": stats.get("truncated_chars", 0),
        "parts": sum(len(e["parts"]) for e in conv), "rendered_chars": sum(p["chars"] for e in conv for p in e["parts"]),
        "memory_dirs": dict(collections.Counter(e["memory_dir"] for e in conv)),
        "ledger": manifest_ledger,
        "checks": {"passed": not problems, "problems": problems[:50]},
        "sessions": entries,
    }
    os.makedirs(workdir, exist_ok=True)
    with open(os.path.join(workdir, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    return manifest


def main(argv):
    ap = argparse.ArgumentParser(prog="prepare.py")
    ap.add_argument("workdir")
    ap.add_argument("--projects-dir", default=None)
    ap.add_argument("--project", action="append", default=None, help="only this project dir (repeatable)")
    ap.add_argument("--session", action="append", default=None, help="only this session id (repeatable)")
    ap.add_argument("--segment-chars", type=int, default=SEGMENT_CHARS)
    a = ap.parse_args(argv)
    m = prepare(a.workdir, a.projects_dir, set(a.project) if a.project else None, a.segment_chars,
                set(a.session) if a.session else None)
    print(f"projects_dir: {m['projects_dir']}")
    print(f"sessions found: {m['sessions_found']}  {m['counts']}")
    for k, v in sorted(m["reasons"].items()):
        print(f"  {v:4d}  {k}")
    print(f"fork copies dropped: {m['dedup_dropped_records']} records")
    print(f"parts: {m['parts']}  rendered: {m['rendered_chars'] / 1e6:.1f} M chars  "
          f"truncated tool results: {m['truncated_results']} ({m['truncated_chars'] / 1e6:.1f} M chars)")
    print(f"memory dirs: {len(m['memory_dirs'])}")
    lg = m["ledger"]
    print(f"ledger: {lg['input_chars']:,} chars in {lg['input_files']} files, {lg['booked_chars']:,} booked, "
          f"reconciled={lg['reconciled']}")
    for k, v in lg["buckets"].items():
        if v:
            print(f"  {v:>12,}  {k}")
    print(f"  (of rendered, {lg['of_rendered_cut_by_truncation']:,} cut by truncation; "
          f"thinking not exported: {lg['thinking_chars_not_exported']:,})")
    if m["unknown_record_types"]:
        print(f"unknown record types: {m['unknown_record_types']}")
    print(f"checks: {'passed' if m['checks']['passed'] else 'FAILED'}")
    for p in m["checks"]["problems"]:
        print(f"  {p}")
    return 0 if m["checks"]["passed"] else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
