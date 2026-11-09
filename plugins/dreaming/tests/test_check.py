import contextlib
import io
import os
import shutil
import sys
import tempfile
import time
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "scripts"))
import check  # noqa: E402
import dream  # noqa: E402

FM = "---\nname: {n}\ndescription: d\nmetadata:\n  type: project\n---\n\n"


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def entry(file, verdict, sha="h", checked=True):
    return {"file": file, "sha": sha, "checked": checked, "verdict": verdict if checked else None}


def report(run_id, mem, entries, stubs=None):
    return {"run_id": run_id, "groups": [{"memory_dir": mem, "entries": entries, "stubs": stubs or {}}]}


class Entries(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.d, ignore_errors=True)

    def test_entries_stubs_and_chains(self):
        write(os.path.join(self.d, "MEMORY.md"), "# Memory Index\n")
        write(os.path.join(self.d, "a.md"), FM.format(n="a") + "fact\n")
        write(os.path.join(self.d, "sub", "b.md"), FM.format(n="b") + "fact\n")
        write(os.path.join(self.d, "old.md"), "MOVED TO [[older]]\n")
        write(os.path.join(self.d, "older.md"), "MOVED TO [[b]]\n")
        write(os.path.join(self.d, "gone.md"), "MOVED TO [[nowhere]]\n")
        entries, stubs = check.list_entries(self.d)
        self.assertEqual([e["file"] for e in entries], ["a.md", "sub/b.md"])
        self.assertEqual(entries[0]["type"], "project")
        self.assertEqual(stubs, {"old.md": "sub/b.md", "older.md": "sub/b.md", "gone.md": None})


class Evidence(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp()
        write(os.path.join(self.d, "repo", "CLAUDE.md"), "The build needs   FOO=2 since\n2026-11-01.\n")
        write(os.path.join(self.d, "mem", "a.md"), FM.format(n="a") + "The build needs FOO=1\n")
        self.bases = [os.path.join(self.d, "repo")]
        self.own = {os.path.normcase(os.path.abspath(os.path.join(self.d, "mem", "a.md")))}

    def tearDown(self):
        shutil.rmtree(self.d, ignore_errors=True)

    def ev(self, source, quote):
        return check.verify_evidence({"source": source, "quote": quote}, self.bases, self.own)

    def test_quotes_are_checked_in_the_cited_file(self):
        self.assertTrue(self.ev("CLAUDE.md", "build needs FOO=2 since 2026-11-01")["verified"])  # whitespace-tolerant
        self.assertTrue(self.ev(os.path.join(self.d, "repo", "CLAUDE.md") + ":1", "needs FOO=2 ... 2026-11-01")["verified"])
        self.assertEqual(self.ev("CLAUDE.md", "build needs FOO=3")["why"], "quote not found in the file")
        self.assertEqual(self.ev("README.md", "anything at all")["why"], "source file not found")
        self.assertIn("not evidence for itself", self.ev(os.path.join(self.d, "mem", "a.md"), "The build needs FOO=1")["why"])
        self.assertEqual(self.ev("CLAUDE.md", "FOO")["why"], "quote too short to check")

    def test_verdict_rules(self):
        good = [{"source": "CLAUDE.md", "quote": "The build needs FOO=2"}]
        bad = [{"source": "CLAUDE.md", "quote": "made-up line"}]
        j = check.judge({"verdict": "possibly_stale", "evidence": bad}, self.bases, self.own)
        self.assertEqual((j["verdict"], j["adjusted"]), ("unknown", "evidence not verified"))
        j = check.judge({"verdict": "wrong", "evidence": good}, self.bases, self.own)
        self.assertEqual(j["verdict"], "possibly_stale")
        j = check.judge({"verdict": "wrong", "evidence": good,
                         "correction": {"new_value": "FOO=2", "date": "2026-11-01", "source": "CLAUDE.md"}}, self.bases, self.own)
        self.assertEqual(j["verdict"], "wrong")
        j = check.judge({"verdict": "unknown", "evidence": []}, self.bases, self.own)
        self.assertEqual(j["verdict"], "unknown")
        self.assertNotIn("adjusted", j)
        self.assertEqual(check.judge({"verdict": "maybe"}, self.bases, self.own)["verdict"], "unknown")


class Compare(unittest.TestCase):
    def test_new_places_lost_entries_noise_and_pass_line(self):
        before = report("check-1", "M", [entry("a.md", "possibly_stale", "a0"), entry("b.md", "wrong", "b0"),
                                         entry("c.md", "valid", "c0"), entry("d.md", "valid", "d0"),
                                         entry("e.md", "possibly_stale", "e0")])
        # after the dream: a.md edited, b.md merged into n.md (new), c.md unchanged, d.md gone,
        # e.md moved to a stub whose target does not exist; n.md and z.md are new
        after = report("check-2", "M", [entry("a.md", "valid", "a1"), entry("c.md", "possibly_stale", "c0"),
                                        entry("n.md", "valid", "n1"), entry("z.md", "possibly_stale", "z1")],
                       stubs={"b.md": "n.md", "e.md": None})
        c = check.compare(before, after)
        g, t = c["groups"][0], c["total"]
        self.assertEqual({r["file"]: (r["now"], r["how"]) for r in g["rows"]},
                         {"a.md": ("a.md", "edited"), "b.md": ("n.md", "moved"), "c.md": ("c.md", "unchanged")})
        self.assertEqual(sorted(g["lost"]), ["d.md", "e.md"])
        self.assertEqual((t["before_stale"], t["after_stale"]), (2, 1))  # a, b before; c after
        self.assertEqual((t["unchanged"], t["unchanged_same_verdict"], t["unchanged_agreement"]), (1, 0, 0.0))
        self.assertEqual((t["changed_drop_rate"], t["unchanged_flip_rate"], t["b_diff"]), (1.0, 1.0, 0.0))
        self.assertIsNone(t["passed"])  # threshold not fixed yet
        self.assertEqual((t["new_entries"], t["new_stale"]), (2, 1))
        self.assertEqual((t["changed"], t["changed_stale_before"], t["changed_stale_after"]), (2, 2, 0))

    def test_rule_b_changed_against_unchanged(self):
        # four edited entries, three of them stale before and one after; four unchanged, one flips
        before = report("check-1", "M", [entry(f"c{i}.md", "possibly_stale" if i < 3 else "valid", f"c{i}") for i in range(4)]
                        + [entry(f"u{i}.md", "wrong" if i == 0 else "valid", f"u{i}") for i in range(4)])
        after = report("check-2", "M", [entry(f"c{i}.md", "possibly_stale" if i == 0 else "valid", f"c{i}x") for i in range(4)]
                       + [entry(f"u{i}.md", "valid", f"u{i}") for i in range(4)])
        t = check.compare(before, after)["total"]
        self.assertEqual((t["changed"], t["changed_stale_before"], t["changed_stale_after"]), (4, 3, 1))
        self.assertEqual((t["changed_drop_rate"], t["unchanged_flips"], t["unchanged_flip_rate"]), (0.5, 1, 0.25))
        self.assertEqual((t["b_diff"], t["unchanged_net_drop_rate"]), (0.25, 0.25))
        self.assertIsNone(t["passed"])
        with mock.patch.object(check, "B_MIN_DIFF", 0.2):
            self.assertTrue(check.compare(before, after)["total"]["passed"])
        with mock.patch.object(check, "B_MIN_DIFF", 0.3):
            self.assertFalse(check.compare(before, after)["total"]["passed"])
        only_unchanged = report("check-2", "M", [entry(f"c{i}.md", "valid", f"c{i}") for i in range(4)])
        with mock.patch.object(check, "B_MIN_DIFF", 0.0):
            self.assertIsNone(check.compare(before, only_unchanged)["total"]["passed"])  # nothing changed: no verdict

    def test_entries_not_checked_in_one_run_are_left_out(self):
        before = report("check-1", "M", [entry("a.md", "possibly_stale"), entry("b.md", "valid")])
        after = report("check-2", "M", [entry("a.md", None, checked=False), entry("b.md", "valid")])
        t = check.compare(before, after)["total"]
        self.assertEqual((t["compared"], t["not_checked_in_one_run"], t["before_stale"]), (1, 1, 0))


class MemoryFrom(unittest.TestCase):
    def test_dream_stage_or_base_and_check_snapshot(self):
        runs = tempfile.mkdtemp()
        try:
            write(os.path.join(runs, "dream-1", "run.json"),
                  '{"groups": [{"memory_dir": "M:\\\\mem", "base": "B", "stage": "S"}]}')
            write(os.path.join(runs, "check-1", "run.json"),
                  '{"kind": "check", "groups": [{"memory_dir": "M:\\\\mem", "snapshot": "P"}]}')
            with mock.patch.object(check.common, "RUNS_DIR", runs):
                key = os.path.normcase("M:\\mem")
                self.assertEqual(check.memory_sources("dream-1")[key], ("M:\\mem", "S"))
                self.assertEqual(check.memory_sources("dream-1:base")[key][1], "B")
                self.assertEqual(check.memory_sources("check-1")[key][1], "P")
                with self.assertRaises(ValueError):
                    check.memory_sources("dream-1:other")
        finally:
            shutil.rmtree(runs, ignore_errors=True)


class HookLine(unittest.TestCase):
    SCRIPT = 'python -I "S:/x/plugins/dreaming/scripts/check.py" finish "s1"'

    def summary(self, log):
        hooks = dream.hook_evidence(log, "W", 0)
        report = {"run_id": "check-1", "complete": hooks["ok"], "failed_batches": [], "groups": [], "today": "2026-11-09",
                  "memory_from": None, "hook_log": hooks}
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            check.print_summary(report, hooks, 0, "W")
        return out.getvalue(), check.render_md(report)

    def test_a_blocked_lead_command_is_shown_and_the_check_is_complete(self):
        text, md = self.summary([{"tool": "Bash", "decision": "deny", "command": "ls -la x"},
                                 {"tool": "Bash", "decision": "allow", "command": self.SCRIPT}])
        self.assertIn("check check-1: complete", text)
        self.assertIn("lead tried 1 shell command(s) that are not plugin scripts; the guard blocked all of them: ls -la x", text)
        self.assertNotIn("HOOK PROBLEM", text)
        self.assertIn("lead 试过 1 条非插件命令，全被守卫拦下：ls -la x", md)

    def test_a_lead_command_that_was_not_blocked_makes_the_check_incomplete_and_says_why(self):
        text, md = self.summary([{"tool": "Bash", "decision": "allow", "command": "rm -rf x"}])
        self.assertIn("check check-1: INCOMPLETE", text)
        self.assertIn("HOOK PROBLEM: the lead ran 1 shell command(s) that are not plugin scripts and were not blocked: rm -rf x", text)


class WorkflowDirs(unittest.TestCase):
    def test_only_runs_launched_after_the_start(self):
        cfg = tempfile.mkdtemp()
        try:
            wf = os.path.join(cfg, "projects", "p", "s1", "subagents", "workflows")
            write(os.path.join(wf, "wf_old", "journal.jsonl"), "")
            old = time.time() - 600
            os.utime(os.path.join(wf, "wf_old", "journal.jsonl"), (old, old))
            write(os.path.join(wf, "wf_new", "journal.jsonl"), "")
            with mock.patch.dict(os.environ, {"CLAUDE_CONFIG_DIR": cfg}):
                self.assertEqual(len(dream.workflow_dirs("s1")), 2)
                self.assertEqual([os.path.basename(d) for d in dream.workflow_dirs("s1", time.time() - 60)], ["wf_new"])
        finally:
            shutil.rmtree(cfg, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
