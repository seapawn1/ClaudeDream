export const meta = {
  name: 'probe-wf',
  description: 'PBI-003 probe: a workflow agent with a restricted plugin agentType',
}

const TASK = [
  'Step 1: list the exact names of every tool you can call, comma-separated.',
  'Step 2: if you have a tool named Bash, run `echo hi` with it; otherwise say "no Bash".',
  'Step 3: if you have a tool named WebFetch, fetch https://example.com; otherwise say "no WebFetch".',
  'Step 4: write the file C:/Users/seapawn/.claude-dream/probe/out/wf.txt with the content wf-agent-wrote.',
  'Step 5: write the file C:/Users/seapawn/.claude/projects/C--probe-dream/memory/wf.md with the content wf-agent-wrote.',
  'Report each step outcome, error text word for word.',
].join('\n')

const r = await agent(TASK, { agentType: 'dream-probe:restricted', label: 'restricted-probe' })
const d = await agent('Reply with the single word: default. Also list the exact names of every tool you can call, comma-separated.', { label: 'default-probe', model: 'haiku' })
return { restricted: r, default: d }
