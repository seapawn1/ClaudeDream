# sprint-03-engine · Sprint-3 引擎主干工区

Sprint-3（纯机械梦引擎）的 Scrum 工区：SprintBacklog 四节日志 + 验收考卷区。

**当前状态**：Sprint-3 验收通过（PO 2026-08-16 定调）；端到端三处硬伤由出卷线 agent 版修复（双盲对照胜出），代码在 `sprint-03-acceptance` 分支（fe88969）；developers 版作废存档于 `sprint-03-engine`（bee1ad8）。

## 文件地图

- `SprintBacklog.md` — Sprint 日志四节：① Goal 与 DoD ② Backlog 与 AC（PBI-02.1–02.6）③ 施工计划与结局（developers 填）④ 验收 Review（七站亲验 / 双盲对照 / PO 定调 / Retro 产出）
- `../ProductBacklog.md` — 产品日志：PBI 总表（行序即优先序）+「4. 验收流程约定」（跨 Sprint 流程纪律的家）
- `acceptance/` — 验收考卷区（出卷方资产；卷面对开发方约定保密）：
  - `TestPlan.md` — 判据表 H 与七站定义（判分线已收口，仅存档参考）
  - `verify.mjs` — 判分器（存档，不再驱动验收结论）
  - `adapter.json` — developers 交付接口自述（验收接线依据）
  - `testbed/build-testbed.mjs` — 第三方种植考场 builder（Node 重写）；`testbed/answer-key.md` 对答案卡；`testbed/out/` 考场生成物（gitignored）
  - `e2e-fix-brief.md` — 端到端三处硬伤修复任务书（PO 亲验后派发，已修复收口）

## 当前状态

- **验收**：端到端主线七站（种腐烂→真体检→真处置→真留证→熔断器→G9 回程→回滚兜底）PO 在场亲验，三处硬伤修复后独立实测全绿，PO 定调通过。
- **三处硬伤与修复**：① M2「无链即孤儿」误杀健康记忆 ② 熔断回滚 Windows 绝对路径 pathspec 失败 ③ CLI 直跑无冷却/last-dream（PO 裁定的设计变更）——双盲对照后采用出卷线 agent 版（M2 判据收窄 + M4 路径实体改 `git ls-files` + 命令形候选只留证不隔离 + 回滚相对路径 + CLI 冷却闸门）。
- **流程沉淀**：验收结论只看端到端主线、第三方考场是自证后的必经关口、重要修复双线盲改对照——已写入 ProductBacklog「4. 验收流程约定」第 3–5 条。
- **待办**：合并 main、推送远端（执行中）；通知施工线 developers 版作废（PO 转达）。
