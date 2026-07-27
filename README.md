# ClaudeDream

ClaudeDream 是一个 Claude Code 插件，目标是升级 Claude Code 的记忆系统，使 agent 系统免于腐烂，与用户和项目保持同步。

## 这里是什么

一个 Claude Code 插件，聚焦 Claude Code 记忆机制的改进——让 agent 在长期对话和跨会话中保持上下文一致性，避免漂移与信息丢失。不做对话前端、不做模型推理、不碰 CLI 核心流程。

## 文件地图

| 文件/目录 | 内容 |
|---|---|
| `.gitignore` | Git 忽略规则 |
| `.env` | 本地环境变量，不可阅读 |
| `seapawn.md` | 本地私人笔记，不可阅读 |
| `claude-dream/` | **插件产物** — 可安装的 Claude Code 记忆插件（v0.3.0：commands+agents+hooks 架构，SKILL.md 退役） |
| `.IDEO/` | 设计思考工作区 — [README](.IDEO/README.md) · [Design Sprint 完整产出](.IDEO/DesignSprint/DesignReview.md) |
| `ScrumSprint/` | 当前开发 Sprint — [README](ScrumSprint/README.md) |
| `reference/` | 方案类比参考 — auto-dream · auto-memory · claude-memory-compiler · claude-code-log（Sprint 2 对话读取工具底座） · **claude-dream/**（AI 转化产物：claude-memory-compiler 改写为插件形态，无独立上游，只读不可信，详见 [reference/README](reference/README.md)） |

## 当前状态

| 空间 | 阶段 | 说明 |
|---|---|---|
| [claude-dream/](claude-dream/) | ✅ Sprint 6 已交付 | v0.3.0 commands+agents+hooks 架构：hooks 自动捕获对话 → /flush → /compile → /lint → /query；SKILL.md 退役 — [Sprint 6 Review](ScrumSprint/sprint-06-commands-skeleton/SprintReview.md)（待补） |
| [ScrumSprint/](ScrumSprint/README.md) | ✅ Sprint 1-4 全部已交付 | Target A（手动触发）+ B（读取管线）+ C 首发（编译落盘）+ 可迁移性——MVP 全链路闭合；Target C+ 判定深化待后续 Sprint |
| [.IDEO/DesignSprint/](.IDEO/DesignSprint/README.md) | ✅ 已闭环 | 设计 Sprint 完整产出—Define → Prototype → Test → Review |
