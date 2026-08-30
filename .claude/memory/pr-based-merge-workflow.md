---
name: pr-based-merge-workflow
description: 工作流现状——重构期 repo-restructure 直接提交；旧「main 只经 PR」Sprint-4 集成分支工作流随 2026-08-30 重构定局弃用
metadata:
  type: feedback
---

**现状（2026-08-30）**：全仓库重构进行中，一切提交由 PO 指挥、直接落在 `repo-restructure` 分支；推送、远端、tag 一律等 PO 指令（[[sprint-04-mainline-intent]]）。旧工作流（Sprint-4 起：main 保持 == origin/main、sprint 期间主文件夹挂集成分支、并行线开 worktree 挂侧分支、收口 PR 进 main）已随重构定局弃用——重构完成后是否重建 PR 流程由 PO 另定。

**Why:** 重构定局（PO 2026-08-30：「之前的我全都不想要了，甚至远端仓库我都要删掉的」）推翻了 Sprint-4 时代的工作前提。
**How to apply:** 重构期间不建分支、不开 PR，按 PO 指令直接提交。留一条常青 git 事实备用：**同一分支同一时间只能被一个工作树 checkout**——并行工作线的分支名必须互不相同。
