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

### 2.0 重构主线（抄入 + 修正）

> **起因**：`da60783` 引入 `reference/claude-dream/`——AI 把 claude-memory-compiler 忠实改写成 Claude Code 插件形态（commands + subagents + hooks），比当前单 SKILL.md 更完整。**PO 拍板**：删 SKILL.md、全换 commands+subagents；记忆模型不变（扁平 `memory/` + `MEMORY.md`，不要 knowledge/）；方法 = 抄入参考骨架，有用的抄、无用的删。
>
> **存储/打包决定**：daily/ 和 memory/ 都放**配置目录**（`~/.claude/projects/<slug>/`，保持原生加载）；对话读取先抄参考版；保持**可分发插件**（`.claude-plugin/plugin.json`）。
>
> 详细拆解见 plan：`pbi-swirling-willow.md`。执行顺序：Import-1 置顶（最高优先级）→ Fix-1~6 依次掰回我们的决定 → Open-1/2 抄入后拍板。

| 编号        | 标题                         | 产品意图                                                              | 架构定位      | size | 当前状态 | 备注                                                                                                                                                                                                                                                                                                    |
| ----------- | ---------------------------- | --------------------------------------------------------------------- | ------------- | ---- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PB-Import-1 | 全量抄入参考插件骨架         | 用 commands+subagents+hooks 架构替换单 SKILL.md，一次拿到完整插件形态 | 插件结构      | L    | 就绪     | 抄 commands（flush/compile/query/lint）+ agents（compiler/linter/query-engine）+ hooks 三件套 + scripts（config/utils）+ AGENTS.md；hooks 接进 plugin.json；**删除 SKILL.md**；顺手修 3 个悬空 bug（pyproject 悬空 script、config.py 双重赋值、utils 扫描目录）。先跑通，此时仍是 knowledge/ 模型 |
| PB-Fix-1    | 记忆模型 + 存储对齐          | knowledge/ 分层 → 扁平 memory/；仓库根 → 配置目录                   | 编译输出 · C | L    | 延后     | knowledge/concepts/connections/qa/ →`memory/*.md` + `MEMORY.md`；路径从 ROOT_DIR 改配置目录 slug 解析；**删 session-start.py**（memory/ 原生加载，不需注入）；改 AGENTS.md schema + compiler subagent + utils.py                                                                             |
| PB-Fix-2    | Gate 注入 compiler           | 只记值得记的，滤噪音                                                  | 编译 · C     | S    | 延后     | 参考 compiler**无 Gate**——注入我们的 6 条硬约束排除 + `NOTHING_WORTH_RECORDING` sentinel                                                                                                                                                                                                      |
| PB-Fix-3    | 四分类 + 生命周期            | 记忆自我更新而非只追加                                                | 编译 · C     | M    | 延后     | 参考只有 create/update——注入 🆕⚡🗑️🔁 + 保守删除。我们对 compiler 的改进                                                                                                                                                                                                                            |
| PB-Fix-4    | 防腐涂料                     | 感知旧记忆被修正、与项目同步                                          | 横切 · C     | M    | 延后     | 双源追踪（session+git hash）/ superseded 标注 / git 漂移感知。我们的原创，参考没有                                                                                                                                                                                                                      |
| PB-Fix-5    | connections 作为 memory type | 跨概念关联，但不建目录                                                | 编译输出 · C | M    | 延后     | 原 PB-Comp-5 转此。connections 作`type: connection` + Key Points/Details 作记忆文件可选结构——不建 connections/ 目录                                                                                                                                                                                 |
| PB-Fix-6    | query 层对齐                 | query 不写 knowledge/qa/                                              | 查询 · C     | S    | 延后     | query-engine 默认`--file-back` 写 qa/——改成不写盘 或 写成我们 memory/ 形态                                                                                                                                                                                                                          |
| PB-Open-1   | claude-code-log 去留评估     | 决定对话读取用哪套                                                    | 读取 · B     | M    | 延后     | 锚点先抄参考的 JSONL 解析；Sprint 2 的 claude-code-log 降噪（PB-Base-5.1）是否恢复，抄入后评估                                                                                                                                                                                                          |
| PB-Open-2   | 增量机制统一                 | 游标 vs state.json 选一套                                             | 读取/编译     | S    | 延后     | 我们用 frontmatter 游标，参考用 state.json SHA-256。倾向跟随参考的 state.json（daily/ 增量天然按文件 hash）                                                                                                                                                                                             |

### 2.1 待做

> 以下为与本次重构**正交**的旧 PB——触发层、规模、测试等，重构不吸收，继续有效。

| 编号       | 标题                   | 产品意图                                                             | 架构定位     | size | 当前状态 | 备注                                                                                                     |
| ---------- | ---------------------- | -------------------------------------------------------------------- | ------------ | ---- | -------- | -------------------------------------------------------------------------------------------------------- |
| PB-Comp-1  | 判定深化测试           | 淘汰 / 冲突 / 漂移路径可信                                           | 无           | M    | 延后     | 原型未测路径（🗑️ / ⚡ / SQ3 / SQ4）；可并入 PB-Eval-1                                                  |
| PB-Auto-1  | 语义召唤触发（完整版） | 自然语言召唤（"开始做梦"），含防误触发设计                           | 触发 · A    | M    | 延后     | ⚠️ 需补 IDEO；薄版分化见 PB-Auto-1.1                                                                   |
| PB-Auto-2  | 定时 loop 触发         | 用户不必记得手动跑                                                   | 触发 · A    | M    | 延后     | ⚠️ 需补 IDEO                                                                                           |
| PB-Scale-1 | 规模与生态             | 大规模分片 / 多项目 / 质量度量                                       | 无           | XL   | 延后     | DesignReview 展望                                                                                        |
| PB-Eval-1  | 系统性 eval 环境       | 建立测试集验证编译质量（Gate/四分类/防腐涂料），给改进提供可量化基线 | 测试基础设施 | L    | 延后     | ⚠️ 需补 IDEO：ground truth 标准待定；PB-Comp-1 测试用例可迁移进来；重构后更需要——验证抄入+修正没退化 |

### 2.2 已完成

| 编号           | 标题                             | 产品意图                                     | 架构定位         | size | 当前状态 | 备注                                                                                                                                                                             |
| -------------- | -------------------------------- | -------------------------------------------- | ---------------- | ---- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🟢 PB-Base-1   | 插件骨架与入口                   | 有一个可安装、可唤起的产品                   | 角色·插件       | S    | 已完成   | Sprint 1 已交付；含 marketplace 分发                                                                                                                                             |
| 🟢 PB-Base-2   | 手动触发                         | 用户可控地启动记忆整理                       | 触发 · A        | S    | 已完成   | Sprint 1 已交付                                                                                                                                                                  |
| 🟢 PB-Base-3   | 项目状态感知                     | 让记忆感知项目变化                           | 读取② · B      | M    | 已完成   | Sprint 2 已交付。Review 修正：从 Bash cat 改为 Claude Code 原生加载 + 提示词确认——不重复造轮子                                                                                 |
| 🟢 PB-Base-4   | 记忆基线读取                     | 有可靠的比对基线                             | 读取③ · B      | S    | 已完成   | Sprint 2 已交付。Read 工具静默加载 + 游标提取（frontmatter`modified`/`originSessionId`）。⚠️ 游标精度可改进：当前依赖记忆文件 frontmatter，后续 C 落盘时可写专门的游标文件 |
| 🟢 PB-Base-5.1 | 对话读取工具接入                 | 对话读取有稳定的代码级降噪底座               | 读取④ 底座 · B | S    | 已完成   | Sprint 2 已交付。claude-code-log v1.5.0 全局安装、直接 CLI 调用、`--detail low` 降噪 98.2%。⚠️ `--from-date` ISO 格式有 dateparser 时区偏差（偏移-1天兜底）                |
| 🟢 PB-Base-5   | 对话内容解析                     | 拿到降噪后的多会话对话素材                   | 读取④ · B      | M    | 已完成   | Sprint 2 已交付。Review 修正：从 stdout 喷改为落盘`.claude-dream-context.md` + Read 静默加载。增量（游标后）/全量（冷启动）两种模式跨项目验证通过                              |
| 🟢 PB-Base-6   | 汇总交接 C · 当前背景上下文     | C 拿到自包含上下文即可开工                   | 读取⑤ · B      | S    | 已完成   | Sprint 2 已交付                                                                                                                                                                  |
| 🟢 PB-Base-5.2 | 插件可迁移性——依赖自包含       | 插件装到任意项目即可用，无需手动 pip install | 角色·插件       | S    | 已完成   | Sprint 3 已交付；auto`pip install`，异地真机验证通过                                                                                                                           |
| 🟢 PB-Base-5.3 | 用户手动安装验收——异地真机     | seapawn 异地亲手安装+跑通+满意               | 角色·插件       | S    | 已完成   | Sprint 3 已交付；PO：「过，我很满意」                                                                                                                                            |
| 🟢 PB-Auto-1.1 | 语义召唤触发 · 薄版（仅能识别） | 自然语言直接跳入入口，不含防误触发           | 触发 · A        | S    | 已完成   | 从 PB-Auto-1 分化（PO 拍板）；Sprint 1 已交付                                                                                                                                    |
| 🟢 PB-Base-7   | Gate 硬约束排除                  | 只记值得记的，滤掉噪音                       | 编译① · C      | S    | 已完成   | Sprint 4 已交付；6 条排除 + sentinel`NOTHING_WORTH_RECORDING`                                                                                                                  |
| 🟢 PB-Base-8   | Extract + Cross-Reference        | 概念与全部记忆互证、识别漂移                 | 编译②③ · C    | M    | 已完成   | Sprint 4 已交付；whole-KB-in-context + 3-7 基数上限 + git 漂移候选                                                                                                               |
| 🟢 PB-Base-9   | 四分类 + 生命周期                | 记忆能自我更新而非只追加                     | 编译·分类 · C  | M    | 已完成   | Sprint 4 已交付；🆕⚡🗑️🔁 + 保守删除。ClaudeDream 对 compiler 的改进                                                                                                           |
| 🟢 PB-Base-10  | 原创机制 · 防腐涂料             | 感知旧记忆被修正、与项目同步                 | 无（横切）       | M    | 已完成   | Sprint 4 已交付；双源追踪/superseded/git 漂移——横切进 8/9/11                                                                                                                   |
| 🟢 PB-Base-11  | 写 / 更新 / 删记忆文件           | 编译结果落盘                                 | 输出① · C      | S    | 已完成   | Sprint 4 已交付；首次动手写磁盘，两环境验证通过                                                                                                                                  |
| 🟢 PB-Base-12  | MEMORY.md 索引维护               | 记忆能被 Claude Code 高效加载                | 输出②           | S    | 已完成   | Sprint 4 已交付；ClaudeDream 8=8，DiaryAgent 5=5                                                                                                                                 |
| 🟢 PB-Base-13  | 变更摘要报告                     | 用户能审阅改了什么、为什么                   | 输出③           | S    | 已完成   | Sprint 4 已交付；含每条理由，补 compiler log.md 缺的 why 字段                                                                                                                    |

*说明：*

- *产品意图＝这条对用户/产品的价值。架构定位＝回指 [Architecture](Architecture.md) 的 map 节点 / Target（无清晰节点则写"无"）。*
- *size＝S / M / L / XL 粗估（Developer 在细化时定稿）。优先级＝行序（自上而下由高到低），不单列。*
- *当前状态（生命周期）：未开始 / 已细化 / 就绪 / 进行中 / 已完成 / 延后。*
