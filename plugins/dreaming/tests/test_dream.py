import io
import contextlib
import collections
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


FM = "---\nname: {n}\ndescription: d\nmetadata:\n  type: project\n---\n\n"


def memdir(path, files, index_lines=None):
    """A memory dir: files {name: text}; MEMORY.md lists every file unless index_lines says otherwise."""
    write(os.path.join(path, "MEMORY.md"),
          "# Memory Index\n" + "\n".join(index_lines or [f"- [{n}]({n}) — h" for n in files if n.endswith(".md")]) + "\n")
    for n, t in files.items():
        write(os.path.join(path, n), t)


class CheckGroup(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.base, self.stage = os.path.join(self.tmp, "base"), os.path.join(self.tmp, "stage")
        memdir(self.base, {"a.md": FM.format(n="a") + "fact\n"})

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def group(self, parts=()):
        return {"key": "G", "memory_dir": "M", "base": self.base, "stage": self.stage,
                "parts": [{"id": i, "path": "x"} for i in parts]}

    def test_size_and_format_problems_are_reported_and_do_not_block(self):
        memdir(self.stage, {"a.md": FM.format(n="a") + "fact\n",
                            "big.md": FM.format(n="big") + ("x" * 100 + "\n") * 1100,
                            "bare.md": "no frontmatter\n"},
               index_lines=[f"- [e{i}](e{i}.md) — h" for i in range(210)]
               + ["- [A](a.md) — a", "- [Big](big.md) — b", "- [Bare](bare.md) — c"])
        for i in range(210):
            write(os.path.join(self.stage, f"e{i}.md"), FM.format(n=f"e{i}") + "f\n")
        c = dream.check_group(self.group(), {"organize G": {"index_entries": 2, "changes": []}}, {}, True)
        self.assertTrue(c["passed"])
        self.assertEqual(c["problems"], [])
        kinds = collections.Counter(r["kind"] for r in c["reported"])
        self.assertEqual((kinds["file-over-100KB"], kinds["file-format"], kinds["index-over-limit"]), (1, 1, 1))
        text = {r["file"]: dream.describe_reported(r) for r in c["reported"]}
        self.assertRegex(text["big.md"], r"^big\.md \(1\d\d KB\): over the 100KB limit")
        self.assertRegex(text["MEMORY.md"], r"^MEMORY\.md \(21\d lines, [\d,]+ bytes\): over what Claude Code loads")
        self.assertEqual(text["bare.md"], "bare.md (0 KB): no frontmatter")

    def test_safety_problems_block(self):
        memdir(self.stage, {"b.md": FM.format(n="b") + "new\n"})  # a.md is gone without a stub
        c = dream.check_group(self.group(parts=["s.p001"]), {"organize G": {"index_entries": 1, "changes": []}}, {}, True)
        self.assertFalse(c["passed"])
        joined = " ".join(c["problems"])
        self.assertIn("1 parts have no analyzer result", joined)
        self.assertIn("cannot be found: a.md", joined)

    def test_no_organizer_result_is_only_reported(self):
        memdir(self.stage, {"a.md": FM.format(n="a") + "fact\n"})
        c = dream.check_group(self.group(), {}, {}, False)
        self.assertTrue(c["passed"])
        self.assertEqual([r["kind"] for r in c["reported"]], ["not-organized"])


class Finish(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        home = os.path.join(self.tmp, "home")
        self.patches = [mock.patch.object(common, "DREAM_HOME", home),
                        mock.patch.object(common, "RUNS_DIR", os.path.join(home, "runs")),
                        mock.patch.object(common, "ACTIVE_DIR", os.path.join(home, "active")),
                        mock.patch.object(common, "REGISTRY", os.path.join(home, "registry.jsonl")),
                        mock.patch.dict(os.environ, {"CLAUDE_CONFIG_DIR": self.tmp})]
        for pt in self.patches:
            pt.start()
        self.work = os.path.join(home, "runs", "dream-1")
        groups = []
        for key in ("OK", "BAD"):
            real = os.path.join(self.tmp, "real", key)
            memdir(real, {"a.md": FM.format(n="a") + "fact\n", "old.md": FM.format(n="old") + "kept\n"})
            for side in ("base", "stage"):
                shutil.copytree(real, os.path.join(self.work, side, key))
            groups.append({"key": key, "memory_dir": real, "base": os.path.join(self.work, "base", key),
                           "stage": os.path.join(self.work, "stage", key), "parts": []})
        # OK: the run added a file over 100KB and listed it: reported, written back all the same
        memdir(groups[0]["stage"], {"a.md": FM.format(n="a") + "fact\nmore\n", "old.md": FM.format(n="old") + "kept\n",
                                    "big.md": FM.format(n="big") + ("x" * 100 + "\n") * 1100})
        # BAD: old.md vanished without a stub: not written back
        os.remove(os.path.join(groups[1]["stage"], "old.md"))
        write(os.path.join(groups[1]["stage"], "a.md"), FM.format(n="a") + "fact\nmore\n")
        self.real_ok, self.real_bad = groups[0]["memory_dir"], groups[1]["memory_dir"]
        write(os.path.join(self.work, "run.json"), json.dumps(
            {"run_id": "dream-1", "session_id": "s1", "sandbox": False, "started_at": time.time() - 100,
             "workdir": self.work, "groups": groups}))
        common.activate("s1", self.work, [self.work], "R")

    def tearDown(self):
        for pt in self.patches:
            pt.stop()
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_a_lead_command_the_guard_blocked_does_not_stop_the_write_back(self):
        with open(os.path.join(self.work, "hooklog.jsonl"), "w", encoding="utf-8") as f:
            f.write(json.dumps({"tool": "Bash", "decision": "deny", "command": "ls -la /somewhere"}) + "\n")
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            dream.main(["finish", "s1"])
        text = out.getvalue()
        self.assertTrue(os.path.exists(os.path.join(self.real_ok, "big.md")))  # the OK directory was written back
        self.assertIn("lead tried 1 shell command(s) that are not plugin scripts; the guard blocked all of them: "
                      "ls -la /somewhere", text)
        self.assertNotIn("were not blocked", text)
        report = json.load(open(os.path.join(self.work, "run-report.json"), encoding="utf-8"))
        self.assertTrue(report["hook_log"]["ok"])
        self.assertEqual(report["hook_log"]["lead_commands_blocked"], ["ls -la /somewhere"])
        self.assertIn("lead 试过 1 条非插件命令，全被守卫拦下", report["hook_log"]["lead_blocked_note"])

    def test_reported_problems_are_written_back_and_safety_problems_are_not(self):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            rc = dream.main(["finish", "s1"])
        text = out.getvalue()
        self.assertEqual(rc, 1)  # one directory was blocked
        self.assertTrue(os.path.exists(os.path.join(self.real_ok, "big.md")))  # written back
        self.assertIn("more", open(os.path.join(self.real_ok, "a.md"), encoding="utf-8").read())
        self.assertNotIn("more", open(os.path.join(self.real_bad, "a.md"), encoding="utf-8").read())  # untouched
        self.assertRegex(text, r"REPORTED, written back anyway: big\.md \(\d+ KB\): over the 100KB limit")
        self.assertRegex(text, r"PROBLEM \(this directory is not written back\): 1 files that existed at the start cannot be found: old\.md")
        self.assertIn("SOME CHECKS FAILED", text)
        report = json.load(open(os.path.join(self.work, "run-report.json"), encoding="utf-8"))
        self.assertEqual([g["written_back"] for g in report["groups"]], [True, False])
        self.assertGreaterEqual(report["reported_problems"], 1)


class HookEvidence(unittest.TestCase):
    SCRIPT = 'python -I "S:/x/plugins/dreaming/scripts/dream.py" finish "s1"'

    @staticmethod
    def rec(tool, decision, **kw):
        return dict({"tool": tool, "decision": decision}, **kw)

    def test_a_lead_command_the_guard_blocked_is_listed_and_does_not_fail(self):
        log = [self.rec("Bash", "deny", command="ls -la x; ls y"), self.rec("Bash", "allow", command=self.SCRIPT)]
        h = dream.hook_evidence(log, "W", 0)
        self.assertTrue(h["ok"])
        self.assertTrue(h["lead_ran_only_plugin_scripts"])
        self.assertEqual(h["lead_commands_blocked"], ["ls -la x; ls y"])
        self.assertEqual(dream.hook_problems(h), [])
        self.assertIn("lead tried 1 shell command(s) that are not plugin scripts; the guard blocked all of them: ls -la x; ls y",
                      dream.blocked_line(h))
        self.assertEqual(dream.blocked_line(dream.hook_evidence([], "W", 0)), "lead shell commands blocked by the guard: none")

    def test_an_agent_shell_the_guard_blocked_is_fine_and_one_it_did_not_block_fails(self):
        blocked = [self.rec("Bash", "deny", agent_id="a1", command="ls"), self.rec("mcp__x__y", "deny", agent_id="a1")]
        self.assertTrue(dream.hook_evidence(blocked, "W", 0)["ok"])
        loose = [self.rec("Bash", "allow", agent_id="a1", command="ls")]
        h = dream.hook_evidence(loose, "W", 0)
        self.assertFalse(h["ok"])
        self.assertEqual(dream.hook_problems(h), ["1 agent shell, network or MCP call(s) were not blocked"])

    def test_a_lead_command_that_was_not_blocked_but_is_not_a_plugin_script_fails(self):
        for cmd in ("rm -rf /x", 'python -c "print(1)"', self.SCRIPT + " && ls", "ls " + self.SCRIPT):
            h = dream.hook_evidence([self.rec("Bash", "allow", command=cmd)], "W", 0)
            self.assertFalse(h["ok"], cmd)
            self.assertFalse(h["lead_ran_only_plugin_scripts"], cmd)
            self.assertIn("not plugin scripts and were not blocked", " ".join(dream.hook_problems(h)))

    def test_a_lead_shell_call_the_guard_never_decided_on_fails(self):
        h = dream.hook_evidence([self.rec("Bash", None, command="ls")], "W", 0)
        self.assertFalse(h["ok"])

    def test_the_problem_text_names_what_was_really_not_blocked(self):
        log = [self.rec("Write", "allow", agent_id="a1", path="C:/elsewhere/x.md", tool_use_id="t1")]
        h = dream.hook_evidence(log, "W", 2, {"t1", "t2"})
        self.assertEqual(dream.hook_problems(h),
                         ["1 write(s) outside the work dir were allowed, not blocked",
                          "1 write call(s) in the agents' transcripts are missing from the hook log"])

    def test_the_evidence_check_accepts_script_runs_and_rejects_everything_else(self):
        root = os.path.dirname(os.path.dirname(os.path.abspath(dream.__file__))).replace("\\", "/")
        accepted = (f'python -I "{root}/scripts/dream.py" finish "s"', f'python "{root}/scripts/check.py" start x --project p',
                    f"python -I {root}/scripts/dream.py start s --sandbox", f"python {root}/scripts/prepare.py w --session a",
                    'python -I "C:/another/install/scripts/dream.py" finish "s"')  # a run continued on another install
        rejected = ("ls", "rm -rf x", f"python -c 'import os' {root}/scripts/",  # the guard lets this one through: it only
                    f"python -m http.server {root}/scripts/",                     # looks for the scripts path in the command
                    f'python -I "{root}/scripts/dream.py" finish "$(whoami)"', f"python {root}/scripts/dream.py start s; rm -rf x",
                    f"python {root}/scripts/nothere.py", "python", "python -I /elsewhere/notscripts/dream.py finish s")
        for cmd in accepted:
            self.assertTrue(dream.is_plugin_script(cmd), cmd)
        for cmd in rejected:
            self.assertFalse(dream.is_plugin_script(cmd), cmd)


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
        self.assertEqual([r["kind"] for r in c["reported"]], ["not-organized"])  # reported, not a reason to block
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
