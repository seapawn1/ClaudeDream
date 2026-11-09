# ClaudeDream

一个 Claude Code 插件，升级 Claude Code 的记忆系统，使 agent 免于腐烂，与用户和项目保持同步。

## 愿景

> 任何长期使用 Claude Code 的人，开新会话时 agent 都像昨天刚一起工作过；而且越用越懂你——记忆产生复利，agent 能连起你自己都没连起的线索。

## 当前阶段

**Sprint 01 已结束**（2026-11-09，tag `sprint-01-first-dream`，压缩后的日志 `scrum/documents/sprint-01-first-dream.md`）：插件 `dreaming` 0.2.3 做成，一条命令做梦（agent 只改暂存副本，核对通过才整个目录写回，写回前留回滚副本，一步恢复）、体检、中途断了接着跑；在 IDEO-Scrum 的真实记忆上写回并恢复过一次。DoD 的“记忆新鲜”未达成，“用得上”没验。下一步是 Sprint 02 Planning：Review 建议先做 PBI-013（记忆真正更新鲜），同一冲刺挑一个目录真实写回并留下，第二天判断“用得上”。产品、Product Goal、DoD 与 PBI 见 `scrum/ProductBacklog.md`，竞品摘要见 `scrum/documents/competitor-scan-2026-11-07.md`。

背景：2026-10-14 推倒重来；2026-11-07 PO 定以 Anthropic cookbook《Dreaming with a dynamic workflow》为基线，做成 Claude Code 插件；2026-11-08 建产品日志。新版本起点是 tag `v3.0`，旧版终态是它的上一个提交（`v3.0^`）。讨论底稿：`docs/claude-dream-v3-direction-and-open-questions.md`（PO 已定的方向、已核实的事实）、`docs/cookbook-port-notes.md`（cookbook 精读与移植清单）。旧档案、旧规格、旧 DoD 不作为前提或约束；Sprint 编号从头开始。

## 目录约定

- `.claude-plugin/marketplace.json`：插件市场 `claude-dream`（2026-11-09 由 `claude-dream-dev` 改名）。
- `plugins/dreaming/`：插件 `dreaming`，也就是产品本身（技能、子代理、hook、脚本、测试）；`NOTICE` 注明改编自 cookbook 的出处。
- `scrum/`：Scrum 工作：产品日志 `ProductBacklog.md`、进行中的冲刺文件夹，`documents/` 放已结束冲刺的压缩日志和背景材料。
- `references/`：外部方案原料，只放原料不放结论；部分内容是 2026-07 的快照，使用前对照官方现状复核。
- `docs/`：讨论底稿与设计文档，加运行说明 `docs/run-notes.md`（怎么跑、断了怎么办、问题分两类）。
- `tools/`：开发和验收用的脚本，不随插件发布：`build_agents.py`（两个 agent 的提示词相对 cookbook 原件的改动记录）、`verify_real_run.py`（对开跑前的快照独立核对写回和恢复）、`replay_lead_commands.py`（改 lead 命令的规则前，拿真实日志重放）、`run_numbers.py`（一次运行的模型、耗时、token、写入调用数）。

## 环境与坑

- 本机走第三方中转：凭据文件和环境变量可能都查不到，SDK 调用却照样成功。判断登录态是否可用，唯一作数的是真跑一次最小 SDK 调用。
- Git Bash 对未加引号的反斜杠路径会静默吞掉反斜杠——工作目录已在项目根时省略 `-C`，不要拼反斜杠路径。
