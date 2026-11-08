# ClaudeDream

一个 Claude Code 插件，升级 Claude Code 的记忆系统，使 agent 免于腐烂，与用户和项目保持同步。

## 愿景

> 任何长期使用 Claude Code 的人，开新会话时 agent 都像昨天刚一起工作过；而且越用越懂你——记忆产生复利，agent 能连起你自己都没连起的线索。

## 当前阶段

**Sprint 01 进行中**（分支 `sprint-01-first-dream`，冲刺日志 `scrum/sprint-01-first-dream/SprintBacklog.md`；目标：手动对当前账号的会话记录目录跑通一次大梦，做梦前后各体检一次。2026-10-14 推倒重来；2026-11-07 PO 定以 Anthropic cookbook《Dreaming with a dynamic workflow》为基线，做成 Claude Code 插件；2026-11-08 建产品日志）：产品、Product Goal、DoD 与 PBI 见 `scrum/ProductBacklog.md`，竞品摘要见 `scrum/documents/competitor-scan-2026-11-07.md`。新版本起点是 tag `v3.0`，旧版终态是它的上一个提交（`v3.0^`）。讨论底稿：`docs/claude-dream-v3-direction-and-open-questions.md`（PO 已定的方向、已核实的事实）、`docs/cookbook-port-notes.md`（cookbook 精读与移植清单）。旧档案、旧规格、旧 DoD 不作为前提或约束；Sprint 编号从头开始。

## 目录约定

- `.claude-plugin/marketplace.json`：插件市场 `claude-dream`（2026-11-09 由 `claude-dream-dev` 改名）；插件 `dreaming` 在 Sprint 01 开发中。
- `references/`：外部方案原料，只放原料不放结论；部分内容是 2026-07 的快照，使用前对照官方现状复核。
- `docs/`：讨论底稿与设计文档。

## 环境与坑

- 本机走第三方中转：凭据文件和环境变量可能都查不到，SDK 调用却照样成功。判断登录态是否可用，唯一作数的是真跑一次最小 SDK 调用。
- Git Bash 对未加引号的反斜杠路径会静默吞掉反斜杠——工作目录已在项目根时省略 `-C`，不要拼反斜杠路径。
