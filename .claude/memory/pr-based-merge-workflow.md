---
name: pr-based-merge-workflow
description: 工作流现状——重构收口后 main == origin/main == 重构基线（5b2fffd），PO 指挥下直接在 main 提交；旧「main 只经 PR」Sprint-4 工作流已弃用
metadata:
  type: feedback
---

**现状（2026-08-30 收口后）**：main == origin/main == 重构基线（**5b2fffd**，tag `restructure-2026-08-30`，见 [[sprint-04-mainline-intent]]）；重构期工作分支 repo-restructure 已删除。当前工作流：PO 指挥下**直接在 main 提交**；收口类推送（main + tag）由 PO 指令授权执行。旧工作流（Sprint-4 起：main 保持 == origin/main、sprint 期间主文件夹挂集成分支、并行线 worktree 挂侧分支、收口 PR 进 main）已随重构定局弃用——未来是否重建分支/PR 流程由 PO 另定。

**Why:** 重构定局（PO 2026-08-30）推翻 Sprint-4 时代工作前提；收口后无并行线，分支层无存在必要。
**How to apply:** 不建分支不开 PR，按 PO 指令提交；推送分两类——收口类（PO 点名）即推，日常类等 PO 指令。留一条常青 git 事实备用：**同一分支同一时间只能被一个工作树 checkout**——并行工作线的分支名必须互不相同。
