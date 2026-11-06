# ClaudeDream v3：方向与待议问题

2026-10-25 凌晨讨论底稿。这不是设计定稿：标「PO 定」的是 PO 已做的决定，其余是记录和想法。

**2026-11-07 更新**：PO 定以 Anthropic 官方 cookbook《Dreaming with a dynamic workflow》为基线。§2 末尾新增 11-07 各行，与之冲突的旧行已就地标注；cookbook 的精读笔记和移植清单在 `docs/cookbook-port-notes.md`。

来源：SeaPawn ProductBacklog #5 及其冲刺日志、`S:\SeaPawn\Notes\agent-memory\`、10-25 凌晨 ClaudeDream 会话的核实。

## 1. 要解决什么

**愿景**（保留）：任何长期使用 Claude Code 的人，开新会话时 agent 都像昨天刚一起工作过；而且越用越懂你。

**痛点**（PO 10-20）：记忆太多。当时 SeaPawn 私有层 78 条，索引 `MEMORY.md` 17KB，每次开会话整份加载；paper-writing-polish 52 条、RockMass 38 条、StrataGP 35 条、MidTerm 32 条。10-24 实测 SeaPawn 索引 86 行、18,375 字节，约占 25KB 加载上限的 72%；超出部分不加载也不报错。

## 2. PO 已定的方向

| 日期 | PO 定 |
|---|---|
| 10-14 | 推倒重来：旧插件、设计冲刺与 Sprint 档案全部删除，新起点是 tag `v3.0`。愿景保留，路径重新设计；旧档案、旧规格、旧 DoD 不作前提 |
| 10-21 | 拿 Karpathy 的 LLM Wiki 当骨架，做梦就是其中的 lint。全局 wiki 只由做梦来写，改完提交，PO 看 diff。PO 的决定和不可重建的负结果不能动。项目记忆照原生机制不动，全局 wiki 从项目记忆里编出来（**11-07 改**：骨架以 cookbook 为准，做梦同时做 ingest 和 lint；「PO 看 diff」改为默认不审；原料改为 transcript；「项目记忆不动」「从项目记忆编」待议，见 §5 第 13、14 条） |
| 10-24 | 做梦只管记忆，三件事：整理（合并、去重、删过期、压索引）、从过往对话提炼新记忆（含「怎么做」和 PO 偏好）、补 wiki |
| 10-24 | 不整理技能。技能和记忆都是渐进式披露，用记忆代替技能；技能只留给需要 `/命令`、脚本、限定工具或模型、打包共享的情形，仍然手写 |
| 10-24 | 不建对话库，提炼记忆比建库有意义。理念跟 Claude Code 一致：对话随便丢，记忆才是长期的 |
| 10-24 | USER.md 就是 CLAUDE.md 加用户类记忆，不是缺口 |
| 10-24 | 「自动」指自动生成提案，不是自动采纳；PO 审 diff（记忆库是 git 仓库）（**11-07 改**：照 cookbook 默认不审，见下） |
| 10-25 | 项目记忆归原生 auto-memory 管；wiki 是我们自己的一套机制（11-07：做梦动不动项目层待议，见 §5 第 13 条） |
| 10-25 | 官方放不放行都不影响我们做；官方做出来以后再对标 |
| 10-25 | #30「SeaPawn 文件夹当个人助手（类 Hermes）」不并入 #5，不需要了；专心把 Claude Dream 做好 |
| 10-25 | v3.0 是 v2.0 之后的进一步重构 |
| 10-25 | 先定架构，再定怎么做。不开系统的设计冲刺；第一个增量可能是原型，用一次聚焦的 IDEO 研究（打一个点）来做，细节再议（11-07：架构以 cookbook 为基线；IDEO 研究还做不做未定） |
| 11-07 | 以 Anthropic 官方 cookbook《Dreaming with a dynamic workflow》（`reference/agent-memory/dreaming-cookbook/`）为基线；以前的规则与它冲突处，以 cookbook 为准。PO 判断它很可能就是官方将来的机制（这是判断，未核实） |
| 11-07 | 审阅照 cookbook：默认不审，原地改，靠 git 回滚兜底 |
| 11-07 | 原料照 cookbook：直接读 transcript |
| 11-07 | 产品形态是 Claude Code 插件，和本仓库定位一致：照抄 cookbook 的设计和四个提示词，运行底座换成 Claude Code。PO 有 API，但不走 API 路线；以后可以另出一个 API 版，两版共用提示词 |
| 11-07 | 先照着 cookbook 做。fork 去重、收尾会话当天处理，留作以后的候选 PBI；顺手的话可以一起做 |
| 11-07 | PO 看法：`instructions.md` 本质上就是全局层的 `MEMORY.md` 入口（导入 `GlobalMemory/MEMORY.md`，外加 PO 的规矩），结构不用拆。改不改名未定，见 §5 第 15 条 |

## 3. 已核实的事实

| 事实 | 来源 | 核实 |
|---|---|---|
| 官方 auto-dream 仍未放行。服务端开关 `tengu_onyx_plover` 本机缓存为 `{"enabled": false, "minHours": 24, "minSessions": 3, "remoteEnabled": false}`（7 月为 null） | 本机 `.claude.json` 的 `cachedGrowthBookFeatures` | 10-25，v2.1.309 |
| 设置 `autoDreamEnabled: true` 无效：开关的 `enabled` 或 `available` 为 true 时才读这个设置。只能关，不能开 | v2.1.309 二进制判定代码 | 10-25 |
| 官方文档搜不到 dream / `autoDreamEnabled`；本机所有记忆目录没有 `.consolidate-lock`，从未运行 | claude-code-docs；本机文件 | 10-25 |
| auto-dream 触发：距上次整合 ≥ 24 小时、新会话数 ≥ 阈值（默认 5，服务端现给 3）、服务端开关放行。改完直接写入，没有审阅环节（#47959 误删 23 个记忆文件） | 二进制；GitHub issue | 10-25；issue 为 2026-08 核实 |
| 11-07 复核：v2.1.319 的开关缓存仍为 `{"enabled": false, "minHours": 24, "minSessions": 3, "remoteEnabled": false}`；二进制里 auto-dream 全套还在，门控逻辑不变；官方文档仍搜不到 dream | 本机 `C:\Users\seapawn\.claude.json`（本会话）；二进制与文档（另一会话） | 11-07 |
| 官方 dream 读的是预先消化的活动日志 `logs/`，不是原始 transcript（**11-07：v2.1.319 已去掉 `logs/`**，来源改为漂移的既有记忆加按需 grep transcript，有 `sessions/` 子目录时再看一眼；核心仍是删被推翻的事实、索引 ≤200 行且 ≤25KB、无人审、原地改） | PO 07-16 从 v2.1.210 提取的笔记；v2.1.319 二进制 | 11-07（另一会话） |
| Managed Agents 有官方 Dreams（research preview）：读 memory store 加过去的会话，把重组结果写进**新** store。cookbook 是同一思路的自建版，原地更新 | cookbook 正文 | 11-07 |
| cookbook 在 `anthropics/claude-cookbooks`，MIT 许可；notebook 于 2026-11-04 19:06 UTC 提交（#959） | GitHub API | 11-07 |
| cookbook 成本：11 份 283KB 花 $0.36、2.5 分钟；50 份约 12MB 约 $8、10 分钟（列表价） | cookbook 正文 | 11-07 |
| 本机最近 30 天 39 个 jsonl（含 `subagents/` 下 3 个），共 106MB；21,180 条消息里 5,908 条（约 28%）出现在不止一个文件：fork 会把父会话历史连同消息 uuid 原样复制 | 本机实测 | 11-07 |
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

1. LLM Wiki 骨架怎么落到 Claude Code：wiki 的文件布局、索引、谁来加载、怎么加载。（11-07：格式照 cookbook，小文件、frontmatter、`[[slug]]` 互链、索引；它的 `_index.md` 对应我们的 `MEMORY.md`。两层怎么落见 12–14）
2. 全局 wiki 怎么从项目记忆「编出来」：读哪些、写成什么样、PO 的决定和负结果怎么识别和保护。（11-07：原料改为 transcript，本条由第 14 条取代；PO 决定与负结果的保护可照 organizer 的 `CONFLICT` 规则）
3. 项目记忆膨胀谁来管：做梦不改项目记忆（10-25），SeaPawn 索引已到上限的 72%，这个痛点做梦不直接解决。
4. 用户级 CLAUDE.md 现在规定「GlobalMemory 只在用户明确要求时写」，做梦写全局 wiki 会改掉这条，落地时一并改（SM 10-21 补）。
5. 开工前核实：后台记忆进程、子代理是否加载用户级 CLAUDE.md 的只读规定。

### 运行

6. 谁来定时触发做梦：桌面端定时任务的限制能否接受。
7. 扫全部对话的 token 成本：按规矩从 Haiku 起步，提案再升档，写明理由。
8. 数据源：官方读 `logs/`，我们读什么。（11-07 定：transcript）
9. 隐私：对话里可能有令牌、密码，提炼前要过滤，提案里不能出现；国网（SGCC）和中期考核（MidTerm）的内容不转述，这类项目的对话怎么处理要定。
10. 对话保留期要不要调长：提炼要用的原料每天在过期。

### 流程

11. 第一个增量是什么；聚焦的 IDEO 研究打哪个点。

### 11-07 新增：照 cookbook 移植时冒出来的

记忆分两层（全局、项目），cookbook 只有一层，下面 12–15 是它不用回答的。

12. 路由：一份 transcript 读出的事实，哪些写进项目层、哪些写进全局层。中间地带很多。
13. 做梦动不动项目层：照 cookbook，对项目 transcript 做梦最自然的结果就是写该项目的记忆，和 10-25「项目记忆归原生 auto-memory 管」冲突。
14. 全局层从哪来：analyzer 从 transcript 直接分流，还是先写项目层、再从各项目汇总上去。
15. `instructions.md` 里 PO 的规矩做梦碰不碰。可借 auto-dream 对 CLAUDE.md 的做法：有冲突只标注、只报告，不改人写的层。改不改名：候选 `USER.md`（SM 推荐）、`CLAUDE.md`、保留原名；改名要同步各账号配置目录的 `@` 行、`.gitignore` 白名单（漏改会被 git 静默忽略）、README 和 4 个记忆文件。
16. 删减要不要单独审：cookbook 只增不删，store 会一直长大；要删减得学 auto-dream，而 #47959 出事正出在删减这一步。SM 建议：删减单独审，增改照 cookbook 直接写。
17. 跨会话综合（「连起你自己都没连起的线索」）要不要做、放哪一层：cookbook 的 organizer 明确禁止（“reorganizing, not re-analyzing … Do not invent facts”），每个 analyzer 只看一份 transcript。
18. 原料要不要加上 PO 决定表、ProductBacklog、`docs/`：cookbook 收人写的笔记（示例 `00-maintainer-notes.md`），PO 的决定能以原话、带日期进记忆；代价是这些文件会变，要判断哪些是新的。
19. 工具结果保留多少：cookbook 说工具结果最重要，全量保留最准也最贵。先按它的格式全量渲染，测体积和成本，再定是否截断过长输出。
20. Workflow 工具里起的 agent 能否限工具（防提示注入的关键）；不能的话改用子代理（frontmatter `tools:`）。
21. 插件的命令在 headless `claude -p` 下能否用：决定定时触发能否走 Windows 任务计划程序。
22. 要不要先用 API 原样跑一遍官方 notebook 的示例数据当对照基线（官方报价 $0.36；需要 key 开通 Managed Agents beta，未核实）。评测照 cookbook 用固定事实清单算召回，SM 建议再加精确率（记忆里有多少条在原文找不到依据）。

## 6. 下一步

1. 接着精读 cookbook 第 3–7 段，每段按「能照抄 / 要换底座 / 我们要改」分类，读完即得移植清单（`docs/cookbook-port-notes.md`）。
2. 同类项目调研（PO 11-07 提）：`reference/` 是旧一轮的调研，cookbook 之后有没有新的做梦方案、讲 dream 的文章，甚至有没有人已经把 cookbook 做成了 Claude Code 插件，让现在做变得多余。交 PO 新建的 Developer 会话。
3. 读完、调研回来后开 v3 第一次 Sprint Planning：先建最小 Product Backlog；Sprint Goal 由 PO 定（SM 的候选：把 cookbook 移植成 Claude Code 插件，对一个项目的 transcript 跑通一次做梦）。

## 参考

- SeaPawn ProductBacklog #5：`S:\SeaPawn\Scrum\ProductBacklog.md`
- 笔记：`S:\SeaPawn\Notes\agent-memory\`（auto-memory.md、auto-dream.md、claude-memory-compiler.md、hermes-vs-claude-code.md、claude-md-vs-memory.md）
- 本仓库 `reference/`：外部方案原料；cookbook 原件在 `reference/agent-memory/dreaming-cookbook/`
- `docs/cookbook-port-notes.md`：cookbook 精读笔记与移植清单
- `docs/dreaming-architectures.md`：cookbook、auto-dream、v3 三种做法的架构图和对照表
- 记忆 `product-rationale-distilled`：2026-08 的产品立论快照，用前复核
