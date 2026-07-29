# ClaudeDream

ClaudeDream 是一个 Claude Code 插件，目标是升级 Claude Code 的记忆系统，使 agent 系统免于腐烂，与用户和项目保持同步。

## 这里是什么

一个 Claude Code 插件，聚焦 Claude Code 记忆机制的改进——让 agent 在长期对话和跨会话中保持上下文一致性，避免漂移与信息丢失。不做对话前端、不做模型推理、不碰 CLI 核心流程。

## 文件地图

| 文件/目录 | 内容 |
|---|---|
| `README.md` | 项目地图与当前状态（本文件） |
| `CLAUDE.md` | 项目定位，供 Claude 会话载入 |
| `.gitignore` | Git 忽略规则 |
| `.env` | 本地环境变量，不可阅读 |
| `seapawn.md` | 本地私人笔记，不可阅读 |
| `.claude/` | Claude Code 项目级配置（`settings.json` + 本地 `settings.local.json`） |
| `.claude-plugin/` | `marketplace.json` — 插件分发骨架，指向 `./claude-dream`（产物代码待重新设计，目录暂不存在） |
| `.IDEO/` | 设计思考工作区，预留待用 — [README](.IDEO/README.md) |
| `reference/` | 方案类比参考资料 — auto-dream · auto-memory · claude-memory-compiler · claude-code-log · **claude-dream/**（AI 转化产物：claude-memory-compiler 改写为插件形态，无独立上游，只读不可信）— 详见 [reference/README](reference/README.md) |

## 当前状态

2026-07-29：项目重启。此前的 Design Sprint 产出（原 `.IDEO/DesignSprint/`）和 Scrum Sprint 1-6 开发记录（原 `ScrumSprint/`，含 claude-dream 插件产物代码）已作废，不再是当前工作基础——完整历史仍保留在 Git 里，`main` 之前的提交、以及 `sprint-01` ~ `sprint-05-eval-test-set--06`、`DesignSprint--跑通全流程` 等分支上随时可查。当前只保留 `reference/` 参考资料与基础设施骨架，等待新一轮 Design Sprint / Scrum Sprint 规划。
