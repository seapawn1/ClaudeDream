import json
import os
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "scripts"))
import dream  # noqa: E402


class TornHookLog(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp()
        self.good = json.dumps({"tool": "Edit", "decision": "allow", "agent_id": "a1", "path": os.path.join(self.d, "x.md"),
                                "tool_use_id": "t1"})

    def tearDown(self):
        shutil.rmtree(self.d, ignore_errors=True)

    def write_log(self, *lines):
        with open(os.path.join(self.d, "hooklog.jsonl"), "w", encoding="utf-8", newline="") as f:
            f.write("".join(l + "\r\n" for l in lines))

    def test_a_torn_line_does_not_raise_and_makes_the_evidence_incomplete(self):
        self.write_log(self.good, "ull}", "", self.good.replace("t1", "t2"))
        log = dream.load_hooklog(self.d)
        self.assertEqual(len(log), 3)  # two records and the torn line
        h = dream.hook_evidence(log, self.d, 2, {"t1", "t2"})
        self.assertEqual(h["unreadable_log_lines"], 1)
        self.assertFalse(h["ok"])  # nothing else is wrong: the evidence is incomplete, nothing is written back
        self.assertEqual(dream.hook_problems(h),
                         ["the hook log has 1 line(s) that could not be read, so the evidence is incomplete"])

    def test_a_lost_write_record_is_still_caught_by_the_id_check(self):
        self.write_log(self.good, self.good.replace("t1", "t2"))
        h = dream.hook_evidence(dream.load_hooklog(self.d), self.d, 3, {"t1", "t2", "t3"})
        self.assertFalse(h["ok"])
        self.assertEqual(h["missing_ids"], ["t3"])

    def test_a_call_the_guard_could_not_read_and_blocked_is_a_valid_record(self):
        blocked = json.dumps({"tool": None, "decision": "deny", "error": "unreadable hook input"})
        self.write_log(self.good, blocked)
        h = dream.hook_evidence(dream.load_hooklog(self.d), self.d, 1, {"t1"})
        self.assertEqual((h["unreadable_inputs"], h["unreadable_log_lines"]), (1, 0))
        self.assertTrue(h["ok"])


if __name__ == "__main__":
    unittest.main()
