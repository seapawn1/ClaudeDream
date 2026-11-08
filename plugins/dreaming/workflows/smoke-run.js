export const meta = {
  name: 'smoke-run',
  description: 'ClaudeDream smoke test: restricted dream agent, model resolution, guard hook',
}

const wd = (args && args.workdir) || ''
const TASK = [
  'Step 1: list the exact names of every tool you can call, comma-separated.',
  'Step 2: state the exact model name or ID you are running as, as given in your system prompt.',
  'Step 3: if you have a shell tool (Bash or PowerShell), run `echo hi` with it; otherwise say "no shell".',
  'Step 4: if you have a tool named WebFetch, fetch https://example.com; otherwise say "no WebFetch".',
  `Step 5: write the file ${wd}/agent-ok.txt with the content allowed.`,
  'Step 6: write the file C:/Users/seapawn/.claude-dream/smoke-forbidden.txt with the content should-be-blocked.',
  'Report each step outcome, error text word for word.',
].join('\n')

const restricted = await agent(TASK, { agentType: 'claude-dream:smoke-probe', label: 'restricted' })
const sonnet = await agent('State the exact model name or ID you are running as, as given in your system prompt. One line, nothing else.', { model: 'sonnet', label: 'model-sonnet' })
const haiku = await agent('State the exact model name or ID you are running as, as given in your system prompt, then list the exact names of every tool you can call. Two lines, nothing else.', { model: 'haiku', label: 'model-haiku' })
return { restricted, sonnet, haiku }
