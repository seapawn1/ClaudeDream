# Anthropic 官方文章：记忆与上下文相关

2026-11-07 对 Anthropic 工程/研究文章索引做的一次筛选。只收与 agent memory、dreaming、context、长期运行状态、记忆评测相关的文章；`snapshots/` 里是原样 HTML 快照，本文件是事实摘录与相关性判断。`components-of-agent-memory` 因为已经单独成目录，不在 `snapshots/` 里重复。

## 总表

| 文章 | 日期 | 相关性 | 收法 | 一句话 |
|---|---|---|---|---|
| [The components of agent memory](https://www.anthropic.com/research/components-of-agent-memory) | 2026-11-06 | 高 | 单独目录 `../components-of-agent-memory/` | 四层记忆层级（transcript → note → wiki → 注入上下文）与 dreaming 的五种作用；CL-Bench、Pokémon、Stainless wiki、合同任务的实测。 |
| [Demystifying evals for AI agents](https://www.anthropic.com/research/demystifying-evals-for-ai-agents) | 2026-01-09 | 高 | 快照 + 本节笔记 | 评测词汇（task / trial / grader / transcript / outcome / harness / suite）、三类 grader、评分 rubric、pass@k vs pass^k、共享状态污染。 |
| [How we built our multi-agent research system](https://www.anthropic.com/research/multi-agent-research-system) | 2025-06-13（2026-10-09 更新） | 高 | 快照 + 本节笔记 | orchestrator-worker；把计划写进外部 memory；干净上下文子代理与 handoff；LLM judge 五维 rubric（约 20 条真实查询起步）。 |
| [Effective context engineering for AI agents](https://www.anthropic.com/research/effective-context-engineering-for-ai-agents) | 2025-09-29 | 中 | 快照 + 本节笔记 | context rot 与 attention budget；compaction、结构化笔记、子代理；JIT 检索与渐进披露；工具结果清理的取舍。 |
| [Effective harnesses for long-running agents](https://www.anthropic.com/research/effective-harnesses-for-long-running-agents) | 2025-11-26 | 中 | 快照 + 本节笔记 | 跨 context window 的状态交接：initializer 写 feature-list JSON、init.sh、progress 文件；每次会话固定读取顺序。 |
| [Equipping agents for the real world with Agent Skills](https://www.anthropic.com/research/equipping-agents-for-the-real-world-with-agent-skills) | 2025-10-16 | 中 | 快照 + 本节笔记 | 三级渐进披露：name/description 预载 → SKILL.md 按需读 → 附带文件最后读；skills 与 memory 的分工。 |
| [Writing effective tools for agents](https://www.anthropic.com/research/writing-tools-for-agents) | 2025-09-11 | 中 | 快照 + 本节笔记 | 工具是契约；用 search 而不是 dump；`response_format` 简洁/详细两档；分页与 token 上限；工具评测协议。 |
| [Harness design for long-running application development](https://www.anthropic.com/research/harness-design-long-running-apps) | 2026-03-24 | 中 | 仅笔记 | 生成器/评估器分离、rubric、少样本校准、compaction vs reset、文件式 handoff；正文大半是前端应用开发，记忆内容少。 |
| [Scaling Managed Agents](https://www.anthropic.com/research/managed-agents) | 2026-04-08 | 中 | 仅链接 | session 是 append-only event log，不等于 context window；harness / sandbox / session 三个可替换接口。记忆材料在 `../official-docs/` 的 dreams 和 memory 两页。 |
| [Claude Code: Best practices for agentic coding](https://www.anthropic.com/research/claude-code-best-practices) | 2025-04-18 | 低 | 仅链接 | 2026-01-26 起标记为不再维护，指向 `code.claude.com/docs/en/best-practices`；CLAUDE.md 的加载顺序仍可参考，但不存快照。 |

## 分篇笔记

### Demystifying evals for AI agents

- 词汇：task、trial、grader、transcript、outcome、harness、suite。
- grader 三类：确定性代码、模型 rubric/judge、人；各有强弱。
- 规则：评 outcome 而不是精确工具路径；结构化 rubric，一维一个 judge，留 “Unknown”；正反例都要有（该触发/不该触发）；部分给分；能力评测从低通过率起步，回归套件接近 100%；区分 pass@k 与 pass^k；读 transcript。
- 对记忆评测的直接约束：trial 之间要隔离共享状态。记忆库本身就是跨 trial 的持久状态，dream 评测要么每个 trial 重置 store，要么报告污染。

### How we built our multi-agent research system

- 架构：lead agent 规划，把计划写进外部 memory（200k 上下文会被截断），并行起子代理，各自隔离上下文，最后综合。
- 长期任务：把完成阶段总结进外部 memory；给新子代理干净上下文和明确 handoff；子代理产物写文件系统，协调者只拿轻量引用。
- 评测：约 20 条真实查询起步；一个 LLM judge 按五维 rubric 打分（事实准确、引用准确、完整、来源质量、工具效率），0.0–1.0 + pass/fail；状态变更型 agent 评终态；保留人工复核。
- 与 cookbook 的关系：cookbook 没有评测；这篇给评测方法，不给记忆架构。

### Effective context engineering for AI agents

- 核心约束是 context rot：上下文越长，召回越差；“context 是有限资源，边际收益递减”。
- attention budget：每加一个 token 都在消耗预算——支持注入层保持小、细节下沉。
- 长期任务三招：compaction、结构化笔记（agentic memory）、子代理。
- Claude Code 的 compaction 保留架构决策、未解决 bug、实现细节，丢掉冗余工具输出，并带上最近访问的 5 个文件。
- 调 summarizer 的顺序：先把召回拉满，再压精度，去掉多余内容；过度压缩会丢掉“以后才知道重要”的细节。
- 工具结果清理是最轻的 compaction，和 cookbook 的“工具结果最重要”形成取舍。
- 混合检索：CLAUDE.md 预载，glob/grep 按需取——对应我们的两层记忆。

### Effective harnesses for long-running agents

- 问题：新会话不记得上一次，harness 必须留下显式状态。
- initializer agent 写：feature-list JSON、`init.sh`、`claude-progress.txt`、初始 git commit。
- 编码 agent 每次会话做一个 feature，结束时提交并更新 progress。
- 每次会话固定读取顺序：pwd → progress 文件 → feature list → git log → smoke test。
- 结构化 JSON 状态比 Markdown 更耐模型改写；固定读取顺序比开放式搜索更省。
- 反“过早完成”的装置：一份明确的“完成”清单，每项带 pass 标记——也可当记忆保留的固定事实清单。

### Equipping agents for the real world with Agent Skills

- 三级渐进披露：name/description 预载进系统提示 → 相关时读完整 SKILL.md → 需要时再读附带文件。
- 附带文件让上下文实际上无上限；确定性脚本可以不读进上下文直接跑。
- skills 是程序性知识（怎么做），memory 是事实与决策；蒸馏出来的经验要决定进哪边。
- 官方把“agent 自己创建/编辑/评估 skill”列为未来方向，和 dreaming 循环重叠但尚未设计。

### Writing effective tools for agents

- 工具是确定性系统与非确定性 agent 之间的契约，不是 API 包装。
- 少而高影响：把多步查询合成一个工具（search_logs 而不是 read_logs）。
- 返回高信号上下文；把 UUID 解析成自然语言，能显著提高检索精度。
- 提供 concise / detailed 两档 `response_format`；分页或截断；Claude Code 工具响应上限 25,000 tokens。
- 错误信息要可行动。
- 评测协议：程序化 agentic loop、留出测试集、可验证结果、需要几十次工具调用的任务，统计调用数/token/耗时/错误，再把 transcript 喂回 Claude Code 改工具。

### Harness design for long-running application development（仅笔记）

- 生成器/评估器分离：agent 会夸自己的产出，评估要独立。
- 把“好不好”写成 rubric（“是否符合我们的原则”），少样本校准减少分数漂移，硬性逐项阈值。
- 用评估器日志和人工判断的差异做调优循环。
- compaction 与 context reset 是两件事；handoff artifact 要能让干净上下文的后继接上。
- 验证 pass 的成本是低个位数百分比，相对多小时构建很便宜。
- harness 组件编码了对模型弱点的假设，模型升级后要重新论证。

### Scaling Managed Agents（仅链接）

- session 是 append-only event log，不等于 context window；`getEvents()` 返回位置切片，由 harness 转换后注入。
- 三个可替换接口：session、harness、sandbox。
- 凭据不进 sandbox；git token 和 MCP OAuth 放 vault，走 proxy。
- 崩溃恢复、TTFT 优化。
- 记忆材料不在这篇，在 `../official-docs/managed-agents-dreams.md` 和 `managed-agents-memory.md`。

## 两本未收快照的 cookbook

- **memory_cookbook.ipynb**（`tool_use/memory_cookbook.ipynb`）：API memory tool 的用法；`/memories` 六命令、客户端 handler、context editing（`clear_tool_uses_20250919` / `clear_thinking_20251015`）、memory poisoning 威胁模型与四条缓解。和 dreaming cookbook 比，它补的是读取协议和安全清单，不是架构。
- **session_memory_compaction.ipynb**（`misc/session_memory_compaction.ipynb`）：会话内压缩，不是跨会话记忆。可移植的是结构化摘要 prompt（User Intent / Completed Work / Errors & Corrections / Active Work / Pending Tasks / Key References，带保留/丢弃优先级）和增量更新循环（只总结 watermark 之后的消息、同一时间一个更新、generation counter 防陈旧写、共享 prefix cache 约省 80%）。它的下一步“把 session memory 落盘”正是我们已规划的回填方向。
