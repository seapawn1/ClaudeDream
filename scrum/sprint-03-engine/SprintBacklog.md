# SprintBacklog · Sprint-3 引擎主干（纯机械梦）

Sprint-3 的 Sprint Backlog。Planning 定案 2026-08-15：主菜 PBI-02（引擎主干产品化），切口**纯机械梦先行**——LLM 层拆出为 PBI-07 接棒（见 [ProductBacklog.md](../ProductBacklog.md) 第二部分）。第一节 Why、第二节 What、第三节 How（Developers 填写）。

## 第一节 · Sprint Goal 与完成定义

### 1.1 Sprint Goal

> **梦不再是过场——纯机械梦上岗：零 API 成本跑真体检、真处置、真留证；熔断器让连删事故在结构上不可能；梦开工前先翻底片找用户留话。**

三个「真」的判定口径（验收对着量）：

- **真体检**：S6 跑的是 M1–M5 五条机械判据的真实检查（文件 I/O + git 取证），不再是「数一下记忆文件数量」的占位过场；判据须在种植腐烂的库上逐类检出、在健康库上零误报。
- **真处置**：S7 对体检结果执行真实处置——L0 随手修、确凿删除（仅 M4+git 讣告级证据开票）、L3 隔离（拿不准一律隔离不删，feedback 类永不自动删），不再是写一个 placeholder 文件。
- **真留证**：报告证据栏「从论证变记录」——每笔动作四要素齐全、证据指向落盘的执行日志（C2）；抽查点一律以梦前状态为基准、必须能失败、每笔删除内联死者遗言（C3）。

**范围切口**：本 Sprint 只做机械层。目标形态是 `llm_checks: off` 档位下整场梦**完整可用且零 API 依赖**——无登录态也能做梦（体检、处置、报告、提交全链不发起 SDK/网络调用）。S1–S3 LLM 判据、L1 合并/connection、L2 CLAUDE.md 阀门管辖划归 PBI-07；PBI-05/PBI-06 本轮不做（PO 定案）。

**架构前提（非 How 选择，AC 已决定）**：机械管线（判据/处置/熔断/G9 定向翻底片）全部由受信任代码直接执行——不发起 SDK `query()`、不经过模型工具调用、不受 canUseTool 裁决。这不是留给 Developers 的实现选项，是本节 AC 的直接推论：AC 要求零 API 与无登录态可跑，而 M4 判据需要 shell 出 `git log` 取证，现有 `scope-guard.judgeShell` 无条件拒绝一切 shell 命令——SDK/模型路径下这一步结构上做不到。Developers 的 How 空间在于这段受信任代码具体怎么组织（模块划分、执行顺序、错误处理），不在于选不选 SDK。

### 1.2 Definition of Output Done（抄自 [ProductBacklog.md](../ProductBacklog.md)，Sprint 内不得削弱、只能加强）

- [ ] D1 **跑给你看**：每个增量都带一个能一键重跑的验证（脚本或步骤清单），当场重跑、全绿才算完
- [ ] D2 **不破坏官方 auto-memory 契约**：一记一文件 + MEMORY.md 纯指针索引，增量改动后契约完好
- [ ] D3 **过审才算完**：增量完成后必须经独立 review——调用 review agent 或 PO 亲审，通过才算 Done
- [ ] D4 **绿灯点过烟**：凡「拦坏事」的自动检查（安全阀/白名单/冷却/防递归等守卫，及需特殊状况才触发的分支），上岗前故意造一次它该拦的坏情况、亲眼看它红过一次——从没红过的绿灯可能只是坏事没来过；从没真正跑过的分支不算已覆盖。普通正向断言（错了自己会红）不受此限
- [ ] D5 **接口自述随增量交付**：增量的全部对外接口（命令形状、adapter 键名、占位符、旗标、环境变量、source 指向）一律在公开的交付接口约定中声明齐全，验收与后续消费者只依声明接线

*验收若采用「出卷/答卷分离、卷面保密」形态，出卷方另守 ProductBacklog 第一部分第 4 节「验收流程约定」。*

## 第二节 · Sprint Backlog（选品与细化）

### 2.1 入选条目（抄自 ProductBacklog 第二部分原表）

| 编号 | 标题 | 产品意图 | 架构定位 | 当前状态 | size | 备注（依据） |
|---|---|---|---|---|---|---|
| PBI-02 | 引擎主干产品化（纯机械梦切口） | 原型验证过的体检与处置能真装进 Claude Code 用 | S6–S7 | Sprint-3 主菜施工中 | L（切口后待 Developers 重估） | M1–M5 判据、L0/确凿删除/L3 处置、熔断器从脚本变插件形态（Sketches、verdict §2）；C2/C3 随本条作 AC；**G9 后半**（梦 D3 定向翻底片找用户留话）随本条；S1–S3/L1/L2 拆出为 PBI-07；**C1（单笔精撤）后置**，整梦全撤（Sprint-1 已交付）兜底 |

### 2.2 细化拆条与 Acceptance Criteria（AC 初稿——PO 审阅通过后生效；sizing 与施工顺序归 Developers，见第三节）

拆条按依赖方向排列：配置打底 → 判据 → 处置 → 熔断 → 留证 → 回程。设计出处统一为 [Sketches.md](../.IDEO/design-sprint/Target-1-Consolidation/Prototype-01-FirstDream/Sketches.md)（判据表、处置权限模型、阀门配置模板、凭证形态）与 [verdict.md](../.IDEO/design-sprint/Target-1-Consolidation/Prototype-01-FirstDream/verdict.md)（C1–C7 改造原文、H/O 判据对账）。AC 只约定行为与对外接口（What），实现方式归 Developers（How）。

**贯穿条件（适用于以下全部条目）**：体检、处置、报告生成、git 提交、G9 定向翻底片——整条链路不发起任何 SDK/网络调用，这是本 Sprint 唯一的目标形态，不是判据条目独有的要求；任何子条目的实现都不得引入 API 依赖（含隐性依赖，例如为了"更聪明的匹配"而调用模型）。

#### PBI-02.1 阀门配置落地

*意图：三道安全阀与档位有真实的配置载体（Sketches「阀门配置汇总」定稿模板），不再靠零散环境变量。其余各条都消费本条。*

- AC1 用户在 `.claude/claude-dream.local.md` 写下 `enabled` / `llm_checks` / `delete_policy` / `max_deletes` / `claude_md_edits` / `cooldown_minutes` 六键中任意一键，对应档位行为随之生效；无配置文件或缺键时按既有默认值运行（`true` / `on` / `quarantine-first` / `3` / `true` / `30`——`cooldown_minutes` 默认值沿用代码现有 `DEFAULT_COOLDOWN_MINUTES`，不引入第二套默认值）。
- AC2 `enabled: false` 时会话结束照常落底片，但不拉梦——底片产线独立于梦开关。
- AC3 `llm_checks` 本轮 `on`/`off` 行为一致（LLM 层未交付）：`off` 是本 Sprint 交付的完整语义；`on` 时行为同 `off`，且报告阀门状态节如实标注「LLM 层待 PBI-07，本档位暂不生效」。
- AC4 配置文件优先于环境变量；环境变量仅供测试/临时注入覆盖，且覆盖生效时报告「阀门状态」节须标注「本次由环境变量覆盖：`<键名>`」——不允许静默覆盖。

*备注：`max_new_connections` 键（单梦限建 2 条 connection）消费者是 L1，随 PBI-07 引入，本轮不做。*

#### PBI-02.2 M1–M5 机械体检判据引擎

*意图：S6 体检从占位变真——五条机械判据零 API 落地（Sketches 判据清单机械层表）。架构前提见 1.1——本节判据由受信任代码直接执行，不经 SDK/模型。*

- AC1 M1 断链：`[[目标]]` / Related 指向的文件不存在 → 检出，每笔附出处（哪个文件的哪条引用）。
- AC2 M2 孤儿：全库链接图反查，无出链且无入链 → 检出；**库存 <15 条时整条禁用**（R3 冷启动保护），禁用状态如实入报告。
- AC3 M3 悬空溯源：frontmatter `sources:` 等溯源指向的日志/文件已消失 → 检出。
- AC4 M4 实体失效：正文引用的路径/函数/命令在当前项目 0 命中 → 记「候选」；候选须经 git 历史取证——该路径确有删除记录（讣告）→ 证据升「确凿」；查不到 → 保持「候选」（防改名误判）。两级证据在体检结果中可区分。
- AC5 M5 索引漂移：MEMORY.md 行集合与实际文件集合双向对账，两个方向的差集都检出并标记为可自动修复。
- AC6 零 API：五条判据全程不发起任何 SDK/网络调用，无登录态环境全链可跑。
- AC7 查准兜底：种植腐烂的沙箱中，健康记忆零误报（一键自证覆盖，对齐原型 H2「健康记忆零误删」标准）。

**已知连带影响（供 Developers 开工前确认，非本轮交付物）**：本轮机械管线不再发起 SDK `query()`，意味着 `CLAUDE_INVOKED_BY` 防递归标记、`dreamSessionIdsLog` 会话登记、backfill 对梦自身会话的排除——这三个既有机制在零 API 路径下没有子进程可作用，是「用不上」而非「失效」；PBI-07 恢复 SDK 调用路径后这三个机制需要继续完整可用，本轮改动不得误删或破坏它们。

#### PBI-02.3 机械处置层（L0 随手修 / 确凿删除 / L3 隔离）

*意图：S7 整合从占位变真——机械层能自主完成的处置全部落地，删除权被证据等级和档位双重锁死（Sketches 权限模型）。*

- AC1 L0 随手修：断链修复、补反链、索引双向对账修复、相对日期转绝对等可自动修复项自动执行，每笔进报告明细（四要素）。
- AC2 删除票只由 M4「确凿」级（讣告在案）开出；「候选」级及其他判据一律无删除权——铁律「LLM 无删除开票权」在纯机械梦下的等价表述：**无讣告，不删**。
- AC3 `delete_policy` 档位生效：默认 `quarantine-first` 下仅确凿票执行删除、拿不准一律隔离；`report-only` 下零删除动作，删除建议只进报告。
- AC4 L3 隔离：判据不足的条目以 `status: quarantined` 标记（含隔离原因与起始信息），原文原地完整保留、可逆——去掉标记即还原原状。
- AC5 feedback 类（用户亲口纠正过的记忆）**永不自动删除、永不自动进隔离**，只进报告「待你裁决」节；含 feedback 类腐烂的种植场景下该条毫发无损（一键自证覆盖，对齐 Sketches L3 处置规则与嫁接清单「feedback 类记忆永不自动删」；verdict O4 记「个人/feedback 侧本轮剧本未行使」——本条是初次交付，非既有结算复核）。
- AC6 隔离复检：已隔离条目每梦复检，失效实体重新命中（复活）则解除隔离并记录；「连续两梦无翻案升候删」需语义翻案判定，归 PBI-07，本轮隔离标记只需携带足够的跨梦起始信息。

#### PBI-02.4 熔断器

*意图：三道安全阀补齐第一道——连删事故在结构上不可能（当前代码熔断器完全空白）。*

- AC1 熔断口径写死：计数对象仅为**记忆文件净消失数**（隔离标记不计入、纯索引行修复不计入、非记忆文件的改动不计入）；库存基准取**梦前状态的记忆文件数**；判定为「>」（不含等于）；净消失数 > max(`max_deletes`, 库存 10%) → 中止整梦，记忆状态回到梦前状态，报告写明熔断原因、触发时的真实净消失数、与被回滚的动作清单（呼应 verdict C6「合并算不算额度须写死、报告显示真实盘面消失数」——本轮无合并动作，规则先行写死，为 PBI-07 引入合并时留好口径）。
- AC2 熔断属「拦坏事」守卫，纳入 DoD·D4 覆盖范围（故障注入点烟）。
- AC3 熔断后现场干净：锁与标记正常释放；熔断本身算「做过一场梦」，冷却期照常起算——不写死这一点会出现「熔断→未进冷却→立刻重跑→再熔断」的死循环。

#### PBI-02.5 C2/C3 梦报告证据改造

*意图：兑现「信任」承诺的两条前置改造（verdict §一判决：须在首个可用版本前完成）——证据从论证变记录，抽查点必须能失败。*

- AC1 明细每笔四要素齐全：动作 | 判据编号 | 证据 | 回滚提示。回滚提示按该笔实际形态给出可执行动作——**新建类**（如隔离标记、L0 新增的修复产物）回滚是撤销/删除，不是「恢复到梦前版本」（该对象梦前状态下并不存在）；若该笔触及的文件被同梦其他笔一并改过，须显式标注「撤销本笔将同时影响其他 N 笔」。**单笔精确回滚（跨笔无连坐、覆盖全部改动形态）本身是已知未完备项，后置至 C1**（verdict H4 实测：同一文件被多笔动作触及时，撤其中一笔会连坐另一笔；C1 的修法是「回滚按文件出、不按笔出」+ 显式警告 + 后续 `dream-undo` 脚本，本轮不做）。
- AC2 C2 证据栏「从论证变记录」，按判据性质分两种记法：**真实执行的命令**（如 M4 的 git 取证）记命令原文 + exit code + stdout 摘要 + 时间戳；**纯代码判据**（如 M1/M2/M3/M5 的文件系统比对）记判据输入、判定结果、时间戳。报告中不出现无记录支撑的论证式证据；同篇核查命令统一 shell 方言。
- AC3 C3 抽查点一律以**梦前状态**为基准起手核对；集合中不存在能被梦后状态自动满足的检查（杜绝原型「grep CLAUDE.md 是否为 pnpm」式循环论证）。
- AC4 每笔删除在报告内联被删正文（死者遗言）——看一眼不需要判断力，回滚才需要。
- AC5 自动挑证明力最弱的 3 笔生成抽查点（不足 3 笔全列）。
- AC6 30 秒版按 verdict C5 补两点：摘要须说全**动作类型**（不可只报数字、漏报某类动作，如原型「以为动 5 个文件实际 13 个」的漏报）；触及 CLAUDE.md 的动作**置顶**展示，不与记忆库内部改动混排（C5 后半「提示行由报告同源生成」的落地形态随 PBI-05，本条只交付报告内容本身）。

#### PBI-02.6 G9 回程：D3 定向翻底片 + 底片消费契约

*意图：修 G9 回程 bug（用户对梦报告的裁决送不回下一梦，真人测试实证断线）——梦开工前先翻底片找用户留话；同时以契约反转对 PBI-06 的格式依赖。*

- AC1 梦定向阶段先读底片：检索**上次梦 runId 之后产生的全部底片页**中的用户原话，凡提及上梦报告隔离区/「待你裁决」对象标识（记忆文件名/slug）的段落，摘录进本梦工作输入与报告（原文引用+出处页指针）。本轮为机械检索（标识匹配）；语义理解升级归 PBI-07。
- AC2 **底片消费契约定为公开接口**（写入交付接口约定，DoD·D5）：引擎只依赖三点——①底片台账结构（`ledger.json` 按 sessionId 分组，每页记录含 `file` 字段，值为**文件名**而非完整路径，消费方需自行与底片目录拼接）；②底片页正文保留用户原话；③用户发言在页内有稳定的、可机械识别的段落标记（当前形态：`### User`、`### User (meta)`、`### User (steering)` 三种标题行）。三点均须在 PBI-06 重做压缩规则时保住——尤其第③点，若新压缩规则换成不带该标记的渲染形态，G9 定向检索会**静默失效**而非报错，必须在契约里明写、防止漂移。
- AC3 底片目录的「只读」边界由受信任代码的实现保证——机械管线只调用文件读取 API 读底片页，代码路径中不出现任何面向底片目录的写操作；这个边界不经过 canUseTool（机械管线不通过 SDK/模型执行，见 1.1 架构前提，没有模型轮次可供 canUseTool 介入）。既有「越权写底片」的 canUseTool 故障注入测试（`--rogue` 模式，驱动 SDK agent 尝试写底片验证被拒）继续保留、继续需要登录态——它验证的是 SDK agent 路径（人工故障演练用）的势力范围围栏，是既有能力的回归看护，不因本轮机械管线改走非 SDK 路径而受影响或作废。
- AC4 种植验证：沙箱预置一条含隔离对象 slug 的用户留话底片页，梦后报告收录该原话与出处（一键自证覆盖）。

### 2.3 明确不做（防镀金）

- S1–S3 LLM 判据、L1 合并/connection 建边、L2 CLAUDE.md 阀门管辖、`llm_checks: on` 真语义——**已回写 ProductBacklog 新条目 PBI-07**，不在本 Sprint 偷跑。
- PBI-05（提示行）、PBI-06（压缩重做）——PO Planning 定案本轮不做。

**verdict 改造清单 C1–C7 归属记账**（逐条有归宿，不留掉地项）：C1 单笔精撤后置，本轮承诺「回滚提示诚实反映局限」（见 PBI-02.5-AC1）；C2/C3 本轮交付（PBI-02.5）；**C4 机器推论贴身份证——归 PBI-07**（原文明确针对 connection 的 confidence/origin 标记，connection 本身在 PBI-07 才产生；本轮机械处置的可追溯性已由 C2/C3 的「动作+判据+证据」四要素覆盖，不重复立项）；**C5 拆两半**——摘要说全动作类型、CLAUDE.md 改动置顶本轮交付（PBI-02.5-AC6），提示行同源生成随 PBI-05；C6 熔断额度写死+报告显示真实盘面数本轮交付（PBI-02.4-AC1）；C7 报告不进 dream commit——**代码里已实现**（`run-dream.mjs` 的 `dream:`/`dream-evidence:` 两笔独立提交，revert 前者不连坐后者），本轮只需保持不破坏，不新增交付物。

### 2.4 交付接口约定（Sprint-3 版）

*DoD·D5：增量的全部对外接口在此声明齐全，验收与后续消费者只依声明接线。机器可读版见 [acceptance/adapter.json](acceptance/adapter.json)（Sprint-3 增量版，未变键沿用 Sprint-2 版）。要点：*

1. **阀门配置**：`.claude/claude-dream.local.md` 六键（enabled/llm_checks/delete_policy/max_deletes/claude_md_edits/cooldown_minutes）；解析顺序＝配置文件 > 环境变量 > 默认值（逐键）；环境变量覆盖生效时报告点名「本次由环境变量覆盖：<键名>」；值非法回退默认并记注记。新环境变量四个：`CLAUDE_DREAM_ENABLED`/`CLAUDE_DREAM_LLM_CHECKS`/`CLAUDE_DREAM_DELETE_POLICY`/`CLAUDE_DREAM_MAX_DELETES`（`DREAM_CLAUDE_MD_EDITS`/`CLAUDE_DREAM_COOLDOWN_MINUTES` 沿用）。`enabled` 只约束 SessionEnd 自动链路，CLI 直跑 run-dream 是显式人工调用、不受闸门。
2. **机械梦**：run-dream.mjs 默认路径零 SDK/零网络（无登录态全链可跑）；SDK 唯一落点 run-dream-rogue.mjs（动态 import，rogue 故障演练路径保持 Sprint-1/2 行为）。执行日志 `.claude/dream/<runId>-engine.log`（命令类/代码类两种证据条目）；canUseTool 日志仅 rogue 路径产生。
3. **last-dream.json**：新增顶层 `runId`（running/completed/failed/fused 四态都带）；`status` 扩出 `fused` 终态（熔断场）；`lastDreamAt` 语义与冷却不变。
4. **隔离标记**：frontmatter `status: quarantined` + `quarantine:` 块（reason/since/runId，M4 另带 entity）；reason 枚举 M2-orphan/M3-dangling-source/M4-zero-hits-candidate；去标记即还原。每梦按 reason 复检，复活解除隔离（action=unquarantine）。
5. **报告**：六节名不变；明细动作键枚举 fix-link/fix-index-add-line/fix-index-remove-line/quarantine/unquarantine/delete/delete-suggestion；每笔删除内联「死者遗言」全文；抽查点一律 `git show <preSha>:<file>` 基准、挑最弱 3 笔；新建类动作给撤销式回滚提示、多笔同文件显式标注连坐、附 C1 局限诚实声明。
6. **底片消费契约**（PBI-02.6-AC2，公开接口、PBI-06 重做必须保住）：①台账 ledger.json 按 sessionId 分组、页记录 file 为文件名（消费方自行拼接目录）；②页正文保留用户原话；③用户发言段落标记 `### User`/`### User (meta)`/`### User (steering)`。G9 检索基线＝上次梦 runId（任意终态），页时间戳取页文件名 `--` 后段；不可解析的页保守纳入。
7. **熔断口径**：净消失数＝本梦删除记忆文件数；阈值 max(max_deletes, floor(库存×10%))；严格大于触发；回滚 `git checkout <preSha> -- .claude/memory CLAUDE.md`；报告写明原因/真实净消失数/回滚动作清单；冷却照常起算。

## 第三节 · 施工计划（Product Developers 填写）

*机械管线「不经 SDK/模型、由受信任代码直接执行」是 1.1 架构前提已定的约束，本节只填约束之内的组织方式。本节随施工演进随时改写。*

**施工结局（2026-08-15）**：六条拆条按 3.2 顺序全部交付，模块划分与 3.3 一致，另抽出两件计划外但必要的结构件——`src/lib/dream-git.mjs`（P0 快照/双提交拆分/运行态排除，机械与 rogue 两路径共用）与 `src/run-dream-rogue.mjs`（SDK 占位引擎整体搬迁，SDK 全仓唯一落点，机械路径动态 import 隔离）。3.4 关键口径全部照落：链接解析规则、修断链=摘标记降正文、M4 检索范围排除 `.claude/`、相对日期转绝对暂缓（真实数据未见对应形态，机制预留）、熔断 floor(10%)、三态 runId、G9 机械检索边界、user 类按 AC 字面不豁免。自证 319/319（含 D4 点烟三处：熔断压线触发、enabled 闸门、零登录态运行证明）。

**D3 独立 review（opus，2026-08-15）与修复**：审出 3 阻断 + 3 中 + 3 低，已全量修复并补回归钉子（自证 335/335）。阻断级：F1 G9 基线生产链失效（trigger-check 覆写 last-dream.json 前未读旧 runId，翻底片恒空）——修复＝覆写前读出旧值传参 + g9 的 undefined/null 双语义（链级两场梦验证钉子）；F2 回滚提示/抽查点 git 路径缺 `.claude/memory/` 前缀不可执行——修复＋路径断言钉子；F3 回滚失败时报告与提示行谎称已回滚——restoreFailed 三处渲染 + 提示行条件化 + 失败场报告断言钉子。中级：F4 fix-index 抽查点恒真恒假（模式误用 MEMORY）→ 改用 detail.forFile/removedLine；F5 claude_md_edits 声明未接线 → 报告诚实注记 + adapter honestNote（接线归 PBI-07）；F6 无 frontmatter 隔离标记不可逆 → 拆壳 + EOL 保留。低/存疑：L1 零处置≠零发现措辞；L2 讣告显式 `-M` 防 rename 假讣告；L3 delete 笔连坐计入 MEMORY.md。**PO 口径待裁**：claude_md_edits 惰性标注 vs 接线、user 类豁免维持字面、讣告 -M（已按建议加，可否决）。

### 3.1 Sizing（单 Developer 估算，可随施工重估）

| 拆条 | size | 备注 |
|---|---|---|
| 02.1 阀门配置 | S（0.5d） | 手写 YAML 六键解析（零依赖），触发链消费 |
| 02.2 判据引擎 | M（1.5d） | M4 两级证据最重；M2 冷启动禁用 |
| 02.3 处置层 | M（1d） | L0 四类修复 + 隔离标记 + 复检 |
| 02.4 熔断器 | S（0.5d） | 计数口径 + 回滚 + D4 点烟 |
| 02.5 报告改造 | M（1d） | 四要素/执行日志/抽查点基准/死者遗言 |
| 02.6 G9 回程 | M（1d） | 机械检索 + 契约落盘 + 种植验证 |
| 接口约定/收口/review | M（1d） | D5 adapter、D3 独立 review、收口材料 |

合计约 6.5d。

### 3.2 施工顺序

按依赖方向：**02.1 → 02.2 → 02.3 → 02.4 → 02.5 → 02.6**，接口约定与自证随各条增量交付，收口材料最后。

### 3.3 模块划分（新增 `src/engine/` 目录，机械管线全部住这里）

| 文件 | 职责 |
|---|---|
| `engine/config.mjs` | `.claude/claude-dream.local.md` 六键解析（手写极简 YAML frontmatter 解析器，零依赖）、默认值、环境变量覆盖、来源溯源（供报告阀门状态节标注） |
| `lib/exec-log.mjs` | 受信任代码执行 git 的唯一通道：execFileSync(argv 数组，不经 shell)+ 执行日志（命令原文/exit code/stdout 摘要/时间戳）——C2「真实执行的命令」证据形态的数据源 |
| `engine/check.mjs` | M1–M5 判据引擎（纯函数式：输入记忆库+项目状态，输出 findings 列表，每条带判据编号/对象/证据/出处） |
| `engine/act.mjs` | 处置层：L0 修复、确凿删除、L3 隔离、feedback 保护、隔离复检；每笔动作进 journal（四要素数据源） |
| `engine/fuse.mjs` | 熔断计数（净消失口径）与超限回滚（git checkout preSha 限 pathspec） |
| `engine/g9.mjs` | 定向翻底片：台账+页文件名时间戳过滤上次梦 runId 之后的页 → 摘 `### User` 段落 → 标识匹配 → 摘录输出 |
| `engine/report.mjs` | 六节报告生成（图 delta/30 秒版/明细/隔离观察区/抽查点/阀门状态），C2/C3 形态 |
| `run-dream.mjs` | 重写为机械管线编排：P0 快照 → G9 翻底片 → 体检 → 处置（熔断在线）→ 报告 → 提交拆分。SDK 改为**动态 import、仅 rogue 分支加载**——默认路径零 SDK 在结构上可证；C7 双提交拆分、防递归 env、dreamSessionIdsLog 登记等既有机制原样保留（rogue 路径仍产生真实 SDK 会话） |
| `trigger-check.mjs` | 增消费 config：`enabled:false` 不拉梦（底片照常）；冷却期改从 config 解析（文件>环境变量>默认）；last-dream.json 增记 `runId` 字段（failed/熔断场也要有，供 G9 检索基准） |

### 3.4 关键口径与设计决策（How 选择，PO 可否决）

1. **链接解析规则（M1 的判据输入，报告内自述）**：`[[X]]` 中 X 不含 `/` 或 `.` → 按记忆 slug 解析，查 `.claude/memory/<X>.md`；含路径字符 → 按项目相对路径 stat。两者皆无 → M1 断链检出，附出处（哪个文件的哪条引用）。
2. **L0「修断链」的具体形态**：摘除失效链接的 `[[ ]]` 标记降为普通正文（保留文字、不删信息）——机械层无从知道正确目标，不能乱改指向。每笔四要素入明细。
3. **M4 实体抽取与检索范围**：正文中反引号包裹的 token + 路径形 token（含 `/` 或 `\` 或扩展名）+ `ident(` 函数形 token；检索范围＝git 跟踪文件（`git grep -I`），显式排除 `.claude/`（记忆库自引用不算项目现状）。**边界如实记录**：未跟踪文件不参与检索。路径形实体 0 命中后跑 `git log --diff-filter=D -- <path>` 查讣告升级「确凿」；函数/命令形 token 无机械讣告通道 → 永远停在「候选」（等价于无删除权，交 PBI-07 语义层）。
4. **相对日期转绝对（L0）保守口径**：只转 `昨天/前天` 两种无歧义模式，基准取该文件 frontmatter `modified` 日期；无 modified 或非上述模式一律不转（宁可少修不可错修）。
5. **熔断整数口径**：10% 取 `Math.floor`（向下取整＝阈值更严＝熔断更早，安全方向）；判定为净消失数 > max(max_deletes, floor(库存×10%))。
6. **last-dream.json 增记 runId**：status running 时即写入本梦 runId（runId 生成上移到 trigger-check 可见处），completed/failed/熔断三种终态都保留 runId——G9 的「上次梦 runId 之后」检索基准在任何终态下都有据可查。
7. **G9「工作输入」的机械语义**：本轮只做标识匹配检索（AC1 明示），摘录进 pipeline 工作输入结构并进报告（原文+出处页指针）；**听懂与照办归 PBI-07**，机械梦不因用户留话改变处置——如实记录这个边界，不假装已接通语义回程。
8. **user 类记忆的删除豁免**：AC5 只豁免 feedback 类；user 类按 AC 字面不豁免（M4 确凿可删）。Sketches R5 的立场是「偏好/教训类无可核验实体、判据自然失明」而非显式豁免——按字面执行，若 PO 要显式豁免请指正。
9. **既有机制保持**：`CLAUDE_INVOKED_BY` 防递归 env、`dreamSessionIdsLog` 登记、backfill 排除梦会话——默认机械路径无 SDK 子进程、三者「用不上」但不删除不破坏（rogue 路径仍走全量既有逻辑）；`--rogue` 故障注入测试原样保留。
10. **搭车小活**：清理 hooks.json 里 SessionEnd 的 `timeout: 10` 死配置（Sprint-2 注意点2 记的「待清理」，官方不读该字段，删除纯清理无行为变化）。
11. **自证承载**：全部增量的 D1 验证并入 `test/self-test.mjs`（保持一条命令全绿），Sprint-3 段落建独立测试组；熔断 D4 点烟在自证沙箱里造真实 git 讣告 + max_deletes=1 强触发。
