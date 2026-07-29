---
name: target-c-decision
description: Target C (综合判定) 方案选定——Memory Compiler，以 compiler compile 模型为主基座
metadata: 
  node_type: memory
  type: project
  originSessionId: 455b3371-724a-4c88-826c-3691c3e76a64
  modified: 2026-07-19T11:00:00+08:00
---

# Target C: 综合判定 — 方案决策

**决策**：采用 Memory Compiler 方案。以 compiler 的 compile → index → log 模型为主基座，融入 ClaudeDream 原创的 git 漂移感知。

**方案结构**：
- Gate（Hash 检查）→ Compile（硬约束排除 → Extract → Cross-Reference → Connect）→ Classify（🆕⚡🗑️🔁）→ Output（MEMORY.md + 变更摘要）

**核心引用**：
- compiler 的全量上下文（全部记忆文件进 prompt）、sources 追踪、更新优于新建、log.md 追加
- auto-dream 的信任边界（不编辑 CLAUDE.md）、不确定时保留（删错 > 留错）
- auto-memory 的硬约束排除清单（不存 repo 已有）
- ClaudeDream 原创：git 漂移感知 → "possibly stale" 标注、双源追踪（session + git hash）、superseded 标注冲突链

**Why:** compiler 的 wiki 编译模型是三个参考项目中最完整的——有确定性 gate、有语义编译、有质量门禁、有索引维护。ClaudeDream 的问题和 compiler 解决的问题是同一类。

**How to apply:** Target C 的语义层是一个单 Prompt，包含全部记忆文件作为上下文。原型阶段手工判断 Hash gate，跑一次看四分类结果。关联 [[compiler-architecture-reference]]。

---

### compiler 机制照抄详情（本对话深度分析补充）

从 compiler 全套源码（AGENTS.md + compile.py + lint.py + utils.py）提取的可照抄机制：

**照抄清单**：
| compiler | ClaudeDream |
|---|---|
| `state.json` hash 门控（transcript + git HEAD + 记忆目录 hash） | 同 |
| 全量上下文灌入 prompt（所有 wiki articles → 所有记忆文件）| 同 |
| `sources:` 在 YAML frontmatter 追踪数据来源 | 同，但多了 git commit hash |
| 更新 index.md（一行一条，保持精简） | 同 → MEMORY.md |
| 追加 log.md（每次 compile 一条时间戳记录） | 同 → 变更摘要 |
| 更新优于新建（update > create）| 同 |
| 7 quality rules → 适配为 ClaudeDream 7 条 | 同（YAML 完整、wikilink、绝对日期等）|
| connections/ 跨文章关联 → [[wikilink]] | 同 |

**不照抄的**：
- query.py（Claude Code 自动加载 MEMORY.md，已内建）
- qa/ 文章类型（ClaudeDream 不做查询）
- Agent SDK `query()`（我们在 Claude Code 对话内运行）

**延后的**：
- lint.py（7 项健康检查）——原型后做
- hooks（SessionEnd/PreCompact → flush.py → daily/）——未来自动化 B 的读取

### ClaudeDream 原创机制

| 机制 | 说明 |
|---|---|
| git 漂移感知 | git diff → 标注 "⚠️ possibly stale: [file] changed [date]" |
| 双源追踪 | sources 同时记录 session id + git commit hash |
| superseded 标注 | 冲突保留旧内容 + "⚡ superseded <date>: <原因>" |
| 项目地图 | 读 README/CLAUDE.md/.IDEO/ 建立项目上下文 |

### 7 条质量规则

① 每个记忆文件必须有完整 YAML frontmatter（name, description, metadata.type, sources, created）
② 每个文件至少有一个 [[wikilink]] 链接到相关记忆
③ feedback/project 类型必须有 **Why:** 和 **How to apply:**
④ 绝对日期，不用相对日期
⑤ 冲突更新时保留旧内容 + superseded 标注
⑥ NEVER edit CLAUDE.md（信任边界）
⑦ 不存 repo 已有的内容（硬约束）

### 原型执行（2026-07-18）

**变量**：一个 Compiler（Claude Pawn），给定全量上下文，能否正确四分类？

原型通过直接在当前对话中执行 Compile 来验证。执行记录见：
- `.IDEO/target-c-comprehensive-judgment/prototype/execution-log.md`

**原型 Gate 结果**：通过。最近对话产生了新概念（compiler 架构深度分析、7 rules 适配），git HEAD 有变化（96e99be），记忆目录有新文件。明显需要 Compile。

---

### Sprint 4 Planning 深化（2026-07-19）

**PB-Base-10 · 防腐涂料的横切设计**：

PO 拍板：PB-Base-10（原创机制）是**横切防腐涂料**——散在 8/9/11 各处，没有独立一格：
- 双源追踪 → 挂靠在 11 写入执行（frontmatter sources 同时记录 session id + git hash）
- superseded 标注 → 挂靠在 9 分类 Update 冲突时（保留旧内容 + 打修正链）
- git 漂移标注 → 挂靠在 8 Cross-Reference 印证时（识别被记忆引用的文件已变）

验收无需独立完成时刻——三样分别在宿主 PBI 的 AC 里验证。

**PB-Base-12/13 正式纳入 scope**：

PO 拍板：12（MEMORY.md 索引维护）和 13（变更摘要报告）从 Product Backlog 延后状态正式纳入 Sprint 4 scope，从 5 条扩为 **7 条**。理由：
- C 是产品第一次真正写记忆 → DoD「可审阅」「索引一致」首次生效
- compiler compile 本就一次做完「写文章+更新 index+追加 log」——技术无冲突
- 变更摘要每条**必须含理由**——compiler log.md 缺的 why 字段，ClaudeDream 补上
