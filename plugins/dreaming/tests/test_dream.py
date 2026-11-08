import json
import os
import shutil
import sys
import tempfile
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


if __name__ == "__main__":
    unittest.main()
