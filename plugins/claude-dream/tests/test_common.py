import os
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "scripts"))
import common  # noqa: E402
import guard  # noqa: E402


class ProjectsDir(unittest.TestCase):
    """PBI-012 acceptance: default is <config dir>/projects; a parameter means only that dir."""

    def test_default_without_env(self):
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("CLAUDE_CONFIG_DIR", None)
            self.assertEqual(common.resolve_projects_dir(),
                             os.path.join(os.path.expanduser("~"), ".claude", "projects"))

    def test_default_follows_config_dir(self):
        with mock.patch.dict(os.environ, {"CLAUDE_CONFIG_DIR": "C:/acct/config"}):
            self.assertEqual(common.resolve_projects_dir(),
                             os.path.join(os.path.abspath("C:/acct/config"), "projects"))

    def test_parameter_wins(self):
        with mock.patch.dict(os.environ, {"CLAUDE_CONFIG_DIR": "C:/acct/config"}):
            self.assertEqual(common.resolve_projects_dir("D:/elsewhere/projects"),
                             os.path.abspath("D:/elsewhere/projects"))


class Guard(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.state = {"workdir": self.tmp, "write_roots": [self.tmp],
                      "plugin_root": "C:/plugins/claude-dream"}

    def d(self, **kw):
        return guard.decide(kw, self.state)[0]

    def test_agent_shell_denied(self):
        self.assertEqual(self.d(tool_name="PowerShell", agent_id="a1", tool_input={"command": "echo hi"}), "deny")
        self.assertEqual(self.d(tool_name="Bash", agent_id="a1", tool_input={"command": "ls"}), "deny")

    def test_lead_plugin_script_allowed_only(self):
        ok = 'python -I "C:/plugins/claude-dream/scripts/smoke.py" finish "s1"'
        self.assertEqual(self.d(tool_name="PowerShell", tool_input={"command": ok}), "allow")
        self.assertEqual(self.d(tool_name="Bash", tool_input={"command": "python other.py"}), "deny")
        self.assertEqual(self.d(tool_name="Bash", tool_input={"command": ok + " ; rm -rf x"}), "deny")

    def test_network_and_mcp_denied(self):
        self.assertEqual(self.d(tool_name="WebFetch", tool_input={}), "deny")
        self.assertEqual(self.d(tool_name="mcp__x__y", tool_input={}), "deny")

    def test_writes(self):
        inside = os.path.join(self.tmp, "a", "b.md")
        self.assertEqual(self.d(tool_name="Write", agent_id="a1", tool_input={"file_path": inside}), "allow")
        self.assertEqual(self.d(tool_name="Edit", agent_id="a1", tool_input={"file_path": "C:/elsewhere/x.md"}), "deny")
        self.assertEqual(self.d(tool_name="Write", tool_input={"file_path": self.tmp + "-sibling/x"}), "deny")

    def test_reads_untouched(self):
        self.assertIsNone(self.d(tool_name="Read", agent_id="a1", tool_input={"file_path": "C:/anything"}))


if __name__ == "__main__":
    unittest.main()
