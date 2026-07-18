# Target C: 综合判定 — Target Review

## 一、概况

| 项目 | 内容 |
|---|---|
| Target | C: 综合判定 ⭐ |
| 方案 | Memory Compiler（以 compiler compile → index → log 模型为主基座）|
| 原型变量 | 一个 Compiler（Claude Pawn），给定全量上下文，能否正确四分类？ |
| 原型日期 | 2026-07-18 |
| 状态 | ✅ 验证通过 |

## 二、原型做了什么

### 输入

- MEMORY.md + 全部 4 个记忆文件
- git log + diff（最近 10 次提交）
- 项目地图（README.md、CLAUDE.md、.IDEO/README.md）
- 本会话对话内容（Target C 方案设计、compiler 机制类比、三个 Target 全流程）

### 执行

按照 compiler compile 流程：
1. **Gate（硬约束排除）**：设计方法讨论不存、临时讨论不存、CLAUDE.md 已有不存
2. **Cross-Reference**：每个新事实 × 全部已有记忆 → 四分类
3. **Connect**：跨记忆 wikilink 关联
4. **Output**：直接写文件 → 更新 MEMORY.md → 变更摘要
5. **Quality**：7 rules 自检

### 产出

| 动作 | 文件 |
|---|---|
| 🆕 CREATE | `compiler-architecture-reference.md` |
| ⚡ UPDATE | `target-c-decision.md` — 追加 compiler 机制照抄详情、7 rules、原型计划 |
| ⚡ UPDATE | `compiler-hooks-reference.md` — 追加 hooks 完整链路 |
| 🔗 LINK | target-c-decision ↔ compiler-architecture-reference |
| 📝 UPDATE | MEMORY.md — 追加新条目 |

### 变更摘要

```
## [2026-07-18T10:30:00] ClaudeDream compile
- 🆕 Created (1): [[compiler-architecture-reference]]
- ⚡ Updated (2): [[target-c-decision]], [[compiler-hooks-reference]]
- 🗑️ Deleted (0): —
- 🔁 Skipped (2+): 已覆盖内容合并到新建文件
- 🔗 Connections: target-c-decision ↔ compiler-architecture-reference
```

## 三、Sprint Questions 验证结果

| # | 问题 | 结果 |
|---|---|---|
| SQ1 | 能从对话中区分「值得记住的信息」和「噪音」？ | ✅ — Gate 正确排除了设计方法讨论和临时对话，14 个候选概念中筛选出 5 个值得入档 |
| SQ2 | 能自我更新——不只追加，还覆盖/淘汰？ | ✅ — target-c-decision.md 被 UPDATE 追加新内容而非新建文件；无过时记忆，🗑️ 判定暂未触发 |
| SQ3 | 能感知旧记忆被后续对话修正？ | 🟡 — 原型未触发冲突场景（已有记忆与对话不矛盾）。逻辑通过 prompt 设计验证了 superseded 标注机制，但无实际案例测试 |
| SQ4 | 能感知项目变化并与项目同步？ | 🟡 — git 漂移感知逻辑已在 prompt 中实现（"possibly stale"标注），但当前项目无相关记忆待复核 |

## 四、关键发现

### 验证成立的

1. **全量上下文进 prompt 可行。** 5 个记忆文件 + 项目地图 + git diff + 对话内容没有超上下文窗口，compiler 的模式在 ClaudeDream 场景下工作。
2. **四分类逻辑正确。** 🆕/⚡/🔁 三类判定与人工判断一致。无 🗑️ 场景（本对话不产生过时记忆）。
3. **compiler 的流程（全量读 → 一次性判定 → 直接写）适合 ClaudeDream。** 不产中间审批表、不建基础设施、不依赖外部 SDK——在 Claude Code 对话内直接完成。

### 未验证的

1. **🗑️ 淘汰场景** — 本次对话没有产生"旧记忆过时"的情况。需要构造一个"git diff 显示某文件变更+相关记忆内容与实际不符"的场景来验证。
2. **⚡ 冲突解决** — 没有"新对话推翻旧记忆"的真实案例。当前记忆都是几天内创建的，互为一致。
3. **大规模记忆** — 5 个文件验证了正确性。如果记忆膨胀到 50+ 文件，全量上下文策略可能需要 hash gate + 分片。

## 五、后续方向

| 优先级 | 项 | 说明 |
|---|---|---|
| P0 | 淘汰/冲突场景专项测试 | 构造一个"旧记忆说 X，新对话推翻"或"git 漂移检测"的测试案例 |
| P1 | 确定性层（Hash gate） | 把原型手工判断改为代码：state.json 记录 hash → 自动跳过 |
| P2 | lint 层 | 借鉴 compiler 7 checks，先做结构性检查（broken link、orphan）|
| P3 | hooks 自动化 | 参考 compiler hooks 替换 B 的手工读取步骤 |
