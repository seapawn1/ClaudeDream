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
| `.IDEO/` | 设计工作区 — [文件地图](.IDEO/README.md) · [DesignMapping](.IDEO/DesignMapping.md) · 原型目录 |
| `reference/` | 方案类比参考 — auto-dream · auto-memory · claude-memory-compiler |

## 当前状态

| 日期 | 阶段 | 完成内容 |
|---|---|---|
| 2026-07-18 | Design Sprint Define ✅ | Goal · 4 Sprint Questions · Map · HMW · 3 Targets |
| 2026-07-18 | Target A 草图 ✅ | 决策：手动触发，自动 loop 延后；草图写入 TargetMapping.md |
| 2026-07-18 | 方案类比 ✅ | auto-dream · auto-memory · claude-memory-compiler 入库 |
| 2026-07-18 | 记忆系统 ✅ | 首个记忆文件创建，MEMORY.md 索引就绪 |
| 下一步 | Target B / C | 输入读取 → 综合判定原型 |
