---
name: claude-md-at-claude-dir
description: CLAUDE.md 定位 .claude/CLAUDE.md——2026-08-30 PO 移动定局「以后就保持如此」；配套 .worktreeinclude 同批入库
metadata:
  type: feedback
---

2026-08-30 PO 把仓库根的 CLAUDE.md 移到 `.claude/CLAUDE.md`，并明示「以后就保持如此」——这是项目指令文件的定局位置。同批入库 `.worktreeinclude`（生效条目 `.env` + `settings.local.json`；另四行 reference/.git 相关疑似 .gitignore 尾部误粘，待 PO 确认后清理）。提交 a27ec2f（repo-restructure 分支，重构期间 [[sprint-04-mainline-intent]] 的后续动作）。

**Why:** PO 明示的持久约定，且与 repo-init skill 的「.claude/CLAUDE.md 项目定位」惯例一致。
**How to apply:** 凡要查看或修改项目指令，一律落 `.claude/CLAUDE.md`，不要搬回仓库根；建 worktree 前不必再问 .worktreeinclude 是否存在。