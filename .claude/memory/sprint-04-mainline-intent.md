---
name: sprint-04-mainline-intent
description: 2026-08-30 全仓库重构：定局 → 执行 → 收口（merge 5b2fffd/tag/推送）全落账；「tag 未带目标 ref 打在 HEAD」教训与残余旧物清单
metadata: 
  node_type: memory
  type: project
  originSessionId: 583a2388-114e-4b3d-b8d8-87bd07f5c54f
  modified: 2026-08-30T07:00:00.000Z
---

2026-08-30 定局（PO 指令：「算了，不用了，我要重构整个 claudedream 了……之前的我全都不想要了，甚至远端仓库我都要删掉的，未来等我重构完毕」）：**全仓库重构启动，旧物弃用**。重构于同日执行并收口（PO 指令四连：merge → 删分支 → 打 tag → 推送）。

**收口事实（2026-08-30）**：`repo-restructure` 全部工作以 `--no-ff` 合回 main（**5b2fffd**「merge: 全仓库重构收口」），工作分支 repo-restructure 已删（本地仅剩 main）；annotated tag **`restructure-2026-08-30`** 指向 5b2fffd（推送前 `for-each-ref %(*objectname)` 核验指向——tag 教训兑现）；main 与 tag 均已推送，**main == origin/main == 重构基线**。重构内容：scrum/ 收敛为仅 ProductBacklog.md、.IDEO 与 Sprint-1~3 档案删除、知识蒸馏入 memory（IDEO/Scrum Index）、根 README 与 .claude/CLAUDE.md 按 README/CLAUDE.md/memory 三层分工重写、立论事实抢救入 [[product-rationale-distilled]]。

**仍未清（等 PO 指令）**：①22 个旧 tag 本地仍在（含三条打偏的 sprint-03-engine/sprint-04-dev/sprint-04-llm → 全指 b0d1e66，见下）；②远端 `origin/sprint-03-engine` 分支仍在；③Sprint-4 施工档案末梢（59402e1/bee1ad8/01c789b）仅 reflog 可达，默认约 90 天后 GC 蒸发（PO 已弃用，不回修；改口恢复路径：reflog 取末梢 → `git tag --force <name> <sha>`）。

**事实校正（重要）**：先前落账「打 tag 双保险零丢失」有误——三条 tag（sprint-03-engine / sprint-04-dev / sprint-04-llm）是在分支删除前用 `git tag <name>` **不带目标 ref** 打的，全部落在当时 HEAD（b0d1e66）上，未指向分支末梢。

**How to apply（教训）**：删分支前打 tag 必须 `git tag <name> <branch-tip>`，并用 `git for-each-ref --format='%(refname:short) -> %(*objectname)'` 核验指向后再删分支/推送——本次收口已按此执行；另：重要报告前先验证支撑证据，别把"有 tag"当"备份到"。PowerShell 里 rev-parse 的 `^{commit}` 语法会被参数解析嚼碎，核验用 `%(*objectname)` 或 `git log -1 <tag>`。
