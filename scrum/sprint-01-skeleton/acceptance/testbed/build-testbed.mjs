#!/usr/bin/env node
/**
 * build-testbed.mjs — 确定性生成 dream-lab 考场（虚构目标项目）。
 *
 * 运行后在本脚本同级目录下生成 dream-lab/（若已存在先整体删除重建）：
 * - 一个独立 git 仓库（与外层 ClaudeDream 仓库无关），5 个提交，时间线 2026-06-01 ~ 2026-07-28；
 * - ledger-cli：一个小型 Node 记账 CLI 骨架，源码真实可读；
 * - .claude/memory/：8 条记忆 + MEMORY.md 索引，官方 auto-memory 契约完整；
 * - .claude/claude-dream.local.md：阀门配置；
 * - .claude/dream/ 故意不存在——梦第一次跑时应由产品自己创建。
 *
 * 与设计冲刺 Prototype-01 的 acme-api 考场的区别：**本考场不种腐烂**。
 * Sprint-1 的占位引擎不判内容，考场的作用是提供结构齐全的场地（真 git 仓库、
 * 真记忆库、真 CLAUDE.md、白名单外的源码文件），让回环能在上面转一圈。
 * 记忆内容与项目现状一致、索引一一对应、无断链——任何 diff 都应是梦造成的。
 *
 * 所有文件内容硬编码、所有提交日期固定 → 重跑结果一致（含 commit SHA）。
 */

import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync, existsSync, chmodSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const LAB = join(HERE, 'dream-lab')

/**
 * 清空目录内容，但**保留目录本身**。
 *
 * 两个 Windows 坑合起来逼出这个写法，改动前先读完这段：
 * 1. `.git/objects` 里的对象文件是只读的，rmSync 直接 EPERM —— 故先递归 chmod；
 * 2. 只要有任何进程把考场目录当作 cwd（开着的终端、编辑器、上一次没退干净的
 *    node），删除目录本身就 EPERM/EBUSY，而删除它的**内容**不受影响。
 *
 * 考场要被反复重建（D1「一键重跑」），卡在删不掉目录上等于验收根本起不了步。
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
  // 统一 LF：考场跨平台重跑须得到同一份字节，否则 commit SHA 不稳定
  writeFileSync(p, content.replace(/\r\n/g, '\n'), 'utf8')
}

function commit(message, date, pathspec) {
  git(['add', '--', ...pathspec], date)
  git(['commit', '-m', message], date)
}

// ---------------------------------------------------------------- 记忆库

/** 8 条记忆：与项目现状一致，无腐烂、无断链。[[链接]] 两端都存在。 */
const MEMORIES = [
  {
    name: 'cli-entrypoint',
    description: 'ledger-cli 的可执行入口是 src/cli.js，由 package.json 的 bin 字段挂载',
    type: 'project',
    body: `命令行入口在 \`src/cli.js\`，package.json 里 \`bin.ledger\` 指向它。子命令解析是手写的 switch，没有引入 commander 之类的库——依赖表刻意保持为空。

新增子命令要同时改三处：\`src/cli.js\` 的 switch、README 的命令表、本记忆库对应条目。相关：[[storage-json-lines]]。`,
  },
  {
    name: 'storage-json-lines',
    description: '账目存储用 JSONL 追加写，文件在 ~/.ledger/entries.jsonl，不用数据库',
    type: 'project',
    body: `\`src/store.js\` 以 JSON Lines 追加写入 \`~/.ledger/entries.jsonl\`，一行一笔账。选它的理由是崩溃安全：追加写不会写坏既有行，也不需要迁移脚本。

读取时整文件读入再逐行 parse，账目量级假设在万行以内。金额处理见 [[currency-rounding]]。`,
  },
  {
    name: 'no-network-by-design',
    description: 'ledger-cli 是纯本地工具，不联网、不上报，任何网络依赖都是设计错误',
    type: 'project',
    body: `这个工具处理的是个人财务数据，设计上完全离线：没有遥测、没有云同步、没有汇率接口。

**Why**：账目数据敏感，离线是它相对同类工具的唯一卖点。
**How to apply**：看到任何引入 http 客户端、上报、自动更新检查的改动，先质疑再实现。汇率换算若要做，走用户手工输入或本地表，不拉接口。`,
  },
  {
    name: 'currency-rounding',
    description: '金额一律用整数分存储和计算，浮点只在最终格式化输出时出现',
    type: 'project',
    body: `\`src/store.js\` 里金额字段 \`amountCents\` 是整数分。加减都在整数域完成，只有 \`src/report.js\` 的格式化那一步才除以 100 转成显示字符串。

**Why**：0.1 + 0.2 的老问题，账目对不上是这个工具的致命伤。
**How to apply**：任何新增的金额字段都带 \`Cents\` 后缀；见到裸浮点金额当 bug 处理。相关：[[storage-json-lines]]。`,
  },
  {
    name: 'monthly-report-shape',
    description: '月度报表按分类聚合，输出对齐的纯文本表格，不出 CSV/JSON',
    type: 'project',
    body: `\`src/report.js\` 的 \`monthly()\` 按 \`category\` 聚合当月账目，输出等宽对齐的文本表格，末行是合计。

导出格式（CSV/JSON）多次被讨论、多次没做：这个工具的定位是"看一眼就知道这个月花超没有"，导出属于另一个工具的职责。用户偏好见 [[owner-prefers-tables]]。`,
  },
  {
    name: 'test-with-node-test',
    description: '测试用 Node 内置 node:test 跑，命令是 pnpm test，不引入外部测试框架',
    type: 'project',
    body: `测试文件放 \`test/\` 下、以 \`.test.js\` 结尾，用 Node 内置的 \`node:test\` 与 \`node:assert\`。\`pnpm test\` 即 \`node --test\`（不带路径参数，交给 Node 自己发现测试文件）。

**Why**：与"依赖表保持为空"的整体取向一致——为了跑测试装一整套框架不划算。相关：[[pnpm-only]]。`,
  },
  {
    name: 'pnpm-only',
    description: '本项目只用 pnpm，不要混用 npm 或 yarn 的命令与 lockfile',
    type: 'feedback',
    body: `所有包管理命令用 pnpm：\`pnpm install\` / \`pnpm test\`。仓库里只有 \`pnpm-lock.yaml\`。

**Why**：混用会生出第二份 lockfile，之后每次装依赖的结果都不可复现。
**How to apply**：写文档、写脚本、给命令建议时一律用 pnpm 形式；看到 \`npm install\` 出现在项目文件里就地改掉。相关：[[test-with-node-test]]。`,
  },
  {
    name: 'owner-prefers-tables',
    description: '项目主人要求终端输出优先用对齐表格，不要 JSON 转储',
    type: 'user',
    body: `主人明确说过：终端里给他看的东西一律排成对齐的表格，别甩 JSON。数字要右对齐，合计单独一行。

**Why**：他在终端里直接读结果，不会再拿去做二次处理。
**How to apply**：任何面向终端的新输出都按表格设计；需要机器可读格式时另开子命令，不改默认输出。相关：[[monthly-report-shape]]。`,
  },
]

function memoryFile(m) {
  return `---
name: ${m.name}
description: ${m.description}
metadata:
  type: ${m.type}
---

${m.body}
`
}

const MEMORY_INDEX = `# Memory Index

${MEMORIES.map((m) => `- [${m.description.split('，')[0]}](${m.name}.md) — ${m.name}`).join('\n')}
`

// ---------------------------------------------------------------- 项目文件

const PACKAGE_JSON = `{
  "name": "ledger-cli",
  "version": "0.3.0",
  "type": "module",
  "bin": { "ledger": "./src/cli.js" },
  "scripts": {
    "test": "node --test"
  },
  "engines": { "node": ">=20" }
}
`

const GITIGNORE = `node_modules/
*.log
`

const SRC_CLI = `#!/usr/bin/env node
// ledger — 本地记账 CLI。子命令解析手写，刻意不引入依赖。
import { addEntry, readEntries } from './store.js'
import { monthly } from './report.js'

const [, , cmd, ...rest] = process.argv

switch (cmd) {
  case 'add': {
    const [category, amount, ...note] = rest
    if (!category || !amount) {
      console.error('用法: ledger add <分类> <金额> [备注]')
      process.exit(1)
    }
    addEntry({
      category,
      amountCents: Math.round(Number(amount) * 100),
      note: note.join(' '),
    })
    break
  }
  case 'report':
    console.log(monthly(readEntries(), rest[0]))
    break
  default:
    console.error('用法: ledger <add|report>')
    process.exit(1)
}
`

const SRC_STORE = `// 账目存储：JSONL 追加写，一行一笔。金额一律整数分。
import { appendFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

const FILE = join(homedir(), '.ledger', 'entries.jsonl')

export function addEntry(entry) {
  mkdirSync(dirname(FILE), { recursive: true })
  const row = { ...entry, at: new Date().toISOString() }
  appendFileSync(FILE, JSON.stringify(row) + '\\n', 'utf8')
  return row
}

export function readEntries() {
  if (!existsSync(FILE)) return []
  return readFileSync(FILE, 'utf8')
    .split('\\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}
`

const SRC_REPORT = `// 月度报表：按分类聚合，输出对齐文本表格。
export function monthly(entries, month) {
  const target = month ?? new Date().toISOString().slice(0, 7)
  const totals = new Map()
  for (const e of entries) {
    if (!e.at.startsWith(target)) continue
    totals.set(e.category, (totals.get(e.category) ?? 0) + e.amountCents)
  }

  const rows = [...totals.entries()].sort((a, b) => b[1] - a[1])
  const width = Math.max(8, ...rows.map(([c]) => c.length))
  const fmt = (cents) => (cents / 100).toFixed(2).padStart(10)

  const lines = rows.map(([c, cents]) => c.padEnd(width) + fmt(cents))
  const sum = rows.reduce((acc, [, cents]) => acc + cents, 0)
  lines.push('-'.repeat(width + 10))
  lines.push('合计'.padEnd(width) + fmt(sum))
  return [target, ...lines].join('\\n')
}
`

const TEST_REPORT = `import { test } from 'node:test'
import assert from 'node:assert'
import { monthly } from '../src/report.js'

test('按分类聚合并给出合计', () => {
  const out = monthly([
    { category: '餐饮', amountCents: 1250, at: '2026-07-03T10:00:00.000Z' },
    { category: '餐饮', amountCents: 800, at: '2026-07-09T10:00:00.000Z' },
    { category: '交通', amountCents: 400, at: '2026-07-11T10:00:00.000Z' },
    { category: '餐饮', amountCents: 999, at: '2026-06-30T10:00:00.000Z' },
  ], '2026-07')

  assert.match(out, /餐饮/)
  assert.match(out, /20\\.50/)
  assert.match(out, /合计/)
  assert.match(out, /24\\.50/)
})
`

const README = `# ledger-cli

本地记账 CLI。纯离线，无依赖，Node 20+，ESM only。

## 命令

| 命令 | 说明 |
|---|---|
| \`ledger add <分类> <金额> [备注]\` | 记一笔账 |
| \`ledger report [YYYY-MM]\` | 月度报表，默认本月 |

## 开发

- 安装依赖：\`pnpm install\`
- 跑测试：\`pnpm test\`

数据存在 \`~/.ledger/entries.jsonl\`，一行一笔，不会被本仓库跟踪。
`

const CLAUDE_MD = `# ledger-cli

本地记账 CLI。纯离线工具，Node 20+，ESM only，依赖表刻意保持为空。

## 结构

- \`src/cli.js\` — 可执行入口，package.json 的 \`bin.ledger\` 指向它；子命令解析是手写 switch
- \`src/store.js\` — JSONL 追加写存储，文件在 \`~/.ledger/entries.jsonl\`
- \`src/report.js\` — 月度报表，按分类聚合，输出对齐文本表格

## 命令

- 安装依赖：\`pnpm install\`
- 跑测试：\`pnpm test\`（即 \`node --test\`）

## 约定

- 金额一律用整数分（\`amountCents\`）存储与计算，只在格式化输出时转小数。
- 只用 pnpm，不混用 npm/yarn。
- 不引入网络依赖：这是离线工具，遥测、云同步、汇率接口都属设计错误。
- 终端输出优先用对齐表格，不甩 JSON。
`

const VALVE_CONFIG = `---
enabled: true
claude_md_edits: true
delete_policy: quarantine-first
max_deletes: 3
max_new_connections: 2
llm_checks: on
cooldown_minutes: 30
---

# claude-dream 阀门配置（考场用）

本文件放在目标项目的 \`.claude/claude-dream.local.md\`，frontmatter 即全部配置。
考场里保持默认值；验收脚本会临时改写 \`cooldown_minutes\` 来验证冷却期可配置（PBI-04.1·AC3），
改写后会还原。若实现方采用了不同的键名或配置位置，在 adapter.json 的 \`cooldown\` 段声明。
`

// ---------------------------------------------------------------- 主流程

function build() {
  try {
    clearDirectory(LAB)
  } catch (err) {
    console.error(`清空旧考场失败：${LAB}\n${err.message}\n（有进程正锁着里面的文件——关掉占用它的终端或编辑器再重跑）`)
    process.exit(1)
  }

  git(['init', '-b', 'main'])
  // 落成本地身份：梦要在考场里提交，没有 user.name 会直接失败
  git(['config', 'user.name', 'lab-dev'])
  git(['config', 'user.email', 'dev@lab.test'])
  git(['config', 'commit.gpgsign', 'false'])

  // 提交 1：CLI 骨架
  write('package.json', PACKAGE_JSON)
  write('.gitignore', GITIGNORE)
  write('README.md', README)
  write('src/cli.js', SRC_CLI)
  commit('init: ledger CLI 骨架', '2026-06-01T09:12:00+08:00', ['.'])

  // 提交 2：存储层
  write('src/store.js', SRC_STORE)
  commit('feat: JSONL 追加写存储', '2026-06-15T20:41:00+08:00', ['src/store.js'])

  // 提交 3：报表
  write('src/report.js', SRC_REPORT)
  write('test/report.test.js', TEST_REPORT)
  commit('feat: 月度分类报表', '2026-07-02T14:03:00+08:00', ['src/report.js', 'test/report.test.js'])

  // 提交 4：CLAUDE.md
  write('CLAUDE.md', CLAUDE_MD)
  commit('docs: 添加 CLAUDE.md', '2026-07-20T11:27:00+08:00', ['CLAUDE.md'])

  // 提交 5：记忆库入库
  for (const m of MEMORIES) write(`.claude/memory/${m.name}.md`, memoryFile(m))
  write('.claude/memory/MEMORY.md', MEMORY_INDEX)
  write('.claude/claude-dream.local.md', VALVE_CONFIG)
  commit('chore: 记忆库入库', '2026-07-28T22:05:00+08:00', ['.claude'])

  // .claude/dream/ 故意不建——它应当由梦第一次跑时创建，是 PBI-04.3·AC2 的观测点。

  const head = git(['rev-parse', 'HEAD']).trim()
  const count = git(['rev-list', '--count', 'HEAD']).trim()
  const status = git(['status', '--porcelain']).trim()

  console.log(`考场就位：${LAB}`)
  console.log(`  提交数 ${count}，HEAD ${head.slice(0, 7)}`)
  console.log(`  记忆 ${MEMORIES.length} 条 + MEMORY.md 索引；.claude/dream/ 不存在（应由梦创建）`)
  console.log(`  工作树${status ? '不干净——异常：\n' + status : '干净'}`)
  if (status) process.exit(1)
}

build()
