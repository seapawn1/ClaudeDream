# ClaudeDream

一个 Claude Code 插件，升级 Claude Code 的记忆系统，使 agent 免于腐烂，与用户和项目保持同步。

## 从哪里开始

新会话先读 [README.md](README.md)（项目地图与当前状态）。要理解**方案是什么、为什么这么设计**，读 [scrum/.IDEO/design-sprint/DesignReview.md](scrum/.IDEO/design-sprint/DesignReview.md)——设计冲刺的总结算与全部档案入口；要看 Scrum 段产品目标与 backlog，读 [scrum/ProductBacklog.md](scrum/ProductBacklog.md)。

**当前阶段**：Sprint-1（骨架回环）已收口；当前 Sprint-2（底片层），Goal「白天留底，夜里读得到」，施工与出卷并行推进中。详见 [README.md](README.md) 当前状态与 [scrum/sprint-02-negatives/SprintBacklog.md](scrum/sprint-02-negatives/SprintBacklog.md)。

## 常用命令

- `node claude-dream/test/self-test.mjs` —— DoD·D1 一键自证（全链路/冷却/防递归/故障注入），需登录态（见「环境与坑」）。

## 历史与分支

项目 2026-07-29 重启：Design Sprint（旧 `.IDEO/DesignSprint/`）、Scrum Sprint 1-6（旧 `ScrumSprint/` + `claude-dream/` 插件产物代码）已作废，完整历史保留在 `sprint-01`~`sprint-05-eval-test-set--06`、`DesignSprint--跑通全流程` 等分支——`git branch -a` 查看，不在当前工作树。

## 目录约定

- `scrum/` 是当前工作区，以 Scrum 产物（ProductBacklog 含架构 / 各 Sprint 的 SprintBacklog）为主；`scrum/.IDEO/design-sprint/` 归档已结束的设计冲刺，以设计文档为主，例外是原型施工物（可运行脚本、假数据 builder、真跑产物，含各 `testbed/` 生成物），随所属 `Prototype-0X-*/` 子文件夹落户，生成物不入库。
- `reference/` 只放原料，不放结论；与 `scrum/.IDEO/design-sprint/` 蒸馏冲突时以原料为准。

## 环境与坑

- 跑梦（`claude-dream/src/run-dream.mjs`）与 D1 自证（`claude-dream/test/self-test.mjs`）需 Claude Code 登录态（`~/.claude/.credentials.json`），缺失报 "Not logged in"——headless/CI 环境先确认登录态，别当代码 bug。
- 验收考卷在 `sprint-01-acceptance` 分支 `scrum/sprint-01-skeleton/acceptance/`，卷面对开发方保密；开发方按 AC + `adapter.json` 自证（DoD·D1），不碰考卷。
- 梦进程的 git 提交必须限定 pathspec：`git commit -- <目录>` 走 `--only`，空目录报 "pathspec did not match"，应先 `git diff --cached --name-only -- <pathspec>` 算具体文件再喂 commit。