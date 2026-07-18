# Scrum Sprint — ClaudeDream

## 说明

本目录托管 ClaudeDream 开发的 Scrum Sprint 工作内容。

## 文件地图

| 文件 | 内容 |
|---|---|
| [ProductBacklog.md](ProductBacklog.md) | **Product Goal + Product Backlog + 细化** —— 核心工件 |
| [DefinitionOfDone.md](DefinitionOfDone.md) | **DoD** —— Increment 的全局质量底线（PO 已认可） |
| [Architecture.md](Architecture.md) | 架构地图 —— 摘抄自 DesignMapping，供 Backlog「架构定位」对照 |
| [sprint-01-walking-skeleton/](sprint-01-walking-skeleton/SprintBacklog.md) | **Sprint 1** —— Walking Skeleton：[Backlog](sprint-01-walking-skeleton/SprintBacklog.md) · [Review](sprint-01-walking-skeleton/SprintReview.md)；产出落此文件夹 |
| [sprint-02-read-pipeline/](sprint-02-read-pipeline/SprintBacklog.md) | **Sprint 2** —— 完整读取管线：[Backlog](sprint-02-read-pipeline/SprintBacklog.md) · [Review](sprint-02-read-pipeline/SprintReview.md)；产出落此文件夹 |

## 当前状态

| 事项 | 状态 |
|---|---|
| Product Goal | ✅ 已定（手动优先的 Claude Code 记忆插件） |
| Product Backlog | ✅ 已拆解（20 条，PB-Base/Comp/Auto/Scale 四组） |
| DoD | ✅ PO 已认可（6 类底线，Sprint 2 增补换环境验证 + 独立验证） |
| Sprint 1 | ✅ Increment 已交付 — [Walking Skeleton](sprint-01-walking-skeleton/SprintReview.md)：8 工作项全通过，3 PBI 达 DoD；产物 `claude-dream/` |
| Sprint 2 | ✅ Increment 已交付 — [完整读取管线](sprint-02-read-pipeline/SprintReview.md)：10 工作项全通过，5 PBI 达 DoD；产物 `claude-dream/` v0.2.0 + `.claude-dream-context.md` |

## 背景参考

完整的设计方案、原型验证和设计决策详见 [Design Sprint](../.IDEO/DesignSprint/DesignReview.md)。

| 设计资产 | 位置 | 与本 Sprint 的关系 |
|---|---|---|
| DesignMapping（方案总图） | [.IDEO/DesignSprint/DesignMapping.md](../.IDEO/DesignSprint/DesignMapping.md) | 三 Target 方案、Map、HMW 的完整记录 |
| DesignReview（全流程回顾） | [.IDEO/DesignSprint/DesignReview.md](../.IDEO/DesignSprint/DesignReview.md) | 验证结论、关键收获、展望 |
| Target C 原型执行记录 | [.IDEO/DesignSprint/target-c-comprehensive-judgment/prototype/execution-log.md](../.IDEO/DesignSprint/target-c-comprehensive-judgment/prototype/execution-log.md) | Memory Compiler 四分类验证详情 |
