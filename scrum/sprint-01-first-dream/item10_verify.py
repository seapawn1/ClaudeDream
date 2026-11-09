"""Sprint 01 working file: independent check of the reduced item 10 (real write-back on the IDEO-Scrum memory
directory). Compares the real directory with a snapshot taken before the run (file hashes and a copy), the
run's starting copy, its staged result and its rollback copy, and prints the run's own numbers.

  python -I scrum/sprint-01-first-dream/item10_verify.py <dream run id> [--snapshot DIR]

Run it after the write-back (real == stage expected) and again after /dreaming:restore (real == snapshot
expected). The snapshot is a copy of private memory, so it is kept outside the repository.
"""
import json
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "plugins", "dreaming", "scripts"))
import common  # noqa: E402
import memcheck  # noqa: E402
import writeback as wb  # noqa: E402

REAL = r"S:\SeaPawn-Memory\memory\IDEO-Scrum"
SNAP = r"C:/Users/seapawn/.claude/jobs/06b1ddee/tmp/imem-snapshot"


def main(argv):
    rid = argv[0]
    snap_dir = argv[argv.index("--snapshot") + 1] if "--snapshot" in argv else SNAP
    with open(os.path.join(common.RUNS_DIR, rid, "run.json"), encoding="utf-8") as f:
        run = json.load(f)
    (g,) = run["groups"]
    snap, real = wb.tree(snap_dir), wb.tree(REAL)
    base, stage = wb.tree(g["base"]), wb.tree(g["stage"])
    backup_dir = os.path.join(run["workdir"], "backup", g["key"])
    backup = wb.tree(backup_dir)
    print(f"run {rid}: sandbox={run['sandbox']}, written back={'after' in g}, memory dir {g['memory_dir']}")
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
            size = os.path.getsize(os.path.join(REAL, f)) if os.path.exists(os.path.join(REAL, f)) else 0
            print(f"    {label:8s} {f} ({size:,} bytes)")
    st = memcheck.check_dir(REAL)
    print(f"  MEMORY.md now: {st['stats']}; format problems: {st['files'] or 'none'}; index problems: {st['index'] or 'none'}")
    rep = os.path.join(run["workdir"], "run-report.json")
    if os.path.exists(rep):
        with open(rep, encoding="utf-8") as f:
            r = json.load(f)
        print(f"  run-report: complete={r['complete']}, reported problems={r.get('reported_problems')}, hook ok={r['hook_log']['ok']}")
        for c in r["groups"]:
            print(f"    analyzed {c['analyzed']}/{c['parts']}, organized={c['organized']}, written_back={c['written_back']}, "
                  f"written {len(c.get('written', []))} files, conflicts {c.get('conflicts')}, blocking problems {c['problems']}")
            print(f"    whereabouts: " + ", ".join(f"{k} {sum(1 for v in c['whereabouts'].values() if v.startswith(k))}"
                                                  for k in ("kept", "edited", "moved", "missing", "stub")))
            for x in c["reported"]:
                print("    reported:", x)
    else:
        print("  (no run-report.json yet)")


if __name__ == "__main__":
    main(sys.argv[1:])
