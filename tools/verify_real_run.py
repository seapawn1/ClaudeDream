"""Independent check of a real write-back, and of its restore, against a snapshot taken before the run.

Compares the real memory directory with the snapshot (file hashes) and with the run's starting copy, staged result and
rollback copy, checks the format of MEMORY.md, and prints the run's own report. The snapshot is a copy of the memory
directory that you make by hand right before the run; keep it outside the repository, it is private memory.

  python -I tools/verify_real_run.py <dream run id> --snapshot DIR [--group KEY]

Run it after the write-back (real directory == staged result expected) and again after /dreaming:restore (real directory
== snapshot expected). A run with several memory directories needs --group, the directory's key in run.json. Used in
Sprint 01 for the real write-back on the IDEO-Scrum memory (2026-11-09).
"""
import argparse
import json
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "plugins", "dreaming", "scripts"))
import common  # noqa: E402
import memcheck  # noqa: E402
import writeback as wb  # noqa: E402


def main(argv):
    ap = argparse.ArgumentParser(prog="verify_real_run.py", description="Check a real dream write-back against a snapshot.")
    ap.add_argument("run_id", help="a dream run id under ~/.claude-dream/runs")
    ap.add_argument("--snapshot", required=True, help="a copy of the memory directory made before the run")
    ap.add_argument("--group", default=None, help="the memory directory's key in run.json (needed when the run has several)")
    a = ap.parse_args(argv)
    with open(os.path.join(common.RUNS_DIR, a.run_id, "run.json"), encoding="utf-8") as f:
        run = json.load(f)
    groups = run["groups"]
    if a.group:
        groups = [x for x in groups if x["key"] == a.group]
        if not groups:
            sys.exit(f"no memory directory with the key {a.group} in {a.run_id}")
    if len(groups) != 1:
        sys.exit(f"{a.run_id} has {len(groups)} memory directories ({', '.join(x['key'] for x in groups)}): name one with --group")
    (g,) = groups
    real_dir = g["memory_dir"]
    snap, real = wb.tree(a.snapshot), wb.tree(real_dir)
    base, stage = wb.tree(g["base"]), wb.tree(g["stage"])
    backup_dir = os.path.join(run["workdir"], "backup", g["key"])
    backup = wb.tree(backup_dir)
    print(f"run {a.run_id}: sandbox={run['sandbox']}, written back={'after' in g}, memory dir {real_dir}")
    print(f"  snapshot ({len(snap)} files) == run's starting copy:      {snap == base}")
    print(f"  snapshot == rollback copy (made before write-back):     {snap == backup if backup else 'no rollback copy (nothing written back)'}")
    print(f"  real directory == staged result (written back):         {real == stage}")
    print(f"  real directory == snapshot (untouched, or restored):    {real == snap}")
    new = sorted(set(real) - set(snap))
    gone = sorted(set(snap) - set(real))
    changed = sorted(f for f in set(real) & set(snap) if real[f] != snap[f])
    print(f"  real vs snapshot: {len(new)} new, {len(changed)} changed, {len(gone)} missing, {len(set(real) & set(snap)) - len(changed)} unchanged")
    for label, files in (("new", new), ("changed", changed), ("missing", gone)):
        for f in files[:40]:
            path = os.path.join(real_dir, f)
            print(f"    {label:8s} {f} ({os.path.getsize(path) if os.path.exists(path) else 0:,} bytes)")
    st = memcheck.check_dir(real_dir)
    print(f"  MEMORY.md now: {st['stats']}; format problems: {st['files'] or 'none'}; index problems: {st['index'] or 'none'}")
    rep = os.path.join(run["workdir"], "run-report.json")
    if os.path.exists(rep):
        with open(rep, encoding="utf-8") as f:
            r = json.load(f)
        print(f"  run-report: complete={r['complete']}, reported problems={r.get('reported_problems')}, hook ok={r['hook_log']['ok']}")
        for c in r["groups"]:
            if c.get("memory_dir") != real_dir:
                continue
            print(f"    analyzed {c['analyzed']}/{c['parts']}, organized={c['organized']}, written_back={c['written_back']}, "
                  f"written {len(c.get('written', []))} files, conflicts {c.get('conflicts')}, blocking problems {c['problems']}")
            print("    whereabouts: " + ", ".join(f"{k} {sum(1 for v in c['whereabouts'].values() if v.startswith(k))}"
                                                  for k in ("kept", "edited", "moved", "missing", "stub")))
            for x in c["reported"]:
                print("    reported:", x)
    else:
        print("  (no run-report.json yet)")


if __name__ == "__main__":
    main(sys.argv[1:])
