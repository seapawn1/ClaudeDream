---
name: acceptance-e2e-only
description: PO 裁定验收只做端到端七站——AC 判分线收口作废；七站亲验后三处现象派 developers 修复
metadata:
  type: feedback
---

PO 于 2026-08-15 上午裁定：Sprint-3（及以后）验收**只走端到端主线七站**；AC 判分线（verify.mjs / H 判据 / 对答案卡打回）**收口停用**，判分器与考场保留在档（`sprint-03-acceptance` 分支止于 67e4b53）但不再驱动验收结论。PO 认为机器级判定已由施工线 AI 环（D1 自证 + D3 审阅）负责。

**当晚端到端七站亲验（PO 在场手操，2026-08-15）**：站 3 留证、站 5 G9 回程、站 6 回滚兜底 ✔；站 1/2/4 机制为真但有硬伤。PO 亲眼裁后**决定修复三处、派 developers**（推翻上午「判分发现不打回、不需要修」的旧口径——任务书 `scrum/sprint-03-engine/acceptance/e2e-fix-brief.md`）：

1. **M2 误杀**（判据口径错）：「无链=孤儿」把健康记忆隔离——45 条主库一场隔离 30 条（约 26 条健康），且 M2 抢先隔离吞掉 M4 确凿删除票。要求：健康零误报、真孤儿仍检出、判据叠加时确凿票优先。
2. **熔断回滚失败**（实现 bug）：fuse 回滚用仓库根绝对路径 pathspec，Windows git 拒绝 + 未入库 CLAUDE.md 混入——熔断中止对、还原失败，现场留 4 删+2 隔离。要求：相对路径 pathspec、剔除未入库文件、熔断后工作树回梦前。
3. **CLI 无冷却/last-dream**（PO 裁定的设计变更）：CLI 直跑不落 last-dream.json、无冷却（熔断后立刻重跑畅通）、G9 无基线退化为全收。要求：CLI 也落 last-dream、受冷却约束（cooldown_minutes=0 覆盖通道保留）、G9 恢复窗口语义；enabled 闸门语义不变。

**Why:** 上午 PO 认为 AC 判分与施工线自证重复、判分发现多余；当晚端到端亲验后 PO 亲眼看到三处硬伤的现场后果（七成健康记忆被隔离、熔断后手动救场、事故后门开着），裁定这些"很有必要修复"。判分线仍收口不重启——修复验证走双线盲改 + 独立实测。

**2026-08-16 收口结局**：三处修复双盲对照（developers 版 bee1ad8 vs 出卷线 agent 版 e2e-fix-wip），我方 agent 版全面胜出（M2 隔离 3 条全真腐烂、确凿票 2/2、M4 ls-files 判存、熔断回滚干净、CLI 冷却+fused、G9 窗口），PO 裁定采用，合回 `sprint-03-acceptance`（fe88969）；developers 版作废存档 `sprint-03-engine`。PO 定调验收通过（SprintBacklog 第四节 + Retro 4.7）。流程沉淀三条进 ProductBacklog「4. 验收流程约定」第 3–5 条：验收结论只看端到端七站+第三方考场、自证全绿不构成验收（第三方考场是必经关口）、重要修复双线盲改对照。sprint-03-engine 有 README 地图。

**How to apply:** 验收线只做七站手操 + 第三方考场实测；重要修复默认双线盲改对照、PO 裁胜出版；不要重启 AC 判分器、不要拿判分线 H 判据要求 developers。跨线协作走 PO 的手。Sprint-3 已收口：待合并 main/推送（2026-08-16 执行中）。
