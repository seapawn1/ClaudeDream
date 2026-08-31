---
name: dream-llm-spec
description: 梦 LLM 层活规格与验收方法论（PBI-07 直接输入）——S1/S2/S3 三判据、无证不理、删除票机械开票、C1–C7 信任改造、testbed 对答案卡模式；蒸馏全文已迁 docs/ideo-design/
metadata:
  type: project
---

设计冲刺档案蒸馏迁入 docs/（2026-08-31 PO 裁定：历史记录归 `docs/`，可复用知识留 memory）后回填的活规格。上游全文：`docs/ideo-design/design-map-review-distilled.md`（全局图）与 `docs/ideo-design/target1-plan-and-testing.md`（方案全骨架）。

**LLM 层三判据（PBI-07 规格，只吃机械筛出的候选）**：S1 记忆互矛盾（git 时间序 + 现状核验裁决，不许投票）｜S2 vs CLAUDE.md｜S3 连接候选（机械共现先筛，LLM 只判「非显然」）。铁律：**每判必引双方原文（无证不理）**；**删除票只能由机械确凿证据开出，LLM 只能否决、标注、降级**（全方案最硬的一条）。

**C1–C7 信任改造（兑现前提，未全落）**：C1 回滚按文件出不按笔出 + dream-undo（撤销键工程质量必须高于删除键）｜C2 证据栏贴执行日志（命令+exit code+时间戳）非转述｜C3 抽查点必须能失败（以梦前状态 `git show <pre-sha>:<file>` 起手）｜C4 机器推论贴身份证（origin/confidence/时间戳）｜C5 首行摘要说全动作类型｜C6 报告禁内部术语｜C7 报告不进 dream commit（revert 不得销毁审计轨迹）。

**testbed 验收资产模式（可复用）**：确定性 builder 重跑一致生成假项目，记忆分格（健康显式列出=误删即败 + 预期删/合并/隔离各若干 + 种植断链/漏登/过期缺陷）+ rot-manifest 对答案卡 = 判分基准。Sprint 验收考场沿用此模式（[[acceptance-e2e-only]]）。

**测试方法论五条（可复用）**：模拟用户测缺陷远胜真人｜真人偏倚显式记账（「赞」低于「追问」）｜布景数据从真产物机器提取不可手写｜安全阀只能故障注入证明（建议进 CI）｜抽查点「存在即安心」故必须经得起真查。相关：[[review-report-before-fix]]
