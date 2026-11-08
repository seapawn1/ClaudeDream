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
        self.assertTrue(t["passed"])
        self.assertEqual((t["unchanged"], t["unchanged_same_verdict"], t["unchanged_agreement"]), (1, 0, 0.0))
        self.assertEqual((t["new_entries"], t["new_stale"]), (2, 1))
        self.assertEqual((t["changed"], t["changed_stale_before"], t["changed_stale_after"]), (2, 2, 0))

    def test_same_count_does_not_pass_and_margin_applies(self):
        before = report("check-1", "M", [entry("a.md", "possibly_stale"), entry("b.md", "possibly_stale")])
        same = report("check-2", "M", [entry("a.md", "possibly_stale"), entry("b.md", "possibly_stale")])
        self.assertFalse(check.compare(before, same)["total"]["passed"])
        one_less = report("check-2", "M", [entry("a.md", "valid"), entry("b.md", "possibly_stale")])
        self.assertTrue(check.compare(before, one_less)["total"]["passed"])
        with mock.patch.object(check, "MARGIN", 1):
            self.assertFalse(check.compare(before, one_less)["total"]["passed"])

    def test_entries_not_checked_in_one_run_are_left_out(self):
        before = report("check-1", "M", [entry("a.md", "possibly_stale"), entry("b.md", "valid")])
        after = report("check-2", "M", [entry("a.md", None, checked=False), entry("b.md", "valid")])
        t = check.compare(before, after)["total"]
        self.assertEqual((t["compared"], t["not_checked_in_one_run"], t["before_stale"]), (1, 1, 0))


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
