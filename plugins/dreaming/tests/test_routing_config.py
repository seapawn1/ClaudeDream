import contextlib
import io
import json
import os
import shutil
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "scripts"))
import check  # noqa: E402
import common  # noqa: E402
import dream  # noqa: E402
import prepare  # noqa: E402
from test_prepare import MAIN, write_jsonl  # noqa: E402


class Env(unittest.TestCase):
    """A current account (cur) and another account's config dir (other), with the plugin's own state in temp."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.cur = os.path.join(self.tmp, "cur")
        self.other = os.path.join(self.tmp, "other")
        os.makedirs(os.path.join(self.cur, "projects"))
        home = os.path.join(self.tmp, "home")
        self.patches = [mock.patch.dict(os.environ, {"CLAUDE_CONFIG_DIR": self.cur}),
                        mock.patch.object(common, "DREAM_HOME", home),
                        mock.patch.object(common, "RUNS_DIR", os.path.join(home, "runs")),
                        mock.patch.object(common, "ACTIVE_DIR", os.path.join(home, "active")),
                        mock.patch.object(common, "REGISTRY", os.path.join(home, "registry.jsonl"))]
        for p in self.patches:
            p.start()
        self.cur = common.config_dir()  # as the plugin spells it

    def tearDown(self):
        for p in self.patches:
            p.stop()
        shutil.rmtree(self.tmp, ignore_errors=True)

    def session_in(self, config_dir):
        write_jsonl(os.path.join(config_dir, "projects", "C--nowhere-proj", "s1.jsonl"), MAIN)
        return os.path.join(config_dir, "projects")


class Choice(Env):
    def test_no_arguments_is_the_current_config_dir(self):
        self.assertEqual(common.routing_config_dir(), (self.cur, "current config dir"))
        self.assertEqual(common.resolve_projects_dir(), os.path.join(self.cur, "projects"))

    def test_a_projects_dir_named_projects_gives_its_parent(self):
        got = common.routing_config_dir(os.path.join(self.other, "projects") + os.sep)
        self.assertEqual(got, (os.path.abspath(self.other), "parent of --projects-dir"))
        got = common.routing_config_dir(os.path.join(self.other, "PROJECTS"))  # Windows ignores the case
        self.assertEqual(got[1], "parent of --projects-dir" if os.name == "nt" else "current config dir")

    def test_a_projects_dir_with_another_name_keeps_the_current_config_dir(self):
        self.assertEqual(common.routing_config_dir(os.path.join(self.other, "old-sessions")), (self.cur, "current config dir"))

    def test_explicit_config_dir_wins_and_gives_the_projects_dir(self):
        explicit = os.path.join(self.tmp, "third")
        self.assertEqual(common.routing_config_dir(os.path.join(self.other, "projects"), explicit),
                         (os.path.abspath(explicit), "--config-dir"))
        self.assertEqual(common.resolve_projects_dir(None, explicit), os.path.join(os.path.abspath(explicit), "projects"))
        self.assertEqual(common.resolve_projects_dir(os.path.join(self.other, "x"), explicit), os.path.abspath(os.path.join(self.other, "x")))


class PrepareRouting(Env):
    def memory_of(self, m):
        (e,) = [e for e in m["sessions"] if e["status"] == "converted"]
        return e["memory_dir"], e["route_rule"]

    def test_default_location_follows_the_other_account(self):
        projects = self.session_in(self.other)
        m = prepare.prepare(os.path.join(self.tmp, "w1"), projects)
        self.assertEqual(m["routing"], {"config_dir": os.path.abspath(self.other), "source": "parent of --projects-dir"})
        mem, rule = self.memory_of(m)
        self.assertEqual(mem, os.path.join(os.path.abspath(self.other), "projects", "C--nowhere-proj", "memory"))
        self.assertTrue(rule.startswith("default"))

    def test_the_other_accounts_user_settings_are_read(self):
        projects = self.session_in(self.other)
        target = os.path.join(self.tmp, "elsewhere", "memory")
        with open(os.path.join(self.other, "settings.json"), "w", encoding="utf-8") as f:
            json.dump({"autoMemoryDirectory": target}, f)
        # and the current account's settings must not leak in
        with open(os.path.join(self.cur, "settings.json"), "w", encoding="utf-8") as f:
            json.dump({"autoMemoryDirectory": os.path.join(self.tmp, "wrong")}, f)
        mem, rule = self.memory_of(prepare.prepare(os.path.join(self.tmp, "w2"), projects))
        self.assertEqual(os.path.normcase(mem), os.path.normcase(os.path.normpath(target)))
        self.assertEqual(rule, "autoMemoryDirectory in user settings")

    def test_explicit_config_dir_for_a_copy_of_the_transcripts(self):
        copy = self.session_in(os.path.join(self.tmp, "backup", ".claude"))  # a copy named projects, memory stays in cur
        m = prepare.prepare(os.path.join(self.tmp, "w3"), copy, config_dir=self.cur)
        self.assertEqual(m["routing"]["source"], "--config-dir")
        self.assertEqual(self.memory_of(m)[0], os.path.join(self.cur, "projects", "C--nowhere-proj", "memory"))

    def test_config_dir_alone_reads_its_projects_dir(self):
        self.session_in(self.other)
        m = prepare.prepare(os.path.join(self.tmp, "w4"), config_dir=self.other)
        self.assertEqual(m["projects_dir"], os.path.join(os.path.abspath(self.other), "projects"))
        self.assertEqual(m["sessions_found"], 1)

    def test_no_arguments_is_unchanged(self):
        self.session_in(self.cur)
        m = prepare.prepare(os.path.join(self.tmp, "w5"))
        self.assertEqual(m["routing"], {"config_dir": self.cur, "source": "current config dir"})
        self.assertEqual(self.memory_of(m)[0], os.path.join(self.cur, "projects", "C--nowhere-proj", "memory"))


class Outputs(Env):
    def run_main(self, module, argv):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            rc = module.main(argv)
        return rc, out.getvalue()

    def test_dream_start_and_finish_say_where_the_memory_is_resolved(self):
        projects = self.session_in(self.other)
        rc, text = self.run_main(dream, ["start", "s9", "--projects-dir", projects, "--sandbox"])
        line = f"memory routing: config dir {os.path.abspath(self.other)} (from parent of --projects-dir)"
        self.assertEqual(rc, 0)
        self.assertIn(line, text)
        self.assertIn(os.path.join(os.path.abspath(self.other), "projects", "C--nowhere-proj", "memory"), text)
        run_dir = os.path.join(common.RUNS_DIR, [d for d in os.listdir(common.RUNS_DIR) if d.startswith("dream-")][0])
        with open(os.path.join(run_dir, "run.json"), encoding="utf-8") as f:
            self.assertEqual(json.load(f)["routing"]["source"], "parent of --projects-dir")
        rc, text = self.run_main(dream, ["finish", "s9"])  # no workflow ran: the checks fail, the line is still there
        self.assertIn(line, text)
        with open(os.path.join(run_dir, "run-report.json"), encoding="utf-8") as f:
            self.assertEqual(json.load(f)["routing"]["config_dir"], os.path.abspath(self.other))

    def test_a_run_from_an_older_version_says_so(self):
        self.assertIn("not recorded", common.routing_line(None))

    def test_plan_names_the_source_and_the_config_dir(self):
        self.session_in(self.other)
        rc, text = self.run_main(dream, ["plan", "s9", "--config-dir", self.other])
        self.assertIn("source: --config-dir", text)
        self.assertIn(f"memory routing: config dir {os.path.abspath(self.other)} (from --config-dir)", text)

    def test_check_start_prints_it_and_keeps_it_in_the_run(self):
        projects = self.session_in(self.other)
        mem = os.path.join(os.path.abspath(self.other), "projects", "C--nowhere-proj", "memory")
        os.makedirs(mem)
        with open(os.path.join(mem, "MEMORY.md"), "w", encoding="utf-8") as f:
            f.write("# Memory Index\n- [A](a.md) — a\n")
        with open(os.path.join(mem, "a.md"), "w", encoding="utf-8") as f:
            f.write("---\nname: a\ndescription: d\nmetadata:\n  type: project\n---\n\nfact\n")
        rc, text = self.run_main(check, ["start", "s8", "--projects-dir", projects])
        self.assertEqual(rc, 0, text)
        self.assertIn(f"memory routing: config dir {os.path.abspath(self.other)} (from parent of --projects-dir)", text)
        self.assertIn(mem, text)


if __name__ == "__main__":
    unittest.main()
