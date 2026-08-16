# scrum

## 这里是什么

ClaudeDream 当前的工作区。设计冲刺已于 2026-08-02 结束并归档在 `scrum/.IDEO/design-sprint/`；本目录承载之后的产物开发——用 Scrum 组织：Product Backlog（含架构）、以及每个 Sprint 的 SprintBacklog。

## 从设计冲刺到 Scrum 的交接

设计冲刺回答的是"造什么、为什么这么造"，Scrum 回答的是"现在开始造，怎么排、怎么验"。交接的实物是：

- **入场条件**——[.IDEO/design-sprint/Target-1-Consolidation/Prototype-01-FirstDream/verdict.md](.IDEO/design-sprint/Target-1-Consolidation/Prototype-01-FirstDream/verdict.md) §3 的 C1–C7 七条改造，记录见 [ProductBacklog.md](ProductBacklog.md) 第二部分小字
- **设计结论**——去 [.IDEO/design-sprint/DesignReview.md](.IDEO/design-sprint/DesignReview.md) 读，不在本目录重复
- **方案内部结构**——去 [ProductBacklog.md](ProductBacklog.md) 第三部分看图，细节回 [.IDEO/design-sprint/Target-1-Consolidation/Prototype-01-FirstDream/Sketches.md](.IDEO/design-sprint/Target-1-Consolidation/Prototype-01-FirstDream/Sketches.md) 查

## 文件地图

| 文件/目录 | 内容 |
|---|---|
| `README.md` | 本文件——Scrum 段导航 |
| `ProductBacklog.md` | Product 总述与 Vision（兼任 Goal）、两份 DoD、Product Backlog、架构（角色表+全流程图+批注） |
| `sprint-01-skeleton/` | Sprint-1（骨架回环）完整档案——入口 [README.md](sprint-01-skeleton/README.md)：SprintBacklog（含 Review/Retro 记录）+ 验收考卷考场 + AC0 spike |
| `sprint-02-negatives/` | Sprint-2（底片层）完整档案——[SprintBacklog.md](sprint-02-negatives/SprintBacklog.md)（含 Review/Retro 记录）+ 验收考卷考场（`acceptance/`） |
| `sprint-03-engine/` | Sprint-3（引擎主干·纯机械梦，已收口 2026-08-16）完整档案——[SprintBacklog.md](sprint-03-engine/SprintBacklog.md)（含七站亲验验收 Review/Retro）+ 验收考场（`acceptance/`，含 e2e 修复任务书与双盲对照） |
| `sprint-04-llm/` | Sprint-4（引擎 LLM 层，Planning 定案 2026-08-16）——[SprintBacklog.md](sprint-04-llm/SprintBacklog.md)（PBI-07 八拆条 AC 初稿）；施工走独立工作树 `.claude/worktrees/sprint-04-llm`（分支同名），主工作区仍在 main |
| `.IDEO/design-sprint/` | 已结束的设计冲刺全部档案（原仓库根 `.IDEO/`，2026-08-07 归档于此）——总入口 [DesignReview.md](.IDEO/design-sprint/DesignReview.md) |

## 当前状态

**2026-08-14：Sprint-2（底片层）已收口**（三轮验收 16 过/5 不过/6 待办，PO 裁定不追绿先收口；两大发现——自建规则表覆盖缺口→PBI-06、考卷接口脱靶→验收流程约定）。**2026-08-15：refinement 完成**（DoD 归位 D1–D5 + 新立「验收流程约定」小节）。**同日 Sprint-3 Planning 定案**：PBI-02（纯机械梦切口）为主菜，LLM 层拆出新条目 PBI-07 接棒，PBI-05/06 本轮不做。

**2026-08-16：Sprint-3 验收通过并收口**（端到端七站亲验三处硬伤→双盲对照出卷线 agent 版胜出→修复全绿；Retro 流程三条入 ProductBacklog「验收流程约定」第 3–5 条）。**同日 Sprint-4 Planning 定案**：PBI-07（引擎 LLM 层）一刀全上，八拆条与 AC 初稿见 [sprint-04-llm/SprintBacklog.md](sprint-04-llm/SprintBacklog.md)；新立 PBI-08（命令面，PBI-07 后主菜候选）。详见 [ProductBacklog.md](ProductBacklog.md)。
