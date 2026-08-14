// 势力范围守门人——canUseTool 进程内回调版，移植自设计冲刺原型 engine/scope-guard.py 的 judge_path，
// 规则不变：只放行 .claude/memory/、.claude/dream/、CLAUDE.md（阀门 DREAM_CLAUDE_MD_EDITS 控制）。
// PBI-04.2·AC0 spike 实测确认：permissionMode "default" + 本回调，在写 .claude 受保护路径时确实被调用、决定确实生效。
//
// 与原型的两处已知差异：
// 1. AC0 spike 实测这台 Windows 机器上 SDK 的 shell 工具叫 "PowerShell"，不是原型只认的 "Bash"——
//    两个工具名都要认，见 SHELL_TOOLS。
// 2. 原型给只读 git 子命令开了白名单；这里两轮 D3 review 之后改成了 Bash/PowerShell 一律拒绝，见 judgeShell
//    上面的长注释——字符串模式匹配挡不住真 shell 的语法花样，干脆不判断内容。

import path from 'node:path';
import { appendFileSync, mkdirSync } from 'node:fs';

const ALWAYS_ALLOW = new Set(['Read', 'Glob', 'Grep', 'TodoWrite']);
const FILE_TOOLS = new Set(['Write', 'Edit', 'NotebookEdit']);
const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);

export function judgePath(filePath, root) {
  if (!filePath) return { allow: false, reason: '空路径' };
  const abs = path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
  const rel = path.relative(root, abs).split(path.sep).join('/');
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return { allow: false, reason: `目标在项目外: ${filePath}` };
  }
  if (rel.startsWith('.claude/memory/') || rel.startsWith('.claude/dream/')) {
    return { allow: true, reason: '梦势力范围内' };
  }
  if (rel === 'CLAUDE.md') {
    const claudeMdEditsOn = process.env.DREAM_CLAUDE_MD_EDITS !== 'false';
    return claudeMdEditsOn
      ? { allow: true, reason: 'CLAUDE.md 阀门开启' }
      : { allow: false, reason: '阀门 claude_md_edits=false：CLAUDE.md 一字不动，降级为报告建议' };
  }
  return { allow: false, reason: `梦势力范围外: ${rel}` };
}

// 两轮 D3 review 都在这里踩出真能执行的洞，教训是同一个：想靠字符串模式匹配判断一条命令"安不安全"，
// 对着一个真 shell（这台机器上确认过是 bash 或 PowerShell，SDK 自己的说明写的）是打不赢的仗。
// 第一轮：GIT_RO 只查"以 git <子命令> 开头"，`git log --output=<path>` 照样放行——补了参数白名单
// （禁止任何 - 开头 token）。第二轮实测证明这照样能绕：加引号让 `--output=` 变成 `"--output=`（不再以 - 开头）；
// bash 的 `<(...)` 进程替换、PowerShell 的 `@(...)` 数组子表达式，两个都不含 -、不含链接字符，但真拿去跑
// 会执行里面的命令——两条都经真实 bash/powershell.exe 复现过，不是纸上谈兵。命令字符串的语法空间比任何黑名单/
// 白名单正则都大，会一直有下一个绕过角度，不值得再赌第五轮。所以彻底不判断内容，Bash/PowerShell 一律拒绝——
// 这不是权宜之计，是唯一在字符串层面就能立住的答案。run-dream.mjs 已经额外用 disallowedTools 在 SDK 层面
// 直接不发这两个工具，本函数是它之外的第二道防线，两层都不给，不是只挡一层。
// 以后如果真需要梦进程做只读 git 检查，正确做法是像 run-dream.mjs 自己的 git() helper 那样，从受信任代码里
// 用 execFileSync(argv 数组) 直接调用——不经过 shell，就没有语法可钻；不要再给模型一条自由拼接的命令字符串。
export function judgeShell(command) {
  return { allow: false, reason: `梦进程不发放 shell 命令执行——字符串层面判断不了安全性，一律拒绝: ${(command ?? '').slice(0, 80)}` };
}

/**
 * @param {object} opts
 * @param {string} opts.root 目标项目根目录（cwd）
 * @param {string} opts.logFile 越界拒绝日志落点，.claude/dream/<runId>-canUseTool.log
 */
export function createCanUseTool({ root, logFile }) {
  mkdirSync(path.dirname(logFile), { recursive: true });

  function log(entry) {
    appendFileSync(logFile, JSON.stringify(entry) + '\n', 'utf8');
  }

  return async function canUseTool(toolName, input) {
    const base = { ts: new Date().toISOString(), toolName, input };

    if (ALWAYS_ALLOW.has(toolName)) {
      return { behavior: 'allow', updatedInput: input };
    }
    if (FILE_TOOLS.has(toolName)) {
      // D3 review 抓到的坑：NotebookEdit 的路径字段叫 notebook_path，不是 file_path（已对照 SDK 自带的
      // sdk-tools.d.ts 核实）。原来的写法会让每次 NotebookEdit 都因为读到 undefined 而落到"空路径"拒绝——
      // 后果是"fail safe"（不会放行任何东西），但判断依据是错的，且从没被跑到过（占位引擎不用这个工具）。
      const targetPath = toolName === 'NotebookEdit' ? input.notebook_path : input.file_path;
      const { allow, reason } = judgePath(targetPath ?? '', root);
      // 第二轮验收：被拒的具体路径此前只藏在 input 字段里、或碰运气出现在 reason 文案的字符串
      // 拼接里，没有一个独立、稳定的字段名能直接取。补一个顶层 targetPath——不管 reason 怎么写、
      // input 结构长什么样，路径都有固定地方能读到。
      log({ ...base, targetPath: targetPath ?? null, decision: allow ? 'allow' : 'deny', reason });
      return allow
        ? { behavior: 'allow', updatedInput: input }
        : { behavior: 'deny', message: reason };
    }
    if (SHELL_TOOLS.has(toolName)) {
      const { allow, reason } = judgeShell(input.command);
      log({ ...base, targetPath: null, decision: allow ? 'allow' : 'deny', reason });
      return allow
        ? { behavior: 'allow', updatedInput: input }
        : { behavior: 'deny', message: reason };
    }
    const reason = `梦进程不发放此工具: ${toolName}`;
    log({ ...base, targetPath: null, decision: 'deny', reason });
    return { behavior: 'deny', message: reason };
  };
}
