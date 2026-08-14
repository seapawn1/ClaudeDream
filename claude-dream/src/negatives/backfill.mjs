#!/usr/bin/env node
// PBI-01.1·AC6：漏网场补捞。未触发 SessionEnd 的会话（强杀/崩溃/断电……）不会走
// session-end.mjs 那条路，底片就永远留白——本模块扫这个项目名下所有逐字稿，跟台账
// 对比，把还没处理过的都机械补上。由 trigger-check.mjs 在每次散会/梦触发时顺带跑一次
// （AC6 原文「下一个机械触发点」），也可通过 adapter.json 的 commands.backfill 单独调用。
//
// 刻意不用 Agent SDK 的 listSessions()——它虽然自己不发网络请求，但引入 SDK 包依赖
// 会让 AC2「压缩链路不引用 Agent SDK」的静态检查直接失守。改用官方文档明确写死的编码
// 规则（sessions#where-transcripts-are-stored：「工作目录路径的非字母数字字符替换成 -」）
// 自己算目录名——用这个项目自己的两个真实目录名核对过，规则完全对得上：
//   D:\ClaudeDream                                          -> D--ClaudeDream
//   D:\ClaudeDream\.claude\worktrees\sprint-02-negatives-work -> D--ClaudeDream--claude-worktrees-sprint-02-negatives-work

import { existsSync, readdirSync, statSync, readFileSync, createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { dreamPaths } from '../lib/paths.mjs';
import { processSessionTranscript } from './write-negative.mjs';
import { readLedger } from './ledger.mjs';

const DEFAULT_STALE_MINUTES = 30;
// 官方文档：编码后的目录名超过 200 字符会被截断并追加一段 hash，hash 算法未公开——
// 与其猜错不如老实承认这个边界够不着，留痕跳过（比自建一个大概率错误的路径更安全）。
const MAX_ENCODED_LENGTH = 200;
// D3 review 抓到的坑：编码规则是官方文档写死的「非字母数字字符替换成 -」，这是真实存在的
// 多对一映射——D:\My Project、D:\My-Project、D:\My.Project 编码后是同一个目录名。两个不同
// 项目的逐字稿因此可能同住一个 <projects>/<encoded>/ 目录，不检查就处理会把别的项目的会话
// 内容压缩写进这个项目的底片目录，那是明确因涉隐私才排除入库的地方——跨项目泄漏进去更糟。
// 解法：处理前 peek 逐字稿自己记录的 cwd 字段（每条 transcript entry 都带），跟 root 对不上
// 就跳过，不盲信"同目录=同项目"。只找前 N 行，不为一个字段读全文件。
const CWD_PEEK_MAX_LINES = 20;

function normalizeForCompare(p) {
  return path.resolve(p).replace(/\\/g, '/').toLowerCase();
}

async function peekTranscriptCwd(transcriptPath) {
  const rl = createInterface({ input: createReadStream(transcriptPath, { encoding: 'utf8' }), crlfDelay: Infinity });
  let lineCount = 0;
  try {
    for await (const line of rl) {
      if (!line.trim()) continue;
      lineCount++;
      try {
        const entry = JSON.parse(line);
        if (typeof entry.cwd === 'string' && entry.cwd) return entry.cwd;
      } catch {
        // 这一行解析不出来，跳过找下一行——peek 不是压缩，不需要按 AC3③ 的规格处理坏行。
      }
      if (lineCount >= CWD_PEEK_MAX_LINES) break;
    }
  } finally {
    rl.close();
  }
  return null;
}

function encodedProjectDir(root) {
  return root.replace(/[^a-zA-Z0-9]/g, '-');
}

function projectsRoot() {
  const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  return path.join(configDir, 'projects');
}

function loadDreamSessionIds(paths) {
  if (!existsSync(paths.dreamSessionIdsLog)) return new Set();
  return new Set(
    readFileSync(paths.dreamSessionIdsLog, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)
  );
}

/**
 * @param {object} opts
 * @param {string} opts.root 项目根目录
 * @param {string} [opts.transcriptsDir] 显式指定扫描目录，覆盖「按 root 反推编码目录名」的
 *   默认推导——验收考场需要把 backfill 指向自备的沙箱逐字稿目录，跳过对真实
 *   ~/.claude/projects/<编码> 的依赖。不传时回退读 CLAUDE_DREAM_BACKFILL_TRANSCRIPTS_DIR
 *   环境变量（同一个覆盖口径，供 commands.sessionEnd 这种只吃 stdin JSON、没有 CLI flag
 *   通道的调用方用——子进程默认继承父进程环境变量，考场只需在起 sessionEnd 那个进程上设
 *   这个变量即可透传到它内部顺带触发的补捞，不用改 session-end.mjs/trigger-check.mjs 一行代码；
 *   第二轮验收实锤的真回归——sessionEnd 内部补捞此前没有任何重定向通道，落回自动推导扫了
 *   真实 ~/.claude/projects，把历史会话底片污染进了考场）。两种途径提供时都连带跳过下面的
 *   长度上限检查（那条检查只保护自动推导路径）与 cwd-mismatch 碰撞守卫（那条守卫防的是
 *   "按 root 反推编码目录发生多对一碰撞"，显式指定扫描目录时调用方已经明确知道要扫哪里，
 *   碰撞前提不存在）；root/cwd 仍照常决定 negativeDir/ledger 等产出落点，两者互不影响。
 * @returns {Promise<object>} 扫描摘要，含每个候选会话的处理结果
 */
export async function backfillNegatives({ root, transcriptsDir: transcriptsDirOverride } = {}) {
  const paths = dreamPaths(root);

  let transcriptsDir = transcriptsDirOverride || process.env.CLAUDE_DREAM_BACKFILL_TRANSCRIPTS_DIR || undefined;
  const isExplicitTranscriptsDir = Boolean(transcriptsDir);
  if (!transcriptsDir) {
    const encoded = encodedProjectDir(root);
    if (encoded.length > MAX_ENCODED_LENGTH) {
      return { status: 'skipped-path-too-long', encodedLength: encoded.length };
    }
    transcriptsDir = path.join(projectsRoot(), encoded);
  }
  if (!existsSync(transcriptsDir)) {
    // 全新项目、一场会话都还没跑过——没什么可补的，不是故障。
    return { status: 'no-transcripts-dir', transcriptsDir };
  }

  const dreamSessionIds = loadDreamSessionIds(paths);
  const parsedStale = Number(process.env.CLAUDE_DREAM_BACKFILL_STALE_MINUTES);
  const staleMinutes = Number.isFinite(parsedStale) && parsedStale >= 0 ? parsedStale : DEFAULT_STALE_MINUTES;
  const staleMs = staleMinutes * 60 * 1000;

  let files;
  try {
    // 只看这一层的 *.jsonl，不递归——子 agent 独立稿在 subagents/ 子目录，
    // 是已声明的盲区（SprintBacklog 注意点8），本轮不处理。
    files = readdirSync(transcriptsDir).filter((f) => f.endsWith('.jsonl'));
  } catch (err) {
    return { status: 'error', reason: String(err?.message ?? err) };
  }

  // D3 review 第二轮：短路判据要读台账，一次性读进来给整个循环复用（读的是这一刻的快照，
  // 循环中途另一个进程改了台账也没关系——最坏情况是这次跑漏用一次短路机会，退回完整路径，
  // 从不会因为这个快照过时而误判"没有新内容"，真正的准确性仍由 processSessionTranscript
  // 里加锁的 sliceNewEntries 兜底）。
  const ledgerSnapshot = readLedger(paths.negativeLedger);

  const results = [];
  for (const file of files) {
    const sessionId = file.slice(0, -'.jsonl'.length);

    // AC6①：排除梦会话自己的逐字稿（机械登记比对，见 run-dream.mjs 的 dreamSessionIdsLog）。
    if (dreamSessionIds.has(sessionId)) {
      results.push({ sessionId, status: 'skipped-dream-session' });
      continue;
    }

    const transcriptPath = path.join(transcriptsDir, file);

    // AC6②活稿判别：mtime 距今太近，说明这场会话大概率还在进行中，不碰——
    // 「口径如 mtime 静默超阈值」，阈值可配（CLAUDE_DREAM_BACKFILL_STALE_MINUTES），默认 30 分钟。
    let stat;
    try {
      stat = statSync(transcriptPath);
    } catch {
      results.push({ sessionId, status: 'skipped-stat-failed' });
      continue;
    }
    if (Date.now() - stat.mtimeMs < staleMs) {
      results.push({ sessionId, status: 'skipped-active' });
      continue;
    }

    // D3 review 第二轮抓到的坑：这里以前的注释断言"已覆盖的会话是 O(1) 判断"，实际不是——
    // 判定"没有新内容"要先做 settle-wait 再整读完整份 jsonl，成本随文件体积和历史会话数
    // 线性增长，每次散会触发的 backfill 都要重扫一遍。这里用上面 statSync 顺手拿到的当前
    // 字节数，跟台账里记的"上次稳定读取时的字节数"比一比——jsonl 只追加不改写历史（这也是
    // sliceNewEntries 本身依赖的不变量），字节数没变就等于没有新内容，可以安全跳过下面的
    // cwd-peek 和整套 settle-wait+整读。台账没这条记录（从没成功写过一页）或字节数对不上——
    // 落回原来的完整路径，不冒险。
    const priorBytes = ledgerSnapshot[sessionId]?.lastProcessedBytes;
    if (typeof priorBytes === 'number' && priorBytes === stat.size) {
      results.push({ sessionId, status: 'skipped-no-new-by-size' });
      continue;
    }

    // 目录编码碰撞防线（D3 review）：这份逐字稿自己记录的 cwd 跟 root 对不上，说明它属于
    // 另一个编码到同一目录名的项目——跳过，不把别人的会话内容压缩进这个项目的底片目录。
    // peek 不出 cwd（罕见——前 20 行都没有该字段）时保守放行，不因为读不到就不敢处理正常数据。
    // 第二轮验收抓到的坑：这条守卫只对"按 root 反推编码目录"的自动推导路径有意义（碰撞是
    // 编码规则的多对一映射造成的）；transcriptsDir 由调用方显式指定时，调用方已经明确知道
    // 要扫哪个目录，不存在"猜错目录撞上别的项目"这回事，继续套用这条守卫反而会把 cwd 字段
    // 跟 root 参数碰巧不一致的合法夹具（比如验收考场的合成逐字稿）误判成跨项目内容而丢弃。
    if (!isExplicitTranscriptsDir) {
      let entryCwd;
      try {
        entryCwd = await peekTranscriptCwd(transcriptPath);
      } catch {
        entryCwd = null;
      }
      if (entryCwd && normalizeForCompare(entryCwd) !== normalizeForCompare(root)) {
        results.push({ sessionId, status: 'skipped-cwd-mismatch', entryCwd });
        continue;
      }
    }

    // AC6④（逐字稿已被官方清理跳过不报错）与 AC6③（台账原子写、补捞可重入）都由
    // processSessionTranscript 自己保证——backfill 与 session-end.mjs 共用同一条编排逻辑，
    // 不是各写一套指望它们碰巧行为一致。
    const outcome = await processSessionTranscript({ root, sessionId, transcriptPath });
    results.push({ sessionId, ...outcome });
  }

  return { status: 'scanned', transcriptsDir, fileCount: files.length, results };
}

// CLI 入口：node backfill.mjs [--transcripts-dir=<扫描目录覆盖>] [root]（adapter.json commands.backfill）
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const transcriptsDirArg = args.find((a) => a.startsWith('--transcripts-dir='));
  const transcriptsDir = transcriptsDirArg ? transcriptsDirArg.slice('--transcripts-dir='.length) : undefined;
  const root = args.find((a) => !a.startsWith('--')) || process.cwd();
  backfillNegatives({ root, transcriptsDir }).then((summary) => {
    console.log(JSON.stringify(summary, null, 2));
  });
}
