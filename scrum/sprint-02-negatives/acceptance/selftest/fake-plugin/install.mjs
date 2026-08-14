#!/usr/bin/env node
/** selftest 专用——落一份留/剔规则表，供 H-A3 的半自动核对读取。 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const ROOT = process.cwd()
const RULES_PATH = join(ROOT, '.claude', 'negatives-rules.md')

const RULES = `# 留/剔规则表（selftest 假产品）

| jsonl 条目类型 | 处置 |
|---|---|
| user（两种结构：数组/字符串） | 留 |
| user 角色记录的工具返回（tool_result） | 留 |
| assistant 正文（text） | 留 |
| assistant thinking | 剔 |
| attachment | 剔 |
| file-history-snapshot | 剔 |
| 未知类型 | 留（保守保留） |
`

mkdirSync(dirname(RULES_PATH), { recursive: true })
writeFileSync(RULES_PATH, RULES, 'utf8')
