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


if __name__ == "__main__":
    unittest.main()
