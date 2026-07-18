# Sprint 2 — 完整读取管线（Read Pipeline）

> 本文件是 ClaudeDream 第二个 Sprint 的 **Sprint Backlog**（Scrum 工件）：Sprint Goal（为什么）+ 选中 PBI（做什么）+ 工作项分解（怎么做）。
>
> 关联工件：[Product Backlog](../ProductBacklog.md) · [Definition of Done](../DefinitionOfDone.md) · [Architecture](../Architecture.md) · 上一 Sprint [Sprint 1 Review](../sprint-01-walking-skeleton/SprintReview.md)
>
> 开始日期：2026-07-19。Planning 由 Developer（pawn）主持，Sprint Goal 方向、scope 全纳入、新条目编号（PB-Base-5.1）、测试环境两段式均由 PO（seapawn）拍板。
>
> **落盘约定**：本 Sprint 的所有产出文件都放在本文件夹 `sprint-02-read-pipeline/` 下。

---

## 一 · Sprint Goal

> **让 ClaudeDream 的下游第一次真正「读到东西」——把 Sprint 1 的空占位替换成一条完整的四路读取管线：确认项目 → 读项目状态（项目地图 + git 轨迹）→ 读记忆基线 → 解析对话内容 → 汇总成一份**当前背景上下文**（三项读到的内容原样拼装，不做摘要压缩），让下游编译层（C）直接处理这份上下文、开始找记忆变更，不必回翻原始数据。**

- **为什么有价值**：Sprint 1 的骨架只做到「推断出四条路径」，下游拿到的是空占位。没有真实、有深度的读取输入，编译层（PB-Base-7 起）判定「该记什么」就是无米之炊。读取阶段是整条编译管线的唯一入口地基——它做扎实，C 才有可能被验证。
- **本 Sprint 的深化点（区别于 Sprint 1「太简单」）**：
  - **对话读取**不再浅尝单个原始 jsonl，而是覆盖「自上次做梦以来所有未处理会话」，并借成熟工具（`claude-code-log`）做**代码级降噪**，产出干净对话流——契合 DesignReview「确定性层做降噪、语义层做判断」原则。
  - 每一路都要求**读出内容**，不是打印路径。
- **可 demo**：Sprint Review 真机跑一次，下游打印出的当前背景上下文里确实有项目背景、git 变更、现有记忆内容、多会话对话要点——每一路都是「读出来的内容」。
- **凝聚性**：一个目标（完整读取阶段），对应 [Architecture](../Architecture.md) 里 READ（Target B）一整个 subgraph，可整体交付。

---

## 二 · 选中的 PBI

摘抄自 [Product Backlog](../ProductBacklog.md) 待做区顶部四条，加一条本 Sprint 新立项（PB-Base-5.1）。scope = 全部纳入（PO 拍板）。

| 编号 | 标题（size） | 用户故事 | Acceptance Criteria | 依赖 | 状态 |
|---|---|---|---|---|---|
| PB-Base-5.1 | 对话读取工具接入（S·探路） | 作为 Developer，我想确定 `claude-code-log` 用哪种方式接入插件（pip 装 / vendored 自带），以便对话读取有一个稳定、可复现、低维护的代码级降噪底座。 | ① 实测插件 skill 执行环境下能否调用 `claude-code-log`（先 pip 路线，受阻则 vendored）；② 确定并落盘接入方式 + 调用命令模板；③ 用本项目真实 jsonl 验证 `--detail low --format md --compact` 产出干净对话流（剥掉工具噪音/大块 dump，保留对话交互）。 | 无 | 就绪 |
| PB-Base-5 | 对话内容解析（M） | 作为 Claude Code 用户，我想让 ClaudeDream 读到「自上次做梦以来所有未处理的会话」并转化成干净对话，以便下游拿到有意义的对话素材而非原始噪音。 | ① 用 PB-Base-5.1 的 python 工具把 jsonl 转化成降噪后的干净对话、再读入；② 覆盖多会话（非单个 jsonl）：**有游标**＝读「游标之后」的新会话（增量做梦）；**无游标**＝全量首读当前项目所有可见会话（首次做梦，非降级）；③ 能识别并保留 `/compact` 压缩摘要段（不当噪音丢弃）；④ **只读不判**——不做概念提取（提取归 C）。 | PB-Base-5.1、PB-Base-4 | 就绪 |
| PB-Base-3 | 项目状态感知（M） | 作为 Claude Code 用户，我想让 ClaudeDream 感知项目当前状态与变更轨迹，以便记忆能与项目同步、识别漂移。 | ① 读出项目地图文件内容（README / CLAUDE.md）；② 读出 git 轨迹（log + diff，取有意义的近期变更）；③ 输出项目背景 + 变更轨迹两块内容（读出的原文 / 轨迹，不压成摘要）；④ 只读不判。 | 无 | 就绪 |
| PB-Base-4 | 记忆基线读取（S） | 作为 Claude Code 用户，我想让 ClaudeDream 读出现有全部记忆作为比对基线，以便下游能判断新增/冲突/过时。 | ① 读出 `MEMORY.md` + 全部记忆文件内容；② 顺带取出「上次做梦游标」（供 PB-Base-5 界定会话范围）；**若无游标（首次做梦 / 无历史记忆）→ 明确标记为"无游标"，交由 PB-Base-5 走全量首读**；③ 输出记忆基线内容（记忆全文，供 C 逐字比对，不压成摘要）；④ 只读不判。 | 无 | 就绪 |
| PB-Base-6 | 汇总交接 C · 当前背景上下文（S） | 作为下游编译层（C），我想拿到一份把三项内容（项目状态 / 记忆基线 / 对话）原样拼装好的**当前背景上下文**，以便直接处理它、开始找记忆变更，不必回翻原始数据。 | ① 三项内容拼成一份当前背景上下文（**不摘要、不压缩**；对话已由 python 工具降噪，项目状态 / 记忆保留可用原文）；② 自包含——C 读这一份即可开工，不需回溯 jsonl / git / 记忆全文；③ 交接点替换 Sprint 1 的空占位。 | PB-Base-3、4、5 | 就绪 |

*小字说明：*
- *PB-Base-5.1 是本 Sprint 从 PB-Base-5 分化的新立项（PO 拍板编号 `.1`，遵循 Product Backlog 既有的分化约定：保父级、不冲击其它号）。它是对话读取的「工具接入前置」，带真实技术不确定性，故先做探路。*
- *四路读取的顺序逻辑（DesignMapping）：确认项目 → 项目背景 → git 轨迹 → 已有记忆 → 新对话 → 汇总，是从「在哪」到「发生了什么」到「已知什么」到「新出现了什么」的递进。*
- *AC 中的「只读不判」是 B/C 边界的定盘星（PO 确认）：B 只负责读取 + 降噪 + 拼装，概念提取（Extract）全部归 C。*
- *hash gate 边界（PO 澄清）：整条做梦流程前应有一道 hash 门——判定 hash：变化则进行、不变则跳过（省算力）。**本 Sprint 不做这道判定，全部通过**；hash 门属确定性前置门，对应 Product Backlog `PB-Comp-2`（延后），其描述待在 Product Backlog 层补精确。*

---

## 三 · 工作项分解（≤1 天/项）

> 顺序：先探路（W1-W3 定工具接入），再并行铺三路读取（W4-W7），最后汇总（W8）+ 换环境验证（W9-W10）。探路结果可能反向影响后续体量——见第四节风险 R1。

| # | 工作项 | 归属 | 验收信号 |
|---|---|---|---|
| W1 | 实测插件 skill 执行环境的 shell/PATH：`claude-code-log` 能否经 pip 装 + 调用（本机已确认有 Python 3.11 + pip、无 uv/uvx） | PB-Base-5.1 ① | 明确「能调用/不能」的实测结论，非假设 |
| W2 | 定接入方式（pip 装 / vendored 自带）+ 落盘调用命令模板 | PB-Base-5.1 ② | 接入方式写入本文档 + skill 可复现调用 |
| W3 | 本项目真实 jsonl 验证 `--detail low --format md --compact` 输出干净对话流 | PB-Base-5.1 ③ | 输出剥噪、保留对话交互，人工核对 OK |
| W4 | 读项目状态：项目地图（README/CLAUDE.md）内容 + git log/diff 近期轨迹 | PB-Base-3 ①②③ | 打印出项目背景 + 变更轨迹两块内容 |
| W5 | 读记忆基线：`MEMORY.md` + 全部记忆文件内容 | PB-Base-4 ①③ | 打印出记忆基线内容，条目齐全 |
| W6 | 取「上次做梦游标」：从记忆 frontmatter（`originSessionId` / `modified`）推断上次处理到哪；**无记忆 / 无游标 → 返回"无游标"标记（触发 W7 全量首读）** | PB-Base-4 ② | 得到「游标」或明确的「无游标」两态之一 |
| W7 | 对话解析：用 W2 工具按 W6 游标读多会话（有游标＝游标后；无游标＝全量首读）→ 干净对话；识别保留 compact 摘要段 | PB-Base-5 ①②③ | 两种范围模式都跑通 + 降噪 + compact 段保留 |
| W8 | 汇总：项目状态 / 记忆基线 / 对话三项内容 → 拼成一份当前背景上下文（不摘要），替换 Sprint 1 空占位 | PB-Base-6 ①②③ | 交接点输出自包含上下文，C 无需回溯 |
| W9 | 把 claude-dream 插件装到 **DiaryAgent** 项目（换环境） | 全部（验证） | 插件在 DiaryAgent 被识别、命令可唤起 |
| W10 | 真机端到端：在 DiaryAgent 跑一次完整读取管线（Review demo 素材） | 全部（验证） | 当前背景上下文在真实异构项目上产出，DoD 达标 |

*小字：W1-W3 是探路闭环，先跑通再动 W4+；W4/W5/W6 之间无强依赖，可并行；W7 依赖 W2（工具）+ W6（游标）；W8 依赖 W4/W5/W7；W9-W10 是「换环境」最终验证，本项目探路验完再做（PO 拍板两段式）。*

---

## 四 · 先验认识

> Planning 中确认的技术事实（本机实测 + 参考项目源码阅读 + DesignReview 结论）、PO 拍板、风险登记。开发中遭遇冲突时以此节为准复核。

### 4.1 技术事实

| 主题 | 结论 | 来源 |
|---|---|---|
| claude-code-log 定位 | Python 库，把 Claude Code transcript jsonl 转成可读 HTML/Markdown。`--detail` 五档（full/high/low/minimal/user-only）+ `--compact` 做降噪；README 明说 `--detail low --format md --compact` 就是「喂给下游 LLM 的 condensed Markdown」 | `reference/claude-code-log/README.md`、`models.py` `DetailLevel` |
| 与 B 边界契合 | 该工具只做「读取 + 降噪 + 结构化」，不做概念提取——天然卡在 B/C 边界（B 只读不判）上 | 源码：无 Extract 语义 |
| 多会话 / 压缩识别 | 支持项目级目录聚合、跨会话时间排序、`--from-date/--to-date` 自然语言过滤；能解析 `/compact` 边界（`CompactedSummaryMessage` / `compact_boundary`） | `models.py` |
| 本机运行时（实测 2026-07-19） | ❌ 无 `uv`/`uvx`（含常见安装路径）；✅ 有 Python 3.11.5 + `pip`/`pip3`（在 PATH）+ `py` launcher。→ **uvx 一行方案当场否掉**，接入收敛为 pip 装 / vendored 两选一 | git-bash 实测 |
| ⚠️ 残余不确定性 | ~~上述 PATH 是 git-bash 的；插件 skill 执行时的 shell 环境可能不同~~ → ✅ W1 已解除：skill 环境与 git-bash 一致，Python 3.11.5 + pip 均可用 | — |
| W1 实测结论（2026-07-19） | ✅ `claude-code-log` v1.5.0 **已全局安装**（pip editable install，文件在 site-packages），`PATH` 可见、命令可直接调用。**不需要重新安装、不需要 vendored**。接入方式：`claude-code-log <dir> --detail low --format md --compact -o -`（stdout 输出、stderr 分离） | 本会话实测 |
| W2 接入方式 | **直接 CLI 调用**。命令模板：`claude-code-log "$TRANSCRIPT_DIR" --detail low --format md --compact -o - 2>/dev/null`。已落盘于 [SKILL.md](../../claude-dream/skills/claude-dream/SKILL.md) 格 3.3 | — |
| W3 降噪验证 | ✅ 277KB jsonl：`full` 4,452 行 → `low` 79 行（**98.2% 降噪**）；6MB jsonl → 2,678 行干净对话。compact 模式下 `<summary>`（/compact 摘要段）保留。`--detail low` 剥除工具调用噪音、保留对话交互+WebSearch/WebFetch/Task——输出即「喂给下游 LLM 的 condensed Markdown」 | 本会话实测 |
| ⚠️ `--from-date` ISO 格式偏差 | `--from-date "2026-07-19"` 仅返回 header（4 行），同日自然语言 `"today"` 返回 10,605 行。dateparser 对 ISO 日期（YYYY-MM-DD）解析有时区/零点偏差。**对策**：游标日期向前偏移一天（`date -d "$CURSOR_DATE -1 day"`）或改用自然语言；偏差在 1 天内，对本 Sprint「增量做梦」精度无实质影响 | 本会话实测 |
| 对话素材充分性 | `~/.claude/projects/d--ClaudeDream/` 下 **39 个 jsonl**（1.5KB–6MB），全量 `--detail low` 输出 ~10,600 行干净 Markdown——充分验证「多会话 + 大文件降噪」 | 实测 |
| 上次做梦游标 | 无现成机制。约定从记忆文件 frontmatter 的 `modified` / `originSessionId` 推断上次处理边界——本 Sprint W6 落地。实测：最新 `modified` = `2026-07-18T18:42:56.867Z`，游标推断可用 | DoD「双源追踪」延伸 |
| W9 DiaryAgent 插件加载 | ✅ 真机验证通过：`claude --plugin-dir /d/ClaudeDream/claude-dream -p "/claude-dream"` 在 `/f/DiaryAgent` 项目上成功加载插件、skill 被命中、四格流程全部执行 | 本会话 headless 实测 |
| W10 DiaryAgent 端到端 | ✅ 真机验证通过：格 2 路径解析正确（`f--DiaryAgent`）、格 3.1 读到 README+CLAUDE.md+git 10 commits、格 3.2 正确返回冷启动（无记忆基线）、格 3.3 全量首读 8 会话降噪对话、格 4 汇总框完整展示设计决策轨迹。有游标增量（ClaudeDream）和无游标全量首读（DiaryAgent）两种模式各覆盖一次 | 本会话 headless 实测 |

### 4.2 PO 拍板

① Sprint Goal 方向＝完整读取管线，「完整」标准＝读出内容 + 多会话覆盖 + 代码级降噪；② scope＝5 条 PBI 全部纳入；③ 新条目编号＝`PB-Base-5.1`（从 5 分化）；④ 测试环境两段式＝先在 ClaudeDream 本项目探路定稿，再装到 DiaryAgent 做换环境最终验证；⑤ 工具接入独立成 PB、可分阶段细化。

### 4.3 Impediment / 风险登记

| # | 事项 | 状态 | 应对 |
|---|---|---|---|
| ~~R1~~ | ~~探路结果反向影响后续体量~~ | ✅ 已关闭 | pip 路线在 skill 环境可用，无需 vendored，scope 不变 |
| ~~R2~~ | ~~插件 skill 执行环境的 shell/PATH 未必等于 git-bash 探测结果~~ | ✅ 已关闭 | W1 实测确认：skill 环境与 git-bash 一致，Python 3.11.5 + pip 均可用 |
| ~~R3~~ | ~~vendored 代价~~ | ✅ 已关闭 | 无需 vendored——claude-code-log 已全局安装、可直接调用 |
| R7 | `--from-date` ISO 格式有时区/零点偏差（`"2026-07-19"` 仅返回 4 行，`"today"` 返回 10,605 行） | 已识别 | 游标日期向前偏移一天或改用自然语言；偏差 ≤1 天，对增量做梦精度无实质影响 |
| R4 | 「上次做梦游标」无现成机制，靠 sources 推断，可能不精确 | 已接受 | 本 Sprint 先做能用的推断（W6）；精确化留后续 |
| ~~R5~~ | ~~DiaryAgent 异构项目兼容性~~ | ✅ 已关闭 | DiaryAgent 端到端全通：README/CLAUDE.md/git 格式兼容、jsonl 6 个全可处理、冷启动路径正确。跨项目可用性验证通过 |
| ~~R6~~ | ~~首次做梦无游标~~ | ✅ 已关闭 | DiaryAgent 确为零记忆冷启动，W6 正确返回"无游标"→ W7 正确走全量首读。ClaudeDream（有基线增量）+ DiaryAgent（首次全量）两种模式各覆盖一次 |

## 五 · Definition of Done

摘抄自 [全局 DoD](../DefinitionOfDone.md)（PO 已认可）。一条 PBI 达到 DoD 才算完成、才能进 Sprint Review；否则退回 Product Backlog。

| 类别 | 完成项（每条增量必须满足） | 如何验证 |
|---|---|---|
| 功能可用 | `/claude-dream` 端到端跑通，不半途失败 | 在一次真实会话上实跑一遍 |
| 记忆质量 | frontmatter 完整（含 sources 双源：session id + git commit hash）；用绝对日期；冲突时保留旧内容 + superseded 标注 | 输出文件逐条对照 |
| 信任边界 | 不编辑 CLAUDE.md；不存 repo 已有内容 | diff 检查 |
| 可审阅 | 生成变更摘要报告 | 报告存在 |
| 索引一致 | `MEMORY.md` 索引与实际记忆文件一致（无断链 / 漏项） | 索引核对 |

**本 Sprint 适用性说明**：本 Sprint 交付的是**读取阶段**——只读不判、不写记忆（写入是 PB-Base-11、编译是 PB-Base-7+）。因此：
- **「功能可用」**：判据调整为「读取管线端到端跑通、当前背景上下文成功产出」，而非写记忆。**验证方式**：ClaudeDream 项目（本会话逐命令验证）+ DiaryAgent 项目（headless 真机：`claude --plugin-dir ... -p "/claude-dream"` 完整跑通四格流程）。
- **「记忆质量」「信任边界（不存 repo 已有）」「可审阅」「索引一致」**：本 Sprint **无记忆落盘对象**，暂不适用（与 Sprint 1 同理）。
- **「信任边界（不编辑 CLAUDE.md）」**：仍适用——读取阶段绝不改任何被读文件，只读。
- 换环境验证（W9-W10）在 DiaryAgent 上确认「功能可用」判据。



