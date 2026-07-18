# Sprint 4 — 编译层落盘（Target C · Compile & Write）

> 本文件是 ClaudeDream 第四个 Sprint 的 **Sprint Backlog**（Scrum 工件）：Sprint Goal（为什么）+ 选中 PBI（做什么）+ 工作项分解（怎么做）。
>
> 关联工件：[Product Backlog](../ProductBacklog.md) · [Definition of Done](../DefinitionOfDone.md) · [Architecture](../Architecture.md) · 上一 Sprint [Sprint 3 Review](../sprint-03-portability-acceptance/SprintReview.md)
>
> 开始日期：2026-07-19。Planning 由 Developer（pawn）主持；Sprint Goal 由 pawn 定、scope = PB-Base-7/8/9/10/11/12/13 七条，均由 PO（seapawn）拍板（12/13 正式纳入，因 C 首次写记忆时 DoD「可审阅/索引一致」两条底线首次生效）。
>
> **落盘约定**：本 Sprint 的所有产出文件都放在本文件夹 `sprint-04-compile-write/` 下。

---

## 一 · Sprint Goal

> **让 ClaudeDream 第一次真正「写下东西」——把 Target B 产出的「当前背景上下文」经过一条编译链落盘成项目记忆：Gate 排噪 → Extract 提概念 → 每个概念 × 全部记忆交叉印证、判定四分类（新增🆕/冲突⚡/过时🗑️/重复🔁）→ 带 ClaudeDream 原创防腐机制（双源追踪 / superseded / git 漂移标注）写/改/删记忆文件。三个 Sprint 只读之后，这是产品第一次动手写记忆，兑现「使 agent 免于腐烂」。**

- **为什么有价值**：B 的读取地基已扎实，但没有 C，读到的东西全部丢弃——产品价值为零。C 是整个 ClaudeDream 的命门（Design Sprint 原话）。跑通它，「手动形态」的 MVP 才第一次端到端完整。
- **凝聚性**：一个目标（编译落盘），对应 [Architecture](../Architecture.md) 里 COMPILE + CLASSIFY 两个 subgraph，落地为 SKILL.md 一段新流程，可整体交付。
- **可 demo**：Sprint Review 真机跑一次 `/claude-dream`——读取管线跑完后，C 接手，在项目记忆目录里**真实写下/更新至少一条记忆文件**，frontmatter 带双源，冲突条目带 superseded，并打印一份「改了什么、为什么」的变更摘要。

---

## 二 · 选中的 PBI

摘抄自 [Product Backlog](../ProductBacklog.md) 待做区 C 编译链前七条（PO 拍板 7 条）。七条实为「一段 compile 流程的七个维度」而非七个独立功能——compiler 的 compile 本就是「Gate→Extract→判定→写文章→更新 index→追加 log」一次 LLM 调用做完——凝聚度高、可整体交付。

| 编号 | 标题（size） | 用户故事 | Acceptance Criteria | 依赖 | 状态 |
|---|---|---|---|---|---|
| PB-Base-7 | Gate 硬约束排除（S） | 作为 Claude Code 用户，我想让 C 在提取前先滤掉不值得记的噪音，以便记忆只沉淀真正有价值的信息、不被流水账淹没。 | ① 落盘一份**硬约束排除清单**（借鉴 auto-memory + compiler `flush.py`：跳过例行工具调用/文件读取、琐碎寒暄、"我同意""明白"类临时交流、IDEO/Scrum 方法论等工具知识、**repo 已有内容**、CLAUDE.md 已覆盖内容）；② 清单写进 SKILL.md 的 compile 段 prompt；③ 借用 compiler 的 **sentinel 契约**：若整段上下文无一可记，明确输出「无可记」而非硬造记忆。 | 无（B 的当前背景上下文为输入） | 就绪 |
| PB-Base-8 | Extract + Cross-Reference（M） | 作为 Claude Code 用户，我想让 C 从降噪对话里提取值得记的概念、并把每个概念与全部已有记忆逐一印证，以便识别这条到底是新知、还是碰到了旧记忆。 | ① Extract：从当前背景上下文提取 **3–7 个**离散概念（借鉴 compiler 基数上限，避免过度切碎）；② Cross-Reference：把**全部已有记忆文件原文灌入上下文**（compiler「whole-KB-in-context」打法），每个概念 × 全部记忆做印证；③ git 漂移印证：结合项目状态里的 git 轨迹，识别「被记忆引用的文件已变」→ 标记候选 stale；④ 只提取+印证，判定归 PB-Base-9。 | PB-Base-7 | 就绪 |
| PB-Base-9 | 四分类 + 生命周期（M） | 作为 Claude Code 用户，我想让 C 把每个概念判成新增/冲突/过时/重复四类，以便记忆能自我更新而非只会追加。 | ① 四分类判定：🆕Create / ⚡Update(含冲突) / 🗑️Delete(对话推翻或 git 漂移确证) / 🔁Skip(重复)；② 每类给出**判定理由**（对标原型 execution-log 的判定表）；③ **保守删除**：删除只在对话明确推翻或 git 明确漂移时执行，拿不准→降级为 Update+标注（auto-dream「删错 > 留错」）；④ **更新优于新建**（compiler 硬约束）。⚠️ 参考项目**无写入时四分类器**（只有事后 lint 矛盾检测）——本条是对 compiler 的**改进**，须本 Sprint 亲手验、不能假设有现成实现。 | PB-Base-8 | 就绪 |
| PB-Base-10 | 原创机制 · 防腐涂料（M·横切） | 作为 Claude Code 用户，我想让写下的记忆带上来源与修正链、并能感知项目漂移，以便记忆随时间仍可信、不悄悄腐烂。 | ① **双源追踪**：frontmatter `sources` 同记 `originSessionId` + git commit hash（compiler 只记 session，本条是增强）；② **superseded 标注**：冲突更新时保留旧内容 + 打「⚡ superseded <绝对日期>: <原因>」修正链；③ **git 漂移标注**：被 git diff 证实过时的记忆 → 打「⚠️ possibly stale: <file> changed <date>」。**本条无独立一格**——三样分别挂靠在 8(git 漂移)/9(superseded)/11(双源)上验收。 | 随 8/9/11 一起落地 | 就绪 |
| PB-Base-11 | 写 / 更新 / 删记忆文件（S） | 作为 Claude Code 用户，我想让 C 把判定结论真正落盘成记忆文件，以便下一次会话的 agent 能读到更新后的记忆。 | ① 按 PB-Base-9 的四分类真实 Write/Edit/(保守)Delete 记忆文件；② frontmatter 完整（name/description/type/**双源 sources**/created，含 PB-Base-10 ①）；③ 至少一条 `[[wikilink]]` 关联相关记忆（compiler 质量规则）；④ **落盘后更新游标**（写 `modified` 时间戳 + `originSessionId`，闭合 Sprint 2 PB-Base-4 留的游标 gap）；⑤ 信任边界：绝不编辑 CLAUDE.md、不存 repo 已有内容。 | PB-Base-9、10 | 就绪 |
| PB-Base-12 | MEMORY.md 索引维护（S） | 作为 Claude Code 用户，我想让 C 写完记忆后同步更新 MEMORY.md 索引，以便新会话的 agent 能高效加载、且索引与实际记忆文件不脱节。 | ① 每条新增/更新/删除的记忆文件 → MEMORY.md 索引对应一行一条同步（新增补行、删除撤行、改动更新 hook 描述）；② 索引与实际文件**无断链、无漏项**（DoD「索引一致」判据）；③ 沿用既有 MEMORY.md 格式（`- [标题](file.md) — 一句钩子`），不引入新格式。 | PB-Base-11（随写入同批产出） | 就绪 |
| PB-Base-13 | 变更摘要报告（S） | 作为 Claude Code 用户，我想在每次做梦后拿到一份「改了什么、为什么」的摘要，以便审阅 C 这轮到底动了哪些记忆、依据是什么。 | ① 输出一份变更摘要：本轮 🆕Create / ⚡Update / 🗑️Delete / 🔁Skip 各条 + **每条的理由**（对 compiler log.md 的改进——补上参考项目缺的 why 字段）；② 记录本轮双源（session id + git hash）作为审计锚点；③ 摘要呈现给用户即可（是否 append 落盘到变更日志文件，W8 定）。 | PB-Base-9、11 | 就绪 |

*小字说明：*
- *C 落地为 SKILL.md 中 B 格 4 之后**新增的一段 compile 流程**（对标 compiler：单次 agent 调用 + `acceptEdits`，Prompt 承载 Gate/Extract/判定/写入/索引/摘要指令）。七条 PBI = 这段流程的七个维度，不是七段独立代码。*
- *判定链强依赖：7→8→9→11 顺序不可乱；10 是横切进 8/9/11 的防腐层，没有独立完成时刻，验收挂靠宿主 PBI；12（索引）、13（摘要）是 11 写入的同批**收尾产出**（compiler 里写文章+更新 index+追加 log 本就一次做完）。*
- ***设计来源主次**：七条 PBI 的设计权威来源是 [.IDEO TargetMapping.md](../../.IDEO/DesignSprint/target-c-comprehensive-judgment/TargetMapping.md)（ClaudeDream 自己的 C 设计蓝图，含 Gate/Compile/Classify/Output 完整流程图）和 [原型 execution-log](../../.IDEO/DesignSprint/target-c-comprehensive-judgment/prototype/execution-log.md)（实跑验证记录）。`reference/claude-memory-compiler` 是**实现借鉴**——提供 sentinel 契约、whole-KB-in-context、frontmatter schema 等具体做法；ClaudeDream 在 .IDEO 设计的基础上借鉴它、并在四分类判定/双源追踪/superseded 等处超越它。*
- *B/C 边界（Sprint 2 反哺约束）：C 以 B 产出的 agent 上下文 + `.claude-dream-context.md` 为唯一输入，不回溯原始 jsonl/git/记忆全文之外的数据源。*

---

## 三 · 工作项分解（≤1 天/项）

> C 落地为 SKILL.md 一段 compile 流程 + 一份 Gate 清单。

| # | 工作项 | 归属 | 验收信号 |
|---|---|---|---|
| W1 | 落盘硬约束排除清单（借鉴 auto-memory + compiler flush.py 三条 + repo 已有/CLAUDE.md 排除）+ sentinel「无可记」契约 | PB-Base-7 ①②③ | 清单成文、写进 SKILL.md compile 段 |
| W2 | 写 Extract prompt 段：从当前背景上下文提 3–7 概念（compiler 基数上限） | PB-Base-8 ①④ | 真机跑出离散概念列表，数量受控 |
| W3 | 写 Cross-Reference prompt 段：全部记忆原文灌入 + 每概念×全记忆印证 + git 漂移候选标记 | PB-Base-8 ②③ | 印证结果指出每个概念碰到哪条旧记忆 |
| W4 | 写四分类判定 prompt 段：🆕⚡🗑️🔁 + 逐条理由 + 保守删除 + 更新优于新建 | PB-Base-9 ①②③④ | 产出判定表（对标原型 execution-log） |
| W5 | 防腐涂料落到 prompt：双源 sources 模板 + superseded 模板 + possibly-stale 模板 | PB-Base-10 ①②③ | 三个标注模板可被 W6 直接套用 |
| W6 | 写入执行段：按判定 Write/Edit/(保守)Delete + 完整 frontmatter + wikilink + 更新游标；信任边界护栏 | PB-Base-11 ①②③④⑤ | 真机在记忆目录写下/更新 ≥1 文件，游标刷新 |
| W7 | 写收尾段：MEMORY.md 索引同步（新增补行/删除撤行/改动更新 hook）+ 变更摘要输出（含每条理由 + 双源锚点）| PB-Base-12 ①②③ + PB-Base-13 ①②③ | MEMORY.md 无断链/漏项；变更摘要含理由，呈现给用户 |
| W8 | **本项目干跑**：在 ClaudeDream 上跑完整 `/claude-dream`（B 读取 → C 编译落盘），人工核对四分类与写入正确 | 全部（探路） | 端到端跑通，记忆增量正确、frontmatter 达标、MEMORY.md 同步、摘要可读 |
| W9 | 把最新 claude-dream 插件同步到 **DiaryAgent**（换环境） | 全部（验证） | 插件在 DiaryAgent 可唤起、含 C 段 |
| W10 | **换环境端到端**：DiaryAgent 真机跑一次，冷启动路径下 C 写下首批记忆（Review demo 素材） | 全部（验证） | 异构项目上记忆落盘 + MEMORY.md 同步 + 变更摘要，DoD 达标 |

*小字：W1→W7 是 compile 流程逐段构建（判定链：W1→W2→W3→W4→W6；W5 横切；W7 是写入的同批收尾，与 W6 同次 compile 产出）；W8 本项目干跑；W9-W10 换环境最终验证，两段式（W8 验「有基线增量」、W10 验「冷启动首写」）。*

---

## 四 · 先验认识

> Planning 中确认的技术事实（reference 源码勘探 + 原型记录 + DesignReview）、PO 拍板、风险登记。开发中遭遇冲突以此节为准复核。

### 4.1 技术事实（来自 compiler 源码勘探）

| 主题 | 结论 | 来源 |
|---|---|---|
| compile 是单次 LLM 一气呵成 | compiler `compile.py` 构造一个大 prompt 交给 agent，`allowed_tools=[Read,Write,Edit,Glob,Grep]` + `permission_mode=acceptEdits`，LLM 自己写文章/改 index/追加 log；Python 只写 state.json。C 应照此形态：一段 prompt 承载全部 | `compile.py:132-140` |
| Gate 硬约束 | compiler 的排除清单在 flush 侧、仅 3 条（例行工具调用/琐碎内容/寒暄），用 sentinel `FLUSH_OK` 表示「无可记」。ClaudeDream 的 Gate 可更强（加 repo 已有 + CLAUDE.md 排除） | `flush.py:105-111,229` |
| Extract 基数 | compiler 指令「提取 **3-7 个**值得单独成文的概念」，无打分规则，靠模型判断 + 基数上限防过碎 | `compile.py:94` |
| 交叉印证打法 | **whole-KB-in-context**：把全部已有文章原文灌进 prompt，模型在全局视野下自行调和。适用 50-2000 条规模（ClaudeDream 当前 6 条，远未触顶） | `compile.py:52-63`、`utils.read_all_wiki_content()` |
| ⚠️ 无写入时四分类器 | **参考项目不做** new/冲突/过时/重复 四分类；只有事后 `lint.py` 的 LLM 矛盾检测（detection-only，不自动解决）。四分类是 ClaudeDream 对 compiler 的**改进**，须本 Sprint 亲验 | `lint.py:148-211` |
| frontmatter 必填 | compiler 硬最小集 `title, sources, created, updated`；`created/updated` 由模型自填（可靠性风险，需 prompt 强约束）。ClaudeDream 增 git hash 到 sources（双源） | `AGENTS.md:284` |
| index 格式 | 一行一条表格 `\| [[link]] \| 摘要 \| 来源 \| 日期 \|`，模型自己维护。对标 ClaudeDream 的 MEMORY.md | `AGENTS.md:90-96` |
| log 格式 | append-only 时间戳块，记 created/updated 列表；**无 why 字段**（理由在上游 daily log）。ClaudeDream 变更摘要应含理由 | `compile.py:106-112` |
| 幂等游标 | compiler 用 `state.json` 存每源文件 SHA-256 前 16 位，hash 未变则跳过——对标 ClaudeDream 未来 hash gate（PB-Comp-2，本 Sprint 不做） | `compile.py:154-197` |

### 4.2 PO 拍板

① scope = PB-Base-7/8/9/10/11 五条；12/13 加进 → 七条；② 「聊透 10/11」：10 的作用＝让记忆不腐烂的三样防腐机制（双源/superseded/git 漂移），11 毋庸置疑纳入；③ Sprint Goal 由 pawn 定；④ 过期工件（旧 plan、旧 MEMORY.md）PO 明确「不用管」；⑤ Sprint 3 Retrospective 明确豁免。

### 4.3 Impediment / 风险登记

| # | 事项 | 状态 | 应对 |
|---|---|---|---|
| R1 | **写入时四分类器是 compiler 所无的改进**，判定质量（尤其冲突/过时）无参考实现兜底，可能判错 | 已识别 | W4 本项目干跑人工核对判定表；保守删除（拿不准→Update+标注）兜底；判定深化留 PB-Comp-1 |
| R2 | 首次真正写磁盘：删错记忆 / 误编辑 CLAUDE.md / 存了 repo 已有内容——信任边界破防 | 高·已识别 | W6 加信任边界护栏；DoD「信任边界」逐条 diff 检查；保守删除原则；独立验证（subagent/PO）把关 |
| R3 | `created/updated/游标` 由 LLM 自填，可能漏填或格式漂移 | 已识别 | prompt 强约束 + W7 逐条对照 frontmatter；游标刷新单独验 |
| R4 | DoD「可审阅（变更摘要）」「索引一致（MEMORY.md）」本 Sprint **首次生效**，对应 PB-Base-12/13 | ✅ 已解决 | PO 拍板：正式纳入 7 条 scope，与 11 同批交付 |
| R5 | whole-KB-in-context 未来随记忆增长触顶（~2000 条） | 已接受 | 当前 6 条远未触顶；规模化留 PB-Scale-1 |
| R6 | DiaryAgent 冷启动首写 vs 本项目有基线增量，两条路径行为可能不同 | 已识别（特性） | 沿用两段式：W8 本项目验增量、W10 DiaryAgent 验冷启动首写 |

## 五 · Definition of Done

摘抄自 [全局 DoD](../DefinitionOfDone.md)（PO 已认可）。一条 PBI 达到 DoD 才算完成、才能进 Sprint Review；否则退回 Product Backlog。

| 类别 | 完成项 | 本 Sprint 适用性 |
|---|---|---|
| 功能可用 | `/claude-dream` 端到端跑通不半途失败；≥2 异构项目真机实跑（本项目 + DiaryAgent，冷/热启动均覆盖） | ✅ **首次完整适用**——C 写记忆是产品第一次「功能可用」的真义 |
| 记忆质量 | frontmatter 完整（双源 sources：session id + git hash）；绝对日期；冲突保留旧内容 + superseded | ✅ **首次生效**——PB-Base-10/11 直接对应 |
| 信任边界 | 不编辑 CLAUDE.md；不存 repo 已有内容 | ✅ 完整适用（首次写磁盘，硬约束） |
| 可审阅 | 生成变更摘要报告（含每条理由） | ✅ **首次生效**——PB-Base-13 正式纳入（PO 拍板） |
| 索引一致 | MEMORY.md 索引与实际记忆文件一致（无断链/漏项） | ✅ **首次生效**——PB-Base-12 正式纳入（PO 拍板） |
| 独立验证 | 所有条目通过判定不得执行者自评，由 subagent 或 seapawn 逐条检验 | ✅ 完整适用 |

**DoD 全部六类本 Sprint 首次完整生效**（PO 拍板：PB-Base-12/13 正式纳入，compiler compile 本就一次产出写文件+更新 index+摘要，技术上无冲突）。

### 验证方式

1. **本项目干跑（W8）**：在 ClaudeDream 执行 `/claude-dream`，B 读取跑完后 C 在 `~/.claude/projects/d--ClaudeDream/memory/` 真实写下/更新记忆文件。人工核对：四分类判定表合理、frontmatter 含双源、冲突带 superseded、MEMORY.md 同步、变更摘要含理由。
2. **换环境端到端（W10）**：DiaryAgent 真机跑一次，冷启动路径下 C 写下首批记忆 + MEMORY.md + 变更摘要。
3. **信任边界 diff 检查**：跑完后确认 CLAUDE.md 未被动过，无 repo 已有内容被复制进记忆。
4. **独立验证**：由 subagent 独立审计或 seapawn（PO）逐条对照 DoD 六类，自评不算数。
