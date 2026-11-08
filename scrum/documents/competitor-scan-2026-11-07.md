# 竞品调研摘要（2026-11-07 调研，2026-11-08 提炼）

> 由 stakeholder 会话从 60 条已核实候选中提炼，Master 原样收录。原始清单在系统临时目录（`C:\Users\seapawn\AppData\Local\Temp\claude\dream-research-2026-11-07\digest.txt`），可能被清掉，不入库。
> Master 抽查（2026-11-08）：Hugging Face 文章“约 20% 的笔记仍然有效”一句已对照原文；arXiv 2607.29167 的标题已核对。arXiv 2610.29869 和 Copilot Dreaming 文档页当时网络没连上，未核实。

## 结论

这轮 60 条已核实 + 追加 chase 里，没有发现把 cookbook 原样做成 Claude Code 插件的项目。最接近的开源竞品是 [tigerless-labs/agent-memory](https://github.com/tigerless-labs/agent-memory)（4,314★，2026-09-01 建，pushed_at 2026-11-06）：同样是 Markdown 真源 + 独立 sleep-time 整合层，Claude Code 和 Codex 共用一个 store；但它不是 Claude Code 插件，也没有全局/项目两层。官方产品里最强的是 [GitHub Copilot Dreaming](https://docs.github.com/en/copilot/concepts/prompting-and-context/copilot-dreaming)（public preview）：修 stale guidance、清重复记忆，memory 自动改、instructions/skills 走 PR。我们的四件差异化仍然成立：① 一条命令装好（Claude Code 插件，不是 cargo/pip/npm + hook 手工配置）；② 第一次运行回填历史（这轮确认有回填的 Claude Code 插件只有 [TT-Wang/memem](https://github.com/TT-Wang/memem)）；③ 逐份并行分析并核对（cookbook 的 lead + N analyzer + organizer；多数 skill 是单 agent 顺序跑，Dev916/dreamd 是少数例外）；④ 全局/项目两层（竞品基本只有单层）。窗口在收窄：tigerless 已 4.3k★，Copilot Dreaming 已 public preview，「离线整理记忆」正在从个人项目变成平台功能。

## 谁在修旧记忆

PO 11-08 把产品目标侧重到「把老的、错的、腐烂的、不新鲜的记忆更新整理好」。Hugging Face 上有人审计 Claude Code auto-memory，约 20% 的笔记仍然有效（[dacorvo](https://huggingface.co/blog/dacorvo/the-ambiguous-state-trap)）——这是这个目标的直接证据。明确在做这件事的项目：

| 项目 | 怎么修 | 可借 |
|---|---|---|
| [grandamenium/dream-skill](https://github.com/grandamenium/dream-skill) | 4 阶段：Orient → Gather Signal（窄 grep 近期 JSONL）→ Consolidate（合并发现、相对日期转绝对、解矛盾）→ Prune & Index（重建 <200 行 MEMORY.md） | 四阶段命名；相对日期转绝对；解矛盾；索引硬上限 |
| [tiny-cloud-ventures/amnesia](https://github.com/tiny-cloud-ventures/amnesia) | 只审计已有记忆：重复合并、矛盾消解、放错项目的 move 到正确目录；逐条 Forget/Move/Combine/Keep，回收站 + 撤销，hash 守卫 | 逐条审阅交互；Fix all 先展示精确计划再原子应用；删除进回收站 |
| [cyijun/agent-dream](https://github.com/cyijun/agent-dream) | 只整理已有记忆目录：合并进主题文件、相对日期改绝对、删被推翻条目；时间闸 + 会话闸 + PID 原子锁 + mtime 当 lastConsolidated | 门控与原子锁的实现；organizer-only 的边界 |
| [yantrikos/yantrikdb-server](https://github.com/yantrikos/yantrikdb-server) | 合并/矛盾检测做成显式冲突队列（conflict 工具 + get_conflicts + 人工 resolve）；半衰期衰减；时间查询 stale/upcoming | 结构化 CONFLICT 队列，而不是自由文本；矛盾检测的硬限制 |
| [salishforge/memforge](https://github.com/salishforge/memforge) | 10 阶段：过期刷新、重要性评分、低价值淘汰、冲突解决、LLM 修订、图维护与实体去重、时间链、反思、schema 沉淀、缺口分析 | 直接当 organizer 的检查表 |
| [Praneeth16/lakebase-workshop](https://github.com/Praneeth16/lakebase-workshop) | consolidate → abstract → decay/reconcile；fact_provenance 表回溯来源 turn；confidence <0.6 进 review queue；矛盾两侧都入 review；decay 用「最近 N 天无支持 turn」归档 | provenance、confidence 阈值、矛盾双侧保留、按无支持衰减 |
| [GitHub Copilot Dreaming](https://docs.github.com/en/copilot/concepts/prompting-and-context/copilot-dreaming)（官方 public preview） | 分析 eligible sessions 与 PR review feedback，修 stale guidance、清重复记忆；memory 自动改、无逐条审批；instructions/skills 走 PR | 分层：自动改 memory、PR 改 instructions；成本透明；关闭不回滚已做的更改 |
| [Claude Managed Agents Dreams](https://platform.claude.com/docs/en/managed-agents/dreams)（官方 research preview） | 读现有 store + 1–100 个 past sessions，去重、替换 stale/contradicted 条目、surface insights；写新 store，输入 store 不动 | 写新 store 便于审计；输入不动；「replace stale/contradicted」的措辞 |

## 最相关的 12 个项目

| 项目 | 星数 / 日期 | 形态 | 可借 |
|---|---|---|---|
| [tigerless-labs/agent-memory](https://github.com/tigerless-labs/agent-memory) | 4,314★；pushed_at 2026-11-06 | 运行时/CLI（Markdown 真源 + SQLite/FTS5；插件入口未核实） | Markdown 真源 + 可重建索引；frontmatter 的 validity intervals；独立 sleep-time Manage 层 |
| [TT-Wang/memem](https://github.com/TT-Wang/memem) | 32★；pushed_at 2026-09-01 | Claude Code 插件（功能描述来自 CHASED 一行摘要，未核实） | Stop-hook 后 detached `mine_delta`；FTS5 transcript 搜索；dreamer 的 cluster_merge / reflection_with_citations / tense_rewriting；回填历史 |
| [Dev916/dreamd](https://github.com/Dev916/dreamd) | 0★；pushed_at 2026-11-03 | Rust CLI（不是插件） | per-session worker + aggregator 重写副本；增量水位（字节+记录数）；14 天回填；24h/3 会话门控；备份 + 原子 apply + 回滚 |
| [StartupBros-com/hov-stack（plugins/memory-dream）](https://github.com/StartupBros-com/hov-stack/tree/main/plugins/memory-dream) | 1★（monorepo）；pushed_at 2026-11-08 | Claude Code 插件（marketplace） | triage→plan→draft→verify→preview；drafter/scribe 两个子代理；逐条审批；fidelity 验证 + recall eval |
| [grandamenium/dream-skill](https://github.com/grandamenium/dream-skill) | 162★；pushed_at 2026-03-24；updated_at 2026-11-01 | Claude Code skill（不是插件） | 4 阶段；相对日期转绝对；解矛盾；索引 <200 行；24h Stop-hook 自动触发 |
| [jayadevrana/claude-dream-skill](https://github.com/jayadevrana/claude-dream-skill) | 0★；pushed_at 2026-08-08 | Claude Code skill（不是插件；source-available 商业许可） | 证据等级；密钥脱敏；标过期/矛盾；审阅门。注意：无代码/测试，许可禁止 AI 摄取与衍生，不能借代码与文字 |
| [tiny-cloud-ventures/amnesia](https://github.com/tiny-cloud-ventures/amnesia) | 7★；updated_at 2026-07-27（pushed_at 未核实） | Claude Code 插件 | 逐条 Forget/Move/Combine/Keep；Fix all 先展示计划再原子应用；回收站 + 撤销；hash 守卫 |
| [cyijun/agent-dream](https://github.com/cyijun/agent-dream) | 4★；pushed_at 2026-04-06 | skill 文件夹 + Node 脚本（不是插件） | 时间闸 + 会话闸 + PID 原子锁 + mtime 当 lastConsolidated；organizer-only 的边界 |
| [LeoYeAI/talewell](https://github.com/LeoYeAI/talewell) | 549★；pushed_at 2026-10-01 | 长期记忆底层/协议实现（不是 Claude Code 插件） | 一条记忆一个 md + YAML frontmatter；每次写入一次 commit；index.json 由文件重建；forget/consolidate/graph |
| [Square-Q/subconscious-skill](https://github.com/Square-Q/subconscious-skill) | 49★；pushed_at 2026-07-28 | Claude Code skill（不是插件） | 重要性分数 + 未被引用衰减 5% + 低于 0.1 归档 + pin；SessionStart whisper 最多 3 条、每条 ≤80 字 |
| [CodeAbra/iai-personal-memory-engine](https://github.com/CodeAbra/iai-personal-memory-engine) | 921★；pushed_at 2026-11-02 | 本地 MCP server + Claude Code 插件 | 实时捕获 + 会话前/每轮 recall；加密二进制向量/图存储；保留逐字 episode |
| [Bitterbot-AI/bitterbot-desktop](https://github.com/Bitterbot-AI/bitterbot-desktop/tree/main/docs/memory) | 2,483★；pushed_at 2026-11-08 | 独立桌面/网关服务（不是插件） | 每轮 LLM 调用硬上限 + 生成/验证分别计费；Batch API 半价；晋升三角约束；kill switch + 单查询回滚；三道定时闸 |

星数与日期用 `gh api` 在 2026-11-08 重新核过；`pushed_at` 是最后一次代码推送，`updated_at` 是仓库元数据更新时间，两者会差很多。tigerless、memem 的功能描述来自 CHASED 一行摘要，未逐行读代码。grandamenium 的更正：pushed_at 是 2026-03-24，清单里的 upd 2026-11-01 是 updated_at。

## 官方现状

- **Managed Agents Dreams**：research preview，异步作业，读现有 memory store + 1–100 个 past sessions，去重、替换 stale/contradicted 条目、surface insights；写一个新 store，输入 store 不动；beta headers `managed-agents-2026-04-01, dreaming-2026-04-21`，ZDR 不适用。来源：[docs](https://platform.claude.com/docs/en/managed-agents/dreams)。
- **Claude Code auto-dream**：开关仍关着（`tengu_onyx_plover` 的 `enabled` 为 false；`autoDreamEnabled: true` 在 flag 关闭时是静默 no-op）；`/dream` 命令没有注册。相关 issue：[#47959](https://github.com/anthropics/claude-code/issues/47959)（一天删掉 23 个记忆文件）、[#38493](https://github.com/anthropics/claude-code/issues/38493)（identity/accuracy/transparency）、[#38461](https://github.com/anthropics/claude-code/issues/38461) / [#39135](https://github.com/anthropics/claude-code/issues/39135)（/dream 返回 Unknown skill）、[#50694](https://github.com/anthropics/claude-code/issues/50694)（stale `.consolidate-lock` 让 auto-dream 永久停摆）、[#86209](https://github.com/anthropics/claude-code/issues/86209)（flag 关闭时设置被忽略）、[#103887](https://github.com/anthropics/claude-code/issues/103887)（怎么打开 auto-dream）。
- **官方 cookbook**：2026-11-04 提交（#959），MIT；没有官方 Claude Code 插件版本。来源：[anthropics/claude-cookbooks](https://github.com/anthropics/claude-cookbooks)。

## 安全证据

- **CMA_agent_security_review** 有一条直接关于记忆库挂载的建议（「Acting on a note from a memory store」）：应删除/纠正该记忆、查 memory versions 找写入者、agent 不需要写时就只读挂载、不要把「读不可信输入并写入的 store」挂给「会行动的 agent」、一用户一 store。来源：[notebook](https://raw.githubusercontent.com/anthropics/claude-cookbooks/main/managed_agents/CMA_agent_security_review.ipynb)。
- **Memory Provenance Laundering in LLM Agents**（[arXiv:2607.29167](https://arxiv.org/abs/2607.29167)）：整合时外部观察被改写成「用户历史/工作流支持」，保留了行动触发，却抹掉了低信任来源。→ organizer 的 frontmatter 需要 source trust / action-risk 字段，且要能穿过重写；git revert 只是事后止损。
- **Compaction Laundering: Provenance Destruction in Context-Compacting Coding Agents**（[arXiv:2610.29869](https://arxiv.org/abs/2610.29869)）：把带类型的对话压成纯文本标签会破坏 provenance；摘要写进持久记忆时如果不带 mode/role provenance，就能被伪造。补充：[OEP, arXiv:2605.18930](https://arxiv.org/abs/2605.18930)——「局部正确但不可迁移」的经验能骗过内容过滤和 LLM 审计。
