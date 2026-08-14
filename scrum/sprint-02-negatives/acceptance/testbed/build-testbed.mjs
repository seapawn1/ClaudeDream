#!/usr/bin/env node
/**
 * build-testbed.mjs — 确定性生成 negatives-lab 考场（虚构目标项目 + 冻结逐字稿台账）。
 *
 * 运行后在本脚本同级目录下生成：
 * - negatives-lab/：一个独立 git 仓库（与外层 ClaudeDream 仓库无关），2 个提交，
 *   .claude/memory/ 与 .claude/dream/ 齐备（沿用 Sprint-1 占位引擎的最小运行条件），
 *   底片目录**故意不存在**——AC1「落固定只追加目录」该由实现自己首次创建；
 * - negatives-lab-transcripts/：8 个逐字稿文件，落在 negatives-lab/ 之外
 *   （镜像真实 ~/.claude/projects/*.jsonl 在项目外的事实），文件名＝session id。
 *   内容来自 testbed/fixtures/ 下两份定稿：
 *     · real-session-frozen.jsonl —— 冻结的真会话逐字稿（107 行原稿 + 1 行验收埋的
 *       标记话，标记文本＝ACCEPTANCE-MARKER-7f3c1a91，供 E 场景回程检索用），
 *       复制给 MAIN/CONCURRENT_1/CONCURRENT_2/ORPHAN/STALE/LIVE/DREAM_INVOKED 七个身份，
 *       每份复制时把内嵌的 sessionId 字段替换成目标身份，保持内容自洽；
 *     · unknown-type-entry.jsonl —— 手造小样本，含 1 条规则表出卷时没见过的 type，
 *       供 AC3③「未知条目类型保守保留＋留痕」用，只发 UNKNOWN_TYPE 一个身份。
 *
 * 与 sprint-01-skeleton 的 dream-lab 是两个独立考场，互不引用——各自 sprint 的
 * 验收包应能单独重跑，不因对方分支的状态而改变结果。
 *
 * 所有文件内容硬编码、提交日期固定 → 重跑结果一致（含 commit SHA）。
 * mtime 类的时间态判据（STALE/LIVE 的活稿判别）留给 verify.mjs 在场景执行前现场造，
 * 不在此处预置——考场只管"内容摆对"，"时间态怎么摆"是场景语义,归 verify.mjs。
 */

import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync, existsSync, chmodSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const LAB = join(HERE, 'negatives-lab')
const TRANSCRIPTS = join(HERE, 'negatives-lab-transcripts')
const FIXTURES = join(HERE, 'fixtures')

/**
 * 清空目录内容，但**保留目录本身**（Windows EPERM/EBUSY 规避，抄 Sprint-1 build-testbed.mjs
 * 的写法：.git/objects 只读需先 chmod；目录本身可能被某进程占着 cwd，删内容不受影响）。
 */
function clearDirectory(target) {
  if (!existsSync(target)) {
    mkdirSync(target, { recursive: true })
    return
  }
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    const p = join(target, entry.name)
    if (entry.isDirectory()) {
      clearDirectory(p)
      rmSync(p, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    } else {
      try { chmodSync(p, 0o666) } catch { /* 尽力而为，真删不掉时下面会报错 */ }
      rmSync(p, { force: true, maxRetries: 5, retryDelay: 100 })
    }
  }
}

const GIT_BASE = [
  '-c', 'user.name=lab-dev',
  '-c', 'user.email=dev@lab.test',
  '-c', 'commit.gpgsign=false',
  '-c', 'core.autocrlf=false',
]

function git(args, date) {
  const env = { ...process.env }
  if (date) {
    env.GIT_AUTHOR_DATE = date
    env.GIT_COMMITTER_DATE = date
  }
  return execFileSync('git', [...GIT_BASE, ...args], {
    cwd: LAB, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function write(relpath, content) {
  const p = join(LAB, relpath)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, content.replace(/\r\n/g, '\n'), 'utf8')
}

function commit(message, date, pathspec) {
  git(['add', '--', ...pathspec], date)
  git(['commit', '-m', message], date)
}

// ---------------------------------------------------------------- 会话身份台账
// verify.mjs 引用同一份常量（各自文件里各放一份字面量，两脚本按文件系统状态协作，
// 不互相 import——沿用 Sprint-1 verify.mjs / build-testbed.mjs 的解耦方式）。
export const SESSION_IDS = {
  MAIN: '9a49720b-15ae-4445-9ddc-de88d0657612', // A/B/E/G：真逐字稿冻结稿，含标记话
  UNKNOWN_TYPE: '11111111-2222-3333-4444-555555555555', // A：未知条目类型
  CONCURRENT_1: 'c0000000-0000-0000-0000-000000000001', // H：并发散会之一
  CONCURRENT_2: 'c0000000-0000-0000-0000-000000000002', // H：并发散会之二
  ORPHAN: 'f0000000-0000-0000-0000-00000000000f', // F：从未触发散会，靠补捞发现
  STALE: 'f0000000-0000-0000-0000-0000000000a1', // F：mtime 陈旧——该被补捞
  LIVE: 'f0000000-0000-0000-0000-0000000000a2', // F：mtime 新鲜——不该被误冻
  DREAM_INVOKED: 'd0000000-0000-0000-0000-000000000d', // F①：CLAUDE_INVOKED_BY 会话，禁止压成底片
  WRITE_FAIL: 'e0000000-0000-0000-0000-00000000ee01', // C：写失败注入专用身份，不与其他场景共用
  OFFLINE_CHECK: 'e0000000-0000-0000-0000-00000000ee02', // G：断网自证专用身份
}

const FIXTURE_PLAN = [
  { sessionId: SESSION_IDS.MAIN, source: 'real-session-frozen.jsonl', originalSessionId: '9a49720b-15ae-4445-9ddc-de88d0657612' },
  { sessionId: SESSION_IDS.UNKNOWN_TYPE, source: 'unknown-type-entry.jsonl', originalSessionId: '11111111-2222-3333-4444-555555555555' },
  { sessionId: SESSION_IDS.CONCURRENT_1, source: 'real-session-frozen.jsonl', originalSessionId: '9a49720b-15ae-4445-9ddc-de88d0657612' },
  { sessionId: SESSION_IDS.CONCURRENT_2, source: 'real-session-frozen.jsonl', originalSessionId: '9a49720b-15ae-4445-9ddc-de88d0657612' },
  { sessionId: SESSION_IDS.ORPHAN, source: 'real-session-frozen.jsonl', originalSessionId: '9a49720b-15ae-4445-9ddc-de88d0657612' },
  { sessionId: SESSION_IDS.STALE, source: 'real-session-frozen.jsonl', originalSessionId: '9a49720b-15ae-4445-9ddc-de88d0657612' },
  { sessionId: SESSION_IDS.LIVE, source: 'real-session-frozen.jsonl', originalSessionId: '9a49720b-15ae-4445-9ddc-de88d0657612' },
  { sessionId: SESSION_IDS.DREAM_INVOKED, source: 'real-session-frozen.jsonl', originalSessionId: '9a49720b-15ae-4445-9ddc-de88d0657612' },
  { sessionId: SESSION_IDS.WRITE_FAIL, source: 'real-session-frozen.jsonl', originalSessionId: '9a49720b-15ae-4445-9ddc-de88d0657612' },
  { sessionId: SESSION_IDS.OFFLINE_CHECK, source: 'real-session-frozen.jsonl', originalSessionId: '9a49720b-15ae-4445-9ddc-de88d0657612' },
]

/** 复制定稿到目标 session id 下，内嵌 sessionId 字段随之替换，保持内容自洽。 */
function stageTranscript({ sessionId, source, originalSessionId }) {
  const raw = readFileSync(join(FIXTURES, source), 'utf8')
  const restamped = raw.split(originalSessionId).join(sessionId)
  writeFileSync(join(TRANSCRIPTS, `${sessionId}.jsonl`), restamped, 'utf8')
}

// ---------------------------------------------------------------- negatives-lab 内容

const README = `# negatives-lab

Sprint-2-negatives 验收考场的虚构目标项目。跟 sprint-01-skeleton 的 dream-lab
是同一路数的假考场，专供占位梦引擎（Sprint-1 交付）+ 底片产线（本 sprint 交付）
在上面转一圈用，不是真产品代码。
`

const CLAUDE_MD = `# negatives-lab

假项目，验收考场专用。梦势力范围：\`.claude/memory/\`、\`.claude/dream/\`、本文件。
底片目录不在此列——落点由 developers 在 adapter.json 的 \`paths.negativeDir\` 声明，
势力范围外，梦不该碰。
`

const PACKAGE_JSON = `{
  "name": "negatives-lab",
  "private": true,
  "type": "module",
  "version": "0.0.0"
}
`

const GITIGNORE = `node_modules/
`

const MEMORY_MD = `# MEMORY.md

（考场初始为空索引，梦占位引擎跑过之后会追加条目——见 D2 auto-memory 契约。）
`

const DREAM_VALVE = `---
cooldown_minutes: 30
---

考场阀门配置，跑场景前由 verify.mjs 按需现场改写（比如把冷却期状态设成"刚梦过"）。
`

function buildLab() {
  clearDirectory(LAB)
  git(['init', '-q'])
  git(['config', 'commit.gpgsign', 'false'])

  write('README.md', README)
  write('CLAUDE.md', CLAUDE_MD)
  write('package.json', PACKAGE_JSON)
  write('.gitignore', GITIGNORE)
  commit('考场落地：negatives-lab 骨架', '2026-08-14T01:00:00+00:00', ['README.md', 'CLAUDE.md', 'package.json', '.gitignore'])

  write('.claude/memory/MEMORY.md', MEMORY_MD)
  write('.claude/claude-dream.local.md', DREAM_VALVE)
  commit('考场落地：记忆库与阀门配置就位（.claude/dream/ 故意留空，等自建）', '2026-08-14T01:05:00+00:00', ['.claude/memory/MEMORY.md', '.claude/claude-dream.local.md'])
}

function buildTranscripts() {
  clearDirectory(TRANSCRIPTS)
  for (const plan of FIXTURE_PLAN) stageTranscript(plan)
}

buildLab()
buildTranscripts()

const head = git(['rev-parse', '--short', 'HEAD']).trim()
const commitCount = git(['rev-list', '--count', 'HEAD']).trim()
const dirty = git(['status', '--porcelain']).trim()
console.log(`考场就位（negatives-lab）：提交数 ${commitCount}，HEAD ${head}，工作树${dirty ? '有未跟踪改动——不正常，请检查' : '干净'}`)
console.log(`逐字稿台账（negatives-lab-transcripts/）：${FIXTURE_PLAN.length} 份，会话身份见 SESSION_IDS`)
