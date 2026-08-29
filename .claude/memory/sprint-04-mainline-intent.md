---
name: sprint-04-mainline-intent
description: 2026-08-30 定局重写：旧"Sprint-4 施工态替代 main"意图作废——PO 定局为「重构仓库」，新基线 repo-restructure @ a19dd627，三个工作分支（sprint-03-engine / sprint-04-dev / sprint-04-llm）打 tag 归档，工作树已删
metadata: 
  node_type: memory
  type: project
  originSessionId: 583a2388-114e-4b3d-b8d8-87bd07f5c54f
  modified: 2026-08-30T06:30:00.000Z
---

2026-08-30（本日，PO 指令「重构本仓库」）定局：**旧「sprint-04-dev 替代 main 当新主线」意图作废**，改为仓库重构。

**执行后实况**：
- 主文件夹 checkout：`repo-restructure`（@ `a19dd627`，Sprint-3 收口文档提交 = Sprint-4 公共起点；**不含 Sprint-4 任何施工/收尾结果**）。
- 三个非 main 工作分支已打 tag 并删除（PO 拍板「三个全删」）：`sprint-03-engine`（bee1ad8，其"端到端修复 1/2/3"末笔**未并入 main**，该笔在 tag 里）、`sprint-04-dev`（01c789b 完整施工态）、`sprint-04-llm`（E2E 卷面三件套 + 记忆落账 59402e1）。
- 工作树 `.claude/worktrees/sprint-04-dev`（上面是 main @ 820ad99）已删除；远端 `origin/sprint-03-engine` 未动。
- 记忆集全套（11 条索引）已从 59402e1 迁至新基线并落账（b0d1e66）。

**Why**：PO 从「Sprint-4 施工态成新主线」终极改判为「重构仓库」——Sprint-4 LLM 层结果不入新基线，靠 tag（+ origin，sprint-03-engine 侧）双保险，零丢失。

**How to apply**：后续若 PO 提及「把 Sprint-4 结果并回/恢复主线」，先对齐目标（基线仍是从 a19dd627 起步吗 / 从哪个 tag 恢复分支）；动 main 指针与推送仍等 PO 指令（[[pr-based-merge-workflow]]、[[worktree-git-ops-report-first]]）。CLAUDE.md「当前阶段」与新 README 仍描述旧布局——重构期文档以 PO 指令为准，没有指令别自行重写。
