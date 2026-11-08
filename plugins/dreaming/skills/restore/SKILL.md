---
name: restore
description: ClaudeDream - undo the latest dream run that wrote memory back (or the run named with --run), restoring the memory directories exactly as they were. Run only when the user asks for it.
disable-model-invocation: true
argument-hint: "[--run <run-id>] [--force]"
allowed-tools:
  - Bash(python *)
  - PowerShell(python *)
---

Run this command with your shell tool and show its output verbatim, nothing else:
`python -I "${CLAUDE_PLUGIN_ROOT}/scripts/dream.py" restore "${CLAUDE_SESSION_ID}" $ARGUMENTS`

If it says files changed after the dream wrote them back, do not run it again with --force unless the user asks for that.
