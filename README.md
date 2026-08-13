# ClaudeDream

ClaudeDream 是一个 Claude Code 插件，目标是升级 Claude Code 的记忆系统，使 agent 系统免于腐烂，与用户和项目保持同步。

## 这里是什么

> **为长期使用 Claude Code 的人，设计让 agent 免于腐烂的记忆系统：记忆与用户、项目持续保持同步；每一次自动整合都增强而非侵蚀信任——可溯源、可撤销。**

**势力范围**：整合可维护记忆文件与 CLAUDE.md，绝不触碰其他项目内容。不做对话前端、不做模型推理、不碰 CLI 核心流程。

**非目标（本轮收窄）**：团队共享记忆（`team/`、多人协作）；跨项目记忆（未来方向）。

**当前处于产物开发段**：设计冲刺已完成（2026-08-02），方案定稿并在真实腐烂记忆库上跑通验证；Sprint-1（骨架回环）已收口（2026-08-13）；Sprint-2（底片层）Planning 已完成（2026-08-13），施工与出卷并行推进中。要一次看懂设计结论，读 [scrum/.IDEO/design-sprint/DesignReview.md](scrum/.IDEO/design-sprint/DesignReview.md)；要看产物开发的目标与 backlog，读 [scrum/ProductBacklog.md](scrum/ProductBacklog.md)。

## 为什么需要它

### 官方现状：不是"还没做"，是"做了但没写文档、没做透明层"

设计冲刺 Ask the Experts 阶段（2026-08-01）证实，Claude Code 内置的离线记忆整合功能（内部称 Auto Dream）并非尚在酝酿的未来功能，而是**已经在其他用户机器上真实运行、却始终没有出现在官方文档（<https://code.claude.com/docs/en/memory>）里**的研究预览功能。触发条件是 24 小时冷却期**且** 5 次新会话（两个条件都要满足），且需服务端 gate 放行。

社区已暴露出真实事故，两个 issue 均在 [anthropics/claude-code](https://github.com/anthropics/claude-code)：

| Issue | 内容 | 状态（核实于 2026-08-01） |
|---|---|---|
| [#47959](https://github.com/anthropics/claude-code/issues/47959) | Auto Dream 在约 24 小时内静默删除 23 个记忆文件（5 个用户画像 + 14 条反馈 + 4 条参考），含用户反复强调过 3 次的规则；无确认、无变更日志，靠用户自建备份对比才发现。作者事后永久关闭了该功能 | 2026-05-23 被 `github-actions[bot]` 以 stale 关闭；标签含 `bug` `has repro` `data-loss` |
| [#38493](https://github.com/anthropics/claude-code/issues/38493) | 把官方实现的缺口归纳为三类——**身份**（项目改名后记忆变孤儿，新记忆按会话主题而非项目命名）、**准确性**（整合时写下"18 of 21 items resolved"却不读原文核实）、**透明度**（唯一线索是 `/memory` 里"上次运行于 X 秒前"） | 2026-04-23 被 `github-actions[bot]` 以 stale 关闭 |

这三个缺口与 Challenge 里"可溯源、可撤销"的要求几乎一一对应——**不是我们凭空设想的风险，是已经被实测证实的官方产品缺陷。**

两个 issue 的全部评论均来自 `github-actions[bot]`（重复告警、stale 关闭、7 天后自动锁定），未见产品团队任何正面回应（已逐条核实评论作者）。据此判断：这块地没人种，但也没人明确说不让种。

### 为什么是现在

项目在 2026-07-29 重启——此前的 Design Sprint 与 Scrum Sprint 1-6 产出因组织杂乱作废，完整历史仍留在 git 里，但不再是当前工作基础。重启要重新框定一个值得数月投入的方向，本身是个高风险决定（high stakes）。

**窗口来自上一节的三个事实**：功能已上线却未进官方文档；已有实测的数据丢失事故；反馈通道被机器人自动关闭、产品团队未表态。三者叠加意味着——问题真实存在、官方已知晓、但短期内不打算正面处理。

另有一个本机观察可作线索，但**不构成主论据**：官方 Auto Dream 在这台机器上从未真正跑起来过，服务端 gate（`tengu_onyx_plover`）一直未放行。本机实证（2026-07-16）：全盘无 `.consolidate-lock`、无 `logs/` 目录，而 auto-memory 正常工作，故阻塞点只能是该 gate。
*（推测：可能与本机走的第三方网络中转有关——此判断无证据支撑，代表性存疑，不应作为立项依据。）*

## 前人三条路径：四阶段流程彼此同构

三条可参照的路径，其整合流程在结构上是同一套四阶段——**取料 → 提炼 → 整合 → 索引/体检**。抄哪条都构不成差异化。

| 路径 | 取料 | 提炼与整合 | 索引/体检 | 最先撞的墙 |
|---|---|---|---|---|
| **官方 Auto Dream**<br/>（`claude.exe` v2.1.210 逐字提取） | Phase 1 Orient：`ls` 记忆目录、读 `MEMORY.md`、`ls -R logs/`<br/>Phase 2 Gather：主读 `logs/YYYY/MM/DD/`，transcript 仅作窄词 grep 兜底 | Phase 3 Consolidate：并入既有主题文件、相对日期转绝对、删除被推翻的事实 | Phase 4 Prune and index：`MEMORY.md` 控制在 200 行 / 25KB 内；与 CLAUDE.md 对账 | **不敢改人写的层**——即使记忆明确纠正了 CLAUDE.md，也"do NOT edit CLAUDE.md during a dream"，只标注 + 报告；**无变更日志**；已实测误删 23 个文件 |
| **claude-memory-compiler**<br/>（[coleam00/claude-memory-compiler](https://github.com/coleam00/claude-memory-compiler)，clone commit `54eddd70`） | `flush.py`：SessionEnd / PreCompact 钩子 → Agent SDK 提取 → `daily/YYYY-MM-DD.md` | `compile.py`：日志 → `knowledge/concepts/`、`connections/`、`qa/` 交叉引用文章 | `lint.py` 7 项检查：断链、孤儿页、孤儿源、陈旧文章、矛盾（LLM）、缺失反链、稀疏文章 | **只报不删**——`lint.py` 检出矛盾后仅输出 issue 列表，无删除动作；且其 `check_stale_articles()` 判的是**源日志 hash 是否漂移**（`stored_hash != current_hash`），不是"记忆内容已过期"，与本项目所指的"过期"是两回事 |
| **claude-dream**<br/>（AI 转化产物，无独立上游） | 同 compiler，改写为 Claude Code 原生钩子 | 改写为 slash commands（`/flush` `/compile` `/query` `/lint`）+ subagents | 同 compiler | **不可作为实现依据**——无 commit 可追溯、无上游、未经验证，只能看形态不能抄结论 |

> 三条路径的取料层都依赖一层"预先消化好的活动流"——官方是 `logs/`，compiler 是 `daily/`。这层是下一节的问题。

## 原料层是否可行

**可得的**：会话日志（jsonl）在本机真实可得——`~/.claude/projects/` 下约 30 个项目、单项目常有 40+ 份会话文件（核查于 2026-07-16）。

**不可得的**：官方 Auto Dream 依赖的 `logs/` 逐日活动流压缩层，**本机全部项目均不存在**。这不是本项目的个例，是这台机器上整层都还是暗的——意味着这层必须自建。

自建这层需要解决三件事，构成本方向最大的一块工程量：

1. **挂哪个钩子**——SessionEnd、PreCompact、SessionStart 都可挂，但 **SessionEnd 触发之后没有 LLM 在运行**。插件形态目前没有一个"免费"的离线时刻可以白嫖，这是 Map 上 S5 的硬约束来源。
2. **压缩到什么程度**——已有可复用的现成件：`claude-code-log`（v1.5.0）的 `--detail low --format md --compact`，2026-08-01 三个真实会话实测：相对 `--detail full` 的 Markdown 体积降至约 1/4–1/7（77.6%–86.2%），相对原始 jsonl 降至约 1/20–1/170，随会话工具密度大幅波动。详见 [reference/README.md](reference/README.md)。
3. **丢什么留什么**——压缩不可逆，取舍必须写死并留档，否则后续无法判断"记忆里没有"是因为没发生还是因为被压掉了。

## 差异化在哪

不在整合算法本身（见上节：三条路径同构）。真正的空间在**信任与所有权层**：

| # | 差异化点 | 依据 | 必须随行的限定 |
|---|---|---|---|
| ① | **变更凭证 + git 可回滚**——梦改完记忆与 CLAUDE.md 后写报告、用 git 提交留痕 | 正是上节官方三缺口（身份/准确性/透明度）的解药。官方不敢让 Auto Dream 改 CLAUDE.md，本质是它**没有回滚层**；我们有 git，因此敢做官方不敢做的事 | "有 git 就够"本身是待验证的假设，正是设计冲刺问题 3 要问的：事后可回看可回滚，够不够替代事前逐条批准 |
| ② | **记忆容器身份的稳定性** | 官方记忆按工作目录路径字符串键控，项目改名或搬盘会静默孤立记忆。本项目 2026-07-29 重启搬盘时**自己实际踩过这个坑**；[#38493](https://github.com/anthropics/claude-code/issues/38493) 也独立报告了同一问题（项目改名后记忆变孤儿、无检测） | "官方尚未着手解决"有依据（#38493 提出后被 stale 关闭、无产品团队回应），但"官方没意识到"是**推测**——不能排除内部已在处理而未公开 |
| ③ | **本地可控、可否决** | 第三方工具 [thedotmack/claude-mem](https://github.com/thedotmack/claude-mem) 在官方方案已上线的情况下仍获得数万 star，证明"更可控、更本地"的需求真实存在 | **star 数各源分歧且在快速增长，引用时必须带快照日期**：[46.1K@2026-04-07](https://www.augmentcode.com/learn/claude-mem-46k-stars) · [65.8K@2026-04-23](https://www.augmentcode.com/learn/claude-mem-65k-stars) · [89.1K](https://skillsllm.com/skill/claude-mem)（无日期） · [44,192](https://alternativeto.net/software/claude-mem/about)（无日期）。**论证方向不受影响**（数字只增不减），但任何单一快照都不可作为当前值引用 |

## 证据与效力

**本节是设计冲刺 Ask the Experts（2026-08-01，四模块：A 官方机制 + 项目考古 / B 前人方案深读 / C 社区之声调研 / D 决策者访谈）的蒸馏层**，原载于 `.IDEO/ChallengeBackground.md`，2026-08-07 并入本文件。

**证据落盘状态**（Decider 于 2026-08-01 拍板"只补出处、不建原始材料目录"）：

| 材料 | 状态 |
|---|---|
| 官方机制（Auto Dream / auto-memory 提取文档） | ✅ 已入库 [reference/agent-memory/](reference/agent-memory/) |
| 前人方案源码（claude-memory-compiler、claude-dream、claude-code-log） | ✅ 已入库 [reference/](reference/)，取材口径见 [reference/README.md](reference/README.md) |
| 两个社区 issue | ✅ 本节已给 URL，可直接回原帖核实 |
| **决策者访谈原话** | ⚠️ **未落盘**，仅存在于 2026-08-01 会话 |
| **社区之声调研过程** | ⚠️ **未落盘**，仅存在于 2026-08-01 会话 |
| **40 条 HMW 原始候选**（合并为 21 条后选定 8 条） | ⚠️ **未落盘**，仅合并/选定的口径记录在 commit `a5b91c1` |

标 ⚠️ 者是**已知情的设计选择，不是遗漏**。若后续阶段需复查未选中的候选或访谈原话，需重跑对应模块。

**效力**：本节与 `reference/` 下原料冲突时，**以原料为准**；本节中所有带"推测"标注的判断不得作为决策依据。

## 文件地图

| 文件/目录 | 内容 |
|---|---|
| `README.md` | 本文件——项目地图与当前状态 |
| `CLAUDE.md` | 项目指令（每次新会话自动加载）：定位、历史分支、入口指引 |
| `.gitignore` | Git 忽略规则 |
| `.env` | 本地环境变量，不可阅读 |
| `seapawn.md` | 本地私人笔记，不可阅读 |
| `.claude/` | 本项目的 auto-memory 记忆库（`memory/` + `MEMORY.md` 索引）——本项目自身用，不是产物 |
| `.claude-plugin/` | `marketplace.json` — 插件分发骨架，指向 [`./claude-dream`](claude-dream/) |
| `claude-dream/` | **插件产物代码**（与 `reference/claude-dream/` 是两回事，那个是只读参考材料）——Sprint-1 骨架回环：`hooks/`（SessionEnd/SessionStart）、`src/`（触发链、canUseTool 围栏、占位体检整合引擎、梦报告与 `dream:` 提交）。自证脚本 `claude-dream/test/self-test.mjs`（DoD·D1，覆盖全链路/冷却期/防递归/故障注入） |
| `scrum/` | **Scrum 段工作区（当前阶段）**——总入口 [scrum/README.md](scrum/README.md)：产品待办与架构 [ProductBacklog.md](scrum/ProductBacklog.md)、Sprint-1 [sprint-01-skeleton/](scrum/sprint-01-skeleton/README.md)（已收口）、Sprint-2 [sprint-02-negatives/SprintBacklog.md](scrum/sprint-02-negatives/SprintBacklog.md)（底片层，Planning 完成、施工中；出卷线 `sprint-02-acceptance` 分支，卷面保密）、设计冲刺全部档案归档于 `scrum/.IDEO/design-sprint/`（总入口 [DesignReview](scrum/.IDEO/design-sprint/DesignReview.md)） |
| `reference/` | 方案类比参考资料 — auto-dream · auto-memory · claude-memory-compiler · claude-code-log · claude-mem · **claude-dream/**（AI 转化产物：claude-memory-compiler 改写为插件形态，无独立上游，只读不可信）— 详见 [reference/README](reference/README.md) |

## 当前状态

**2026-08-13：Sprint-1 收口——增量收下。验收 16 判据 15 过（出卷/答卷分离，考卷与考场在 `sprint-01-acceptance` 分支 `scrum/sprint-01-skeleton/acceptance/`；三场真梦全程无人值守，revert 一步可退），遗留 H-A8（提示行用户可见）立为 PBI-05；Review 与 Retro 落盘 SprintBacklog 第四/五节，DoD 增设 D4「绿灯点过烟」。**

**同日：Sprint-2（底片层）Planning 完成。** Goal「白天留底，夜里读得到」——PBI-01 机械压缩底片层先动工（料先行，PBI-02 排后一棒），PBI-05 留 backlog 不搭车；opus 独立审阅 29 条全数收入 AC；施工分支 `sprint-02-negatives`，出卷线 `sprint-02-acceptance`（worktree 隔离、卷面保密），两线并行推进，待派发 developers。

设计冲刺结论摘要（2026-08-02 结算）：定稿方案的主干成立——体检判据（M1–M5 机械 + S1–S3 语义）、四级处置权限、三道安全阀、git 回滚层，在一个 42 条记忆的腐烂库上真跑通并经故障注入验证；兑现层三处待改——报告的证据形态、回滚的隔离性、机器推论的身份标识。完整结算见 [scrum/.IDEO/design-sprint/DesignReview.md](scrum/.IDEO/design-sprint/DesignReview.md)。

**产物开发的入场条件**：verdict §3 的 C1–C3（回滚与证据形态改造）须在首个可用版本前完成，记录在 [scrum/ProductBacklog.md](scrum/ProductBacklog.md) 第二部分小字；C4–C7 待后续再议。Sprint-1 的 Sprint Goal 是插件骨架立起、回环走通（不含引擎判断质量），见 [scrum/sprint-01-skeleton/SprintBacklog.md](scrum/sprint-01-skeleton/SprintBacklog.md)。

### 里程碑

| 日期 | 事件 |
|---|---|
| 2026-07-29 | 项目重启——旧 Design Sprint 与 Scrum Sprint 1-6 产出作废（历史仍在 `sprint-01`~`sprint-05-eval-test-set--06`、`DesignSprint--跑通全流程` 等分支）；新一轮冲刺启动，Monday Define 拍板 |
| 2026-08-01 | Ask the Experts 四模块完成；HMW 40→21→8 条；Pick a Target 圈定 **长期用户 + S6–S8 整合段** |
| 2026-08-02 | Ideate（三场闪电演示 → 四派竞争草图 → wiki 主体杂交定稿）；Prototype 施工（腐烂库 builder + 梦引擎，三场真梦跑通）；Friday Test（真人十格 + 三个模拟用户人格）；三级 Review 落盘 |
| 2026-08-07 | 设计冲刺档案归档至 `scrum/.IDEO/design-sprint/`；Scrum 段骨架搭建（Architecture / ProductBacklog / README） |
| 2026-08-09 | ProductBacklog 按 SGEP 方法论重制；Architecture 并入 ProductBacklog 第三部分，原文件删除；Sprint-1 Planning——Sprint Goal 拍板，PBI-04（插件骨架与回环）新建并精化，PBI-03 一并选入，`scrum/sprint-01-skeleton/SprintBacklog.md` 建档 |
| 2026-08-12 | Sprint-1 执行：04.2·AC0 spike 实测 canUseTool 放行路线成立（记录见 `scrum/sprint-01-skeleton/spike-ac0/`）；`claude-dream/` 插件骨架与 13 条 AC 落地，自证脚本全绿；交付接口 `adapter.json` 与故障注入入口一并交付；D3 独立 review 三轮 + 复审已闭环 |
| 2026-08-13 | Sprint-1 收口：D3 三轮 + 复审闭环；验收首考挂 7 条经查全为考卷侧接口想当然、developers 零改动，修卷三轮（`b3ad44d`）后 13 自动判据全绿 + 人工两项过；Review 增量收下（15/16，H-A8→PBI-05），Retro 立「空转冒充覆盖」病根、「绿灯点过烟」入 DoD·D4；开发版插件全局关闭 |
| 2026-08-13 | Sprint-2（底片层）Planning：Goal「白天留底，夜里读得到」；PBI-01 先动工（料先行），PBI-05 不搭车；opus 独立审阅 29 条全收；`sprint-02-negatives` 施工分支与 `sprint-02-acceptance` 出卷线（worktree 隔离）并行落盘 |

*过程细节与每一次拍板的理由由 git 历史承载，不堆回本文件。*
