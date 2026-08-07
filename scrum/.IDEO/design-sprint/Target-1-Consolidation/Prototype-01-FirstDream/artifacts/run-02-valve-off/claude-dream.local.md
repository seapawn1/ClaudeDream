---
enabled: true
claude_md_edits: false
delete_policy: quarantine-first
max_deletes: 3
max_new_connections: 2
llm_checks: on
---

# claude-dream 阀门配置

本文件放在目标项目的 `.claude/claude-dream.local.md`。frontmatter 即全部配置；正文仅作说明，梦引擎不读。

| 键 | 含义 |
|---|---|
| `enabled` | 总开关。false = 不做梦 |
| `claude_md_edits` | 关 → CLAUDE.md 一字不动，报告降级为"建议（未动）"+ 记忆侧标注 |
| `delete_policy` | `quarantine-first`：拿不准一律隔离，确凿证据才删；`report-only`：连删都降级为汇报 |
| `max_deletes` | 熔断线：单梦删除数 > max(此值, 库存 10%) → 整梦中止回滚 |
| `max_new_connections` | 单梦新建 connection 上限（废边防线） |
| `llm_checks` | 关 → 纯机械梦（只跑 M1–M5 与 L0 修复），零 API 成本 |
