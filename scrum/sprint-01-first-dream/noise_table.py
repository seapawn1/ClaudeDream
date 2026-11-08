"""Sprint 01 working file: the numbers the PO needs to fix the PBI-004 pass-line threshold (2.2, rule B).

  python noise_table.py --repeat RUN RUN [RUN...] [--dream BEFORE AFTER]...

--repeat: checks of the same memory with nothing changed in between; every pair gives the noise alone
(agreement, flip rate). --dream: a check before and a check after a dream; gives the drop rate of the
entries the dream changed, the flip rate of the entries it did not change, and their difference.
Prints a Markdown table. Run from the repository root.
"""
import argparse
import itertools
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "plugins", "dreaming", "scripts"))
import check  # noqa: E402
import common  # noqa: E402


def load(rid):
    with open(os.path.join(common.RUNS_DIR, rid, "check-report.json"), encoding="utf-8") as f:
        return json.load(f)


def model_of(rid):
    """Which model answered the run's checkers, from their own transcripts."""
    with open(os.path.join(common.RUNS_DIR, rid, "run.json"), encoding="utf-8") as f:
        run = json.load(f)
    import dream
    import re
    models = set()
    for d in dream.workflow_dirs(run["session_id"], run["started_at"]):
        for n in os.listdir(d):
            if n.startswith("agent-") and n.endswith(".jsonl"):
                with open(os.path.join(d, n), encoding="utf-8", errors="replace") as f:
                    models |= set(re.findall(r'"model":"([^"]+)"', f.read()))
    return ", ".join(sorted(models)) or "?"


def main(argv):
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--repeat", nargs="+", default=[])
    ap.add_argument("--dream", nargs=2, action="append", default=[])
    a = ap.parse_args(argv)
    print("| 比较 | 模型 | 没改过的条目 | 结论相同 | 翻转（波动比例） | 改过的条目 | 可能过时+错误 | 下降比例 | 差 |")
    print("| --- | --- | --- | --- | --- | --- | --- | --- | --- |")
    for x, y in list(itertools.combinations(a.repeat, 2)) + [tuple(p) for p in a.dream]:
        t = check.compare(load(x), load(y))["total"]
        print(f"| {x[-15:]} → {y[-15:]} | {model_of(y)} | {t.get('unchanged', 0)} | {t.get('unchanged_same_verdict', 0)} "
              f"| {t.get('unchanged_flips', 0)}（{t['unchanged_flip_rate']}） | {t.get('changed', 0)} "
              f"| {t.get('changed_stale_before', 0)} → {t.get('changed_stale_after', 0)} | {t['changed_drop_rate']} | {t['b_diff']} |")


if __name__ == "__main__":
    main(sys.argv[1:])
