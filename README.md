# ClaudeDream

ClaudeDream 是一个 Claude Code 插件，目标是升级 Claude Code 的记忆系统，使 agent 系统免于腐烂，与用户和项目保持同步。

## 这里是什么

一个 Claude Code 插件，聚焦 Claude Code 记忆机制的改进——让 agent 在长期对话和跨会话中保持上下文一致性，避免漂移与信息丢失。不做对话前端、不做模型推理、不碰 CLI 核心流程。

## 文件地图

| 文件/目录 | 内容 |
|---|---|
| `.gitignore` | Git 忽略规则 |
| `.env` | 本地环境变量，不入库 |
| `seapawn.md` | 本地私人笔记，不入库 |
| `.IDEO/` | 设计思考工作区 — [README](.IDEO/README.md) · [Design Sprint 完整产出](.IDEO/DesignSprint/DesignReview.md) |
| `ScrumSprint/` | 当前开发 Sprint — [README](ScrumSprint/README.md) |
| `reference/` | 方案类比参考 — auto-dream · auto-memory · claude-memory-compiler |

## 当前状态

| 空间 | 阶段 | 说明 |
|---|---|---|
| [ScrumSprint/](ScrumSprint/README.md) | 🔵 Sprint 1 进行中 | Walking Skeleton：插件骨架 + 命令/语义触发，8 个工作项 — [Sprint Backlog](ScrumSprint/sprint-01-walking-skeleton/SprintBacklog.md) |
| [.IDEO/DesignSprint/](.IDEO/DesignSprint/README.md) | ✅ 已闭环 | 设计 Sprint 完整产出—Define → Prototype → Test → Review |
