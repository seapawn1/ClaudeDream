import os
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "scripts"))
import writeback as wb  # noqa: E402

FM = "---\nname: {n}\ndescription: d\nmetadata:\n  type: project\n---\n\n"


def write(d, rel, text):
    p = os.path.join(d, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


class Writeback(unittest.TestCase):
    def setUp(self):
        self.t = tempfile.mkdtemp()
        self.real, self.base, self.stage, self.backup = (os.path.join(self.t, x) for x in ("real", "base", "stage", "backup"))
        write(self.real, "MEMORY.md", "# Memory Index\n- [A](a.md) — a\n- [Old](old.md) — o\n")
        write(self.real, "a.md", FM.format(n="a") + "fact one\n")
        write(self.real, "old.md", FM.format(n="old") + "the build needs FOO=1\nport is 8080\n")
        for d in (self.base, self.stage):
            shutil.copytree(self.real, d)
        # the run: edits a.md, adds b.md, moves old.md into b.md with a stub
        write(self.stage, "a.md", FM.format(n="a") + "fact one\nfact two (2026-11-09)\n")
        write(self.stage, "b.md", FM.format(n="b") + "the build needs FOO=1\nport is 8080\n")
        write(self.stage, "old.md", "MOVED TO [[b]]\n")
        write(self.stage, "MEMORY.md", "# Memory Index\n- [A](a.md) — a\n- [B](b.md) — b\n")

    def tearDown(self):
        shutil.rmtree(self.t, ignore_errors=True)

    def test_compare_and_whereabouts(self):
        d = wb.compare(self.base, self.stage)
        self.assertEqual(d["added"], ["b.md"])
        self.assertEqual(sorted(d["modified"]), ["MEMORY.md", "a.md", "old.md"])
        self.assertEqual(d["whereabouts"]["old.md"], "moved to b.md")
        self.assertEqual(d["whereabouts"]["a.md"], "edited")
        self.assertEqual(d["lost"], [])
        self.assertEqual(d["moved_with_missing_lines"], [])

    def test_lost_and_thin_moves(self):
        write(self.stage, "a.md", "MOVED TO [[nowhere]]\n")
        write(self.stage, "b.md", FM.format(n="b") + "port is 8080\n")  # dropped a fact line of old.md
        d = wb.compare(self.base, self.stage)
        self.assertIn("a.md", d["lost"])
        self.assertEqual(d["moved_with_missing_lines"][0]["file"], "old.md")

    def test_apply_leaves_concurrent_changes_and_restore_is_exact(self):
        write(self.real, "a.md", FM.format(n="a") + "edited by another session\n")
        res = wb.apply(self.base, self.stage, self.real, self.backup)
        self.assertEqual(res["conflicts"], ["a.md"])
        self.assertIn("b.md", res["written"])
        with open(os.path.join(self.real, "a.md"), encoding="utf-8") as f:
            self.assertIn("edited by another session", f.read())
        before = wb.tree(self.backup)
        r = wb.restore(self.real, self.backup, res["after"])
        self.assertTrue(r["restored"] and r["identical"])
        self.assertEqual(wb.tree(self.real), before)

    def test_restore_refuses_after_foreign_change(self):
        res = wb.apply(self.base, self.stage, self.real, self.backup)
        write(self.real, "b.md", FM.format(n="b") + "someone edited after write-back\n")
        r = wb.restore(self.real, self.backup, res["after"])
        self.assertFalse(r["restored"])
        self.assertEqual(r["changed_since_write_back"], ["b.md"])

    def test_claims_checked_against_diff_and_hooklog(self):
        d = wb.compare(self.base, self.stage)
        claims = ["merged old.md into b.md", "NOT DONE: a.md, the platform refused the edit",
                  "fixed links in c.md"]
        out = wb.claims_vs_diff(claims, d, attempts={})
        whys = {x["claim"]: x["why"] for x in out}
        self.assertNotIn("merged old.md into b.md", whys)
        self.assertIn("no agent transcript", whys["NOT DONE: a.md, the platform refused the edit"])
        self.assertIn("unchanged", whys["fixed links in c.md"])
        ok = wb.claims_vs_diff(claims[1:2], d, attempts={"a.md": {"calls": 2, "errors": ["permission"]}})
        self.assertEqual(ok, [])


if __name__ == "__main__":
    unittest.main()
