---
name: worktree-git-ops-report-first
description: 工作树分支操作先上报再动手——ff/merge/reset/删除等 PO 指令（2026-08-16 PO 纠正）
metadata: 
  node_type: memory
  type: feedback
  originSessionId: e6e782e9-7f0f-424e-add7-e20668c3fb55
  modified: 2026-08-16T13:50:11.971Z
---

PO 纠正（2026-08-16）：对施工/出卷工作树执行 git 变更（ff、merge、reset、删除等）之前，必须先上报障碍+建议、等 PO 指令再动——即使操作低风险、可逆、结果正确。dev 分支是 developers 的工作区，会话正在里面开着时变更其文件更要先问。

**Why:** 执行权不来自「结果好」，来自决定权在谁；低风险可逆 ≠ 有权做。与 [[pr-based-merge-workflow]] 的「推送永远等 PO 指令」同族——分支级操作同等待遇。

**How to apply:** ①发现工作树分支落后/漂移/需清理，先一句话报障碍（落后几个提交、影响什么）附建议，等 PO 指令；②主文件夹集成分支上 scrum 档案/记忆的提交不在此列（PO 已授权，照旧）；③同类先报再动已有 [[review-report-before-fix]]。
