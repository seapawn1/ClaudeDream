# ClaudeDream

一个 Claude Code 插件，升级 Claude Code 的记忆系统，使 agent 免于腐烂，与用户和项目保持同步。

## 从哪里开始

新会话先读 [README.md](README.md)（项目地图与当前状态）。要理解**方案是什么、为什么这么设计**，读 [scrum/.IDEO/design-sprint/DesignReview.md](scrum/.IDEO/design-sprint/DesignReview.md)——设计冲刺的总结算与全部档案入口；要看 Scrum 段产品目标与 backlog，读 [scrum/ProductBacklog.md](scrum/ProductBacklog.md)。

**当前阶段**：设计冲刺已完成（2026-08-02，Target-1 带条件通过），归档至 `scrum/.IDEO/design-sprint/`；Scrum 段已启动，骨架已建，产物代码未开工。产物开发的入场条件见 [verdict.md](scrum/.IDEO/design-sprint/Target-1-Consolidation/Prototype-01-FirstDream/verdict.md) §3，已转入 [scrum/ProductBacklog.md](scrum/ProductBacklog.md)。

## 历史与分支

项目 2026-07-29 重启：Design Sprint（旧 `.IDEO/DesignSprint/`）、Scrum Sprint 1-6（旧 `ScrumSprint/` + `claude-dream/` 插件产物代码）已作废，完整历史保留在 `sprint-01`~`sprint-05-eval-test-set--06`、`DesignSprint--跑通全流程` 等分支——`git branch -a` 查看，不在当前工作树。

## 目录约定

- `scrum/` 是当前工作区，以 Scrum 产物（Architecture / ProductBacklog / Sprint 记录）为主；`scrum/.IDEO/design-sprint/` 归档已结束的设计冲刺，以设计文档为主，例外是原型施工物（可运行脚本、假数据 builder、真跑产物），随所属 `Prototype-0X-*/` 子文件夹落户。
- `testbed/acme-api/` 是 builder 的生成物，**不入库**——`build-acme.py` 是唯一真相，可确定性重造。
- `reference/` 只放原料，不放结论；与 `scrum/.IDEO/design-sprint/` 蒸馏冲突时以原料为准。