# ProductBacklog

按 SGEP 的四件套承诺关系组织：Product → Definition of Outcome Done，Increment → Definition of Output Done，Product Backlog → Product Goal。第四件（Sprint Backlog → Sprint Goal）属 Sprint 级，开 Sprint 时另建文件。

## 第一部分 · 产品、目标与完成定义

### 1. Product

> **claude-dream——一个 Claude Code 插件，为长期使用 Claude Code 的人提供可信的记忆离线整合（体检 → 整合 → 留证），使 agent 记忆免于腐烂，与用户和项目保持同步。**

*类型：按 SGEP 的 experience / platform 二分是 experience——直接面向用户解决一个具体问题，不是给别人搭产品的底座。满足缺口：长期使用下 agent 记忆会腐烂——自信引用过期事实，用户从此条条核实；官方离线整合零留证、禁碰 CLAUDE.md，且出过静默删除 23 个记忆文件的社区事故——缺的不是"会整合"，是"可信的整合"。势力范围：只动可维护记忆文件与 CLAUDE.md，绝不触碰其他项目内容。非目标：团队共享记忆、跨项目记忆、对话前端、模型推理。Stakeholders：见 [Architecture.md](Architecture.md) 角色表。Scrum 角色映射：Product Owner＝seapawn；Product Developers＝Claude agent，增量一律经 PO 验收，sizing 归 Product Developers。*

### 2. Product Vision

> 任何长期使用 Claude Code 的人，开新会话时 agent 都像昨天刚一起工作过；而且越用越懂你——记忆产生复利，agent 能连起你自己都没连起的线索。

*Vision 常是尚未成真的虚构，作用是给假设与实验定方向，不是承诺。按 SGEP，Product Backlog 的承诺是一个中期 Product Goal——Vision 的可交付纵切片，单一、达成或放弃后才换下一个；当前 Goal 待 PO 拍板后补入本节。*

### 3. Definition of Done

两份完成定义，各挂一个工件，都是核对清单——每条是可二元判定的陈述：**Outcome Done 挂 Product**，答"价值何时算实现"，从首次发布起每次 Sprint Review 用真实使用证据检视，不必等产品全部交付；**Output Done 挂 Increment**，答"质量何时算合格"，每个增量交付前逐条过，不过即不算 Done。

#### Definition of Outcome Done

*待 PO 定义。按 SGEP 应在实现开始前定义好（避免事后偏袒解释）、直接证据优先于间接证据。*

#### Definition of Output Done

- [ ] D1 **CI 全绿，含故障注入**：作恶假 agent 三种作案全被拦下——安全阀只能用故障注入证明
- [ ] D2 **不破坏官方 auto-memory 契约**：一记一文件 + MEMORY.md 纯指针索引，增量改动后契约完好
- [ ] D3 **文档同步**：README／CLAUDE.md 反映增量后的当前状态，无过期指引

*这是对每个增量、每条 PBI 通用的质量底线，Sprint 内不得削弱、只能加强。设计冲刺的 C1–C7 类条款（证据栏形态、抽查点、回滚行为、删除票……）是特定功能的验收标准，refinement 时归位到对应 PBI 的 Acceptance Criteria，不占用全增量的 DoD。*

## 第二部分 · Product Backlog

| 编号 | 标题 | 产品意图 | 架构定位 | 当前状态 | size | 备注（依据） |
|---|---|---|---|---|---|---|
| PBI-01 | 机械压缩底片层 | 梦有原料可吃；用户裁决能送达下一梦 | S4 | 已拍板未动工 | L | 明写「动工排 backlog 首位」；含 G9 回程 bug 修复（TargetMap 备注、DesignReview §7） |
| PBI-02 | 引擎主干产品化 | 原型验证过的体检与处置能真装进 Claude Code 用 | S6–S7 | 原型已跑通，待产品化 | L | M1–M5 / S1–S3 判据、L0–L3 处置、三道安全阀从脚本变插件形态（Sketches、verdict §2） |
| PBI-03 | Agent SDK canUseTool 结构缴械 | 梦在结构上碰不到它不该碰的东西 | 横切 S5–S7 | 未开工 | M | `.claude` 是受保护路径、headless 下 hook 不加载——从「推荐」升为「必选」；PBI-02 的前提（DesignReview §7、原型实测） |

*本表是达成 Product Goal 的唯一工作来源：行序即优先序，由 Product Owner 排定；编号是不随排序变的稳定 ID。粗条目经 Refinement 拆小后落第三部分，本表对应行状态改「已精化」——两表是同一个 Product Backlog 的粗细两态。size 是未经 refinement 的 T 恤码初估，Sprint Planning 时由 Product Developers 重估。本轮先填最急 3 条，其余由 PO 添加。依赖提示：PBI-03 是 PBI-02 的结构前提，现行序按价值排，取舍在首次 Sprint Planning 定。入场条件：verdict §3 的 C1–C3（回滚与证据形态改造）须在首个可用版本前完成，对应条目待 PO 补入。*

## 第三部分 · 精化 Backlog

*待首次 Sprint Planning / Refinement 启用，暂不设表。启用时：编号用层级式（如 PBI-02.1）编码出身；拆分目标是 ready——能在数天内按 Definition of Output Done 完成；每条可带 Acceptance Criteria（该条 output 何时算完）与 Outcome Criteria（该条价值何时算够，本条的 why），两者须经 PO 通过，且可随时演化；sizing 归 Product Developers。*
