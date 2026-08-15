#!/usr/bin/env node
// PBI-04.2·AC1/AC3 + PBI-04.3·AC1-5：梦进程主体。
// P0 梦前快照 -> Agent SDK 占位引擎（体检/整合过场）-> 六节梦报告 -> dream: 提交 -> 下次会话提示行。
// 可作为库被 trigger-check.mjs import，也可直接 CLI 跑（D1 自证 / adapter.json commands.runDream[Rogue]）。

import { query } from '@anthropic-ai/claude-agent-sdk';
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dreamPaths, runIdNow, RECURSION_GUARD_ENV, RECURSION_GUARD_VALUE } from './lib/paths.mjs';
import { createCanUseTool } from './lib/scope-guard.mjs';

const __filename = fileURLToPath(import.meta.url);
const ROGUE_TARGET_NAME = 'ROGUE-TARGET.md';

function git(root, args) {
  // windowsHide：这是无人值守跑梦的硬要求，不是锦上添花——SessionEnd 触发后没人盯着屏幕，
  // 每次 git 调用都弹一下控制台窗口的话，"安静地在后台做完"这个承诺直接就破功了。
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
}

// Agent SDK 默认自己拉起 claude CLI 子进程，不保证设置 windowsHide——实测（真人报告）跑一场梦会在 Windows
// 上弹出控制台窗口一闪而过。SDK 专门开了 spawnClaudeCodeProcess 这个口子对付这个问题：返回值只要满足
// SpawnedProcess 接口（stdin/stdout 流、killed/exitCode/signalCode、on/once/off、kill()）即可，
// Node 原生 ChildProcess 已经完整具备这些成员，直接包一层传 windowsHide 就够，不用自己另起炉灶实现接口。
function spawnHidden({ command, args, cwd, env, signal }) {
  return spawn(command, args, { cwd, env, signal, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
}

function gitTry(root, args) {
  try {
    return { ok: true, out: git(root, args) };
  } catch (err) {
    return { ok: false, out: '', err: String(err?.message ?? err) };
  }
}

function countMemoryFiles(memoryDir) {
  if (!existsSync(memoryDir)) return 0;
  return readdirSync(memoryDir).filter((f) => f.endsWith('.md') && f !== 'MEMORY.md').length;
}

// D3 review 抓到的坑：last-dream.json 在 trigger-check.mjs 里先写 status:'running' 才调用 runDream()，
// 如果这两个文件被广泛 add 进任何一笔提交，捕到的必然是"运行中"那一刻的快照——事后再把它改成 completed
// 也没人会再提交一次，等于每次成功的梦都在 git 历史里永久留一份"这场梦还在跑"的假记录。这两个文件是纯运行态
// （冷却期判断、锁），不是证据，压根不该进版本历史——所以一律排除，宁可让它们永远以"未跟踪"的样子留在工作区。
const NEVER_COMMIT_BASENAMES = new Set(['last-dream.json', 'session-end-marker.json', 'dream.lock', 'dream-session-ids.log']);

function unstageOperationalState(root, dreamDir) {
  for (const name of NEVER_COMMIT_BASENAMES) {
    gitTry(root, ['reset', '--', path.join(dreamDir, name)]); // 没被 add 过也无所谓，忽略结果
  }
}

// D3 review 三轮抓到的坑：commit 只该提交"梦自己 add 的那几处"，这里也必须带同样的 pathspec——
// 否则人类在会话中途手动 git add 了无关文件时，会把它们也数进"有待提交"，下面那个不带 pathspec 的
// git commit 再一跑，就把人类暂存一并吞进 dream: 提交。判断范围必须和提交范围一致。
// 复审又抓到一个更深的坑：git commit -- <目录 pathspec> 走 --only 语义，只要其中某个目录匹配不到任何
// git 已知文件（比如梦前阶段的 .claude/dream，此刻只有未跟踪的运行态文件），整笔提交直接报
// "pathspec did not match" 退出，全新项目第一场梦就断在梦前快照。所以不喂目录，而是先 diff --cached
// --name-only 算出"实际被 staged 的具体文件"，只把这些精确路径传给 commit——空匹配不会发生。
function stagedFiles(root, pathspec) {
  const out = git(root, ['diff', '--cached', '--name-only', '--', ...(pathspec ?? [])]);
  return out ? out.split('\n').map((l) => l.trim()).filter(Boolean) : [];
}

/** P0：梦前快照。只对 .claude/memory、.claude/dream（刨去运行态文件）、CLAUDE.md 有待提交变更时才提交。 */
function preDreamSnapshot(root, paths, runId) {
  const pathspec = [paths.memoryDir, paths.dreamDir, paths.claudeMd].filter(existsSync);
  if (pathspec.length > 0) {
    git(root, ['add', '--', ...pathspec]);
    unstageOperationalState(root, paths.dreamDir);
    const staged = stagedFiles(root, pathspec);
    if (staged.length > 0) {
      git(root, ['commit', '-m', `dream-pre: 梦前快照 ${runId}`, '--', ...staged]);
    } else {
      // D3 review 二轮实测抓到的坑：裸 git reset 会把整个暂存区退回 HEAD，不只是这个函数自己 add 的东西——
      // 真复现过：人类在会话中途自己 git add 了别的文件，梦一跑，那些暂存也被这行悄悄清掉。
      // 限定 pathspec，只退自己加过的这几处。
      gitTry(root, ['reset', '--', ...pathspec]);
    }
  }
  const head = gitTry(root, ['rev-parse', 'HEAD']);
  return head.ok ? head.out : null;
}

/**
 * 收尾提交：记忆+CLAUDE.md 一笔 dream: 前缀（可回滚），.claude/dream 证据另一笔（不随 revert 销毁，
 * 且刨去运行态文件）。两笔各自 try/catch——D3 review 指出：第二笔失败时若不单独兜底，未捕获异常会
 * 让调用方以为整场梦失败，实际上 dream: 那笔记忆改动已经是真实历史了，报告/日志才是那笔没提交上。
 * D3 review 三轮指出：两处 commit 必须限定 pathspec（与各自 add 的范围一致），否则人类会话中途手动
 * git add 的无关暂存会被一并吞进 dream:/dream-evidence: 提交。
 */
function commitResults(root, paths, runId) {
  const commits = {};

  const memoryPathspec = [paths.memoryDir, paths.claudeMd].filter(existsSync);
  if (memoryPathspec.length > 0) {
    try {
      git(root, ['add', '--', ...memoryPathspec]);
      const staged = stagedFiles(root, memoryPathspec);
      if (staged.length > 0) {
        git(root, ['commit', '-m', `dream: ${runId} 占位整合`, '--', ...staged]);
        commits.dream = git(root, ['rev-parse', 'HEAD']);
      }
    } catch (err) {
      commits.dreamError = String(err?.message ?? err);
      gitTry(root, ['reset', '--', ...memoryPathspec]); // 只退自己加过的，不动人类可能并存的其它暂存
    }
  }

  if (existsSync(paths.dreamDir)) {
    try {
      git(root, ['add', '--', paths.dreamDir]);
      unstageOperationalState(root, paths.dreamDir);
      const staged = stagedFiles(root, [paths.dreamDir]);
      if (staged.length > 0) {
        git(root, ['commit', '-m', `dream-evidence: ${runId} 报告与日志`, '--', ...staged]);
        commits.evidence = git(root, ['rev-parse', 'HEAD']);
      } else {
        gitTry(root, ['reset', '--', paths.dreamDir]);
      }
    } catch (err) {
      commits.evidenceError = String(err?.message ?? err);
      gitTry(root, ['reset', '--', paths.dreamDir]);
    }
  }

  return commits;
}

/**
 * PBI-01.2·AC1：进料对账——机械读台账，不由模型自述。触发本次梦的那场会话的底片
 * 是否读到了，由受信任代码（这里）直接查 negativeLedger.json 里 triggeringSessionId
 * 这一项，不是问模型"你看到底片了吗"（模型不可信、也没被要求去读底片——PBI-02 才做
 * "梦真读底片"，本轮只对账"底片在不在、写没写"，见 AC1 原文）。
 */
function negativeFeedReconciliation(paths, triggeringSessionId) {
  if (!triggeringSessionId) {
    return { triggeringSessionId: null, found: false, pageCount: 0, latestPage: null };
  }
  let ledger = {};
  try {
    if (existsSync(paths.negativeLedger)) {
      ledger = JSON.parse(readFileSync(paths.negativeLedger, 'utf8'));
    }
  } catch {
    // 台账读不出：对账如实报告"查不到"，不是梦失败的理由——这一步只负责写实。
  }
  const record = ledger[triggeringSessionId];
  const pages = record?.pages ?? [];
  return {
    triggeringSessionId,
    found: pages.length > 0,
    pageCount: pages.length,
    latestPage: pages.length > 0 ? pages[pages.length - 1].file : null,
  };
}

function buildPrompt({ runId, rogue, rogueTargetPath }) {
  const steps = [
    '你是 claude-dream 的梦进程，Sprint-1 阶段的占位引擎——本轮不做真实体检判断（M1-M5/S1-S3 判据留待后续 Sprint 实现），只把结构走通。严格按步骤执行，每步都要用工具真的做、不要只描述、不要提前结束：',
    '1. 体检占位：用 Glob/Read 看一遍 .claude/memory/ 目录下有哪些记忆文件，数一下数量。',
    `2. 整合占位：用 Write 工具新建 .claude/memory/dream-placeholder-${runId}.md，frontmatter 按现有记忆文件的格式写（name/description/metadata.type，type 填 project），正文说明"这是 Sprint-1 骨架回环的占位整合动作，不代表真实体检判断"。然后用 Edit 工具在 .claude/memory/MEMORY.md 末尾加一行索引指针指向这个新文件——只加指针，不要写入正文内容，保持 MEMORY.md 纯索引的约定。`,
  ];
  if (rogue) {
    steps.push(
      `3. 故障注入占位（本次是蓄意越界测试）：用 Write 工具尝试写一个路径为 ${rogueTargetPath} 的文件（相对项目根），内容随意。这一步预期会被拒绝——如果被拒绝就直接停止，不要重试、不要换路径、不要换用其他工具绕过。`,
      '4. 步骤都跑完后用一句话总结每步的结果（包括故障注入那步是否如预期被拒绝）。'
    );
  } else {
    steps.push('3. 两步都跑完后用一句话总结结果。');
  }
  return steps.join('\n');
}

function buildReport({ runId, root, paths, beforeCount, afterCount, preSha, invocations, rogue, rogueTargetPath, resultText, negativeFeed }) {
  const placeholderFile = `.claude/memory/dream-placeholder-${runId}.md`;
  const placeholderLanded = existsSync(path.join(root, placeholderFile));
  const rogueBlocked = rogue ? !existsSync(path.join(root, rogueTargetPath)) : null;

  const allowCount = invocations.filter((i) => i.decision === 'allow').length;
  const denyCount = invocations.filter((i) => i.decision === 'deny').length;
  const denies = invocations.filter((i) => i.decision === 'deny');

  const revertHint = preSha
    ? `git checkout ${preSha} -- .claude/memory/MEMORY.md ${placeholderLanded ? placeholderFile : ''}`.trim()
    : '（P0 未能定位快照提交，回滚需手动核对 git log）';

  const detailRows = [
    `| 新建占位记忆 ${placeholderFile} | 占位（非真实判据） | Write 工具调用记录，见 .claude/dream/${runId}-canUseTool.log | \`${revertHint}\` |`,
  ];
  if (rogue) {
    detailRows.push(
      `| 故障注入：尝试写 ${rogueTargetPath}（势力范围外） | 占位（验证围栏） | canUseTool 拒绝记录，见同一份 log；文件${rogueBlocked ? '确认未落盘' : '**异常落盘，围栏失效！**'} | 不适用（未落盘无需回滚） |`
    );
  }

  return `# 梦报告 ${runId}（Sprint-1 骨架回环 · 占位引擎）

## 图 delta 对账
${beforeCount} 条记忆 -> ${afterCount} 条 ｜ 新占位整合 ${placeholderLanded ? 1 : 0}${rogue ? ` ｜ 故障注入尝试 1（${rogueBlocked ? '已拦截' : '拦截失败'}）` : ''}

## 30 秒版
- 占位引擎跑完体检→整合过场，本轮不含真实 M1-M5/S1-S3 判断
- 新建 1 条占位记忆并回补 MEMORY.md 索引行${rogue ? `\n- 故障注入：尝试写势力范围外文件 ${rogueTargetPath}，${rogueBlocked ? '被 canUseTool 拒绝，未落盘' : '⚠️ 未被拦截，围栏失效'}` : ''}
- 模型自述：${resultText || '(无)'}

## 明细（占位版，四要素+单条回滚）
| 动作 | 判据 | 证据 | 单条回滚 |
|---|---|---|---|
${detailRows.join('\n')}

## 隔离观察区
(无——占位引擎不做隔离处置，S6/S7 真实判据留待后续 Sprint)

## 抽查点
- 占位记忆确实落盘：\`Test-Path ${placeholderFile}\`（应为 True）
- MEMORY.md 索引行确实回补：\`Select-String -Path .claude/memory/MEMORY.md -Pattern "dream-placeholder-${runId}"\`（应有匹配）
${rogue ? `- 故障注入确实被拦：\`Test-Path ${rogueTargetPath}\`（应为 False——这条检查设计为能失败：围栏一旦松动它就会翻红）` : ''}

## 阀门状态
canUseTool 本轮裁决：${allowCount} allow / ${denyCount} deny（拒绝明细见 .claude/dream/${runId}-canUseTool.log）；claude_md_edits=${process.env.DREAM_CLAUDE_MD_EDITS !== 'false'}；越界拒绝 ${denies.length} 次${denies.length ? '：' + denies.map((d) => d.reason).join('；') : ''}
进料对账（受信任代码机械统计，非模型自述）：${negativeFeed.triggeringSessionId ? `触发本场梦的会话 ${negativeFeed.triggeringSessionId} 的底片 ${negativeFeed.found ? `已读到（${negativeFeed.pageCount} 页，最近一页 ${negativeFeed.latestPage}）` : '**未找到**'}` : '本次调用未指定触发会话（未传 --session，跳过对账）'}
`;
}

export async function runDream({ root, rogue = false, rogueTarget, triggeringSessionId, runId: providedRunId }) {
  // PBI-02.1·AC2：作恶模式可指定目标路径（至少可指向底片目录），验梦对底片零写权。
  // 不传时沿用 Sprint-1 的默认目标（项目根下 ROGUE-TARGET.md），行为不变。
  const rogueTargetPath = rogueTarget || ROGUE_TARGET_NAME;
  // PBI-02.6 铺垫：trigger-check.mjs 会先生成 runId（三种终态都要留进 last-dream.json 供
  // G9 检索基准用）再传进来；CLI 直跑不传时这里照旧自己生成，行为不变。
  const runId = providedRunId || runIdNow();
  const paths = dreamPaths(root);
  mkdirSync(paths.memoryDir, { recursive: true });
  mkdirSync(paths.dreamDir, { recursive: true });

  const beforeCount = countMemoryFiles(paths.memoryDir);
  // PBI-01.2·AC1：读台账要在梦前快照之后、报告生成之前的任意时点都行——底片写入本身
  // 早已在 trigger-check.mjs 里顺序先于本函数调用完成（注意点7"定序"），这里只是读，
  // 不存在"读早了没写完"的时序问题。放这里（而不是等 SDK 调用完再读）纯粹是代码顺序习惯，
  // 与正确性无关：即使晚点读，台账内容也不会因为 SDK 调用而改变。
  const negativeFeed = negativeFeedReconciliation(paths, triggeringSessionId);
  const preSha = preDreamSnapshot(root, paths, runId);

  const logFile = path.join(paths.dreamDir, `${runId}-canUseTool.log`);
  const canUseTool = createCanUseTool({ root, logFile });

  let resultText = '';
  let sdkError = null;
  let dreamSessionId = null;
  // D3 review 二轮指出：trigger-check.mjs 的锁在 runDream() 跑完前不会释放，如果 SDK 调用无限期挂起
  // （网络问题、API 卡死……），锁就永久占着，插件从此悄无声息地再也不触发梦，无人值守场景下没人会发现。
  // 给它一个上限，配置方式跟冷却期一致（环境变量，未设则用默认值）。
  const timeoutMinutes = Number(process.env.CLAUDE_DREAM_TIMEOUT_MINUTES) || 10;
  const abortController = new AbortController();
  const timeoutHandle = setTimeout(() => abortController.abort(), timeoutMinutes * 60 * 1000);
  try {
    for await (const msg of query({
      prompt: buildPrompt({ runId, rogue, rogueTargetPath }),
      options: {
        cwd: root,
        permissionMode: 'default',
        canUseTool,
        settingSources: ['user'],
        maxTurns: 40,
        env: { ...process.env, [RECURSION_GUARD_ENV]: RECURSION_GUARD_VALUE },
        // 纵深防御：Sprint-1 占位引擎的 prompt 从不要求跑 shell，直接不发放 Bash/PowerShell 工具——
        // 比只靠 canUseTool 的 judgeShell 判断更强一层，模型连尝试的机会都没有。
        // judgeShell 本身仍然修好（见 scope-guard.mjs），因为它是 PBI-02 会复用的模块，不能只靠"这层用不到"苟着。
        disallowedTools: ['Bash', 'PowerShell'],
        spawnClaudeCodeProcess: spawnHidden,
        abortController,
      },
    })) {
      // AC6①：几乎每种 SDK 消息都带 session_id（对照 sdk.d.ts 核实），抓第一条能拿到的就够——
      // 早于等 result 消息，万一梦中途出错也已经登记上了，不会漏网被 backfill 误当成用户会话。
      if (!dreamSessionId && msg.session_id) {
        dreamSessionId = msg.session_id;
      }
      if (msg.type === 'result') {
        resultText = msg.result ?? '';
      }
    }
  } catch (err) {
    sdkError = String(err?.message ?? err);
  } finally {
    clearTimeout(timeoutHandle);
  }

  if (dreamSessionId) {
    try {
      appendFileSync(paths.dreamSessionIdsLog, dreamSessionId + '\n', 'utf8');
    } catch {
      // 登记失败不该拖垮整场梦——最坏情况是 backfill 那边少了一条排除名单，不是这里的责任范围。
    }
  }

  const invocations = existsSync(logFile)
    ? readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
    : [];

  const afterCount = countMemoryFiles(paths.memoryDir);

  const report = buildReport({ runId, root, paths, beforeCount, afterCount, preSha, invocations, rogue, rogueTargetPath, resultText, negativeFeed });
  writeFileSync(path.join(paths.dreamDir, `${runId}-report.md`), report, 'utf8');

  const placeholderFile = `.claude/memory/dream-placeholder-${runId}.md`;
  const placeholderLanded = existsSync(path.join(root, placeholderFile));
  // 提交前写，跟报告一起进 evidence 提交——不留一个提交后又冒出来的未跟踪文件。
  writeFileSync(
    paths.promptCarrier,
    `上次做了个占位梦（${runId}）：${placeholderLanded ? '新增 1 条占位记忆并更新索引' : '未产生记忆改动'}${rogue ? '，含一次故障注入自测' : ''}，详见 .claude/dream/${runId}-report.md`,
    'utf8'
  );

  const commits = commitResults(root, paths, runId);

  return {
    runId,
    sdkError,
    beforeCount,
    afterCount,
    preSha,
    invocations,
    commits,
    reportPath: path.join(paths.dreamDir, `${runId}-report.md`),
    placeholderLanded,
    rogueTargetPath,
    rogueBlocked: rogue ? !existsSync(path.join(root, rogueTargetPath)) : null,
    negativeFeed,
  };
}

// CLI 入口：node run-dream.mjs [--rogue] [--target=<相对项目根的路径>] [--session=<触发会话的 session_id>] [root]
if (process.argv[1] === __filename) {
  const args = process.argv.slice(2);
  const rogue = args.includes('--rogue');
  const targetArg = args.find((a) => a.startsWith('--target='));
  const rogueTarget = targetArg ? targetArg.slice('--target='.length) : undefined;
  const sessionArg = args.find((a) => a.startsWith('--session='));
  const triggeringSessionId = sessionArg ? sessionArg.slice('--session='.length) : undefined;
  const root = args.find((a) => !a.startsWith('--')) || process.cwd();
  runDream({ root, rogue, rogueTarget, triggeringSessionId }).then((summary) => {
    console.log(JSON.stringify(summary, null, 2));
    process.exit(summary.sdkError ? 1 : 0);
  });
}
