"""ClaudeDream health check (PBI-004), run by the lead of /dreaming:check. Reports only.

  python check.py start  <session_id> [--projects-dir PATH] [--project DIR]... [--session ID]... [--against RUN_ID|none]
  python check.py finish <session_id>
  python check.py compare <before_run_id> <after_run_id>

start: render the sessions (prepare.py) as evidence; copy every memory directory a dream would write
to into the run's work dir (the checkers read only that snapshot); list its entries -- one memory per
file; MEMORY.md and MOVED TO stubs are not entries -- and dump each project's git log; generate the
workflow (one dreaming:checker per batch of entries); turn the guard on.
finish: take the verdicts from the workflow's journal, check every piece of evidence the checkers
cite (the quoted text must be in the cited file), compare with an earlier check, write the report,
delete the rendered transcripts. No memory file is changed.
"""
import argparse
import collections
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402
import dream  # noqa: E402
import memcheck  # noqa: E402
import prepare as prep  # noqa: E402
import routing  # noqa: E402
import writeback as wb  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
BATCH = 8
VERDICTS = {"valid": "有效", "possibly_stale": "可能过时", "wrong": "错误", "conflict": "CONFLICT", "unknown": "无法判断"}
STALE = ("possibly_stale", "wrong")
# PBI-004 pass line (2.2 item 4, PO 11-09, rule B): only the old entries the dream edited or moved
# count; the old entries it left unchanged are the same run's control group, and any change in their
# verdicts is noise. Passed when the changed entries' drop in stale-or-wrong (per entry) is clearly
# larger than the unchanged entries' fluctuation (share of them that flipped between stale-or-wrong and
# the rest). How much larger the PO fixes in 2.2 after the noise is measured on the desktop (item 9);
# until then B_MIN_DIFF is None and the comparison gives the numbers without a verdict.
B_MIN_DIFF = None
fwd = dream.fwd


# ---------- entries ----------

def list_entries(snapshot):
    """The memory files of a directory: entries (one memory each) and MOVED TO stubs with their targets."""
    entries, stubs = [], {}
    for root, _, names in os.walk(snapshot):
        for n in sorted(names):
            if not n.endswith(".md"):
                continue
            rel = os.path.relpath(os.path.join(root, n), snapshot).replace(os.sep, "/")
            if rel == "MEMORY.md":
                continue
            text = wb.read(snapshot, rel)
            m = wb.STUB_RE.match(text.strip())
            if m:
                stubs[rel] = m.group(1)
                continue
            fm = memcheck.frontmatter(text) or {}
            meta = fm.get("metadata") if isinstance(fm.get("metadata"), dict) else {}
            entries.append({"file": rel, "sha": wb._sha(os.path.join(snapshot, rel)), "name": fm.get("name"),
                            "description": fm.get("description"), "type": meta.get("type")})
    resolved = {}
    names = {e["file"] for e in entries}
    for rel, slug in stubs.items():
        target, seen = wb.slug_file(snapshot, slug), {rel}
        while target in stubs and target not in seen:  # a stub pointing at another stub
            seen.add(target)
            target = wb.slug_file(snapshot, stubs[target])
        resolved[rel] = target if target in names else None
    return sorted(entries, key=lambda e: e["file"]), resolved


def git_log(root, out):
    try:
        r = subprocess.run(["git", "-C", root, "log", "--branches", "--date=short", "--pretty=format:%h %ad %d %s", "-n", "500"],
                           capture_output=True, timeout=60)
    except (OSError, subprocess.TimeoutExpired):
        return False
    if r.returncode != 0:
        return False
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write(f"# git log of {fwd(root)} (all local branches, newest first: hash, date, branch, subject)\n")
        f.write(r.stdout.decode("utf-8", errors="replace") + "\n")
    return True


# ---------- start ----------

def memory_sources(spec):
    """--memory-from RUN_ID[:base|:stage]: check another copy of the memory instead of the real dirs --
    a dream run's staged result (stage, the default) or its starting copy (base), or an earlier check's
    snapshot. Returns {normcase(memory dir): (memory dir, copy to check)}."""
    rid, _, side = spec.partition(":")
    with open(os.path.join(common.RUNS_DIR, rid, "run.json"), encoding="utf-8") as f:
        run = json.load(f)
    if run.get("kind") == "check":
        return {os.path.normcase(g["memory_dir"]): (g["memory_dir"], g["snapshot"]) for g in run["groups"]}
    side = side or "stage"
    if side not in ("base", "stage"):
        raise ValueError(f"--memory-from {spec}: the side is base or stage")
    return {os.path.normcase(g["memory_dir"]): (g["memory_dir"], g[side]) for g in run["groups"]}


def start_cmd(a):
    started = time.time()
    old = common.active_state(a.session_id)
    if old:
        print(f"note: an unfinished run in this session is abandoned: {old['workdir']}")
    sources = memory_sources(a.memory_from) if a.memory_from else None
    run_id, workdir = common.new_run("check", a.session_id)
    m = prep.prepare(workdir, a.projects_dir, set(a.project) if a.project else None,
                     prep.SEGMENT_CHARS, set(a.session) if a.session else None)
    print(f"run: {run_id}\nworkdir: {workdir}\nsessions found: {m['sessions_found']} {m['counts']}")
    if not m["checks"]["passed"]:
        print("prepare checks FAILED; nothing started:")
        for p in m["checks"]["problems"]:
            print("  " + p)
        shutil.rmtree(os.path.join(workdir, "transcripts"), ignore_errors=True)
        return 1
    found = {}
    for e in m["sessions"]:
        if e["status"] != "converted":
            continue
        g = found.setdefault(e["memory_dir"], {"roots": set(), "project_dirs": set()})
        g["roots"].add(routing.git_root(e["cwd"]) or e["cwd"])
        wt = re.match(r"(.*?[\\/]\.claude[\\/]worktrees[\\/][^\\/]+)", e["cwd"] or "")
        if wt:  # the session worked in a worktree: its files are the project's current state too
            g["roots"].add(wt.group(1))
        g["project_dirs"].add(e["project_dir"])
    today = time.strftime("%Y-%m-%d")
    groups, batches = [], []
    for mem, g in sorted(found.items()):
        if any(x in os.path.normpath(mem).split(os.sep) for x in dream.PROTECTED):
            continue
        source = mem
        if sources is not None:
            if os.path.normcase(mem) not in sources:
                continue  # checking another run's copies: only the dirs it has
            source = sources[os.path.normcase(mem)][1]
        if not os.path.isdir(source):
            continue  # no memory yet: nothing to check
        key = routing.sanitize(os.path.normpath(mem))[-120:]
        snapshot = os.path.join(workdir, "snapshot", key)
        shutil.copytree(source, snapshot)
        entries, stubs = list_entries(snapshot)
        if not entries:
            continue
        context = os.path.join(workdir, "context", key)
        os.makedirs(context)
        roots = sorted(r for r in g["roots"] if r and os.path.isdir(r))
        for i, r in enumerate(roots):
            git_log(r, os.path.join(context, f"git-log-{i + 1}.txt"))
        transcripts = sorted(fwd(os.path.join(workdir, "transcripts", p)) for p in g["project_dirs"]
                             if os.path.isdir(os.path.join(workdir, "transcripts", p)))
        files = [e["file"] for e in entries]
        for n in range(0, len(files), BATCH):
            batches.append({"id": f"{key}#{n // BATCH + 1}", "key": key, "snapshot": fwd(snapshot),
                            "files": files[n:n + BATCH], "roots": [fwd(r) for r in roots],
                            "transcripts": transcripts, "context": fwd(context), "today": today})
        groups.append({"key": key, "memory_dir": mem, "source": fwd(source), "snapshot": fwd(snapshot), "roots": roots,
                       "project_dirs": sorted(g["project_dirs"]), "entries": entries, "stubs": stubs,
                       "format": memcheck.check_dir(snapshot)})
    run = {"run_id": run_id, "kind": "check", "session_id": a.session_id, "started_at": started,
           "workdir": workdir, "projects_dir": m["projects_dir"], "against": a.against, "today": today,
           "memory_from": a.memory_from,
           "groups": groups, "batches": batches}
    wb.save(os.path.join(workdir, "run.json"), run)
    if not batches:
        print("no memory files to check")
        shutil.rmtree(os.path.join(workdir, "transcripts"), ignore_errors=True)
        return 1
    with open(os.path.join(HERE, "check_workflow.tmpl.js"), encoding="utf-8") as f:
        script = f.read().replace("__PLAN__", json.dumps({"batches": batches}, ensure_ascii=False))
    wf_path = os.path.join(workdir, "check-run.js")
    with open(wf_path, "w", encoding="utf-8", newline="\n") as f:
        f.write(script)
    common.activate(a.session_id, workdir, [workdir], dream.PLUGIN_ROOT)
    print(f"memory dirs: {len(groups)}; entries: {sum(len(g['entries']) for g in groups)}; checkers: {len(batches)}")
    for g in groups:
        print(f"  {len(g['entries']):4d} entries  {g['memory_dir']}")
    print(f"WORKFLOW_SCRIPT: {fwd(wf_path)}")
    return 0


# ---------- finish: verdicts and evidence ----------

def _norm(s):
    return re.sub(r"\s+", " ", s).strip()


def resolve_source(src, bases):
    src = str(src or "").strip().strip("`'\"")
    src = re.sub(r":\d+(-\d+)?$", "", src)  # path:line
    cands = [src] if os.path.isabs(src) else []
    cands += [os.path.join(b, src) for b in bases]
    for c in cands:
        if os.path.isfile(c):
            return os.path.abspath(c)
    return None


_TEXT = {}


def _text(path):
    if path not in _TEXT:
        with open(path, encoding="utf-8", errors="replace") as f:
            _TEXT[path] = _norm(f.read(8_000_000))
    return _TEXT[path]


def verify_evidence(ev, bases, own):
    """One piece of cited evidence: is the quoted text in the file it names?"""
    src, quote = (ev or {}).get("source"), _norm(str((ev or {}).get("quote") or ""))
    out = {"source": src, "quote": quote[:300], "verified": False}
    path = resolve_source(src, bases)
    if not path:
        out["why"] = "source file not found"
        return out
    out["path"] = fwd(path)
    if os.path.normcase(path) in own:
        out["why"] = "the memory file under check is not evidence for itself"
        return out
    pieces = [p.strip() for p in re.split(r"\.\.\.|…", quote) if p.strip()]
    if sum(len(p) for p in pieces) < 8:
        out["why"] = "quote too short to check"
        return out
    text = _text(path)
    if all(p in text for p in pieces):
        out["verified"] = True
    else:
        out["why"] = "quote not found in the file"
    return out


def judge(raw, bases, own):
    """A checker's verdict on one file, with the script's rules applied: no verified evidence, no verdict
    (it counts as unknown); `wrong` needs a correction with value, date and source."""
    v = raw.get("verdict") if isinstance(raw, dict) else None
    out = {"verdict_reported": v, "reason": (raw or {}).get("reason"), "stale_note": (raw or {}).get("stale_note"),
           "correction": (raw or {}).get("correction")}
    out["evidence"] = [verify_evidence(e, bases, own) for e in ((raw or {}).get("evidence") or [])[:10]]
    if v not in VERDICTS:
        out.update(verdict="unknown", adjusted="no valid verdict returned")
    elif v != "unknown" and not any(e["verified"] for e in out["evidence"]):
        out.update(verdict="unknown", adjusted="evidence not verified")
    elif v == "wrong" and not all(str((out["correction"] or {}).get(k) or "").strip() for k in ("new_value", "date", "source")):
        out.update(verdict="possibly_stale", adjusted="wrong without a complete correction (new value, date, source)")
    else:
        out["verdict"] = v
    return out


def session_of(path, workdir, sessions):
    t = os.path.normcase(os.path.join(workdir, "transcripts"))
    if not os.path.normcase(path).startswith(t):
        return None
    sid = os.path.basename(path).split(".p")[0]
    s = sessions.get(sid, {})
    return {"session": sid, "part": os.path.basename(path), "created": s.get("created"), "title": s.get("title"),
            "project_dir": s.get("project_dir")}


def finish_cmd(a):
    state = common.active_state(a.session_id)
    if not state:
        print("no active check run for this session")
        return 2
    workdir = state["workdir"]
    with open(os.path.join(workdir, "run.json"), encoding="utf-8") as f:
        run = json.load(f)
    if run.get("kind") != "check":
        print("the active run in this session is not a health check")
        return 2
    common.deactivate(a.session_id)
    since = run.get("started_at")
    results = dream.journal_results(a.session_id, since)
    log = dream.load_hooklog(workdir)
    _, writes = dream.agent_activity(a.session_id, since)
    hooks = dream.hook_evidence(log, workdir, writes)
    with open(os.path.join(workdir, "manifest.json"), encoding="utf-8") as f:
        sessions = {e["id"]: e for e in json.load(f)["sessions"]}
    by_key = {g["key"]: g for g in run["groups"]}
    verdicts = collections.defaultdict(dict)
    failed = []
    for b in run["batches"]:
        g = by_key[b["key"]]
        res = results.get(f"check {b['id']}")
        got = {}
        for r in (res or {}).get("entries", []) if isinstance(res, dict) else []:
            if isinstance(r, dict) and r.get("file") in b["files"] and r["file"] not in got:
                got[r["file"]] = r
        if not res:
            failed.append(b["id"])
        bases = list(g["roots"]) + [g["snapshot"], workdir]
        for f in b["files"]:
            if f not in got:
                verdicts[g["key"]][f] = {"checked": False, "verdict": None}
                continue
            own = {os.path.normcase(os.path.abspath(os.path.join(g["snapshot"], f))),
                   os.path.normcase(os.path.abspath(os.path.join(g["memory_dir"], f)))}
            j = judge(got[f], bases, own)
            for e in j["evidence"]:
                if e.get("path"):
                    s = session_of(e["path"], workdir, sessions)
                    if s:
                        e["session"] = s
            verdicts[g["key"]][f] = dict(j, checked=True)
    report = {"run_id": run["run_id"], "kind": "check", "today": run["today"], "projects_dir": run["projects_dir"],
              "memory_from": run.get("memory_from"),
              "hook_log": hooks, "failed_batches": failed, "groups": []}
    for g in run["groups"]:
        rows = []
        for e in g["entries"]:
            rows.append(dict(e, **verdicts[g["key"]].get(e["file"], {"checked": False, "verdict": None})))
        counts = collections.Counter(r["verdict"] if r["checked"] else "not_checked" for r in rows)
        report["groups"].append({
            "key": g["key"], "memory_dir": g["memory_dir"], "roots": g["roots"], "entries": rows, "stubs": g["stubs"],
            "counts": dict(counts), "stale": sum(counts[v] for v in STALE),
            "evidence": {"cited": sum(len(r.get("evidence", [])) for r in rows),
                         "verified": sum(1 for r in rows for x in r.get("evidence", []) if x["verified"])},
            "format": {"index": g["format"]["index"], "stats": g["format"]["stats"],
                       "files_with_problems": g["format"]["files"]},
        })
    report["complete"] = not failed and hooks["ok"] and writes == 0
    against = pick_against(run, a.against if a.against is not None else run.get("against"))
    if against:
        with open(os.path.join(common.RUNS_DIR, against, "check-report.json"), encoding="utf-8") as f:
            report["comparison"] = compare(json.load(f), report)
    wb.save(os.path.join(workdir, "check-report.json"), report)
    with open(os.path.join(workdir, "check-report.md"), "w", encoding="utf-8", newline="\n") as f:
        f.write(render_md(report))
    shutil.rmtree(os.path.join(workdir, "transcripts"), ignore_errors=True)  # rendered copies may hold secrets
    print_summary(report, hooks, writes, workdir)
    return 0 if report["complete"] else 1


# ---------- comparison ----------

def pick_against(run, against):
    """The earlier check to compare with: the one named, or the latest finished check of the same
    memory directories; `none` for no comparison."""
    if against == "none":
        return None
    if against:
        return against if os.path.exists(os.path.join(common.RUNS_DIR, against, "check-report.json")) else None
    mine = {os.path.normcase(g["memory_dir"]) for g in run["groups"]}
    for p in sorted(glob.glob(os.path.join(common.RUNS_DIR, "check-*", "check-report.json")), reverse=True):
        rid = os.path.basename(os.path.dirname(p))
        if rid >= run["run_id"]:
            continue
        with open(p, encoding="utf-8") as f:
            theirs = {os.path.normcase(g["memory_dir"]) for g in json.load(f)["groups"]}
        if mine & theirs:
            return rid
    return None


def compare(before, after):
    """PBI-004: the entries that existed before, each at its place after (same file, or where its
    MOVED TO stub points); the pass line; agreement on unchanged entries (the noise); new entries apart."""
    out = {"before_run": before["run_id"], "after_run": after["run_id"], "b_min_diff": B_MIN_DIFF, "groups": []}
    tot = collections.Counter()
    a_groups = {os.path.normcase(g["memory_dir"]): g for g in after["groups"]}
    for bg in before["groups"]:
        ag = a_groups.get(os.path.normcase(bg["memory_dir"]))
        if not ag:
            continue
        a_entries = {e["file"]: e for e in ag["entries"]}
        rows, lost = [], []
        for e in bg["entries"]:
            if e["file"] in a_entries:
                loc = e["file"]
                how = "unchanged" if a_entries[loc]["sha"] == e["sha"] else "edited"
            elif e["file"] in ag["stubs"]:
                loc = ag["stubs"][e["file"]]
                how = "moved" if loc in a_entries else None
            else:
                loc, how = None, None
            if how is None:
                lost.append(e["file"])
                continue
            a = a_entries[loc]
            rows.append({"file": e["file"], "now": loc, "how": how, "before": e["verdict"] if e["checked"] else None,
                         "after": a["verdict"] if a["checked"] else None})
        both = [r for r in rows if r["before"] and r["after"]]
        unchanged = [r for r in both if r["how"] == "unchanged"]
        changed = [r for r in both if r["how"] != "unchanged"]
        before_files = {e["file"] for e in bg["entries"]}
        new = [e for e in ag["entries"] if e["file"] not in before_files]
        new_checked = [e for e in new if e["checked"]]
        c = {
            "compared": len(both), "not_checked_in_one_run": len(rows) - len(both), "lost": lost,
            "before_stale": sum(1 for r in both if r["before"] in STALE),
            "after_stale": sum(1 for r in both if r["after"] in STALE),
            "unchanged": len(unchanged), "unchanged_same_verdict": sum(1 for r in unchanged if r["before"] == r["after"]),
            "unchanged_stale_before": sum(1 for r in unchanged if r["before"] in STALE),
            "unchanged_stale_after": sum(1 for r in unchanged if r["after"] in STALE),
            "unchanged_flips": sum(1 for r in unchanged if (r["before"] in STALE) != (r["after"] in STALE)),
            "changed": len(changed), "changed_stale_before": sum(1 for r in changed if r["before"] in STALE),
            "changed_stale_after": sum(1 for r in changed if r["after"] in STALE),
            "new_entries": len(new), "new_checked": len(new_checked),
            "new_stale": sum(1 for e in new_checked if e["verdict"] in STALE),
        }
        tot.update({k: v for k, v in c.items() if isinstance(v, int)})
        tot["lost"] += len(lost)
        out["groups"].append(dict(c, memory_dir=bg["memory_dir"], rows=rows,
                                  changed_verdicts=[r for r in unchanged if r["before"] != r["after"]]))
    tot = dict(tot)
    n_ch, n_un = tot.get("changed", 0), tot.get("unchanged", 0)
    tot["unchanged_agreement"] = round(tot["unchanged_same_verdict"] / n_un, 3) if n_un else None
    tot["changed_drop_rate"] = (round((tot["changed_stale_before"] - tot["changed_stale_after"]) / n_ch, 3)
                                if n_ch else None)
    tot["unchanged_flip_rate"] = round(tot["unchanged_flips"] / n_un, 3) if n_un else None
    tot["unchanged_net_drop_rate"] = (round((tot["unchanged_stale_before"] - tot["unchanged_stale_after"]) / n_un, 3)
                                      if n_un else None)
    tot["b_diff"] = (round(tot["changed_drop_rate"] - tot["unchanged_flip_rate"], 3)
                     if n_ch and n_un else None)
    tot["passed"] = None if B_MIN_DIFF is None or tot["b_diff"] is None else tot["b_diff"] > B_MIN_DIFF
    out["total"] = tot
    return out


def compare_cmd(a):
    reps = []
    for rid in (a.before, a.after):
        with open(os.path.join(common.RUNS_DIR, rid, "check-report.json"), encoding="utf-8") as f:
            reps.append(json.load(f))
    c = compare(*reps)
    wb.save(os.path.join(common.RUNS_DIR, a.after, f"compare-{a.before}.json"), c)
    print_comparison(c)
    return 0


# ---------- output ----------

def print_comparison(c):
    t = c["total"]
    verdict = {None: "no verdict yet (threshold not fixed, or no changed or no unchanged entries)",
               True: "PASSED", False: "not passed"}[t["passed"]]
    print(f"compared with {c['before_run']}: {t.get('compared', 0)} old entries checked in both runs")
    print(f"  changed by the dream (edited or moved): {t.get('changed', 0)}; stale or wrong "
          f"{t.get('changed_stale_before', 0)} -> {t.get('changed_stale_after', 0)}; drop rate {t['changed_drop_rate']}")
    print(f"  unchanged (control): {t.get('unchanged', 0)}; stale or wrong "
          f"{t.get('unchanged_stale_before', 0)} -> {t.get('unchanged_stale_after', 0)}; flipped {t.get('unchanged_flips', 0)} "
          f"(flip rate {t['unchanged_flip_rate']}); same verdict {t.get('unchanged_same_verdict', 0)} (agreement {t['unchanged_agreement']})")
    print(f"  pass line B: drop rate - flip rate = {t['b_diff']}, must exceed {c['b_min_diff']}: {verdict}")
    print(f"  all old entries (old rule, void): stale or wrong {t.get('before_stale', 0)} -> {t.get('after_stale', 0)}")
    print(f"  new entries: {t.get('new_entries', 0)}, checked {t.get('new_checked', 0)}, stale or wrong {t.get('new_stale', 0)}")
    lost = [f"{g['memory_dir']}: {x}" for g in c["groups"] for x in g["lost"]]
    print(f"  entries with no whereabouts: {len(lost)}" + ("".join(f"\n    {x}" for x in lost[:20])))


def print_summary(report, hooks, writes, workdir):
    print(f"check {report['run_id']}: {'complete' if report['complete'] else 'INCOMPLETE'}"
          f"{'; failed batches: ' + ', '.join(report['failed_batches']) if report['failed_batches'] else ''}")
    print(f"hook log: {hooks['calls']} calls, lead ran only plugin scripts={hooks['lead_ran_only_plugin_scripts']}, "
          f"blocked agent shell={hooks['agent_shell_attempts_blocked']}, blocked network/MCP={hooks['network_or_mcp_attempts_blocked']}, "
          f"agent write calls={writes}")
    for g in report["groups"]:
        c = g["counts"]
        # English on stdout: the lead's shell may decode the output in a legacy code page (GBK)
        print(f"  {g['memory_dir']}: " + ", ".join(f"{k} {v}" for k, v in sorted(c.items()))
              + f"; evidence verified {g['evidence']['verified']}/{g['evidence']['cited']}")
    if "comparison" in report:
        print_comparison(report["comparison"])
    print(f"report: {fwd(os.path.join(workdir, 'check-report.md'))}")


def _cell(s, n=300):
    return str(s or "").replace("|", "\\|").replace("\n", " ")[:n]


def render_md(report):
    L = [f"# 体检报告 {report['run_id']}", "",
         f"日期 {report['today']}。只出报告，没有改任何记忆文件。结论经脚本复核：引用的原文不在所引文件里的证据不算；"
         "没有核实得了的证据，结论记为“无法判断”；“错误”缺新值、日期或出处的，记为“可能过时”。"
         "引文核对只证明引文确实在所引文件里，不证明 checker 的推理对。"
         + (f"检查的不是真实记忆目录，而是 {report['memory_from']} 里的副本。" if report.get("memory_from") else ""), ""]
    if "comparison" in report:
        c, t = report["comparison"], report["comparison"]["total"]
        L += ["## 与上次体检对比", "",
              f"上次：{c['before_run']}。两次都检查到的老条目 {t.get('compared', 0)} 条。",
              "",
              "| 老条目 | 条数 | “可能过时”加“错误”（上次 → 这次） | 比例 |",
              "| --- | --- | --- | --- |",
              f"| 改过或移走的 | {t.get('changed', 0)} | {t.get('changed_stale_before', 0)} → {t.get('changed_stale_after', 0)} "
              f"| 下降比例 {t['changed_drop_rate']}（每条平均） |",
              f"| 没改过的（对照） | {t.get('unchanged', 0)} | {t.get('unchanged_stale_before', 0)} → {t.get('unchanged_stale_after', 0)} "
              f"| 波动比例 {t['unchanged_flip_rate']}（在两类之间翻转的 {t.get('unchanged_flips', 0)} 条）；结论完全相同的占 {t['unchanged_agreement']} |",
              "",
              f"及格线 B（2.2 PBI-004 第 4 条）：下降比例减波动比例 = {t['b_diff']}，要大于 {c['b_min_diff']}："
              + {None: "未判（门槛待 PO 定，或缺改过的、没改过的条目）", True: "通过", False: "未通过"}[t["passed"]] + "。",
              f"新增条目 {t.get('new_entries', 0)} 条，其中可能过时或错误 {t.get('new_stale', 0)} 条（单独报告，不设及格线）。"
              f"全部老条目合计 {t.get('before_stale', 0)} → {t.get('after_stale', 0)}（原第 2 条的口径，已作废，仅供参考）。",
              f"找不到下落的条目：{t.get('lost', 0)} 条。", ""]
        for g in c["groups"]:
            for x in g["lost"]:
                L.append(f"- 找不到下落：{g['memory_dir']} / {x}")
        L.append("")
    for g in report["groups"]:
        L += [f"## {g['memory_dir']}", "",
              "结论：" + "，".join(f"{VERDICTS.get(k, '未检查')} {v}" for k, v in sorted(g["counts"].items()))
              + f"。证据核实 {g['evidence']['verified']}/{g['evidence']['cited']}。"
              + f"索引 {g['format']['stats'].get('lines')} 行、{g['format']['stats'].get('bytes')} 字节"
              + (f"；索引问题：{'；'.join(g['format']['index'][:5])}" if g["format"]["index"] else "") + "。", "",
              "| 文件 | 结论 | 理由 | 证据 | 过时说明草稿 |", "| --- | --- | --- | --- | --- |"]
        for r in g["entries"]:
            if not r["checked"]:
                L.append(f"| {r['file']} | 未检查 |  |  |  |")
                continue
            v = VERDICTS[r["verdict"]] + (f"（agent 报 {r['verdict_reported']}，{r['adjusted']}）" if r.get("adjusted") else "")
            ev = "<br>".join(("✓ " if x["verified"] else "✗ ") + _cell(
                (x["session"]["session"][:8] + " " + str(x["session"]["created"])[:10]) if x.get("session") else x.get("path") or x["source"], 120)
                + f"：{_cell(x['quote'], 120)}" for x in r["evidence"])
            note = r.get("stale_note") or ""
            if r["verdict"] == "wrong" and r.get("correction"):
                cc = r["correction"]
                note = f"新值：{cc.get('new_value')}（{cc.get('date')}，{cc.get('source')}）。" + note
            L.append(f"| {r['file']} | {v} | {_cell(r.get('reason'))} | {ev} | {_cell(note, 500)} |")
        L.append("")
    return "\n".join(L) + "\n"


def main(argv):
    ap = argparse.ArgumentParser(prog="check.py")
    sub = ap.add_subparsers(dest="command", required=True)
    s = sub.add_parser("start")
    s.add_argument("session_id")
    s.add_argument("--projects-dir", default=None)
    s.add_argument("--project", action="append", default=None)
    s.add_argument("--session", action="append", default=None)
    s.add_argument("--against", default=None, help="the earlier check run to compare with; 'none' for no comparison")
    s.add_argument("--memory-from", default=None,
                   help="RUN_ID[:base|:stage]: check a dream run's staged result (or starting copy), or an earlier "
                        "check's snapshot, instead of the real memory dirs")
    f = sub.add_parser("finish")
    f.add_argument("session_id")
    f.add_argument("--against", default=None)
    c = sub.add_parser("compare")
    c.add_argument("before")
    c.add_argument("after")
    a = ap.parse_args(argv)
    return {"start": start_cmd, "finish": finish_cmd, "compare": compare_cmd}[a.command](a)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
