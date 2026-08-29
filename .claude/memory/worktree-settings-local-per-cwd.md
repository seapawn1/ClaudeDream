---
name: worktree-settings-local-per-cwd
description: settings.local.json 不入 git、按 cwd 生效——工作树会话吃工作树自己的本地设置；sprint-04-dev 工作树是 developer 风格
metadata: 
  node_type: memory
  type: project
  originSessionId: e6e782e9-7f0f-424e-add7-e20668c3fb55
  modified: 2026-08-16T13:32:12.454Z
---

`settings.local.json` 被全局 gitignore（`C:\Users\DELL\.config\git\ignore` 第 1 行 `**/.claude/settings.local.json`）拦着，永不入 git——`git worktree add` 只搬 tracked 文件，所以它不会「跟」进新工作树；之前工作树里有它，是会话进场后 Claude Code 按目录就地写的（/config 或权限授予落在当时 cwd 的项目级本地设置）。它按 cwd 生效：**新会话**在哪个目录开，就吃哪个目录自己的 settings.local.json（当前会话中途切 cwd 不换风格）。

Claude Code 自建工作树（`--worktree`/EnterWorktree/子代理隔离）另有 `.worktreeinclude` 工序——复制「匹配模式且被 gitignore」的文件进新工作树（docs /en/worktrees.mdx）。**本项目根目录无 `.worktreeinclude`、也无 WorktreeCreate hook，该工序空转**——两种建树方式对 settings.local.json 结果相同：都不复制（2026-08-16 查证）。另：v2.1.211 起工作树会话里的权限批准（don't ask again）存主 checkout 的 settings.local.json、全库生效。

现状（2026-08-16）：主文件夹 `D:/ClaudeDream/.claude/settings.local.json` = `ideo-scrum:scrum-master`；施工工作树 `.claude/worktrees/sprint-04-dev/.claude/settings.local.json` = `ideo-scrum:developer`；两份 autoMemoryDirectory 都指向 `D:/ClaudeDream/.claude/memory`（单一记忆库，别改成各写各的）。

相关：[[pr-based-merge-workflow]]
