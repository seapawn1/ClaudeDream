# ClaudeDream

一个 Claude Code 插件，升级 Claude Code 的记忆系统，使 agent 免于腐烂，与用户和项目保持同步。

## 当前阶段

**全仓库重构进行中**（2026-08-30 起，`repo-restructure` 分支直接提交）：scrum/ 已收敛为仅 [ProductBacklog.md](../scrum/ProductBacklog.md)；设计冲刺与 Sprint-1~3 档案已删除，知识蒸馏在 `.claude/memory/`（`MEMORY.md` 的 IDEO Index / Scrum Index）。机械引擎已交付（触发/围栏/底片/判据/处置/熔断/报告/G9），backlog 主菜候选 PBI-07（LLM 层）。旧物（22 个 tag、远端 origin 残留）弃用待清——推送、远端、tag 一律等 PO 指令。

## 常用命令

- `node claude-dream/test/smoke-check.mjs` —— 真梦前置冒烟：一条命令查登录态/token/SDK 可达，红绿分明、红时一句话说清缺什么。先跑这个再跑下面的自证。
- `node claude-dream/test/self-test.mjs` —— DoD·D1 一键自证（全链路/冷却/防递归/故障注入），需登录态（见「环境与坑」）。

## 目录约定

- `scrum/` 只剩 `ProductBacklog.md`（产品日志：Product/Vision、DoD 与验收流程约定、backlog、架构图）。
- `reference/` 只放原料，不放结论；与记忆蒸馏冲突时以原料为准。`reference/claude-dream/` 是只读参考材料，与插件产物 `claude-dream/` 是两回事。
- `.claude/memory/` 是知识库（跨会话记忆 + 档案蒸馏），遵守官方 auto-memory 契约：一记一文件 + MEMORY.md 纯指针索引，勿破。

## 环境与坑

- 跑梦与 D1 自证需 Claude Code 登录态，缺失时 SDK 报 "Could not resolve authentication method"——先跑 smoke-check，别当代码 bug。托管/网关代理环境下凭据文件/环境变量可能都查不到而调用照样成功——唯一作数的判据是真跑一次最小 SDK 调用。
- 梦进程的 git 提交必须限定 pathspec：先 `git diff --cached --name-only -- <pathspec>` 算具体文件再喂 commit——`git commit -- <目录>` 的 `--only` 语义在目录无匹配文件时整笔报错。
- Git Bash 对未加引号的反斜杠路径会静默吞掉反斜杠——工作目录已在项目根时省略 `-C`，不要拼反斜杠路径。
- 验收考卷对开发方约定保密：若未来再启用出卷/答卷分离验收，主动不读、不引用考卷内容。
