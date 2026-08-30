# ClaudeDream

一个 Claude Code 插件，升级 Claude Code 的记忆系统，使 agent 免于腐烂，与用户和项目保持同步。

## 从哪里开始

新会话先读 [README.md](README.md)（项目地图与当前状态）。要理解**方案是什么、为什么这么设计**，读 [scrum/.IDEO/design-sprint/DesignReview.md](scrum/.IDEO/design-sprint/DesignReview.md)——设计冲刺的总结算与全部档案入口；要看 Scrum 段产品目标与 backlog，读 [scrum/ProductBacklog.md](scrum/ProductBacklog.md)。

**当前阶段**：Sprint-1（骨架回环）已收口；Sprint-2（底片层）已收口（2026-08-14）；Sprint-3（引擎主干·纯机械梦）已收口（2026-08-16，七站亲验+双盲对照、PO 验收通过）；Sprint-4（引擎 LLM 层·PBI-07）Planning 定案（2026-08-16）：八条拆条一刀全上（主路径与档位/S1S2 判据/S3 连接落盘/L1 处置/铁律执行器/L2 阀门/候删/报告接口），`llm_checks` 默认 on + 无登录态优雅降级；施工走 `.claude/worktrees/sprint-04-llm`（分支 `sprint-04-llm`），收口时并回 `main`。详见 [README.md](README.md) 当前状态与 [scrum/ProductBacklog.md](scrum/ProductBacklog.md)。

## 常用命令

- `node claude-dream/test/smoke-check.mjs` —— E0·AC1 真梦前置冒烟检查：一条命令查登录态/token/SDK 可达，红绿分明、红时一句话说清缺什么。先跑这个再跑下面的自证，省得在自证脚本中途才发现环境不通。
- `node claude-dream/test/self-test.mjs` —— DoD·D1 一键自证（全链路/冷却/防递归/故障注入），需登录态（见「环境与坑」）。

## 历史与分支

项目 2026-07-29 重启：Design Sprint（旧 `.IDEO/DesignSprint/`）、Scrum Sprint 1-6（旧 `ScrumSprint/` + `claude-dream/` 插件产物代码）已作废，完整历史保留在 `sprint-01`~`sprint-05-eval-test-set--06`、`DesignSprint--跑通全流程` 等分支——`git branch -a` 查看，不在当前工作树。

## 目录约定

- `scrum/` 是当前工作区，以 Scrum 产物（ProductBacklog 含架构 / 各 Sprint 的 SprintBacklog）为主；`scrum/.IDEO/design-sprint/` 归档已结束的设计冲刺，以设计文档为主，例外是原型施工物（可运行脚本、假数据 builder、真跑产物，含各 `testbed/` 生成物），随所属 `Prototype-0X-*/` 子文件夹落户，生成物不入库。
- `reference/` 只放原料，不放结论；与 `scrum/.IDEO/design-sprint/` 蒸馏冲突时以原料为准。

## 环境与坑

- 跑梦（`claude-dream/src/run-dream.mjs`）与 D1 自证（`claude-dream/test/self-test.mjs`）需 Claude Code 登录态，缺失时 SDK 报 "Could not resolve authentication method"——headless/CI 环境先跑 `node claude-dream/test/smoke-check.mjs` 确认登录态，别当代码 bug。注意：认证不一定落在 `~/.claude/.credentials.json` 或裸环境变量上，托管/网关代理环境下这两者都可能查不到而调用照样成功（本机 2026-08-14 实测过这个反例）——凭据文件/环境变量只是冒烟检查里红灯时的辅助线索，唯一作数的判据是它真跑的那次最小 SDK 调用。
- 验收考卷（各 Sprint 的 `acceptance/` 目录，如 `scrum/sprint-01-skeleton/acceptance/`、`scrum/sprint-02-negatives/acceptance/`）收口后已并入 `main` 工作树，不必切分支查看——卷面对开发方是**约定保密**（不是分支隔离）：开发方按 AC + `adapter.json` 自证（DoD·D1），主动不读、不引用考卷内容。
- 梦进程的 git 提交必须限定 pathspec：`git commit -- <目录>` 走 `--only`，空目录报 "pathspec did not match"，应先 `git diff --cached --name-only -- <pathspec>` 算具体文件再喂 commit。
- Git Bash 对未加引号的反斜杠路径会静默吞掉反斜杠（`d:\ClaudeDream` → `d:ClaudeDream`），`git -C <path>` 这类命令因此报 "cannot change to" 假错——工作目录已在项目根时直接省略 `-C`，不要拼反斜杠路径。
- 当前重启后（2026-07-29 起）的 Sprint 施工/出卷分支（如 `sprint-02-negatives`、`sprint-02-acceptance`）收口合并后即删除，`git branch -a` 只剩 `main`——查某轮 Sprint 细节走 `git log --oneline` 找对应 `merge:` 提交，分支不在不代表工作不存在。