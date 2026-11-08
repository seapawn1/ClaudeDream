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

    def test_apply_and_restore_is_exact(self):
        before = wb.tree(self.real)
        res = wb.apply(self.base, self.stage, self.real, self.backup)
        self.assertTrue(res["written_back"])
        self.assertEqual(res["written"], ["MEMORY.md", "a.md", "b.md", "old.md"])
        self.assertEqual(wb.tree(self.real), wb.tree(self.stage))
        r = wb.restore(self.real, self.backup, res["after"])
        self.assertTrue(r["restored"] and r["identical"])
        self.assertEqual(wb.tree(self.real), before)

    def test_index_conflict_writes_nothing_in_the_directory(self):
        # native auto memory in another session added a line to MEMORY.md during the run
        write(self.real, "MEMORY.md", "# Memory Index\n- [A](a.md) — a\n- [Old](old.md) — o\n- [N](n.md) — n\n")
        before = wb.tree(self.real)
        res = wb.apply(self.base, self.stage, self.real, self.backup)
        self.assertFalse(res["written_back"])
        self.assertEqual(res["conflicts"], ["MEMORY.md"])
        self.assertEqual(res["written"], [])
        self.assertEqual(wb.tree(self.real), before)

    def test_conflict_mid_write_undoes_what_was_written(self):
        real_copy2, calls = wb.shutil.copy2, []

        def copy2(src, dst):  # another session edits old.md right after the first file is written
            if not calls:
                write(self.real, "old.md", FM.format(n="old") + "edited by another session\n")
            calls.append(dst)
            return real_copy2(src, dst)
        before = wb.tree(self.real)
        wb.shutil.copy2 = copy2
        try:
            res = wb.apply(self.base, self.stage, self.real, self.backup)
        finally:
            wb.shutil.copy2 = real_copy2
        self.assertFalse(res["written_back"])
        self.assertEqual(res["conflicts"], ["old.md"])
        self.assertEqual(res["undone"], ["MEMORY.md", "a.md", "b.md"])
        now = wb.tree(self.real)
        self.assertNotIn("b.md", now)
        self.assertEqual({k: v for k, v in now.items() if k != "old.md"},
                         {k: v for k, v in before.items() if k != "old.md"})

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
