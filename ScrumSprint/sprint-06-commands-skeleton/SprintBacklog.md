# Sprint 6 — 命令骨架抄入（PB-Import-1）

> 本文件是 ClaudeDream 第六个 Sprint 的 **Sprint Backlog**（Scrum 工件）：Sprint Goal（为什么）+ 选中 PBI（做什么）+ 工作项分解（怎么做）。
>
> 关联工件：[Product Backlog](../ProductBacklog.md) · [Definition of Done](../DefinitionOfDone.md) · 上一 Sprint [Sprint 4 Review](../sprint-04-compile-write/SprintReview.md)
>
> 开始日期：2026-07-27。Planning 由 Developer（pawn）主持；Sprint Goal 由 pawn 定，scope = PB-Import-1 一条，由 PO（seapawn）拍板。
>
> **落盘约定**：本 Sprint 的所有产出文件都放在 `sprint-06-commands-skeleton/` 下。

---

## 一 · Sprint Goal

> **让 ClaudeDream 第一次以「命令 + 智能体」形态运行**——SKILL.md 退役，`reference/claude-dream/` 的骨架（commands / agents / hooks）接入可分发插件并通过端到端验收，为六条修正 PBI 提供稳定基础。

- **为什么有价值**：当前 SKILL.md 把 B/C 全部塞进单一提示词文件，随 Sprint 迭代越来越难维护，且无法拆分修正。commands + subagents 形态让每条 Fix PBI 有独立的修改目标，而不是在一个巨大的 prompt 里到处打补丁。
- **凝聚性**：一个目标（架构换型），对应一个锚点 PBI（Import-1），可整体交付。本 Sprint 不改行为——即使仍是 knowledge/ 模型，只要结构对了就是 Done。
- **可 demo**：Sprint Review 真机演示：hooks 自动写 daily log → `/flush` 提炼 → `/compile` 编译到 knowledge/ → `/lint` 健康报告 → `/query` 返回答案。SKILL.md 已从插件中消失。

---

## 二 · 选中的 PBI

| 编号 | 标题（size） | 用户故事 | Acceptance Criteria | 依赖 | 状态 |
|---|---|---|---|---|---|
| PB-Import-1 | 全量抄入参考插件骨架（L） | 作为 ClaudeDream 开发者，我想把插件从单 SKILL.md 升级为 commands + subagents + hooks 架构，以便后续六条修正 PBI 各有独立的修改目标、而不是在一个巨大 prompt 里打补丁。 | ① `/flush` `/compile` `/lint` `/query` 四条命令在插件里注册并可唤起；② `compiler` `linter` `query-engine` 三个 subagent 在插件里注册并可被命令调用；③ `session-end.py` `pre-compact.py` `session-start.py` hooks 注册进 `plugin.json` 并在会话事件时自动触发；④ `SKILL.md` 已从插件中删除，无残留引用；⑤ 3 个悬空 bug 已修（pyproject 悬空 entry / config 双重赋值 / utils 扫描目录硬编码）；⑥ 端到端验收：本项目 + ≥1 外部项目，五条命令全通 + hooks 自动触发 daily log 写入。 | 无（从 reference/claude-dream/ 直接抄入） | 就绪 |

---

## 三 · 工作项分解（≤1 天/项）

| # | 工作项 | 归属 PBI·AC | 验收信号 |
|---|---|---|---|
| W1 | 复制 commands 四件套：`flush.md` `compile.md` `query.md` `lint.md` → 插件 commands 目录；确认路径在 plugin.json 中可被注册 | Import-1 ① | 四条命令文件存在于插件目录，内容与参考一致 |
| W2 | 复制 agents 三件套：`compiler.md` `linter.md` `query-engine.md` → 插件 agents 目录 | Import-1 ② | 三个 agent 文件存在，frontmatter 完整（name / description / model / tools） |
| W3 | 复制 hooks 三件套：`session-start.py` `session-end.py` `pre-compact.py` → 插件 hooks 目录 | Import-1 ③ | 文件存在，recursion guard（CLAUDE_INVOKED_BY）完整 |
| W4 | 复制 scripts：`config.py` `utils.py` → 插件 scripts 目录；修 3 个悬空 bug | Import-1 ⑤ | bug 修复：pyproject 无悬空 entry；config.py 无双重赋值；utils 扫描目录改参数化 |
| W5 | 复制 AGENTS.md + pyproject.toml（精简依赖：python-dotenv + tzdata，无 claude-agent-sdk） | Import-1 骨架 | 文件存在；pyproject 依赖仅两项 |
| W6 | 创建目录骨架：`daily/`（.gitkeep）/ `knowledge/index.md` + `log.md`（空初始化）/ `reports/`（.gitkeep）/ `scripts/state.json`（空 state） | Import-1 骨架 | 目录结构存在，state.json 合法空 JSON |
| W7 | 接入 plugin.json（hooks 注册）：session-start / session-end / pre-compact 注册进 `.claude-plugin/plugin.json`；对标 `reference/.claude/settings.json` 格式适配插件形态 | Import-1 ③ | plugin.json 含 hooks 声明；真机重启后 hooks 自动触发 |
| W8 | 删除 SKILL.md：`claude-dream/skills/claude-dream/SKILL.md` 退役；确认 plugin.json / README 无残留引用 | Import-1 ④ | 文件不存在；grep 无残留引用 |
| W9 | 端到端验收——本项目：hooks 触发 → `/flush` → `/compile` → `/lint` → `/query` 全通 | Import-1 ⑥ | 五条命令输出正常；daily log 有写入；knowledge/ 有文章产出 |
| W10 | 端到端验收——外部项目（DiaryAgent 或同等项目）：同 W9，验证可分发性 | Import-1 ⑥ | 异构项目上五条命令全通 |

---

## 四 · 先验认识

### 4.1 技术事实（来自 reference/claude-dream 勘探）

| 主题 | 结论 | 来源 |
|---|---|---|
| commands 是 markdown 文件 | `.claude/commands/*.md`，文件内容即 slash command 的执行指令；`$ARGUMENTS` 接参数 | `reference/claude-dream/.claude/commands/` |
| agents 有 frontmatter | `.claude/agents/*.md` 需 frontmatter：`name` / `description` / `model` / `tools`；`linter` 指定 `claude-opus-5` | `reference/claude-dream/.claude/agents/linter.md:1-10` |
| hooks 纯本地 IO | `session-end.py` 直接把 transcript raw dump 写进 daily log，**无 LLM 调用**；LLM 提炼留给 `/flush` 命令 | `reference/claude-dream/hooks/session-end.py` |
| session-start 注入 knowledge/ | 当前注入 `knowledge/index.md` + 最近 daily log；Fix-1 后改注入 `MEMORY.md`——Fix-1 会删此 hook | `reference/claude-dream/hooks/session-start.py` |
| state.json 跟踪 SHA-256 | `/compile` 读 `state.json` 的 `ingested` 字段，hash 未变跳过——即 Hash Gate 在 commands 里已内建 | `reference/claude-dream/.claude/commands/compile.md:2-9` |
| 无 claude-agent-sdk | 所有 LLM 调用走当前 Claude Code 会话（commands + subagents），不需后台进程或 API key | `reference/claude-dream/README.md` |
| pyproject 最小依赖 | `python-dotenv` + `tzdata` 仅两项；原参考项目 `compile:main` entry 是错误残留——已确认删除 | `reference/claude-dream/pyproject.toml` |

### 4.2 PO 拍板

① scope = PB-Import-1 单条；② session-start.py **先抄进来**，Fix-1 再删（memory/ 原生加载后不需注入）；③ 存储位置 = 配置目录（daily/ 和 memory/ 都在 `~/.claude/projects/<slug>/`）；④ 打包形态 = 保持可分发插件；⑤ claude-code-log 先抄参考版 JSONL 解析，后续 PB-Open-1 再评估是否恢复。

### 4.3 Impediment / 风险登记

| # | 事项 | 状态 | 应对 |
|---|---|---|---|
| R1 | **plugin.json 的 hook 注册格式**：参考用 `.claude/settings.json`（项目级），可分发插件用 `.claude-plugin/plugin.json`，两者 hook 声明格式是否兼容**未确认** | ⚠️ 高·未解决 | W7 执行时优先勘探 plugin.json hook 格式；若格式不同则适配；若插件形态暂不支持 hooks，先以项目级 settings.json 跑通 W9 再议 |
| R2 | **commands/agents 在可分发插件里的路径**：参考用 `.claude/commands/` 和 `.claude/agents/`，插件形态是否需要放在 `claude-dream/.claude/commands/` | 未确认 | W1/W2 执行时确认插件目录约定；参考 Sprint 1 plugin.json 的 skill 注册方式类推 |
| R3 | **SKILL.md 删除是不可逆的**：Import-1 端到端验收失败时无 fallback | 已接受 | 先做 W9 初步验证再做 W8 删除；git 可回退 |
| R4 | **session-start.py 注入 knowledge/index.md**，但 W6 创建的是空文件：首次会话 knowledge/ 为空，注入内容为空，不影响功能但体验不佳 | 已接受 | Fix-1 删 session-start 后自然消失；本 Sprint 不处理 |

---

## 五 · Definition of Done

摘抄自 [全局 DoD](../DefinitionOfDone.md)（PO 已认可）。

| 类别 | 完成项 | 本 Sprint 适用性 |
|---|---|---|
| 功能可用 | 五条命令 + hooks 在 ≥2 异构项目上端到端跑通 | ✅ W9 + W10 |
| 信任边界 | hooks 不触碰 CLAUDE.md；commands 不写 memory/ 以外（此时 knowledge/，Fix-1 后改） | ✅ 检查 commands 写入目标 |
| 记忆质量 | knowledge/ 文章有完整 frontmatter（参考 schema，Fix-1 后换 memory/ schema） | ✅ 此时用参考 schema |
| 可审阅 | /compile 输出 log.md 追加（含编译记录） | ✅ W9 验证 log.md 有写入 |
| 索引一致 | knowledge/index.md 与文章同步 | ✅ W9 验证 |
| 独立验证 | 由 subagent 或 seapawn 逐条验收，自评不通过 | ✅ 完整适用 |
| 优雅结构 | commands/agents/hooks/scripts 分层，无 SKILL.md | ✅ W8 完成后核查 |
