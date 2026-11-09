"""Replays every lead shell command in every hook log under ~/.claude-dream/runs through the two rules that decide on it
(the guard's rule, pinned to the command's own scripts folder, and the evidence check's rule) and lists the commands where
a rule disagrees with what the guard decided at the time. Run it before changing the rule for the lead's commands
(common.lead_script_command): a rule that blocks a command the lead really ran would fail a real run.

  python -I tools/replay_lead_commands.py [plugin root]     (default: plugins/dreaming, next to this folder)

Sprint 01: 31 allowed and 1 blocked command, 0 disagreements (0.2.3). A hook log line that cannot be read is counted apart.
"""
import collections
import glob
import json
import os
import shlex
import sys

sys.stdout.reconfigure(encoding="utf-8")
here = os.path.dirname(os.path.abspath(__file__))
root = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, "..", "plugins", "dreaming")
sys.path.insert(0, os.path.join(root, "scripts"))
import common  # noqa: E402
import dream  # noqa: E402

res, bad = collections.Counter(), []
for log in glob.glob(os.path.expanduser("~/.claude-dream/runs/*/hooklog.jsonl")):
    for line in open(log, encoding="utf-8"):
        if not line.strip():
            continue
        try:
            r = json.loads(line)
        except ValueError:
            res["(unparseable line)"] += 1
            continue
        if r.get("agent_id") or r.get("tool") not in ("Bash", "PowerShell"):
            continue
        cmd, dec = r.get("command"), r.get("decision")
        ev = dream.is_plugin_script(cmd)
        scripts_dir = None
        try:
            parts = shlex.split((cmd or "").replace("\\", "/"))
            script = next(p for p in parts[1:] if not p.startswith("-"))
            scripts_dir = os.path.dirname(script)
        except Exception:
            pass
        pinned = bool(scripts_dir) and common.lead_script_command(cmd, scripts_dir)
        res[(r.get("tool"), dec, ev, pinned)] += 1
        if (dec == "allow") != ev or (dec == "allow") != pinned:
            bad.append((dec, ev, pinned, (cmd or "")[:100]))
print("(tool, logged decision, evidence rule, pinned rule): count")
for k, v in sorted(res.items(), key=str):
    print(" ", k, v)
print("disagreements between the logged decision and the rules:", len(bad))
for b in bad:
    print("  ", b)
