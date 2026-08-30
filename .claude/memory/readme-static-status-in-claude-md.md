---
name: readme-static-status-in-claude-md
description: README 只留静态两段（这里是什么/文件地图）——「当前状态/阶段」单一来源归 .claude/CLAUDE.md，勿写回 README
metadata:
  type: feedback
---

PO 裁定（2026-08-30）：README 的「当前状态」节删除——README 只留静态两段（这里是什么 / 文件地图），项目当前阶段单一来源在 `.claude/CLAUDE.md` 的「当前阶段」节。判据：README 静态层（变化以月计），CLAUDE.md 动态层（变化以天计）；状态放 README 是腐烂温床（少改的文件背最常变的信息），且对 agent 零增值（CLAUDE.md 每会话自动加载）。

**Why:** 与 [[claude-md-at-claude-dir]] 同源的分工定局；PO 计划同步修改其 repo-init skill 的 README 骨架（三段改两段），用户级 skill 由 PO 自理。
**How to apply:** 本仓库改文档时不得在 README 再立状态/进展类小节；「现在到哪了」一律更新 CLAUDE.md 当前阶段。
