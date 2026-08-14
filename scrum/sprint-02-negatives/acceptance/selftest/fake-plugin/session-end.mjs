#!/usr/bin/env node
/**
 * selftest 专用假产品——只为自证 verify.mjs 自身的判断逻辑没写错，不是真实现。
 * 规则极简、写死：user:text/user:string/user:tool_result/assistant:text/未知类型 → 留；
 * attachment/assistant:thinking/file-history-snapshot → 剔。见同目录 RULES.md。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'

const ROOT = process.cwd()
const NEG_DIR = join(ROOT, '.claude', 'negatives')
const LEDGER = join(NEG_DIR, '.ledger.jsonl')
const ERROR_TRACE = join(ROOT, '.claude', 'negatives-errors.log')

function traceErr(msg) {
  mkdirSync(dirname(ERROR_TRACE), { recursive: true })
  appendFileSync(ERROR_TRACE, `${new Date().toISOString()} ${msg}\n`, 'utf8')
}

const KNOWN_TYPES = new Set(['user', 'assistant', 'attachment', 'file-history-snapshot'])

function classify(line) {
  let obj
  try { obj = JSON.parse(line) } catch { return null }
  if (!KNOWN_TYPES.has(obj.type)) return { keep: true, text: line, why: 'unknown-type-conservative' }
  if (obj.type === 'attachment' || obj.type === 'file-history-snapshot') return { keep: false, text: line }
  if (obj.type === 'user') {
    const c = obj.message?.content
    if (typeof c === 'string') return { keep: true, text: c }
    if (Array.isArray(c)) {
      const kept = c.filter((b) => b.type === 'text' || b.type === 'tool_result')
      if (!kept.length) return { keep: false, text: line }
      return { keep: true, text: kept.map((b) => (b.type === 'text' ? b.text : JSON.stringify(b))).join('\n') }
    }
    return { keep: false, text: line }
  }
  if (obj.type === 'assistant') {
    const c = obj.message?.content
    if (Array.isArray(c)) {
      const kept = c.filter((b) => b.type === 'text')
      if (!kept.length) return { keep: false, text: line }
      return { keep: true, text: kept.map((b) => b.text).join('\n') }
    }
    return { keep: false, text: line }
  }
  return { keep: false, text: line }
}

function main() {
  const raw = readStdinSync()
  if (!raw || !raw.trim()) {
    traceErr('empty-stdin: no session to compress, exiting without writing a negative')
    process.exit(0)
  }

  let payload
  try { payload = JSON.parse(raw) } catch (err) {
    traceErr(`bad-json: ${err.message}`)
    process.exit(0)
  }

  const { session_id, transcript_path } = payload
  if (!session_id || !transcript_path) {
    traceErr('missing session_id/transcript_path in stdin payload')
    process.exit(0)
  }

  if (process.env.CLAUDE_INVOKED_BY === 'claude-dream') {
    traceErr(`excluded dream-invoked session ${session_id}`)
    process.exit(0)
  }

  if (process.env.SELFTEST_WRITE_FAIL === '1') {
    traceErr(`write-failure injected for ${session_id}, degraded silently`)
    process.exit(0)
  }

  mkdirSync(NEG_DIR, { recursive: true })
  const outFile = join(NEG_DIR, `${session_id}.md`)
  if (existsSync(outFile)) {
    process.exit(0) // 幂等：已处理过，不产生第二页，也不改字节
  }

  if (!existsSync(transcript_path)) {
    traceErr(`transcript missing (assumed cleaned up by official retention): ${transcript_path}`)
    process.exit(0)
  }

  const beforeBytes = statSync(transcript_path).size
  const lines = readFileSync(transcript_path, 'utf8').trim().split('\n')
  const kept = []
  for (const line of lines) {
    const c = classify(line)
    if (c?.keep) kept.push(c.text)
  }
  const body = `# 底片 ${session_id}\n\n压缩前 ${beforeBytes} 字节 → 压缩后 ??? 字节\n\n` + kept.join('\n\n')
  const afterBytes = Buffer.byteLength(body, 'utf8')
  const finalBody = body.replace('??? 字节', `${afterBytes} 字节`)
  writeFileSync(outFile, finalBody, 'utf8')

  mkdirSync(dirname(LEDGER), { recursive: true })
  appendFileSync(LEDGER, JSON.stringify({ sessionId: session_id, at: new Date().toISOString(), beforeBytes, afterBytes: Buffer.byteLength(finalBody, 'utf8') }) + '\n', 'utf8')

  console.log(`negatives: ${session_id} 压缩前 ${beforeBytes} 字节 → 压缩后 ${Buffer.byteLength(finalBody, 'utf8')} 字节`)
  process.exit(0)
}

function readStdinSync() {
  try { return readFileSync(0, 'utf8') } catch { return '' }
}

main()
