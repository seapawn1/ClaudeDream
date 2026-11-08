---
name: dream
description: ClaudeDream - look back over past Claude Code sessions and consolidate memory. Run only when the user asks for it.
disable-model-invocation: true
argument-hint: "[--projects-dir <path>]"
allowed-tools:
  - Bash(python *)
  - PowerShell(python *)
  - Workflow
  - Read
---

!`python -I "${CLAUDE_PLUGIN_ROOT}/scripts/dream.py" plan "${CLAUDE_SESSION_ID}" $ARGUMENTS`

The dream pipeline is not built yet (Sprint 01 skeleton). Show the output above verbatim and stop.
