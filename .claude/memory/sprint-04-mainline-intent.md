---
name: sprint-04-mainline-intent
description: 2026-08-30 定局：PO 宣布全仓库重构，旧产物（Sprint-4 施工三分支、tag、远端仓库）全部弃用；重构执行进展落账；含「tag 未带目标 ref 打在 HEAD」的教训
metadata: 
  node_type: memory
  type: project
  originSessionId: 583a2388-114e-4b3d-b8d8-87bd07f5c54f
  modified: 2026-08-30T07:00:00.000Z
---

2026-08-30 最终定局（PO 指令：「算了，不用了，我要重构整个 claudedream 了……之前的我全都不想要了，甚至远端仓库我都要删掉的，未来等我重构完毕」）：**全仓库重构启动，旧物弃用**；停止一切恢复/备份动作，等 PO 重构指令，不做任何远端操作。

**重构执行进展（2026-08-30，Developer 按指令逐步执行）**：设计冲刺档案 `scrum/.IDEO/` 已删（450040f）；Sprint-1~3 档案与 `scrum/README.md` 已删、scrum/ 收敛为仅 ProductBacklog.md（7ef52cc）；两轮蒸馏（IDEO Index 2 份 + Scrum Index 3 份）先行落账 memory；根 README 与 `.claude/CLAUDE.md` 已按新世界重写、`product-rationale-distilled` 抢救立论事实；`.worktreeinclude` 建立（a27ec2f）。**仍未清**：22 个 tag（含三条打偏的）、远端 origin 与 `origin/sprint-03-engine`——弃用定局不变，动它们等 PO 指令。

**事实校正（重要）**：先前落账「打 tag 双保险零丢失」有误——三条 tag（sprint-03-engine / sprint-04-dev / sprint-04-llm）是在分支删除前用 `git tag <name>` **不带目标 ref** 打的，全部落在当时 HEAD（b0d1e66）上，未指向分支末梢 bee1ad8 / 01c789b / 59402e1。真实末梢现状：仅 reflog（默认 90 天）可达 + `origin/sprint-03-engine`（=bee1ad8，远端未动）。PO 已弃用旧物，不回修；若日后改口，恢复路径：先从 reflog 取分支末梢，再 `git tag --force <name> <sha>` 修正指向。

**How to apply（教训）**：删分支前打 tag 必须 `git tag <name> <branch-tip>`，并用 `git for-each-ref --format='%(refname:short) -> %(objectname:short)' refs/tags/<name>` 核验指向后再删分支——本次只看了 tag 名、没看指向。另：重要报告前先验证支撑证据，别把"有 tag"当"备份到"。

**后续**：远端（删 origin 等）与 tag 清理一律等 PO 重构指令（[[worktree-git-ops-report-first]]）；工作流现状见 [[pr-based-merge-workflow]]。
