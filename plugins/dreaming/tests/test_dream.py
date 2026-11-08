import json
import os
import shutil
import sys
import tempfile
import time
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "scripts"))
import common  # noqa: E402
import dream  # noqa: E402
import memcheck  # noqa: E402


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


GOOD = "---\nname: a\ndescription: d\nmetadata:\n  node_type: memory\n  type: feedback\n---\n\nbody\n"


class MemCheck(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.d, ignore_errors=True)

    def test_native_dir_passes(self):
        write(os.path.join(self.d, "a.md"), GOOD)
        write(os.path.join(self.d, "old.md"), "MOVED TO [[a]]\n")
        write(os.path.join(self.d, "MEMORY.md"), "# Memory Index\n\n> note\n- [A](a.md) — the rule\n")
        r = memcheck.check_dir(self.d)
        self.assertEqual(r["index"], [])
        self.assertEqual(r["files"], {})

    def test_problems_are_found(self):
        write(os.path.join(self.d, "a.md"), "---\nname: a\ndescription: d\nmetadata: x\n---\n")
        write(os.path.join(self.d, "b.md"), GOOD.replace("name: a", "name: b"))
        write(os.path.join(self.d, "MEMORY.md"), "# Memory Index\n[[a]] — cookbook style\n- [Gone](gone.md) — x\n")
        r = memcheck.check_dir(self.d)
        self.assertTrue(any("native format" in x for x in r["index"]))
        self.assertTrue(any("missing file" in x for x in r["index"]))
        self.assertIn("a.md", r["files"])  # no metadata.type
        self.assertIn("not listed in MEMORY.md", r["files"]["b.md"])

    def test_index_limits(self):
        write(os.path.join(self.d, "MEMORY.md"), "# Memory Index\n" + "\n" * 205)
        self.assertTrue(any("over" in x for x in memcheck.check_index(self.d)[0]))


class Journal(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        j = os.path.join(self.tmp, "projects", "P", "sess", "subagents", "workflows", "wf_1", "journal.jsonl")
        lines = [{"type": "started", "key": "k1", "label": "analyze s.p001"},
                 {"type": "result", "key": "k1", "result": {"summary": "x"}},
                 {"type": "started", "key": "k2", "label": "analyze s.p002"},
                 {"type": "result", "key": "k2", "result": None},
                 {"type": "started", "key": "k3", "label": "organize G"}]
        write(j, "\n".join(json.dumps(x) for x in lines) + "\n")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_results_by_label(self):
        with mock.patch.dict(os.environ, {"CLAUDE_CONFIG_DIR": self.tmp}):
            r = dream.journal_results("sess")
        self.assertEqual(r["analyze s.p001"], {"summary": "x"})
        self.assertIsNone(r["analyze s.p002"])  # ran but failed: counts as not analyzed
        self.assertNotIn("organize G", r)  # started, never finished

    def test_write_calls_matched_to_the_hook_log_by_id(self):
        def use(i, path):
            return {"type": "assistant", "message": {"content": [
                {"type": "tool_use", "id": i, "name": "Edit", "input": {"file_path": path}}]}}

        def result(i, text, err):
            return {"type": "user", "message": {"content": [
                {"type": "tool_result", "tool_use_id": i, "content": text, "is_error": err}]}}
        recs = [use("t1", "W/a.md"), result("t1", "ok", False),
                use("t2", "W/a.md"), result("t2", "<tool_use_error>File has been modified since read", True),
                use("t3", "W/b.md"), result("t3", "File content has changed since it was last read", True),
                use("t3", "W/b.md")]  # the same record twice in a transcript
        p = os.path.join(self.tmp, "projects", "P", "sess", "subagents", "workflows", "wf_1", "agent-x.jsonl")
        write(p, "\n".join(json.dumps(x) for x in recs) + "\n")
        with mock.patch.dict(os.environ, {"CLAUDE_CONFIG_DIR": self.tmp}):
            per, n, ids = dream.agent_activity("sess")
        self.assertEqual((n, ids), (2, {"t1", "t3"}))  # t2 was refused before the hook could see it
        self.assertEqual((per["a.md"]["calls"], len(per["a.md"]["errors"]), len(per["b.md"]["errors"])), (2, 1, 1))
        log = [{"agent_id": "x", "tool": "Edit", "path": "W/a.md", "tool_use_id": "t1", "decision": "allow"},
               {"agent_id": "x", "tool": "Edit", "path": "W/b.md", "tool_use_id": "t3", "decision": "allow"}]
        self.assertTrue(dream.hook_evidence(log, "W", n, ids)["ok"])
        h = dream.hook_evidence(log[:1], "W", n, ids)
        self.assertFalse(h["ok"])
        self.assertEqual(h["missing_ids"], ["t3"])
        old = [dict(r, tool_use_id=None) for r in log]  # a hook log from before the guard logged ids
        self.assertTrue(dream.hook_evidence(old, "W", n, ids)["ok"])
        self.assertFalse(dream.hook_evidence(old[:1], "W", n, ids)["ok"])


class Continue(unittest.TestCase):
    def setUp(self):
        self.now = time.time()
        self.tmp = tempfile.mkdtemp()
        home = os.path.join(self.tmp, "home")
        self.runs = os.path.join(home, "runs")
        self.patches = [mock.patch.object(common, "DREAM_HOME", home),
                        mock.patch.object(common, "RUNS_DIR", self.runs),
                        mock.patch.object(common, "ACTIVE_DIR", os.path.join(home, "active")),
                        mock.patch.object(common, "REGISTRY", os.path.join(home, "registry.jsonl")),
                        mock.patch.dict(os.environ, {"CLAUDE_CONFIG_DIR": self.tmp})]
        for pt in self.patches:
            pt.start()
        self.work = os.path.join(self.runs, "dream-1")
        parts = []
        for i in ("a", "b"):
            path = os.path.join(self.work, "transcripts", "P", f"{i}.p001.txt")
            write(path, "SESSION x\n")
            parts.append({"id": f"{i}.p001", "path": path})
        self.run = {"run_id": "dream-1", "session_id": "s1", "sandbox": True, "started_at": self.now - 5000,
                    "workdir": self.work, "groups": [{"key": "G", "memory_dir": "M", "base": "B", "stage": "S", "parts": parts}]}
        write(os.path.join(self.work, "run.json"), json.dumps(self.run))
        # the first run: a analyzed, b failed, the organizer ran after them
        self.journal("s1", "wf_1", [("analyze a.p001", {"summary": "x"}), ("analyze b.p001", None),
                                    ("organize G", {"index_entries": 1, "changes": []})], age=4000)
        common.activate("s1", self.work, [self.work], "R")

    def tearDown(self):
        for pt in self.patches:
            pt.stop()
        shutil.rmtree(self.tmp, ignore_errors=True)

    def journal(self, sid, wf, items, age):
        lines = []
        for n, (label, result) in enumerate(items):
            lines += [{"type": "started", "key": f"{sid}{wf}{n}", "label": label},
                      {"type": "result", "key": f"{sid}{wf}{n}", "result": result}]
        j = os.path.join(self.tmp, "projects", "P", sid, "subagents", "workflows", wf, "journal.jsonl")
        write(j, "\n".join(json.dumps(x) for x in lines) + "\n")
        os.utime(j, (self.now - age, self.now - age))  # long done: the run is not busy

    def load(self):
        with open(os.path.join(self.work, "run.json"), encoding="utf-8") as f:
            return json.load(f)

    def test_continue_plans_only_what_is_left_and_merges_sessions(self):
        self.assertEqual(dream.main(["start", "s2", "--continue", "dream-1"]), 0)
        with open(os.path.join(self.work, "dream-run.js"), encoding="utf-8") as f:
            script = f.read()
        self.assertIn("b.p001", script)
        self.assertNotIn("a.p001", script)
        run = self.load()
        self.assertEqual([s["session_id"] for s in run["sessions"]], ["s1", "s2"])
        self.assertIsNone(common.active_state("s1"))  # the guard moved to s2 with the run
        self.assertEqual(common.active_state("s2")["workdir"], self.work)
        run["sessions"][1]["started_at"] = self.now - 3000  # as if s2 started then
        write(os.path.join(self.work, "run.json"), json.dumps(run))
        self.journal("s2", "wf_1", [("analyze b.p001", {"summary": "y"}),
                                    ("organize G", {"index_entries": 2, "changes": []})], age=2000)
        self.assertEqual(dream.main(["start", "s2", "--continue", "dream-1"]), 0)  # nothing left: straight to finish
        self.assertEqual(len(self.load()["sessions"]), 2)  # the same session is not added twice

    def test_results_and_the_organizer_rule(self):
        self.run["sessions"] = [{"session_id": "s1", "started_at": self.now - 5000},
                                {"session_id": "s2", "started_at": self.now - 3000}]
        # the second run analyzed b again, then its organizer failed
        self.journal("s2", "wf_1", [("analyze b.p001", {"summary": "y"}), ("organize G", None)], age=2000)
        runs = dream.run_journal(self.run)
        r = dream.run_results(self.run, runs)
        self.assertEqual(r["analyze b.p001"], {"summary": "y"})  # a result beats an earlier failure
        self.assertEqual(r["organize G"], {"index_entries": 1, "changes": []})  # the latest result there is
        g = self.run["groups"][0]
        self.assertFalse(dream.organized(g, runs))  # but it came before b was analyzed again
        self.assertTrue(dream.organized(g, runs[:1]))
        c = dream.check_group(dict(g, base=self.tmp, stage=self.tmp), r, {}, dream.organized(g, runs))
        self.assertIn("not organized", c["problems"])
        # continuing plans the organizer alone
        write(os.path.join(self.work, "run.json"), json.dumps(self.run))
        self.assertEqual(dream.main(["start", "s3", "--continue", "dream-1"]), 0)
        with open(os.path.join(self.work, "dream-run.js"), encoding="utf-8") as f:
            self.assertIn('"parts": []', f.read())

    def test_refusals(self):
        self.assertEqual(dream.main(["start", "s2", "--continue", "nope"]), 2)
        write(os.path.join(self.work, "hooklog.jsonl"), "{}\n")  # an agent wrote just now: still running
        self.assertEqual(dream.main(["start", "s2", "--continue", "dream-1"]), 2)
        os.utime(os.path.join(self.work, "hooklog.jsonl"), (self.now - 1000, self.now - 1000))
        os.remove(self.run["groups"][0]["parts"][1]["path"])
        self.assertEqual(dream.main(["start", "s2", "--continue", "dream-1"]), 1)  # transcripts gone
        write(os.path.join(self.work, "run-report.json"), "{}")
        self.assertEqual(dream.main(["start", "s2", "--continue", "dream-1"]), 2)  # finished



if __name__ == "__main__":
    unittest.main()
