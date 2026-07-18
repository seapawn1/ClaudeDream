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
- **三种触发形态**：手动（`/claudedream`）/ 定时 loop / 语义召唤（自然语言"开始做梦""开始更新"）。

---

## 二 · Product Backlog

| 编号 | 标题 | 产品意图 | 架构定位 | size | 当前状态 | 备注 |
|---|---|---|---|---|---|---|
| PB-Base-1 | 插件骨架与入口 | 有一个可安装、可唤起的产品 | 角色·插件 | S | 进行中 | Sprint 1 纳入 |
| PB-Base-2 | 手动触发 | 用户可控地启动记忆整理 | 触发 · A | S | 进行中 | Sprint 1 纳入 |
| PB-Base-3 | 项目状态感知 | 让记忆感知项目变化 | 读取② · B | M | 未开始 | 原创需求：三参考项目都不读 git/项目文件 |
| PB-Base-4 | 记忆基线读取 | 有可靠的比对基线 | 读取③ · B | S | 未开始 | — |
| PB-Base-5 | 对话内容解析 | 拿到原始对话素材 | 读取④ · B | M | 未开始 | transcript JSONL |
| PB-Base-6 | 四路汇总交接 C | 判定拿到干净的结构化输入 | 读取⑤ · B | S | 未开始 | — |
| PB-Base-7 | Gate 硬约束排除 | 只记值得记的，滤掉噪音 | 编译① · C | S | 未开始 | ✅ 原型验证 |
| PB-Base-8 | Extract + Cross-Reference | 概念与全部记忆互证、识别漂移 | 编译②③ · C | M | 未开始 | ✅ 原型验证 |
| PB-Base-9 | 四分类 + 生命周期 | 记忆能自我更新而非只追加 | 编译·分类 · C | M | 未开始 | ✅ 原型验证（🗑️⚡ 待测） |
| PB-Base-10 | 原创机制 | 感知旧记忆被修正、与项目同步 | 无 | M | 未开始 | git 漂移 / 双源追踪 / superseded；✅ 逻辑覆盖待测 |
| PB-Base-11 | 写 / 更新 / 删记忆文件 | 编译结果落盘 | 输出① · C | S | 未开始 | — |
| PB-Base-12 | MEMORY.md 索引维护 | 记忆能被 Claude Code 高效加载 | 输出② | S | 未开始 | — |
| PB-Base-13 | 变更摘要报告 | 用户能审阅改了什么、为什么 | 输出③ | S | 未开始 | — |
| PB-Comp-1 | 判定深化测试 | 淘汰 / 冲突 / 漂移路径可信 | 无 | M | 延后 | 原型未测路径（🗑️ / ⚡ / SQ3 / SQ4） |
| PB-Comp-2 | 确定性层 · Hash Gate | 跳过无变化、省算力 | 无 | M | 延后 | compiler compile-gate |
| PB-Comp-3 | 质量层 · Lint | 结构健康、防腐烂 | 无 | L | 延后 | compiler lint 层 |
| PB-Auto-1 | 语义召唤触发（完整版） | 自然语言召唤（"开始做梦"），含防误触发设计 | 触发 · A | M | 延后 | ⚠️ 需补 IDEO；薄版分化见 PB-Auto-1.1 |
| PB-Auto-1.1 | 语义召唤触发 · 薄版（仅能识别） | 自然语言直接跳入入口，不含防误触发 | 触发 · A | S | 进行中 | 从 PB-Auto-1 分化（PO 拍板）；Sprint 1 纳入 |
| PB-Auto-2 | 定时 loop 触发 | 用户不必记得手动跑 | 触发 · A | M | 延后 | ⚠️ 需补 IDEO |
| PB-Auto-3 | hooks 自动化 | 后台自动捕获，替换 B 手动读取 | 无 | XL | 延后 | ⚠️ 需补 IDEO；compiler-hooks |
| PB-Scale-1 | 规模与生态 | 大规模分片 / 多项目 / 质量度量 | 无 | XL | 延后 | DesignReview 展望 |

*说明：*
- *编号前缀标阶段：`PB-Base`（MVP 薄切片，跑通即"手动形态"可用）/ `PB-Comp`（判定硬化 & 编译器完备化）/ `PB-Auto`（自动化触发）/ `PB-Scale`（规模生态）。同前缀内顺序编号；未来某条分化用 `PB-Base-1.1`——保父级、可无限细分、不冲击其它号。*
- *产品意图＝这条对用户/产品的价值。架构定位＝回指 [Architecture](Architecture.md) 的 map 节点 / Target（无清晰节点则写"无"）。*
- *size＝S / M / L / XL 粗估（Developer 在细化时定稿）。优先级＝行序（自上而下由高到低），不单列。*
- *当前状态（生命周期）：未开始 / 已细化 / 就绪 / 进行中 / 已完成 / 延后。*

---

## 三 · Backlog 细化（Refinement）

| 编号 | 用户故事（作为…我想…以便…） | Acceptance Criteria（本条专属，需全满足） | 依赖 | size | 当前状态 | 备注 / 佐证 |
|---|---|---|---|---|---|---|
| PB-Base-1 | 作为 Claude Code 用户，我想要 ClaudeDream 作为可安装插件存在并能被 `/claudedream` 唤起，以便在自己环境里启用记忆系统。 | ① 插件目录结构 + manifest 就位，Claude Code 能识别加载；② `/claudedream` 命中入口并返回可见响应（下游可为空）；③ 能解析出项目目录、记忆目录、transcript 目录三条路径 | 无 | S | 进行中 | 参考 Claude Code plugin 规范；Sprint 1 纳入 |
| PB-Base-2 | 作为 Claude Code 用户，我想说 `/claudedream` 手动启动记忆整理，以便在合适时机更新记忆。 | ① 三格流程走通：发起 → 确认 → 交接下游（读取→判定→写入→报告）；② 触发后先确认目标项目再继续；③ 未识别到有效上下文时明确提示，而非静默失败 | PB-Base-1 | S | 进行中 | Target A 三格故事板；Sprint 1 纳入 |
| PB-Auto-1.1 | 作为 Claude Code 用户，我想直接说「开始做梦 / 更新记忆」而不必敲斜杠，以便更自然地唤起记忆整理。 | ① `SKILL.md` 的 `description` 写入窄触发短语；② 去掉 `disable-model-invocation`，使 Claude 能自动识别并跳入入口；③ 真机验证：一句「开始做梦」能跳入与 `/claudedream` 相同的入口流程。不含防误触发设计 | PB-Base-1 | S | 进行中 | 从 PB-Auto-1 分化（薄版）；Sprint 1 纳入 |
| … | *（其余条目待就近细化）* | | | | | |

*说明：*
- *细化＝把条目从"粗颗粒"打磨到"就绪可入 Sprint"。两阶段：`refined`（加了 Acceptance Criteria）→ `ready`（估算完、无阻塞依赖），均由「当前状态」列体现（已细化 / 就绪）。*
- *只对"即将入 Sprint"的条目细化，不必一次做全部；其余在 Backlog Refinement 事件里就近补。*
- *Acceptance Criteria＝这一条专属、可测的完成条件，回答"这条做对没"；与 [Definition of Done](DefinitionOfDone.md) 分工（DoD 回答"任何交付都不能破的线"）。*
