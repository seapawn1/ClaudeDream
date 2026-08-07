# ProductBacklog

按 SGEP 的四件套承诺关系写全：Product → Definition of Outcome Done，Increment → Definition of Output Done，Product Backlog → Product Goal。

## 第一部分 · 产品、目标与完成定义

### 1. Product（这个产品是什么）

- **形态**：一个 Claude Code 插件 `claude-dream`，升级 Claude Code 的记忆系统，使 agent 记忆免于腐烂
- **类型**：按 SGEP 的 experience / platform 二分，这是 **experience**——直接面向长期使用 Claude Code 的人解决一个具体问题（记忆腐烂），不是给别人搭产品的底座
- **势力范围**：整合可维护记忆文件与 CLAUDE.md，绝不触碰其他项目内容
- **非目标**：团队共享记忆、跨项目记忆
- **Stakeholders**：见 [Architecture.md](Architecture.md) 角色与结果表，此处不重复

### 2. Product Vision 与 Product Goal

**Vision**（长期，来自设计冲刺长期目标原句）：

> 任何长期使用 Claude Code 的人，开新会话时 agent 都像昨天刚一起工作过；而且越用越懂你——记忆产生复利，agent 能连起你自己都没连起的线索。

**Goal**（当前中期目标，2026-08-07 拍板）：

> **交付首个用户敢开着用的 claude-dream——一场梦改完记忆与 CLAUDE.md 之后，用户能查证它做了什么、能按文件退回去。**

Goal 是 Vision 的一块可交付切片；Goal 是单一的、中期的，达成或放弃之后才换下一个（候选下一个：Target-2 取用段 S10–S11）。

### 3. Definition of Outcome Done（挂 Product，价值验证）

| 验收信号 | 结算 | 缺口 |
|---|---|---|
| 不引用过期事实 | ✅ 过 | M4 的搭便车事实盲区 |
| 与项目现状同步 | ✅ 过 | — |
| 条条可溯源 | ⚠️ 形式过、实质待改 | 证据是转述非执行日志；有抽查点永不失败 |
| 用户握有最终解释权 | ⚠️ 部分过 | 单条回滚跨笔连坐会静默丢数据 |
| 不重复提问 | ⬜ 未测 | 属取用段，转 Target-2 |
| **审计型用户逐笔核对后，外部证据能全部验成** | ⚠️ 本轮未做到 | 是 Product Goal 的直接判据，本轮设计冲刺已暴露但未修——见下表 Q2/Q3 |

### 4. Definition of Output Done（挂 Increment，增量级质量标准）

这是**整个增量的质量底线，不是单条 PBI 的验收标准**（后者是 PBI 自己的 Acceptance Criteria）。按 SGEP，它在 Sprint 期间不得被削弱。七条全部从设计冲刺的教训长出来：

| 编号 | 质量标准 | 出处与教训 | 怎么验 |
|---|---|---|---|
| Q1 | 安全阀必须经**故障注入**验证——合作型 agent 永远碰不到熔断线，必须用作恶假 agent 走完真实审计路径 | run-03 实证；DesignReview 教训 3 | CI 跑 rogue-dream 三种作案，三种全被拦下 |
| Q2 | 报告证据栏必须是**执行产物**：命令原文 + exit code + stdout 前几行 + 时间戳，统一 shell 方言 | C2；P1「从论证变成记录」 | 抽任一笔，证据栏含退出码与时间戳 |
| Q3 | 抽查点**必须能失败**——一律以梦前状态为基准，凡能被梦后状态自动满足的检查不许写进去 | C3 | 以梦前 sha 复跑，至少一条抽查点在梦前状态下不通过 |
| Q4 | 任何面向用户的数字必须与报告**同源生成**，不得手写 | C5；Test 中主持人手写布景抄错两个数被当场抓住 | 提示行与报告的数字逐项对账为同一变量 |
| Q5 | 机器推论必须**带身份标识**：`origin` / `confidence` / `generated_at` / `verified_at`；未确认的推论正文顶部有警告行 | C4；P1 与 P3 独立提出 | 抽任一条 connection，frontmatter 四字段齐全 |
| Q6 | 每次改动**可回滚且不销毁审计轨迹**——报告不进 dream commit，或 revert 时保留 | C7 | 对一场梦执行 revert，报告仍在 |
| Q7 | **删除票只能由机械确凿证据开出**，LLM 无删除开票权 | Sketches 铁律（嫁接 C） | 构造只有 LLM 判据支持的删除申请，引擎必须拒收并整梦回滚 |

C1–C7 出处：[.IDEO/design-sprint/Target-1-Consolidation/Prototype-01-FirstDream/verdict.md](.IDEO/design-sprint/Target-1-Consolidation/Prototype-01-FirstDream/verdict.md) §3。

## 第二部分 · Backlog 骨架

表格行序即优先顺序；「编号」是不随排序变的稳定 ID，后续插行不必重编号。「size」是未经 refinement 的初估（T恤码：S/M/L），按 SGEP 应由 Product Developers 在 Sprint Planning 时重估。

本轮只填最急的 5 条，其余留给 Decider 扩充：

| 编号 | 标题 | 产品意图 | 架构定位 | 当前状态 | size | 依据 | 备注 |
|---|---|---|---|---|---|---|---|
| B1 | 机械压缩底片层 | 梦有原料可吃；用户裁决能送达下一梦 | S4 | 已拍板未动工 | L | TargetMap 备注、DesignReview §7 | 明写「动工排 backlog 首位」；含 G9 回程 bug 修复 |
| B2 | 引擎主干产品化 | 原型验证过的体检与处置能真装进 Claude Code 用 | S6–S7 | 原型已跑通，待产品化 | L | Sketches、verdict §2 | M1–M5 / S1–S3 判据、L0–L3 处置、三道安全阀从脚本变插件形态 |
| B3 | Agent SDK canUseTool 结构缴械 | 梦在结构上碰不到它不该碰的东西 | 横切 S5–S7 | 未开工 | M | DesignReview §7、原型实测 | `.claude` 是受保护路径、headless 下 hook 不加载——从「推荐」升为「必选」；B2 的前提 |
| B4 | 回滚按文件出 | 用户撤销一笔时不会静默丢掉另一笔 | S8–S9 | 未开工 | M | verdict §3 C1 | 撤销键的工程质量必须高于删除键；含 `dream-undo` 脚本（索引回补、跨笔依赖检查、dry-run） |
| B5 | 报告证据形态改造 | 用户起疑去查时，证据经得起真查 | S8 | 未开工 | M | verdict §3 C2+C3 | 含两条改造，refinement 时可拆；对应 Q2 与 Q3 |

**入场条件**：C1–C3（对应 B4、B5）须在首个可用版本前完成。

**未裁决、不进本表排序**：verdict §4 待 Decider 裁决三项——observe-only 模式是否进产物 / 梦间方差是否可接受 / 个人侧复利怎么测。

## 第三部分 · 细化 Backlog 列表

*待首次 Sprint Planning / Refinement 填入，本轮不填内容。*

| 编号 | 标题 | 描述 | Acceptance Criteria | Outcome Criteria | size | 状态 |
|---|---|---|---|---|---|---|
| | | | | | | |

按 SGEP，每条 PBI 可带 **Acceptance Criteria**（output 何时算完，在 Definition of Output Done 之外，针对该 PBI 特有的标准）与 **Outcome Criteria**（价值何时算够，在 Definition of Outcome Done 之外，是该 PBI 的 why）。Refinement 的目标是把骨架里的一块拆到「能在数天内按 Definition of Output Done 完成」。
