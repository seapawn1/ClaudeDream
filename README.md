# ClaudeDream

ClaudeDream 是一个 Claude Code 插件，目标是升级 Claude Code 的记忆系统，使 agent 系统免于腐烂，与用户和项目保持同步。

## 这里是什么

一个 Claude Code 插件，聚焦 Claude Code 记忆机制的改进——让 agent 在长期对话和跨会话中保持上下文一致性，避免漂移与信息丢失。不做对话前端、不做模型推理、不碰 CLI 核心流程。

## 文件地图

| 文件/目录      | 内容                                                                                                                                                                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.gitignore` | Git 忽略规则                                                                                                                                                                                                                                                             |
| `.env`       | 本地环境变量，不可阅读                                                                                                                                                                                                                                                   |
| `seapawn.md` | 本地私人笔记，不可阅读                                                                                                                                                                                                                                                   |
| `.IDEO/`     | 设计思考工作区 —[README](.IDEO/README.md)                                                                                                                                                                                                                                |
| `reference/` | 方案类比参考 — auto-dream · auto-memory · claude-memory-compiler · claude-code-log（Sprint 2 对话读取工具底座） ·**claude-dream/**（AI 转化产物：claude-memory-compiler 改写为插件形态，无独立上游，只读不可信，详见 [reference/README](reference/README.md)） |

## 当前状态
