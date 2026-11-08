import json
import os
import shutil
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "scripts"))
import common  # noqa: E402
import prepare  # noqa: E402
import routing  # noqa: E402
import segments as sg  # noqa: E402
import transcripts as tx  # noqa: E402


def rec(**kw):
    kw.setdefault("timestamp", "2026-11-09T00:00:00Z")
    return kw


def write_jsonl(path, records):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


MAIN = [
    {"type": "custom-title", "customTitle": "Fixture session"},
    rec(type="user", uuid="u1", cwd="C:/nowhere/proj", gitBranch="main",
        message={"role": "user", "content": "<system-reminder>harness</system-reminder>Run the tests\nUSER: not a label"}),
    rec(type="assistant", uuid="a1", message={"role": "assistant", "content": [
        {"type": "thinking", "thinking": "secret thoughts"},
        {"type": "text", "text": "Running them."},
        {"type": "tool_use", "id": "t1", "name": "Bash", "input": {"command": "make test", "description": "run"}}]}),
    rec(type="user", uuid="u2", message={"role": "user", "content": [
        {"type": "tool_result", "tool_use_id": "t1", "is_error": True, "content": "FAILED: FOO unset"}]}),
    rec(type="user", uuid="u3", isMeta=True, message={"role": "user", "content": "skill expansion text"}),
    rec(type="system", subtype="compact_boundary", uuid="s1", compactMetadata={"trigger": "auto", "preTokens": 5}),
    rec(type="user", uuid="u4", isCompactSummary=True, message={"role": "user", "content": "Summary: tests need FOO=1"}),
    rec(type="attachment", uuid="x1", attachment={"type": "queued_command", "prompt": "also check lint"}),
    rec(type="attachment", uuid="x2", attachment={"type": "skill_listing", "content": "long"}),
    rec(type="mystery-new-type", uuid="m1"),
]


class Render(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_events_and_format(self):
        stats = tx.new_stats()
        evs = tx.events(MAIN, stats)
        text = tx.render(tx.session_info(MAIN, "C:/x/abc.jsonl"), [("=== primary thread abc: claude-code ===", evs)], ["n"])
        self.assertTrue(text.startswith("SESSION abc: Fixture session (agent claude-code; created "))
        self.assertIn("USER:\nRun the tests\n USER: not a label", text)  # reminder stripped, label escaped
        self.assertIn("TOOL CALL Bash:\ncommand: make test\ndescription: run", text)
        self.assertIn("TOOL RESULT (Bash) [error]:\nFAILED: FOO unset", text)
        self.assertIn("EVENT compact_boundary:", text)
        self.assertIn("EVENT compact_summary:\nSummary: tests need FOO=1", text)
        self.assertIn("USER:\nalso check lint", text)
        self.assertNotIn("secret thoughts", text)
        self.assertNotIn("skill expansion text", text)
        self.assertEqual(stats["unknown:mystery-new-type"], 1)  # counted, not silently dropped
        self.assertEqual(stats["skipped:thinking"], 1)


class Prepare(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.projects = os.path.join(self.tmp, "projects")
        self.home = os.path.join(self.tmp, "dreamhome")
        p = os.path.join(self.projects, "C--nowhere-proj")
        write_jsonl(os.path.join(p, "s1.jsonl"), MAIN)
        write_jsonl(os.path.join(p, "s1", "subagents", "agent-aa.jsonl"),
                    [rec(type="user", uuid="v1", isSidechain=True, message={"role": "user", "content": "sub task"})])
        with open(os.path.join(p, "s1", "subagents", "agent-aa.meta.json"), "w") as f:
            json.dump({"agentType": "Explore"}, f)
        write_jsonl(os.path.join(p, "s1", "subagents", "workflows", "wf_1", "agent-bb.jsonl"),
                    [rec(type="user", uuid="w1", isSidechain=True, message={"role": "user", "content": "dream work"})])
        with open(os.path.join(p, "s1", "subagents", "workflows", "wf_1", "agent-bb.meta.json"), "w") as f:
            json.dump({"agentType": "dreaming:analyzer"}, f)
        write_jsonl(os.path.join(p, "dream.jsonl"), [rec(type="user", uuid="d1", cwd="C:/nowhere/proj", message={
            "role": "user", "content": "<command-name>/dreaming:dream</command-name>"})])
        # work first, then the dream command in the same session: the work is kept
        write_jsonl(os.path.join(p, "mixed.jsonl"), [
            rec(type="user", uuid="k1", cwd="C:/nowhere/proj", message={"role": "user", "content": "real work"}),
            rec(type="user", uuid="k2", message={"role": "user", "content": "<command-name>/dreaming:dream</command-name>"}),
            rec(type="assistant", uuid="k3", message={"role": "assistant", "content": [{"type": "text", "text": "dream lead talk"}]})])
        # a fork of s1: copies u1 and a1 with the parent's sessionId, then adds its own message
        write_jsonl(os.path.join(p, "fork.jsonl"), [
            dict(MAIN[1], sessionId="s1"), dict(MAIN[2], sessionId="s1"),
            rec(type="user", uuid="f1", sessionId="fork", cwd="C:/nowhere/proj",
                message={"role": "user", "content": "new question in the fork"})])
        write_jsonl(os.path.join(p, "reg.jsonl"), [rec(type="user", uuid="r1", cwd="C:/nowhere/proj",
                                                      message={"role": "user", "content": "hello"})])
        write_jsonl(os.path.join(p, "empty.jsonl"), [{"type": "custom-title", "customTitle": "x"}])
        t = os.path.join(self.projects, "C--probe")
        write_jsonl(os.path.join(t, "t1.jsonl"), MAIN)
        self.patches = [
            mock.patch.object(common, "DREAM_HOME", self.home),
            mock.patch.object(common, "REGISTRY", os.path.join(self.home, "registry.jsonl")),
            mock.patch.dict(os.environ, {"CLAUDE_CONFIG_DIR": self.tmp}),
        ]
        for pt in self.patches:
            pt.start()
        common.register({"kind": "dream", "session_id": "reg"})
        common.register({"kind": "probe-dir", "dir": t})

    def tearDown(self):
        for pt in self.patches:
            pt.stop()
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_manifest(self):
        work = os.path.join(self.tmp, "work")
        m = prepare.prepare(work, self.projects)
        by_id = {e["id"]: e for e in m["sessions"]}
        self.assertEqual(m["sessions_found"], 7)
        self.assertTrue(m["checks"]["passed"], m["checks"]["problems"])
        self.assertTrue(m["ledger"]["reconciled"], m["ledger"])
        self.assertEqual(by_id["s1"]["status"], "converted")
        self.assertEqual(by_id["dream"]["reason"], "dream command session (marker)")
        self.assertEqual(by_id["reg"]["reason"], "registered dream or test run")
        self.assertEqual(by_id["empty"]["status"], "skipped")
        self.assertEqual(by_id["t1"]["reason"], "registered test directory")
        subs = {s["id"]: s for s in by_id["s1"]["subthreads"]}
        self.assertEqual(subs["agent-aa"]["status"], "converted")
        self.assertEqual(subs["agent-bb"]["status"], "excluded")
        text = "".join(open(pt["file"], encoding="utf-8").read() for pt in by_id["s1"]["parts"])
        self.assertIn("=== sub-thread agent-aa: Explore ===", text)
        self.assertNotIn("dream work", text)
        self.assertEqual(by_id["s1"]["memory_dir"],
                         os.path.join(self.tmp, "projects", "C--nowhere-proj", "memory"))
        # the dream part of a mixed session is cut, the work before it kept
        mixed = "".join(open(pt["file"], encoding="utf-8").read() for pt in by_id["mixed"]["parts"])
        self.assertIn("real work", mixed)
        self.assertNotIn("dream lead talk", mixed)
        # the fork keeps only its own message and says which session holds the copies
        fork = "".join(open(pt["file"], encoding="utf-8").read() for pt in by_id["fork"]["parts"])
        self.assertIn("new question in the fork", fork)
        self.assertNotIn("Run the tests", fork)
        self.assertIn("copied messages are left out", fork)
        self.assertEqual(by_id["fork"]["dedup_dropped"], {"s1": 2})

    def test_skip_project_excludes_and_still_reconciles(self):
        m = prepare.prepare(os.path.join(self.tmp, "work2"), self.projects, skip=["NOWHERE-pr"])
        self.assertTrue(m["ledger"]["reconciled"], m["ledger"])
        skipped = [e for e in m["sessions"] if e.get("reason") == "project dir skipped by --skip-project NOWHERE-pr"]
        self.assertEqual(len(skipped), 6)  # every session of C--nowhere-proj, matched case-insensitively
        self.assertEqual(m["parts"], 0)

    def test_skip_session_by_id_prefix(self):
        m = prepare.prepare(os.path.join(self.tmp, "work3"), self.projects, skip_sessions=["fo"])
        self.assertTrue(m["ledger"]["reconciled"], m["ledger"])
        by_id = {e["id"]: e for e in m["sessions"]}
        self.assertEqual(by_id["fork"]["reason"], "session skipped by --skip-session fo")
        self.assertEqual(by_id["s1"]["status"], "converted")


def ev(kind, body, uid):
    e = {"kind": kind, "label": {"user": "USER:", "compact_boundary": "EVENT compact_boundary: {}",
                                 "compact_summary": "EVENT compact_summary:"}.get(kind, "AGENT:"),
         "body": body, "uuid": uid, "_id": uid}
    e["text"] = tx.block(e["label"], body)
    return e


class LiveFile(unittest.TestCase):
    def test_a_growing_file_reads_the_same_until_reset(self):
        d = tempfile.mkdtemp()
        try:
            p = os.path.join(d, "s.jsonl")
            with open(p, "wb") as f:
                f.write(b'{"a": 1}\n{"a": 2}\n{"a": 3, "half')  # the writer is mid-record
            tx.reset_reads()
            first, bad = tx.read_records(p)
            self.assertEqual(([r["a"] for r in first], bad), ([1, 2], 0))
            with open(p, "ab") as f:
                f.write(b'": 0}\n{"a": 4}\n')
            self.assertEqual(tx.read_records(p)[0], first)  # a later read in the same run
            tx.reset_reads()
            self.assertEqual([r["a"] for r in tx.read_records(p)[0]], [1, 2, 3, 4])
            with open(p, "ab") as f:
                f.write(b'{"a": 5}')  # complete last record with no newline
            tx.reset_reads()
            self.assertEqual(len(tx.read_records(p)[0]), 5)
        finally:
            tx.reset_reads()
            shutil.rmtree(d, ignore_errors=True)


class Pack(unittest.TestCase):
    def test_boundary_size_and_carried_summary(self):
        evs = [ev("user", "a" * 50, 0), ev("agent", "b" * 50, 1),
               ev("compact_boundary", "", 2), ev("compact_summary", "SUMMARY-1", 3),
               ev("user", "c" * 80, 4), ev("agent", "d" * 80, 5), ev("user", "e" * 80, 6)]
        parts = sg.pack([("=== primary thread x: claude-code ===", evs)], budget=200)
        placed = [e["_id"] for p in parts for _, es in p["sections"] for e in es if "_id" in e]
        self.assertEqual(sorted(placed), list(range(7)))  # every event exactly once
        self.assertEqual(len(placed), len(set(placed)))
        first_after = [p for p in parts if any(e.get("_id") == 2 for _, es in p["sections"] for e in es)][0]
        self.assertFalse(first_after["carried"])  # starts at the boundary, has its own summary
        later = [p for p in parts if p["carried"]]
        self.assertTrue(later)  # a size cut after the compaction carries SUMMARY-1
        self.assertTrue(all("SUMMARY-1" in es[0]["text"] for p in later for _, es in p["sections"][:1]))
        self.assertEqual(sg.check_carried(parts), [])
        later[0]["sections"].pop(0)  # drop the carried copy: the check must notice
        self.assertTrue(sg.check_carried(parts))

    def test_long_tool_result_is_cut(self):
        stats = tx.new_stats()
        e = {"kind": "tool_result", "label": "TOOL RESULT (Read):", "body": "x" * (sg.MAX_EVENT + 5000)}
        sg.shape(e, stats)
        self.assertIn("characters of this tool result left out", e["text"])
        self.assertEqual(stats["truncated_results"], 1)


class Routing(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_worktree_path_maps_to_main_checkout(self):
        self.assertEqual(routing.git_root(r"S:\Gone\Repo\.claude\worktrees\feat"), r"S:\Gone\Repo")

    def test_settings_precedence_and_broken_file(self):
        proj = os.path.join(self.tmp, "proj")
        os.makedirs(os.path.join(proj, ".claude"))
        with open(os.path.join(proj, ".claude", "settings.local.json"), "w") as f:
            f.write("")  # broken, ignored
        with open(os.path.join(proj, ".claude", "settings.json"), "w") as f:
            json.dump({"autoMemoryDirectory": "D:/mem/proj"}, f)
        mem, rule = routing.memory_dir(proj, config_dir=self.tmp)
        self.assertEqual(mem, os.path.normpath("D:/mem/proj"))
        with open(os.path.join(proj, ".claude", "settings.local.json"), "w") as f:
            json.dump({"autoMemoryDirectory": "D:/mem/local"}, f)
        self.assertEqual(routing.memory_dir(proj, config_dir=self.tmp)[0], os.path.normpath("D:/mem/local"))

    def test_default_uses_git_root(self):
        repo = os.path.join(self.tmp, "repo")
        os.makedirs(os.path.join(repo, ".git"))
        os.makedirs(os.path.join(repo, "sub"))
        mem, rule = routing.memory_dir(os.path.join(repo, "sub"), config_dir=self.tmp)
        self.assertEqual(mem, os.path.join(self.tmp, "projects", routing.sanitize(repo), "memory"))
        self.assertEqual(rule, "default: git root")

    def test_sanitize(self):
        self.assertEqual(routing.sanitize(r"S:\ClaudeDream\.claude\worktrees\x"), "S--ClaudeDream--claude-worktrees-x")


if __name__ == "__main__":
    unittest.main()
