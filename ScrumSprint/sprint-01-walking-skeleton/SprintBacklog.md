# Sprint 1 — Walking Skeleton

> 本文件是 ClaudeDream 第一个 Sprint 的 **Sprint Backlog**（Scrum 工件）：Sprint Goal（为什么）+ 选中 PBI（做什么）+ 工作项分解（怎么做）。
>
> 关联工件：[Product Backlog](../ProductBacklog.md) · [Definition of Done](../DefinitionOfDone.md) · [Architecture](../Architecture.md)
>
> 开始日期：2026-07-18。Planning 由 Developer（pawn）主持，Sprint Goal 与 PBI 装载、三处待决点均由 PO（seapawn）拍板。
>
> **落盘约定**：本 Sprint 的所有产出文件都放在本文件夹 `sprint-01-walking-skeleton/` 下。

---

## 一 · Sprint Goal

> **让 ClaudeDream 作为插件在真实 Claude Code 里被 `/claudedream` 唤起（命令触发），并能识别「开始做梦 / 更新记忆」这类自然语言（语义触发薄版），走通「发起 → 确认 → 交接下游」的手动骨架流程（下游可为空）。**

- **为什么有价值**：这是 Product Goal「手动形态可用」的最小地基。没有骨架，后面的读取（B）/编译（C）无处挂载。
- **可 demo**：Sprint Review 真机跑一次 `/claudedream`，看它被识别、命中入口、解析出三条路径（项目 / 记忆 / transcript）、走完三格；再验证一句自然语言「开始做梦」能跳入同一入口。
- **凝聚性**：一个目标、可整体交付——不是无关任务的拼盘。

---

## 二 · 选中的 PBI

摘抄自 [Product Backlog](../ProductBacklog.md)，并对本 Sprint 落地做细化。用户故事 / AC 中的原文与本 Sprint 细化并列于同一行。

| 编号 | 标题（size） | 用户故事 | Acceptance Criteria | 本 Sprint 细化 | 依赖 | 状态 |
|---|---|---|---|---|---|---|
| PB-Base-1 | 插件骨架与入口（S） | 作为 Claude Code 用户，我想要 ClaudeDream 作为可安装插件存在并能被 `run claudedream` 唤起，以便在自己环境里启用记忆系统。 | ① 插件目录结构 + manifest 就位，Claude Code 能识别加载；② `run claudedream` 命中入口并返回可见响应（下游可为空）；③ 能解析出项目目录、记忆目录、transcript 目录三条路径。 | AC② 入口具体化为斜杠命令 `/claudedream`（PO 拍板）；AC③ transcript 只要求「推断出路径」，不解析内容。 | 无 | 就绪 |
| PB-Base-2 | 手动触发（S） | 作为 Claude Code 用户，我想说 `run claudedream` 手动启动记忆整理，以便在合适时机更新记忆。 | ① 三格流程走通：发起 → 确认 → 交接下游（读取→判定→写入→报告）；② 触发后先确认目标项目再继续；③ 未识别到有效上下文时明确提示，而非静默失败。 | 入口用 `/claudedream`；下游为占位（可为空）。size = S，就绪。 | PB-Base-1 | 就绪 |
| PB-Auto-1.1 | 语义召唤触发 · 仅「能识别」（S） | 作为 Claude Code 用户，我想直接说「开始做梦 / 更新记忆」而不必敲斜杠，以便更自然地唤起记忆整理。 | ① `SKILL.md` 的 `description` 写入窄触发短语；② 去掉 `disable-model-invocation`，使 Claude 能自动识别并跳入入口；③ 真机验证：一句「开始做梦」能跳入与 `/claudedream` 相同的入口流程。**不含**防误触发设计。 | 仅切「能识别」薄版（PO 追加）；完整版仍延后待补 IDEO。 | PB-Base-1 | 就绪 |

*小字说明：*
- *PB-Base-1 / PB-Base-2 的用户故事、AC 为 [Product Backlog](../ProductBacklog.md) 原文摘抄；架构定位与产品意图见 Product Backlog，不在此重复。*
- *本 Sprint 切出的薄版编号为 PB-Auto-1.1（从 PB-Auto-1 分化，PO 已拍板）。PB-Auto-1 完整版在 Product Backlog 中标「延后 · ⚠️ 需补 IDEO」（产品意图＝自然语言召唤、架构定位＝触发·A、原 size M）——「什么话算召唤、如何与手动可控共存、如何防误触发」是设计难点，留待补一轮 IDEO；本 Sprint 仅切薄版，故 AC 为本切片专属、非 Product Backlog 原文。*

---

## 三 · 工作项分解（≤1 天/项）

| # | 工作项 | 归属 | 验收信号 |
|---|---|---|---|
| W1 | 建插件目录 + `.claude-plugin/plugin.json`（`name` / `version` / `description`） | PB-Base-1 ① | Claude Code 能识别加载，manifest 校验通过 |
| W2 | 建 `skills/claudedream/SKILL.md` 入口骨架 | PB-Base-1 ① | `/claudedream` 出现在 `/` 菜单 |
| W3 | 本地加载验证 `claude --plugin-dir ./` | PB-Base-1 ① | 插件被识别、命令可见 |
| W4 | 入口解析三条路径：项目（`${CLAUDE_PROJECT_DIR}`）/ 记忆 / transcript（**推断出路径即可**，不解析内容） | PB-Base-1 ②③ | 三条路径可打印 |
| W5 | 三格流程落地：发起 → 确认目标项目 → 交接下游占位（下游可为空） | PB-Base-2 ①② | 三格走通；触发后先确认再继续 |
| W6 | 无有效上下文时明确提示 | PB-Base-2 ③ | 不静默失败，给出明确提示 |
| W7 | 真机端到端跑一次 `/claudedream`（Review demo 素材） | PB-Base-1+2 | 走完三格，DoD「功能可用」达标 |
| W8 | 语义触发薄版：`description` 写窄触发短语；去掉 `disable-model-invocation`；真机验证「开始做梦」能跳入 | PB-Auto-1.1 | 自然语言能跳入同一入口 |

---

## 四 · 先验认识

> Planning 中确认的技术事实（全部来自 Claude Code 官方文档 `claude-code-docs` MCP，非推测）、PO 拍板、以及已登记的风险。开发中遭遇冲突时，以此节为准复核。

### 4.1 技术事实

| 主题 | 结论 |
|---|---|
| Manifest | `.claude-plugin/plugin.json`，可选但推荐；必需字段 `name`；建议加 `version`（否则 git 每次 commit 算新版本）、`description`。 |
| 入口机制 | 「命令」已合并进 skills。`skills/claudedream/SKILL.md` → 命令 `/claudedream`（插件命名空间前缀视安装名而定）。SKILL.md 正文在触发时作为一条消息注入对话。 |
| 命令 vs 语义触发 | `disable-model-invocation: true` = 仅用户可 `/` 触发（纯手动）；去掉它 = Claude 可依 `description` 自动识别（语义触发）。**本 Sprint 去掉它以支持薄版语义触发。** |
| 路径变量 | `${CLAUDE_PROJECT_DIR}` = 项目根（需 CC v2.1.196+）；`${CLAUDE_PLUGIN_ROOT}` = 插件安装目录。 |
| transcript 路径 | ⚠️ **无官方路径变量**。约定形态 `~/.claude/projects/<项目 id>/*.jsonl`。本 Sprint 只要求 W4 **推断出路径**，不解析内容（内容解析是 PB-Base-5）。 |

### 4.2 PO 三处拍板

① 触发语法用 `/claudedream`（`run claudedream` 措辞已在 Product Backlog 全局同步为 `/claudedream`）；② transcript「能推断出路径即可」；③ 语义触发做「能识别」的薄版（编号 PB-Auto-1.1）。

### 4.3 Impediment / 风险登记

| # | 事项 | 状态 | 应对 |
|---|---|---|---|
| R1 | transcript 目录无官方路径变量 | 已识别 | W4 降级为「推断路径」，风险已控；内容解析留 PB-Base-5 |
| R2 | 语义触发薄版无防误触发设计 | 已接受 | `description` 写窄触发短语降低误触率，不承诺零误触；完整方案待 PB-Auto-1 补 IDEO |
| R3 | Product Backlog 措辞 `run claudedream` 与本 Sprint `/claudedream` 不一致 | ✅ 已解决 | PO 拍板统一为 `/claudedream`，Product Backlog 已同步（Product Goal / PB-Base-1 / PB-Base-2） |

---

## 五 · Definition of Done

摘抄自 [全局 DoD](../DefinitionOfDone.md)（PO 已认可）。一条 PBI 达到 DoD 才算完成、才能进 Sprint Review；否则退回 Product Backlog。

| 类别 | 完成项（每条增量必须满足） | 如何验证 |
|---|---|---|
| 功能可用 | `run claudedream` 端到端跑通，不半途失败 | 在一次真实会话上实跑一遍 |
| 记忆质量 | frontmatter 完整（含 sources 双源：session id + git commit hash）；用绝对日期；冲突时保留旧内容 + superseded 标注 | 输出文件逐条对照 |
| 信任边界 | 不编辑 CLAUDE.md；不存 repo 已有内容 | diff 检查 |
| 可审阅 | 生成变更摘要报告 | 报告存在 |
| 索引一致 | `MEMORY.md` 索引与实际记忆文件一致（无断链 / 漏项） | 索引核对 |

**本 Sprint 适用性说明**：下游为空 → 「记忆质量」类暂无落盘对象，本 Sprint 不适用；其余 4 类（功能可用 / 信任边界 / 可审阅 / 索引一致）在 W7 验收时对照。
