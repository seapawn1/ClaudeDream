---
name: smoke
description: ClaudeDream smoke test for a new environment (Sprint 01). Run only when the user asks for it.
disable-model-invocation: true
allowed-tools:
  - Bash(python *)
  - PowerShell(python *)
  - Workflow
  - Read
---

The plugin's start script has already run. Its output:

!`python -I "${CLAUDE_PLUGIN_ROOT}/scripts/smoke.py" start "${CLAUDE_SESSION_ID}"`

Do exactly these three things, in order, and nothing else:

1. Call the Workflow tool with `name: "claude-dream:smoke-run"` and `args: {"workdir": "<the WORKDIR value above>"}`. Wait for it to finish.
2. Run this command with your shell tool: `python -I "${CLAUDE_PLUGIN_ROOT}/scripts/smoke.py" finish "${CLAUDE_SESSION_ID}"`
3. Show the output of step 2 verbatim, then the workflow's returned value verbatim.
