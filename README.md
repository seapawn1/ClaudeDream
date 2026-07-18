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
| `.env` | 本地环境变量，不入库 |
| `seapawn.md` | 本地私人笔记，不入库 |
| `.claude/settings.json` | Claude Code 项目级配置 |
| `.claude/skills/ideo-kernel/` | IDEO 设计思维 5 模式 + 40 方法 |
| `.claude/skills/scrum-kernel/` | Scrum 框架指南 |
| `.claude/output-styles/` | 自定义输出样式 |
| `.IDEO/` | 设计思考实战笔记（方法应用，非方法定义） |

## 当前状态

2026-07-18：技能包与输出样式就绪，进入设计阶段。
