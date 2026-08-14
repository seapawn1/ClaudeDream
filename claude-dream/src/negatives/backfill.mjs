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
 * @returns {Promise<object>} 扫描摘要，含每个候选会话的处理结果
 */
export async function backfillNegatives({ root }) {
  const paths = dreamPaths(root);
  const encoded = encodedProjectDir(root);

  if (encoded.length > MAX_ENCODED_LENGTH) {
    return { status: 'skipped-path-too-long', encodedLength: encoded.length };
  }

  const transcriptsDir = path.join(projectsRoot(), encoded);
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
    let mtimeMs;
    try {
      mtimeMs = statSync(transcriptPath).mtimeMs;
    } catch {
      results.push({ sessionId, status: 'skipped-stat-failed' });
      continue;
    }
    if (Date.now() - mtimeMs < staleMs) {
      results.push({ sessionId, status: 'skipped-active' });
      continue;
    }

    // 目录编码碰撞防线（D3 review）：这份逐字稿自己记录的 cwd 跟 root 对不上，说明它属于
    // 另一个编码到同一目录名的项目——跳过，不把别人的会话内容压缩进这个项目的底片目录。
    // peek 不出 cwd（罕见——前 20 行都没有该字段）时保守放行，不因为读不到就不敢处理正常数据。
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

    // AC6④（逐字稿已被官方清理跳过不报错）与 AC6③（台账原子写、补捞可重入）都由
    // processSessionTranscript 自己保证——backfill 与 session-end.mjs 共用同一条编排逻辑，
    // 不是各写一套指望它们碰巧行为一致。
    const outcome = await processSessionTranscript({ root, sessionId, transcriptPath });
    results.push({ sessionId, ...outcome });
  }

  return { status: 'scanned', transcriptsDir, fileCount: files.length, results };
}

// CLI 入口：node backfill.mjs [root]（adapter.json commands.backfill）
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] || process.cwd();
  backfillNegatives({ root }).then((summary) => {
    console.log(JSON.stringify(summary, null, 2));
  });
}
