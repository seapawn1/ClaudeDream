---
name: pr-based-merge-workflow
description: Sprint-4 起 PR 工作流——主文件夹 checkout 集成分支、工作树挂侧分支、只 PR 集成分支；main 只在 sprint 之间被 checkout 且 == origin/main；推送由 PO 指令
metadata:
  type: feedback
---

PO 裁定（2026-08-16，Sprint-4 起；当日稍晚修订为「主文件夹集成分支」模型）：改 PR 工作流——main 分支保持 == origin/main（当前 820ad99），只在两个 sprint 之间被 checkout；**sprint 期间主文件夹 checkout 集成分支 `sprint-04-llm`**，scrum 档案（SprintBacklog 各节、验收、Retro）、docs 与记忆同步都提交在这里；开发者/出卷等工作线开 `.claude/worktrees/<侧名>` 独立工作树、挂**侧分支**（名字必须 ≠ 集成分支名——git 硬约束：一支同一时间只能被一个工作树 checkout）；侧分支内部合并进集成分支；收口时按 PO 指令推集成分支 + 开 PR（sprint-04-llm → main），PR 合并后主文件夹 checkout 回 main、删集成分支与侧分支。Sprint-4 Planning 定案的提交（docs a19dd62 + scrum a5033b6 + memory 2440f1b）只在集成分支上。

**Why:** PO 要以 PR 方式审阅与合并，main 只经 review 前进；主文件夹跟集成分支让新会话始终看到当前 sprint 真状态，不 stale。

**How to apply:** ① 本会话与后续会话的默认工作现场＝主文件夹（集成分支），scrum 档案直接在这里提交；② 施工/出卷等并行线用 EnterWorktree 开侧分支工作树（或按 PO 点名开）；③ PR 若 squash 合并，合并后本地 main reset 到 origin/main（内容同、历史异）；merge/rebase 则 fast-forward；④ 推送永远等 PO 指令。相关：[[acceptance-e2e-only]]
