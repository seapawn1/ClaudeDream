"""PreToolUse guard. Does nothing unless a dream run is active for this session.

During a run:
- agents (subagents and workflow agents) may not use a shell;
- the lead may run only this plugin's own scripts with python;
- nobody may use network tools or MCP tools;
- Write/Edit/MultiEdit/NotebookEdit are allowed only inside the run's write roots
  (allowed explicitly, so no permission prompt), and denied everywhere else.
Every call during a run is logged to <workdir>/hooklog.jsonl.
"""
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402

SHELL = {"Bash", "PowerShell"}
NETWORK = {"WebFetch", "WebSearch"}
WRITE = {"Write", "Edit", "MultiEdit", "NotebookEdit"}


def decide(data, state):
    tool = data.get("tool_name") or ""
    tin = data.get("tool_input") or {}
    agent = data.get("agent_id")
    if tool in SHELL:
        if agent:
            return "deny", "ClaudeDream: agents may not use a shell during a dream run"
        cmd = (tin.get("command") or "").replace("\\", "/").lower()
        scripts = (os.path.join(state["plugin_root"], "scripts") + "/").replace("\\", "/").lower()
        if cmd.lstrip().startswith("python") and scripts in cmd and not any(c in cmd for c in ";&|`$("):
            return "allow", "ClaudeDream: lead runs a plugin script"
        return "deny", "ClaudeDream: the lead may only run the plugin's own scripts during a dream run"
    if tool in NETWORK or tool.startswith("mcp__"):
        return "deny", "ClaudeDream: no network or MCP tools during a dream run"
    if tool in WRITE:
        path = tin.get("file_path") or tin.get("notebook_path") or ""
        if common.within(path, state["write_roots"]):
            return "allow", "ClaudeDream: write inside the run's work dir"
        return "deny", "ClaudeDream: writes outside the run's work dir are blocked during a dream run"
    return None, None


def main():
    try:
        data = json.loads(sys.stdin.read() or "{}")
    except Exception:
        return 0
    state = common.active_state(data.get("session_id"))
    if not state:
        return 0  # not a dream run: do nothing
    decision, reason = decide(data, state)
    tin = data.get("tool_input") or {}
    rec = {
        "ts": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "agent_id": data.get("agent_id"),
        "agent_type": data.get("agent_type"),
        "tool": data.get("tool_name"),
        "path": tin.get("file_path") or tin.get("notebook_path"),
        "command": tin.get("command"),
        "decision": decision,
    }
    try:
        with open(os.path.join(state["workdir"], "hooklog.jsonl"), "a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    except OSError:
        pass
    if decision:
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": decision,
            "permissionDecisionReason": reason,
        }}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
