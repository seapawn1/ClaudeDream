#!/usr/bin/env node
/**
 * 假梦进程 —— 只服务于考卷自检，不是产品实现，一行都不要拿去当参考架构。
 *
 * 它把回环的**形状**走一遍（快照 → 占位整合 → 报告 → 单笔 dream: 提交 → 提示行），
 * 好让 verify.mjs 的判据真的执行到；它并不真的调用 Agent SDK，
 * 也不真的做体检——那正是 Sprint-1 由 developers 交付的东西。
 *
 * 提一句 @anthropic-ai/claude-agent-sdk 是为了让 H-A3 的静态检查跑到有内容的分支上；
 * 这也恰好暴露了 H-A3 是弱判据——"真的经 SDK 起梦"最终要靠 D3 独立 review 认，
 * 考卷只能证明它在源码里被引用。TestPlan §5 对此有明写。
 *
 * FAKE_MODE 是自检的负向对照开关：
 *   sloppy-snapshot  快照用 git add -A，把白名单外的脏改动一起卷进去 → H-A4 应转红
 *   two-commits      把梦拆成两笔提交 → H-A7 应转红
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs'

const WHITELIST = ['.claude/memory/', '.claude/dream/', 'CLAUDE.md']
const MODE = process.env.FAKE_MODE ?? ''
const ROGUE = process.argv.includes('--rogue-write-outside')
const stamp = new Date().toISOString().replace(/[:.]/g, '-')

const git = (args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

mkdirSync('.claude/dream', { recursive: true })

/** 假的 canUseTool 围栏：白名单外一律拒绝并留证。 */
function canWrite(path) {
  const ok = WHITELIST.some((w) => (w.endsWith('/') ? path.startsWith(w) : path === w))
  if (!ok) {
    appendFileSync(`.claude/dream/${stamp}-canUseTool.log`,
      `${new Date().toISOString()} DENY Write(${path}) — 梦势力范围外，只可写 ${WHITELIST.join('、')}\n`, 'utf8')
  }
  return ok
}

// ---- 故障注入：蓄意越界，证明围栏真的拦得住（TestPlan §3.2）----
if (ROGUE) {
  const target = 'src/cli.js'
  if (canWrite(target)) writeFileSync(target, '越界写入\n', 'utf8')
  process.exit(0)
}

// ---- P0 梦前快照：pathspec 只收三处 ----
if (MODE === 'sloppy-snapshot') git(['add', '-A'])
else git(['add', '--', ...WHITELIST])
git(['commit', '--allow-empty', '-m', `dream: snapshot ${stamp}`])
const snapshot = git(['rev-parse', 'HEAD'])

// ---- S6/S7 占位引擎：走过场，不判内容 ----
const memo = '.claude/memory/cli-entrypoint.md'
if (canWrite(memo) && existsSync(memo)) {
  writeFileSync(memo, readFileSync(memo, 'utf8') + '\n<!-- 占位引擎到此一游，本轮不判内容 -->\n', 'utf8')
}

// ---- S8 梦报告：六节骨架，内容可为占位 ----
const report = `.claude/dream/${stamp}-placeholder.md`
writeFileSync(report, `# 梦报告 ${stamp}（占位）

体检：占位引擎，本轮不判准确性。
整合：占位处置 1 笔。

## 图 delta 对账

8 条记忆 → 8 条（本轮占位，无增删）

## 30 秒版

- 占位整合 1 笔，未删任何记忆
- 整梦撤销：\`git revert <本次 dream 提交>\`

## 明细

| 动作 | 判据 | 证据 | 单条回滚 |
|---|---|---|---|
| 占位改动 cli-entrypoint | 占位 | 占位 | \`git checkout ${snapshot} -- ${memo}\` |

## 隔离观察区

本梦无隔离。

## 抽查点

- \`git show ${snapshot}\` —— 看梦前快照

## 阀门状态

enabled: true ｜ claude_md_edits: true ｜ delete_policy: quarantine-first
`, 'utf8')

// ---- S9 单笔 dream: 提交 + 下次会话提示行 ----
writeFileSync('.claude/dream/latest.txt',
  `昨夜做了一场梦：占位整合 1 笔，报告 -> ${report}\n`, 'utf8')

if (MODE === 'two-commits') {
  git(['add', '--', '.claude/memory'])
  git(['commit', '-m', 'dream: 占位整合（第一笔）'])
  git(['add', '--', ...WHITELIST])
  git(['commit', '-m', 'dream: 报告与提示（第二笔）'])
} else {
  git(['add', '--', ...WHITELIST])
  git(['commit', '-m', 'dream: 占位整合 1 笔'])
}
