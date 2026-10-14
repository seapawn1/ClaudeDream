# ClaudeDream

一个 Claude Code 插件：升级 Claude Code 的记忆系统，使 agent 记忆免于腐烂，与用户和项目保持同步。

## 这里是什么

这个插件的开发仓库。2026-07~08 的旧版本（插件代码、设计冲刺与 Sprint 档案）已删除，可在 git 历史中查看：tag `v3.0` 的上一个提交（`v3.0^`）就是旧版终态。

## 文件地图

| 文件/目录 | 内容 |
|---|---|
| `.claude-plugin/marketplace.json` | 插件市场注册（`claude-dream-dev`） |
| `reference/` | 外部方案原料，见 [reference/README.md](reference/README.md) |
| `CLAUDE.md` | 项目指令（每次会话自动加载），含当前阶段 |
| `.worktreeinclude` | 建 worktree 时从主检出复制的文件清单 |
| `.env` / `.claude/seapawn.md` | 本地私人文件，不可阅读 |
