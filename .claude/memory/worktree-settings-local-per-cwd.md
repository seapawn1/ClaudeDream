---
name: worktree-settings-local-per-cwd
description: settings.local.json 不入 git、按 cwd 生效、单一 autoMemoryDirectory——技术事实常青；「每 Sprint 独立施工工作树」模式已随 2026-08-30 重构弃用
metadata:
  type: project
---

技术事实（常青）：

- `settings.local.json` 被全局 git ignore（`C:\Users\DELL\.config\git\ignore` 第 1 行）拦着，永不入 git；`git worktree add` 只搬 tracked 文件，它不会「跟」进新工作树。
- 本地设置按 cwd 生效：新会话在哪个目录开，就吃哪个目录自己的 settings.local.json（会话中途切 cwd 不换）。
- Claude Code 自建工作树（`--worktree`/EnterWorktree）有 `.worktreeinclude` 工序——把「匹配模式且被 gitignore」的文件复制进新工作树。本项目 `.worktreeinclude` 已于 2026-08-30 建立（条目 `.env` + `settings.local.json`，提交 a27ec2f）。
- v2.1.211 起工作树会话里的权限批准（don't ask again）存主 checkout 的 settings.local.json、全库生效。
- 项目用单一 autoMemoryDirectory（指向主检出 `.claude/memory/`），worktree 会话不另立记忆库。

**时代标注（2026-08-30）**：「每 Sprint 配独立施工工作树、各挂分支」是 Sprint-2~4 时代的模式（当年：施工树 developer 输出风格、主文件夹 scrum-master 风格），已随全仓库重构弃用（[[sprint-04-mainline-intent]]）；重构后是否恢复并行工作树施工等 PO 定。
