#!/usr/bin/env node
/**
 * 假插件的 SessionEnd hook —— 只服务于考卷自检，不是产品实现。
 * 零 API、零判断：读冷却配置、写触发标记，仅此而已。
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { dirname } from 'node:path'

const MARKER = '.claude/dream/.trigger'
const CONFIG = '.claude/claude-dream.local.md'

// 防递归：梦进程自己结束不算一次会话
if (process.env.CLAUDE_INVOKED_BY) process.exit(0)

// FAKE_MODE=no-cooldown 是自检的负向对照：故意无视冷却期
const ignoreCooldown = process.env.FAKE_MODE === 'no-cooldown'

let cooldownMin = 30
if (existsSync(CONFIG)) {
  const m = readFileSync(CONFIG, 'utf8').match(/^\s*cooldown_minutes\s*:\s*(\d+)\s*$/m)
  if (m) cooldownMin = Number(m[1])
}

if (!ignoreCooldown && existsSync(MARKER)) {
  const ageMin = (Date.now() - statSync(MARKER).mtimeMs) / 60000
  if (ageMin < cooldownMin) process.exit(0)   // 冷却期内，不重复触发
}

mkdirSync(dirname(MARKER), { recursive: true })
writeFileSync(MARKER, `${new Date().toISOString()} ${process.hrtime.bigint()}\n`, 'utf8')
