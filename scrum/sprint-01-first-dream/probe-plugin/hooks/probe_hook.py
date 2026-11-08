"""PBI-003 probe hook: logs every PreToolUse call; optionally allows or denies writes.

Flag files in ~/.claude-dream/probe/ switch behaviour:
  allow  -> return permissionDecision "allow" for Write/Edit
  deny   -> return permissionDecision "deny" for Write/Edit whose path contains FORBIDDEN, and for Bash/WebFetch/WebSearch
"""
import json, os, sys, time

base = os.path.join(os.path.expanduser("~"), ".claude-dream", "probe")
os.makedirs(base, exist_ok=True)
raw = sys.stdin.read()
try:
    data = json.loads(raw)
except Exception:
    data = {"unparsed": raw[:500]}

tool = data.get("tool_name")
tin = data.get("tool_input") or {}
path = tin.get("file_path") or ""
rec = {
    "ts": time.strftime("%Y-%m-%dT%H:%M:%S"),
    "event": data.get("hook_event_name"),
    "session_id": data.get("session_id"),
    "agent_id": data.get("agent_id"),
    "agent_type": data.get("agent_type"),
    "permission_mode": data.get("permission_mode"),
    "cwd": data.get("cwd"),
    "tool": tool,
    "path": path,
    "command": tin.get("command"),
    "keys": sorted(data.keys()),
}
decision = None
if os.path.exists(os.path.join(base, "deny")):
    if tool in ("Bash", "PowerShell", "WebFetch", "WebSearch") or (tool in ("Write", "Edit") and "FORBIDDEN" in path):
        decision = "deny"
if decision is None and os.path.exists(os.path.join(base, "allow")) and tool in ("Write", "Edit"):
    decision = "allow"
rec["decision"] = decision
with open(os.path.join(base, "hooklog.jsonl"), "a", encoding="utf-8") as f:
    f.write(json.dumps(rec, ensure_ascii=False) + "\n")
if decision:
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": decision,
        "permissionDecisionReason": "dream-probe " + decision,
    }}))
sys.exit(0)
