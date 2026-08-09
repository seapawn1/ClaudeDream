# ProductBacklog

按 SGEP 的四件套承诺关系组织：Product → Definition of Outcome Done，Increment → Definition of Output Done，Product Backlog → Product Goal。第四件（Sprint Backlog → Sprint Goal）属 Sprint 级，开 Sprint 时另建文件。

## 第一部分 · 产品、目标与完成定义

### 1. Product

> **claude-dream——一个 Claude Code 插件，为长期使用 Claude Code 的人提供可信的记忆离线整合（体检 → 整合 → 留证），使 agent 记忆免于腐烂，与用户和项目保持同步。**

*类型：按 SGEP 的 experience / platform 二分是 experience——直接面向用户解决一个具体问题，不是给别人搭产品的底座。满足缺口：长期使用下 agent 记忆会腐烂——自信引用过期事实，用户从此条条核实；官方离线整合零留证、禁碰 CLAUDE.md，且出过静默删除 23 个记忆文件的社区事故——缺的不是"会整合"，是"可信的整合"。势力范围：只动可维护记忆文件与 CLAUDE.md，绝不触碰其他项目内容。非目标：团队共享记忆、跨项目记忆、对话前端、模型推理。Stakeholders：见第三部分角色表。Scrum 角色映射：Product Owner＝seapawn；Product Developers＝Claude agent，增量一律经 PO 验收，sizing 归 Product Developers。*

### 2. Product Vision

> 任何长期使用 Claude Code 的人，开新会话时 agent 都像昨天刚一起工作过；而且越用越懂你——记忆产生复利，agent 能连起你自己都没连起的线索。

*Vision 常是尚未成真的虚构，作用是给假设与实验定方向，不是承诺。PO 决定（2026-08-09）：本产品不拆中期 Product Goal，Vision 直接兼任——Backlog 排序与每个 Sprint Goal 都直接对着它对齐。*

### 3. Definition of Done

两份完成定义，各挂一个工件，都是核对清单——每条是可二元判定的陈述：**Outcome Done 挂 Product**，答"价值何时算实现"，从首次发布起每次 Sprint Review 用真实使用证据检视，不必等产品全部交付；**Output Done 挂 Increment**，答"质量何时算合格"，每个增量交付前逐条过，不过即不算 Done。

#### Definition of Outcome Done

- [ ] OD1 **越用越懂**：agent 连起用户未明说的线索且被确认有用（connection 被采纳）——复利信号，须长期观察

*按 SGEP 在实现开始前定义、直接证据优先于间接证据；本条属长期观察项，非单次 Review 可判。其余候选（不引用过期事实、敢放行）待成熟版本后由 PO 再议补入。*

#### Definition of Output Done

- [ ] D1 **跑给你看**：每个增量都带一个能一键重跑的验证（脚本或步骤清单），当场重跑、全绿才算完
- [ ] D2 **不破坏官方 auto-memory 契约**：一记一文件 + MEMORY.md 纯指针索引，增量改动后契约完好
- [ ] D3 **过审才算完**：增量完成后必须经独立 review——调用 review agent 或 PO 亲审，通过才算 Done

*这是对每个增量、每条 PBI 通用的质量底线，Sprint 内不得削弱、只能加强。设计冲刺的 C1–C7 类条款（证据栏形态、抽查点、回滚行为、删除票……）是特定功能的验收标准，refinement 时归位到对应 PBI 的 Acceptance Criteria，不占用全增量的 DoD。*

## 第二部分 · Product Backlog

| 编号 | 标题 | 产品意图 | 架构定位 | 当前状态 | size | 备注（依据） |
|---|---|---|---|---|---|---|
| PBI-01 | 机械压缩底片层 | 梦有原料可吃；用户裁决能送达下一梦 | S4 | 已拍板未动工 | L | 明写「动工排 backlog 首位」；含 G9 回程 bug 修复（TargetMap 备注、DesignReview §7） |
| PBI-02 | 引擎主干产品化 | 原型验证过的体检与处置能真装进 Claude Code 用 | S6–S7 | 原型已跑通，待产品化 | L | M1–M5 / S1–S3 判据、L0–L3 处置、三道安全阀从脚本变插件形态（Sketches、verdict §2） |
| PBI-03 | Agent SDK canUseTool 结构缴械 | 梦在结构上碰不到它不该碰的东西 | 横切 S5–S7 | Sprint-1 选定，已精化 | M | `.claude` 是受保护路径、headless 下 hook 不加载——从「推荐」升为「必选」；PBI-02 的前提（DesignReview §7、原型实测） |
| PBI-04 | 插件骨架与回环 | 插件形态立起来：无人值守转完一圈「触发→快照→占位整合→报告→提交→提示」，后续引擎内容有处可装 | S5 + P0 + S8 + S9（S6/S7 占位） | Sprint-1 选定，已精化 | L | 吸收 PBI-03（拉起梦必经 Agent SDK，canUseTool 围栏随壳就地装）；OC：环真转一圈，dream commit 可 revert |

*本表是达成 Product Goal 的唯一工作来源：行序即优先序，由 Product Owner 排定；编号是不随排序变的稳定 ID。粗条目经 Refinement 拆小后写入对应 Sprint 的 SprintBacklog 第二节（层级编号如 PBI-04.1，AC/OC 须 PO 通过、sizing 归 Product Developers），本表对应行状态改「已精化」。size 是未经 refinement 的 T 恤码初估，Sprint Planning 时由 Product Developers 重估。依赖提示：PBI-03 是 PBI-02 的结构前提，现行序按价值排，取舍在首次 Sprint Planning 定。入场条件：verdict §3 的 C1–C3（回滚与证据形态改造）须在首个可用版本前完成，对应条目待 PO 补入。*

## 第三部分 · 架构

### 角色

| 角色 | 解释 |
|---|---|
| 长期用户 | 产品的顾客：要 agent 像昨天刚一起工作过，且随时能推翻产品的改动 |
| 会话 agent | 记忆的生产者与消费者：会话中产生信号，开新会话时取用记忆 |

### 架构图

```mermaid
flowchart TD
    User([长期用户]) --> S1
    Agent([会话 agent]) --> S1
    S1["S1 开会话：两句话热身<br/>✅ 官方现成"] --> S2["S2 干活，产生信号：决定/偏好/教训/项目变化<br/>✅ 官方现成"]
    S2 --> S3["S3 会话中实时记零散记忆<br/>官方 auto-memory 契约：一记一文件 + MEMORY.md 索引<br/>✅ 官方现成，沿用不改"]
    S2 --> S4["S4 会话流落盘：机械压缩底片层<br/>Karpathy raw/ 形制：只追加、零 API、不做判断<br/>🟡 已拍板未动工——PBI-01"]
    S3 --> S5
    S4 --> S5{"S5 Dream 触发<br/>SessionEnd hook 零 API 写标记 + 冷却期<br/>分离进程判条件后跑 Agent SDK，CLAUDE_INVOKED_BY 防递归<br/>🟡 待建——原型仅手动触发近似"}
    Dream([Dream 整合进程]) --> S5
    S5 --> P0["梦前快照：git 快照提交<br/>pathspec 仅 .claude/memory/ + CLAUDE.md + .claude/dream/"]
    P0 --> S6["S6 体检：对照项目现状，两层判据<br/>机械层 M1–M5 零 LLM 成本先跑：断链/孤儿/悬空溯源/实体失效+git 讣告/索引漂移<br/>LLM 层 S1–S3 只吃机械层筛出的候选：记忆互矛盾/记忆 vs CLAUDE.md/连接候选<br/>✅ 原型已验证，待产品化——PBI-02"]
    S6 --> S7["S7 整合：memory 文件系统 + CLAUDE.md 一起改<br/>四级处置：L0 随手修 / L1 自主改+建 connection / L2 阀门管辖 CLAUDE.md / L3 隔离观察<br/>铁律：LLM 无删除开票权；三道安全阀：熔断器 · 配置层缴械 · 隔离优先<br/>✅ 原型已验证，待产品化——PBI-02"]
    S7 --> S8["S8 写梦报告 .claude/dream/&lt;时间或主题&gt;.md<br/>六节：图 delta 对账 / 30 秒版 / 明细四要素+单条回滚 / 隔离观察区 / 抽查点 / 阀门状态<br/>✅ 原型已验证，证据形态待改造"]
    S8 --> S9["S9 git 单提交 dream: 前缀 = 回滚原子<br/>下次开会话一行提示<br/>✅ 原型已验证"]
    S9 --> S10["S10 新会话开场：找对容器 → 取索引<br/>⬜ 靶外，转 Target-2"]
    S10 --> S11["S11 引用前现场校验：记忆说 X 存在 ≠ X 现在存在<br/>⬜ 靶外，转 Target-2"]
    S11 --> END([像昨天刚一起工作过<br/>越用越懂你])
    END -.->|下一轮会话，记忆产生复利| S1
```

| 批注 |
|---|
| Dream 整合进程即产品自身——无人值守跑 S5–S9，人不参与梦，报告即汇报 |
| 官方 auto-memory 契约是硬约束：一记一文件 + MEMORY.md 纯指针索引，不得破坏 |
| 取用在架构上不被保证——记忆是 context，不是 enforced configuration，S11 只是最后一道拦截 |
| 记忆容器按工作目录路径字符串键控，项目改名/搬盘会静默孤立记忆（本项目 2026-07-29 实际发生过） |

*出处：数据流与角色取自 [.IDEO/design-sprint/DesignMap.md](.IDEO/design-sprint/DesignMap.md)；S5–S8 内部结构（触发、快照、判据、处置、阀门、报告六节）取自 [Sketches.md](.IDEO/design-sprint/Target-1-Consolidation/Prototype-01-FirstDream/Sketches.md) 定稿方案，完整论证与阀门配置回该文件查；实现状态标注综合 [TargetMap.md](.IDEO/design-sprint/Target-1-Consolidation/TargetMap.md)、[DesignReview.md](.IDEO/design-sprint/DesignReview.md) §5、§7 与 [verdict.md](.IDEO/design-sprint/Target-1-Consolidation/Prototype-01-FirstDream/verdict.md)。*
