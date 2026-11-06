# ClaudeDream

一个 Claude Code 插件，升级 Claude Code 的记忆系统，使 agent 免于腐烂，与用户和项目保持同步。

## 愿景

> 任何长期使用 Claude Code 的人，开新会话时 agent 都像昨天刚一起工作过；而且越用越懂你——记忆产生复利，agent 能连起你自己都没连起的线索。

## 当前阶段

**以官方 cookbook 为基线，精读并整理移植清单**（2026-10-14 推倒重来；2026-11-07 PO 定以 Anthropic cookbook《Dreaming with a dynamic workflow》为架构基线，做成 Claude Code 插件）：旧插件代码、设计冲刺与 Sprint-1~3 档案、ProductBacklog 已全部删除；新版本起点是 tag `v3.0`，旧版终态是它的上一个提交（`v3.0^`）。愿景保留。PO 已定的方向、已核实的事实和待议问题见 `docs/claude-dream-v3-direction-and-open-questions.md`；cookbook 精读笔记与移植清单见 `docs/cookbook-port-notes.md`。下一步：读完 cookbook 余下各段；同类项目调研（看有没有人已做完同样的东西）交 Developer 会话；之后开 v3 第一次 Sprint Planning，先建 Product Backlog。旧档案、旧规格、旧 DoD 不作为前提或约束；Sprint 编号从头开始。

## 目录约定

- `.claude-plugin/marketplace.json`：插件市场注册（`claude-dream-dev`），插件列表暂空，新插件做出来后再登记。
- `reference/`：外部方案原料，只放原料不放结论；部分内容是 2026-07 的快照，使用前对照官方现状复核。
- `docs/`：讨论底稿与设计文档。

## 环境与坑

- 本机走第三方中转：凭据文件和环境变量可能都查不到，SDK 调用却照样成功。判断登录态是否可用，唯一作数的是真跑一次最小 SDK 调用。
- Git Bash 对未加引号的反斜杠路径会静默吞掉反斜杠——工作目录已在项目根时省略 `-C`，不要拼反斜杠路径。
