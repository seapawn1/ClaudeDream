# ClaudeDream — Product Backlog

> 本文件是 ClaudeDream 开发的 **Product Backlog**（Scrum 工件）。拆解依据：`.IDEO/DesignSprint/DesignMapping.md` 的架构地图（触发 → 读取 → 编译 → 输出 → 注入）、三个 Target 的细粒度设计、编译器三层架构（compile / lint / query）。
>
> 关联工件：[Definition of Done](DefinitionOfDone.md) · [Architecture](Architecture.md) · 设计来源 [DesignReview](../.IDEO/DesignSprint/DesignReview.md)
>
> 排序为 Scrum Master 建议草案，优先级最终由 PO（seapawn）拍板。

---

## 一 · Product Goal

> **ClaudeDream 交付一个 Claude Code 记忆插件：通过手动、定时 loop、语义召唤等多路触发，把开发者的对话可信地编译进项目记忆，让记忆随项目持续生长而无需用户深度参与。**

- **产品形态**：一个可安装的 Claude Code 插件。客户 = Claude Code 用户。
- **清晰边界**：不做对话前端、不碰 CLI 核心、不做 query 检索层（Claude Code 原生加载 `MEMORY.md` 已覆盖）。
- **三种触发形态**：手动（`/claude-dream`）/ 定时 loop / 语义召唤（自然语言"开始做梦""开始更新"）。

---

## 二 · Product Backlog

### 2.1 待做

| 编号 | 标题 | 产品意图 | 架构定位 | size | 当前状态 | 备注 |
|---|---|---|---|---|---|---|
| PB-Base-5.2 | 插件可迁移性——依赖自包含 | 插件装到任意项目即可用，无需手动 pip install 等环境准备 | 角色·插件 | S | 已细化 | 从 PB-Base-5.1 分化。当前隐式依赖全局 pip 安装的 `claude-code-log`，换机器/用户即不可用。<br><br>**AC**：① `claude-code-log` 依赖显式声明——pip 自动安装或 vendored 自带，插件加载后不需用户手动 pip install；② 在新环境（无 claude-code-log）上验证：`claude --plugin-dir ...` 加载后 `/claude-dream` 格 3.3 不因缺依赖而失败；③ 解决方案不能依赖"开发者本机已装"——必须是插件自身可复现的。<br><br>**方案选项**（细化时定）：A) `plugin.json` 声明依赖 + Claude Code 插件机制自动安装（如果支持）；B) SKILL.md 格 3.3 前 `pip install claude-code-log` 自动装；C) vendored——把 claude-code-log 打入插件目录（Sprint 2 R3 已评估代价：依赖链复杂、会腐烂） |
| PB-Base-7 | Gate 硬约束排除 | 只记值得记的，滤掉噪音 | 编译① · C | S | 未开始 | ✅ 原型验证。**输入**：B 产出的 `.claude-dream-context.md`（对话降噪）+ agent 上下文（项目感知+记忆基线） |
| PB-Base-8 | Extract + Cross-Reference | 概念与全部记忆互证、识别漂移 | 编译②③ · C | M | 未开始 | ✅ 原型验证 |
| PB-Base-9 | 四分类 + 生命周期 | 记忆能自我更新而非只追加 | 编译·分类 · C | M | 未开始 | ✅ 原型验证（🗑️⚡ 待测） |
| PB-Base-10 | 原创机制 | 感知旧记忆被修正、与项目同步 | 无 | M | 未开始 | git 漂移 / 双源追踪 / superseded；✅ 逻辑覆盖待测 |
| PB-Base-11 | 写 / 更新 / 删记忆文件 | 编译结果落盘 | 输出① · C | S | 未开始 | **输入**：C 的判定结论；**输出**：记忆文件 + 更新游标（`modified` 时间戳 + `originSessionId`） |
| PB-Base-12 | MEMORY.md 索引维护 | 记忆能被 Claude Code 高效加载 | 输出② | S | 未开始 | — |
| PB-Base-13 | 变更摘要报告 | 用户能审阅改了什么、为什么 | 输出③ | S | 未开始 | — |
| PB-Comp-1 | 判定深化测试 | 淘汰 / 冲突 / 漂移路径可信 | 无 | M | 延后 | 原型未测路径（🗑️ / ⚡ / SQ3 / SQ4） |
| PB-Comp-2 | 确定性层 · Hash Gate | 跳过无变化、省算力 | 做梦流程前置门 | M | 延后 | 整条做梦流程前判定 hash：变化则进行、不变则跳过（省算力）。Sprint 2 明确不做、全部通过 |
| PB-Comp-3 | 质量层 · Lint | 结构健康、防腐烂 | 无 | L | 延后 | compiler lint 层 |
| PB-Auto-1 | 语义召唤触发（完整版） | 自然语言召唤（"开始做梦"），含防误触发设计 | 触发 · A | M | 延后 | ⚠️ 需补 IDEO；薄版分化见 PB-Auto-1.1 |
| PB-Auto-2 | 定时 loop 触发 | 用户不必记得手动跑 | 触发 · A | M | 延后 | ⚠️ 需补 IDEO |
| PB-Auto-3 | hooks 自动化 | 后台自动捕获，替换 B 手动读取 | 无 | XL | 延后 | ⚠️ 需补 IDEO；compiler-hooks |
| PB-Scale-1 | 规模与生态 | 大规模分片 / 多项目 / 质量度量 | 无 | XL | 延后 | DesignReview 展望 |

### 2.2 已完成

| 编号 | 标题 | 产品意图 | 架构定位 | size | 当前状态 | 备注 |
|---|---|---|---|---|---|---|
| 🟢 PB-Base-1 | 插件骨架与入口 | 有一个可安装、可唤起的产品 | 角色·插件 | S | 已完成 | Sprint 1 已交付；含 marketplace 分发 |
| 🟢 PB-Base-2 | 手动触发 | 用户可控地启动记忆整理 | 触发 · A | S | 已完成 | Sprint 1 已交付 |
| 🟢 PB-Base-3 | 项目状态感知 | 让记忆感知项目变化 | 读取② · B | M | 已完成 | Sprint 2 已交付。Review 修正：从 Bash cat 改为 Claude Code 原生加载 + 提示词确认——不重复造轮子 |
| 🟢 PB-Base-4 | 记忆基线读取 | 有可靠的比对基线 | 读取③ · B | S | 已完成 | Sprint 2 已交付。Read 工具静默加载 + 游标提取（frontmatter `modified`/`originSessionId`）。⚠️ 游标精度可改进：当前依赖记忆文件 frontmatter，后续 C 落盘时可写专门的游标文件 |
| 🟢 PB-Base-5.1 | 对话读取工具接入 | 对话读取有稳定的代码级降噪底座 | 读取④ 底座 · B | S | 已完成 | Sprint 2 已交付。claude-code-log v1.5.0 全局安装、直接 CLI 调用、`--detail low` 降噪 98.2%。⚠️ `--from-date` ISO 格式有 dateparser 时区偏差（偏移-1天兜底） |
| 🟢 PB-Base-5 | 对话内容解析 | 拿到降噪后的多会话对话素材 | 读取④ · B | M | 已完成 | Sprint 2 已交付。Review 修正：从 stdout 喷改为落盘 `.claude-dream-context.md` + Read 静默加载。增量（游标后）/全量（冷启动）两种模式跨项目验证通过 |
| 🟢 PB-Base-6 | 汇总交接 C · 当前背景上下文 | C 拿到自包含上下文即可开工 | 读取⑤ · B | S | 已完成 | Sprint 2 已交付。格 4 摘要框 + 落盘文件。B/C 交接契约确立：C 输入 = agent 上下文（项目+记忆+对话）+ `.claude-dream-context.md` |
| 🟢 PB-Auto-1.1 | 语义召唤触发 · 薄版（仅能识别） | 自然语言直接跳入入口，不含防误触发 | 触发 · A | S | 已完成 | 从 PB-Auto-1 分化（PO 拍板）；Sprint 1 已交付 |

*说明：*
- *编号前缀标阶段：`PB-Base`（MVP 薄切片，跑通即"手动形态"可用）/ `PB-Comp`（判定硬化 & 编译器完备化）/ `PB-Auto`（自动化触发）/ `PB-Scale`（规模生态）。同前缀内顺序编号；未来某条分化用 `PB-Base-1.1`——保父级、可无限细分、不冲击其它号。*
- *产品意图＝这条对用户/产品的价值。架构定位＝回指 [Architecture](Architecture.md) 的 map 节点 / Target（无清晰节点则写"无"）。*
- *size＝S / M / L / XL 粗估（Developer 在细化时定稿）。优先级＝行序（自上而下由高到低），不单列。*
- *当前状态（生命周期）：未开始 / 已细化 / 就绪 / 进行中 / 已完成 / 延后。*

### Sprint 2 反哺的设计约束

以下原则在 Sprint 2 Review 中由 PO 确认，对后续 C 开发有约束力：

1. **工具分工**：Bash 只做游标提取（grep frontmatter）+ 外部工具调用（claude-code-log）；Read 工具做文件静默加载；Claude Code 原生能力（README/CLAUDE.md 自动加载、git 感知）不重复造轮子
2. **B/C 交接**：B 产出 = agent 上下文（项目感知 + 记忆基线 + 对话内容）+ `.claude-dream-context.md`（持久化降噪文件）。C 以这两者为唯一输入，不回溯原始数据源
3. **只读不判**：B 不做概念提取，C 不做原始数据读取——边界清晰
4. **输出不喷对话**：大量数据（对话降噪、记忆全文）落盘后用 Read 加载，格 4 只展示摘要；C 同理

