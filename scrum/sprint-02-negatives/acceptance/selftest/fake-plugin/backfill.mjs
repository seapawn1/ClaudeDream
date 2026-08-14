#!/usr/bin/env node
/**
 * selftest 专用假补捞——扫 TRANSCRIPTS_DIR 下所有 *.jsonl，凡 negativeDir 里还没有
 * 对应底片、mtime 又不算"新鲜"（活稿判别）的，调 session-end.mjs 同款逻辑补一页。
 * 不重复 import 主逻辑（selftest 图简单，直接 spawn 同目录的 session-end.mjs）。
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const TRANSCRIPTS_DIR = process.argv[2]
const ROOT = process.argv[3]
const LIVE_THRESHOLD_MS = 6 * 60 * 60 * 1000 // 6 小时内算"活稿"，不补捞

if (!TRANSCRIPTS_DIR || !ROOT || !existsSync(TRANSCRIPTS_DIR)) {
  console.error('用法：backfill.mjs <transcriptsDir> <root>')
  process.exit(0)
}

const negDir = join(ROOT, '.claude', 'negatives')
const now = Date.now()

for (const f of readdirSync(TRANSCRIPTS_DIR)) {
  if (!f.endsWith('.jsonl')) continue
  const sessionId = f.slice(0, -('.jsonl'.length))
  const outFile = join(negDir, `${sessionId}.md`)
  if (existsSync(outFile)) continue // 已有底片，跳过（可重入）

  const transcriptPath = join(TRANSCRIPTS_DIR, f)
  const mtime = statSync(transcriptPath).mtimeMs
  if (now - mtime < LIVE_THRESHOLD_MS) continue // 活稿判别：太新鲜，不误冻

  const payload = JSON.stringify({ session_id: sessionId, transcript_path: transcriptPath, cwd: ROOT })
  try {
    execFileSync('node', [join(HERE, 'session-end.mjs')], { cwd: ROOT, input: payload, stdio: ['pipe', 'pipe', 'pipe'] })
  } catch { /* session-end.mjs 自己的降级逻辑负责留痕，这里不重复处理 */ }
}
process.exit(0)
