import os
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "scripts"))
import common  # noqa: E402
import dream  # noqa: E402
import guard  # noqa: E402


class LeadScriptRule(unittest.TestCase):
    """The one rule for the lead's shell commands, as the guard applies it (the plugin's own scripts directory
    pinned) and as the hook evidence applies it (a logged command of any install path)."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.root = os.path.join(self.tmp, "Program Files (x86)", "p", "plugins", "dreaming")  # parentheses in the path
        os.makedirs(os.path.join(self.root, "scripts"))
        self.scripts = os.path.join(self.root, "scripts").replace("\\", "/")
        self.state = {"workdir": self.tmp, "write_roots": [self.tmp], "plugin_root": self.root}

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def guard(self, command, **kw):
        return guard.decide(dict(kw, tool_name="Bash", tool_input={"command": command}), self.state)[0]

    def test_real_script_runs_are_allowed_even_when_the_path_has_parentheses(self):
        s = self.scripts
        for cmd in (f'python -I "{s}/dream.py" finish "sess-1"',
                    f'python "{s}/check.py" start sess-1 --project S--IDEO-Scrum --against none',
                    f'python -u -I "{s}/dream.py" start sess-1 --sandbox',
                    f'python -X utf8 "{s}/dream.py" finish "sess-1"',
                    f'python -I "{s}/dream.py" start sess-1 --session 4b0764eb --skip-project "ideo-s10-"'):
            self.assertEqual(self.guard(cmd), "allow", cmd)

    def test_everything_else_is_blocked(self):
        s = self.scripts
        for cmd in ("ls", "rm -rf x", "python other.py",
                    f'python -c "print(1)" {s}/',                         # the old rule let this through
                    f'python -m http.server {s}/',
                    f'python -Ic "print(1)" {s}/',
                    f'python --version {s}/dream.py',
                    f'python -I "{s}/dream.py" finish "$(whoami)"',
                    f'python -I "{s}/dream.py" finish "`whoami`"',
                    f'python -I "{s}/dream.py" finish "$HOME"',
                    f'python -I "{s}/dream.py" finish s ; rm -rf x',
                    f'python -I "{s}/dream.py" finish s && ls',
                    f'python -I "{s}/dream.py" finish s | tee out.txt',
                    f'python -I "{s}/dream.py" finish s > out.txt',
                    f'python -I "{s}/dream.py" finish s < in.txt',
                    f'python -I "{s}/dream.py" finish (s)',                 # parentheses outside quotes
                    f'python -I "{s}/dream.py" finish "s',                  # a quote left open
                    f'python -I "{s}/dream.py"\nrm -rf x',
                    f'python -I "{s}/notascript.txt" finish s',
                    f'python -I "{self.tmp}/elsewhere/scripts/dream.py" finish s',   # another directory: the guard pins its own
                    f'& python -I "{s}/dream.py" finish s',
                    "python"):
            self.assertEqual(self.guard(cmd), "deny", cmd)

    def test_an_agent_never_gets_a_shell(self):
        self.assertEqual(self.guard(f'python -I "{self.scripts}/dream.py" finish s', agent_id="a1"), "deny")

    def test_the_evidence_check_uses_the_same_rule_for_any_install_path(self):
        known = {n.lower() for n in os.listdir(dream.HERE) if n.endswith(".py")}
        self.assertTrue(dream.is_plugin_script('python -I "C:/another/install/scripts/dream.py" finish "s"'))
        self.assertTrue(dream.is_plugin_script('python -I "C:/Program Files (x86)/p/scripts/check.py" start s'))
        for cmd in ('python -c "print(1)" C:/x/scripts/', "ls", 'python -I "C:/x/scripts/other.py" finish s',
                    'python -I "C:/x/notscripts/dream.py" finish s', 'python -I C:/x/scripts/dream.py finish "$(id)"'):
            self.assertFalse(dream.is_plugin_script(cmd), cmd)
        self.assertTrue(common.lead_script_command('python C:/x/scripts/dream.py', None, known))
        self.assertFalse(common.lead_script_command('python C:/x/scripts/nothere.py', None, known))

    def test_what_the_guard_allows_the_evidence_check_accepts(self):
        for name in ("dream.py", "check.py", "prepare.py"):
            cmd = f'python -I "{self.scripts}/{name}" finish "s"'
            self.assertEqual(self.guard(cmd), "allow")
            self.assertTrue(dream.is_plugin_script(cmd), cmd)


if __name__ == "__main__":
    unittest.main()
