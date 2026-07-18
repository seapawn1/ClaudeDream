# ClaudeDream — Design Sprint Review

## 一、Design Sprint 概况

| 项目 | 内容 |
|---|---|
| 启动日期 | 2026-07-18 |
| 耗时 | 单日完成全部五个模式（Define → Ideate → Prototype → Test → Review）|
| 团队 | seapawn（Decider）+ Claude Pawn（Facilitator） |
| 方法论 | IDEO Design Thinking + Google Design Sprint |
| 核心成果 | 三 Target 设计方案 + Memory Compiler 原型验证 |

### 旅程回顾

从 Define 阶段的一张白板（Long-term Goal + 4 Sprint Questions + Map + 9 HMW），到三个 Target 各自的设计方案，再到 C 的 Memory Compiler 原型执行与验证——一次走完 Design Sprint 的完整闭环。过程中经历了方案类比（Analogous Empathy）、方案发散（Brainstorming）、约束聚焦（Impose Constraints）、故事板草图（Storyboard）、原型执行（Prototype）、用户测试（Test with Users / Feedback Capture Matrix）、Review 总结。

---

## 二、问题与方案

### Long-term Goal

记忆永不腐烂——每个 agent 都拥有一套活的、随项目持续生长的记忆。

### 最终方案

**Memory Compiler。** 以 claude-memory-compiler 的 compile → index → log 模型为主基座，融合 auto-dream 的信任边界（不编辑 CLAUDE.md）、auto-memory 的硬约束排除清单（不存 repo 已有），以及 ClaudeDream 原创的 git 漂移感知。方案分三层：

1. **读取层（Target B）** — 四路输入：确认项目 → 项目状态感知（git + 项目地图）→ 记忆基线 → 对话内容
2. **编译层（Target C）** — Memory Compiler：Gate → Extract → Cross-Reference → Classify → Output
3. **触发层（Target A）** — 手动触发，自动 Loop 延后

---

## 三、三 Target 回顾

| Target | 模式 | 状态 | 关键交付物 |
|---|---|---|---|
| **A: Loop 触发** | Ideate | ✅ 草图完成 | 3 格故事板草图。决策：手动触发，自动 loop 延后至正式落地 |
| **B: 输入读取** | Ideate | ✅ 草图完成 | 顺序管线方案 + 技术探路（transcript 格式确认、git 可用性、记忆路径确认）。Map B/C 边界厘清——B 只管取数据，不参与判定 |
| **C: 综合判定** ⭐ | Ideate → Prototype → Test → Review | ✅ 原型通过 | Memory Compiler 方案。原型四分类正确（🆕CREATE 1 / ⚡UPDATE 2 / 🔁SKIP 2+）。Quality 7 rules 全通过 |

### A: Loop 触发

**决策**：退化为纯手动触发。用户说 "run claudedream" 即可启动。自动定时（CronCreate、锁文件、Hook）全部延后到正式落地——先跑通核心流程，再考虑自动化。

**不做的**：auto-dream 的 minHours/minSessions 门控、compiler 的 hooks 链路、桌面计划任务。

### B: 输入读取

**决策**：顺序 Shell 管线。触发后依次执行：确认项目 → 项目背景 → git 历史 → 现有记忆 → 对话历史 → 汇总交给 C。

**技术探路确认的**：
- 对话历史路径：`~/.claude/projects/D--ClaudeDream/<uuid>.jsonl`，JSONL 格式
- git log 在项目目录直接可用
- 记忆目录路径：`~/.claude/projects/D--ClaudeDream/memory/`

**Map 边界厘清**：R0 层（读取层）与 R3（判定层）的职责分离——B 只负责"读取并输出原始数据"，C 负责"基于输入做判定"。判定动词（提取候选、标记需复核、作为比对基线）全部下移到 C。三个参考项目全都不读 git / 项目文件——项目状态感知是 ClaudeDream 原创需求。

### C: 综合判定 ⭐

**方案**：以 compiler compile → index → log 模型为主基座，对标 AGENTS.md 的完整编译流程。

**原型执行**：Claude Pawn 作为 compiler，读入全部上下文（5 记忆文件 + MEMORY.md + git log + 项目地图 + 对话内容），一次性完成 Gate → Cross-Reference → Connect → Output。不产中间审批表，直接写文件。

**原型结果**：

| 动作 | 文件 |
|---|---|
| 🆕 CREATE | `compiler-architecture-reference.md` |
| ⚡ UPDATE | `target-c-decision.md` |
| ⚡ UPDATE | `compiler-hooks-reference.md` |
| 🔗 LINK | target-c-decision ↔ compiler-architecture-reference |
| 📝 UPDATE | MEMORY.md |

**设计来源确认**：
- compiler：全量上下文、hash gate、sources 追踪、更新优于新建、log.md
- auto-dream：不编辑 CLAUDE.md、不确定时保留（删错 > 留错）
- auto-memory：硬约束排除清单、4 类型体系、[[wikilink]] 双链
- ClaudeDream 原创：git 漂移感知、双源追踪（session + git hash）、superseded 标注

---

## 四、Sprint Questions 完成度

| # | 问题 | 状态 | 说明 |
|---|---|---|---|
| SQ1 | 能从对话中区分「值得记住的信息」和「噪音」？ | ✅ 已验证 | Gate 正确排除了设计方法讨论和临时对话，Quality 7 rules 约束了不存 repo 已有 |
| SQ2 | 能自我更新——不只追加，还覆盖/淘汰？ | ✅ 已验证 | target-c-decision.md 被 UPDATE 追加新内容而非新建文件。🗑️ 路径逻辑覆盖 |
| SQ3 | 能感知旧记忆被后续对话修正？ | ✅ 直觉通过 | superseded 标注机制在 prompt 中实现，seapawn 凭设计评审确认方向正确 |
| SQ4 | 能感知项目变化并与项目同步？ | ✅ 直觉通过 | git 漂移感知（"possibly stale"）在 prompt 中实现，seapawn 凭设计评审确认机制足够 |

四条 Sprint Question 全部有结论——两条实际验证通过，两条逻辑覆盖 + 直觉通过。

---

## 五、关键收获

### 方案层面

1. **compiler 的 compile → index → log 模型是正确答案。** 三个参考项目中，compiler 与 ClaudeDream 的问题域最接近——都是"把对话编译成持久知识"。auto-dream 太依赖服务端 gate，auto-memory 是实时的不是批处理的。

2. **全量上下文策略可行。** 5 个记忆文件 + 项目地图 + git diff + 对话内容没有超上下文窗口。compiler 验证的"全量比预筛选更准"在 ClaudeDream 场景下同样成立。后续如果记忆膨胀到 50+ 文件，需要 hash gate 先判断"变了没"。

3. **确定性层和语义层分离是核心设计原则。** 代码做 gate 和 lint（廉价、可预测），prompt 做 Compile（昂贵、智能）。两层各司其职。

4. **信任边界在 prompt 级别已经生效。** Agent 在 Compile 过程中自动遵守了"不编辑 CLAUDE.md"和"不存 repo 已有内容"两条硬约束——不需要额外代码检查。这验证了 auto-dream 和 auto-memory 的做法：约束写在 prompt 里就够了。

### 过程层面

5. **Design Sprint 流程有效。** 单日从 Define 到 Test 走完完整闭环。Analogous Empathy（三个参考项目对比）为 Ideate 提供了精确的决策基础——如果没有类比，我们可能从零设计。

6. **B 和 A 的确定性工作留到 C 验证后再做。** 这个决策在回顾时确认正确——如果 C 判定逻辑不成立，A 和 B 做得再好也没有价值。原型执行也反向验证了 B 的可行性（四路数据全部成功获取）。

### 意外发现

7. **三个参考项目全都不读 git / 项目文件。** 项目状态感知是 ClaudeDream 的原创需求——没有现成模式可抄，但原型中的 git diff → "possibly stale" 标注方案成立。

8. **compiler 的 hooks 架构可以作为 ClaudeDream 未来自动化的蓝图。** SessionEnd/PreCompact → flush.py → daily/ → compile.py 这条链路，可以直接映射到 ClaudeDream 的 B → C 流程。

---

## 六、展望

本次 Design Sprint 验证了 Memory Compiler 方案的核心可行性。后续发展从三个维度展开：

**编译器完备化。** 当前的 Compile 语义层（prompt）已验证通过，下一步是补全 compiler 的三个缺少层：确定性 Gate（hash state.json 跳过无变化）、输出层严格执行质量规则、lint 层做结构性健康检查（断链、孤儿页、稀疏文章）。这三个层完成后，Memory Compiler 就与 compiler 功能对等。

**自动化闭环。** 当前 A（手动触发）和 B（手动读取）可以用自动化补齐：B 的读取通过 SessionEnd/PreCompact hooks 后台捕获对话、提取要点、追加到日志（参考 compiler flush.py 架构），A 的定时触发通过 CronCreate 或计划任务驱动。自动化后，用户只需要正常使用 Claude Code，记忆系统自动维护。

**规模与生态。** 支持多项目记忆隔离与关联，引入记忆质量度量（lint 趋势、活跃度、冲突率），以及记忆规模突破后的分片或 RAG 兜底策略。

核心原则始终不变：**确定性层和语义层分离**——代码做 gate 和 lint，prompt 做判断。这是 compiler 教给我们最重要的设计原则。

---

## 七、关闭语

2026-07-18，从早上的一张空白 Map 开始，到晚上一份经过验证的 Memory Compiler 方案结束。ClaudeDream 不再是一个想法——它有设计方案、有运行的原型、有验证过的判定逻辑、有明确的发展路线。

记忆永不腐烂。路还很长，但方向已经清楚。
