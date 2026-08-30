# ClaudeDream

一个 Claude Code 插件：为长期使用 Claude Code 的人提供**可信的记忆离线整合**（体检 → 整合 → 留证），使 agent 记忆免于腐烂，与用户和项目保持同步。

## 这里是什么

Claude Code 内置了离线记忆整合（Auto Dream），但零留证、禁碰 CLAUDE.md，且出过 24 小时静默删除 23 个记忆文件的社区事故（[anthropics/claude-code#47959](https://github.com/anthropics/claude-code/issues/47959)）——缺的不是"会整合"，是"可信的整合"。ClaudeDream 的答案：无人值守的"梦"——机械体检 + 分级处置 + 梦报告 + git 回滚原子，在官方契约（一记一文件 + MEMORY.md 纯指针索引）之上做加法。

**势力范围**：只动可维护记忆文件、CLAUDE.md 与底片层专属目录。**非目标**：团队共享记忆、跨项目记忆、对话前端、模型推理。产品立论的完整依据（官方三缺口、前人路径对比、差异化定位）见 `.claude/memory/product-rationale-distilled.md`。

## 文件地图

| 文件/目录 | 内容 |
|---|---|
| `claude-dream/` | **插件产物**——Sprint-1 触发链/围栏/回环、Sprint-2 底片产线、Sprint-3 机械引擎（`src/engine/`：config/check/act/fuse/g9/report）、`run-dream.mjs` 机械编排（默认零 SDK）、`run-dream-rogue.mjs`（SDK 故障演练） |
| `scrum/ProductBacklog.md` | **产品日志**——Product/Vision、DoD 与验收流程约定、backlog、架构图 |
| `reference/` | 外部方案原料（auto-dream · auto-memory · claude-memory-compiler · claude-code-log · claude-mem · claude-dream）——只放原料不放结论，见 [reference/README.md](reference/README.md) |
| `.claude/CLAUDE.md` | 项目指令（每次会话自动加载）：**当前阶段**、常用命令、目录约定、环境与坑 |
| `.claude/memory/` | **知识库**——跨会话记忆 + 设计冲刺/Sprint-1~3 档案的蒸馏（`MEMORY.md` 索引：IDEO Index / Scrum Index） |
| `.claude-plugin/marketplace.json` | 插件分发骨架 |
| `.worktreeinclude` | worktree 创建时从主检出复制的文件清单 |
| `.env` / `seapawn.md` | 本地私人文件，不可阅读 |
