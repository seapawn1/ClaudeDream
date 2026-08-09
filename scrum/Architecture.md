# Architecture

## 角色

| 角色 | 解释 |
|---|---|
| 长期用户 | 产品的顾客：要 agent 像昨天刚一起工作过，且随时能推翻产品的改动 |
| 会话 agent | 记忆的生产者与消费者：会话中产生信号，开新会话时取用记忆 |

## 架构图

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
