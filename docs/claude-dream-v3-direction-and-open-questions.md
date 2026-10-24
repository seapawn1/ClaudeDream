# ClaudeDream v3：方向与待议问题

2026-10-25 凌晨讨论底稿。这不是设计定稿：标「PO 定」的是 PO 已做的决定，其余是记录和想法。

来源：SeaPawn ProductBacklog #5 及其冲刺日志、`S:\SeaPawn\Notes\agent-memory\`、10-25 凌晨 ClaudeDream 会话的核实。

## 1. 要解决什么

**愿景**（保留）：任何长期使用 Claude Code 的人，开新会话时 agent 都像昨天刚一起工作过；而且越用越懂你。

**痛点**（PO 10-20）：记忆太多。当时 SeaPawn 私有层 78 条，索引 `MEMORY.md` 17KB，每次开会话整份加载；paper-writing-polish 52 条、RockMass 38 条、StrataGP 35 条、MidTerm 32 条。10-24 实测 SeaPawn 索引 86 行、18,375 字节，约占 25KB 加载上限的 72%；超出部分不加载也不报错。

## 2. PO 已定的方向

| 日期 | PO 定 |
|---|---|
| 10-14 | 推倒重来：旧插件、设计冲刺与 Sprint 档案全部删除，新起点是 tag `v3.0`。愿景保留，路径重新设计；旧档案、旧规格、旧 DoD 不作前提 |
| 10-21 | 拿 Karpathy 的 LLM Wiki 当骨架，做梦就是其中的 lint。全局 wiki 只由做梦来写，改完提交，PO 看 diff。PO 的决定和不可重建的负结果不能动。项目记忆照原生机制不动，全局 wiki 从项目记忆里编出来 |
| 10-24 | 做梦只管记忆，三件事：整理（合并、去重、删过期、压索引）、从过往对话提炼新记忆（含「怎么做」和 PO 偏好）、补 wiki |
| 10-24 | 不整理技能。技能和记忆都是渐进式披露，用记忆代替技能；技能只留给需要 `/命令`、脚本、限定工具或模型、打包共享的情形，仍然手写 |
| 10-24 | 不建对话库，提炼记忆比建库有意义。理念跟 Claude Code 一致：对话随便丢，记忆才是长期的 |
| 10-24 | USER.md 就是 CLAUDE.md 加用户类记忆，不是缺口 |
| 10-24 | 「自动」指自动生成提案，不是自动采纳；PO 审 diff（记忆库是 git 仓库） |
| 10-25 | 项目记忆归原生 auto-memory 管；wiki 是我们自己的一套机制 |
| 10-25 | 官方放不放行都不影响我们做；官方做出来以后再对标 |
| 10-25 | #30「SeaPawn 文件夹当个人助手（类 Hermes）」不并入 #5，不需要了；专心把 Claude Dream 做好 |
| 10-25 | v3.0 是 v2.0 之后的进一步重构 |
| 10-25 | 先定架构，再定怎么做。不开系统的设计冲刺；第一个增量可能是原型，用一次聚焦的 IDEO 研究（打一个点）来做，细节再议 |

## 3. 已核实的事实

| 事实 | 来源 | 核实 |
|---|---|---|
| 官方 auto-dream 仍未放行。服务端开关 `tengu_onyx_plover` 本机缓存为 `{"enabled": false, "minHours": 24, "minSessions": 3, "remoteEnabled": false}`（7 月为 null） | 本机 `.claude.json` 的 `cachedGrowthBookFeatures` | 10-25，v2.1.309 |
| 设置 `autoDreamEnabled: true` 无效：开关的 `enabled` 或 `available` 为 true 时才读这个设置。只能关，不能开 | v2.1.309 二进制判定代码 | 10-25 |
| 官方文档搜不到 dream / `autoDreamEnabled`；本机所有记忆目录没有 `.consolidate-lock`，从未运行 | claude-code-docs；本机文件 | 10-25 |
| auto-dream 触发：距上次整合 ≥ 24 小时、新会话数 ≥ 阈值（默认 5，服务端现给 3）、服务端开关放行。改完直接写入，没有审阅环节（#47959 误删 23 个记忆文件） | 二进制；GitHub issue | 10-25；issue 为 2026-08 核实 |
| 官方 dream 读的是预先消化的活动日志 `logs/`，不是原始 transcript | PO 07-16 从 v2.1.210 提取的笔记 | v2.1.309 未复核 |
| auto-memory 的「技能维护」块（`tengu_gorse_fathom`）本机为 false，只改已有项目技能 | 本机缓存；07-16 笔记 | 10-25 |
| `MEMORY.md` 每次会话只加载前 200 行或 25KB，超出不加载也不报错 | 官方文档 memory 页 | SM 10-24 |
| 对话记录默认本地只留 30 天（`cleanupPeriodDays`），桌面端会话另有 `desktopSessionCleanupPeriodDays`。做梦要在过期前提炼，或把保留期调长 | 官方文档 data-usage、settings 页 | SM 10-24 |
| 桌面端定时任务要求应用开着、机器醒着 | 官方文档 | SM 10-24 |
| 桌面端会话记录搜索工具：SM 两次测试零命中；10-25 用它搜「ClaudeDream」有命中。覆盖范围不明，不能靠它做全文回忆 | 实测 | 10-24、10-25 |
| Hermes：MEMORY.md 2,200 字符、USER.md 1,375 字符；FTS5 全文搜会话；自动写技能并自动修补；cron；多聊天软件网关 | 摘要式抓取，见 `hermes-vs-claude-code.md` | 引用前以官方页面为准 |

## 4. 代码里看到、尚未核实的线索

- 开关新增 `available` 字段，像「可用但默认关、用户自选开」的灰度档；还有 `remoteEnabled`。
- dream 提示词新增 Team memory：`team/` 子目录，多人共享。changelog 有一条提到 team memory stores（`CLAUDE_MEMORY_STORES`）。
- 有 accountMemory（账号级记忆）的确认对话框。官方可能在做跨项目记忆，和全局 wiki 可能重叠；按 10-25 PO 定，不影响我们做。

## 5. 待议问题

### 架构（下次讨论的主题）

1. LLM Wiki 骨架怎么落到 Claude Code：wiki 的文件布局、索引、谁来加载、怎么加载。
2. 全局 wiki 怎么从项目记忆「编出来」：读哪些、写成什么样、PO 的决定和负结果怎么识别和保护。
3. 项目记忆膨胀谁来管：做梦不改项目记忆（10-25），SeaPawn 索引已到上限的 72%，这个痛点做梦不直接解决。
4. 用户级 CLAUDE.md 现在规定「GlobalMemory 只在用户明确要求时写」，做梦写全局 wiki 会改掉这条，落地时一并改（SM 10-21 补）。
5. 开工前核实：后台记忆进程、子代理是否加载用户级 CLAUDE.md 的只读规定。

### 运行

6. 谁来定时触发做梦：桌面端定时任务的限制能否接受。
7. 扫全部对话的 token 成本：按规矩从 Haiku 起步，提案再升档，写明理由。
8. 数据源：官方读 `logs/`，我们读什么。
9. 隐私：对话里可能有令牌、密码，提炼前要过滤，提案里不能出现；国网（SGCC）和中期考核（MidTerm）的内容不转述，这类项目的对话怎么处理要定。
10. 对话保留期要不要调长：提炼要用的原料每天在过期。

### 流程

11. 第一个增量是什么；聚焦的 IDEO 研究打哪个点。

## 6. 下一步

1. 与 PO 讨论架构（第 5 节 1–5）。
2. 架构定下一部分后，再定第一个增量和怎么做。

## 参考

- SeaPawn ProductBacklog #5：`S:\SeaPawn\Scrum\ProductBacklog.md`
- 笔记：`S:\SeaPawn\Notes\agent-memory\`（auto-memory.md、auto-dream.md、claude-memory-compiler.md、hermes-vs-claude-code.md、claude-md-vs-memory.md）
- 本仓库 `reference/`：外部方案原料
- 记忆 `product-rationale-distilled`：2026-08 的产品立论快照，用前复核
