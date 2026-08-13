#!/usr/bin/env node
// PBI-04.2 AC0 spike：canUseTool 能否在写 .claude/memory/ 时被调用并放行。
// 跑在隔离的 scratch/ 目录里，不碰本仓库真实 .claude/。用后即弃。

import { query } from '@anthropic-ai/claude-agent-sdk';
import { mkdirSync, existsSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scratch = path.join(__dirname, 'scratch');

rmSync(scratch, { recursive: true, force: true });
mkdirSync(path.join(scratch, '.claude', 'memory'), { recursive: true });

const log = [];

// 移植自 engine/scope-guard.py 的 judge_path，规则不变：只放行 .claude/memory/、.claude/dream/、CLAUDE.md
function judgePath(filePath, cwd) {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  const rel = path.relative(cwd, abs).split(path.sep).join('/');
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return { allow: false, reason: `目标在项目外: ${filePath}` };
  }
  if (rel.startsWith('.claude/memory/') || rel.startsWith('.claude/dream/')) {
    return { allow: true, reason: '梦势力范围内' };
  }
  if (rel === 'CLAUDE.md') {
    return { allow: true, reason: 'CLAUDE.md 阀门开启（spike 默认放行）' };
  }
  return { allow: false, reason: `梦势力范围外: ${rel}` };
}

const canUseTool = async (toolName, input) => {
  const entry = { toolName, input, ts: new Date().toISOString() };
  if (['Write', 'Edit', 'NotebookEdit'].includes(toolName)) {
    const { allow, reason } = judgePath(input.file_path ?? '', scratch);
    entry.decision = allow ? 'allow' : 'deny';
    entry.reason = reason;
    log.push(entry);
    return allow
      ? { behavior: 'allow', updatedInput: input }
      : { behavior: 'deny', message: reason };
  }
  entry.decision = 'allow';
  entry.reason = '非文件写工具，spike 全放行';
  log.push(entry);
  return { behavior: 'allow', updatedInput: input };
};

const RECURSION_GUARD_VALUE = 'claude-dream-spike-ac0';

const prompt = `这是一次结构验证任务，严格按步骤做，每步都要用工具真的执行，不要只描述、不要提前结束、不要为省事合并步骤：
1. 用你实际可用的 shell 工具（可能叫 Bash 也可能叫 PowerShell，看你有什么就用什么）读出环境变量 CLAUDE_INVOKED_BY 的值，写入 .claude/memory/env-check.txt——PowerShell 下用 \`echo $env:CLAUDE_INVOKED_BY > .claude/memory/env-check.txt\`，POSIX shell 下用 \`echo "$CLAUDE_INVOKED_BY" > .claude/memory/env-check.txt\`，两者选与你工具匹配的那条，原样执行不要改写。
2. 用 Write 工具在 .claude/memory/spike-ac0-proof.md 写入内容 "canUseTool spike OK"。
3. 用 Write 工具在当前目录（项目根，不是 .claude/memory 里）写入一个名为 spike-ac0-escape.md 的文件，内容随意。这一步预期会被拒绝——如果被拒绝就直接停止，不要重试、不要换路径、不要换用其他工具绕过。
4. 三步都尝试完就结束，用一句话总结三步各自的结果。`;

let finalResult = null;
let errorCaught = null;

try {
  for await (const msg of query({
    prompt,
    options: {
      cwd: scratch,
      permissionMode: 'default',
      canUseTool,
      // 'user' 加载 ~/.claude/settings.json——本机鉴权（CLAUDE_CODE_OAUTH_TOKEN）走这层注入，
      // Bash 工具子进程环境本身不带这个变量（大概率是刻意的安全边界），必须让子进程自己读盘拿。
      settingSources: ['user'],
      maxTurns: 8,
      env: { ...process.env, CLAUDE_INVOKED_BY: RECURSION_GUARD_VALUE },
    },
  })) {
    if (msg.type === 'result') {
      finalResult = { subtype: msg.subtype, result: msg.result ?? null };
    }
  }
} catch (err) {
  errorCaught = { message: err?.message ?? String(err), stack: err?.stack ?? null };
}

const proofPath = path.join(scratch, '.claude', 'memory', 'spike-ac0-proof.md');
const escapePath = path.join(scratch, 'spike-ac0-escape.md');
const envCheckPath = path.join(scratch, '.claude', 'memory', 'env-check.txt');

const outcome = {
  errorCaught,
  finalResult,
  canUseToolInvoked: log.length > 0,
  invocations: log,
  allowedWriteLanded: existsSync(proofPath),
  allowedWriteContent: existsSync(proofPath) ? readFileSync(proofPath, 'utf8') : null,
  deniedWriteBlocked: !existsSync(escapePath),
  recursionGuardEnvReadable: existsSync(envCheckPath) && readFileSync(envCheckPath, 'utf8').trim() === RECURSION_GUARD_VALUE,
  recursionGuardEnvFileContent: existsSync(envCheckPath) ? readFileSync(envCheckPath, 'utf8').trim() : null,
};

writeFileSync(path.join(__dirname, 'result.json'), JSON.stringify(outcome, null, 2));
console.log(JSON.stringify(outcome, null, 2));
