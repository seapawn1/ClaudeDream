# Sprint-02-negatives · SprintBacklog

## 第一节 · Sprint Goal

> **白天留底，夜里读得到**——每场会话散会时机械落一页底片（只追加、不可变、零 API），梦开工时真读得到它（含刚散会那场）。管道级承诺：底片落盘、送到梦嘴边、报告里有受信任代码写的进料对账；「听懂用户裁决并照办」（＝梦内 LLM 真读底片做提取、判断与执行）归真引擎 PBI-02，本轮不承诺。

## 第二节 · 选取条目与精化

### 选中条目（摘自 [ProductBacklog.md](../ProductBacklog.md) 第二部分）

| 编号 | 标题 | 产品意图 | 架构定位 | 当前状态 | size | 备注（依据） |
|---|---|---|---|---|---|---|
| PBI-01 | 机械压缩底片层 | 梦有原料可吃；用户裁决能送达下一梦 | S4 | Sprint-2 选定，已精化 | L（developers 自估后若装不下，先回 PO 重议再动工） | 2026-08-02 拍板 Karpathy raw/ 形制：只追加、不可变、零 API，提炼留在梦内；G9 修复本轮只交「留得住」，「翻得到」归 PBI-02 |

**OC（Outcome Criteria，整条 PBI-01 的为什么）**：从本增量起，ClaudeDream 仓库自身的每场会话都留下底片（正常散会即时落，强杀漏网在下个触发点补落）——用户在会话里说过的话不再蒸发，下一场梦（哪怕还是占位）能对账出它读到了这些底片。*势力范围注*：底片是写进用户仓库的一类新文件，属势力范围的有意扩张，边界见 [ProductBacklog.md](../ProductBacklog.md) 第一部分 Product 条目注。

### 精化（PBI-01 拆两条 + 开工件）

**PBI-01.1 底片产线——散会落底片** · size 待 developers 估
- AC1 会话正常结束后自动产出该场底片：一场一文件、可寻址（文件名对得上是哪场），落固定只追加目录；已有底片永不被修改（重跑任何流程不改旧底片字节）；同一场稿重复处理**不产生第二页**（幂等）
- AC2 产线零 API：全程无模型调用、无网络请求。验法写死：压缩链路不引用 Agent SDK，且断网环境下一键自证全链路跑通
- AC3 机械去渣、语义不判断，**以规则表为锚**：①随增量交付一份「留/剔规则表」，逐条列 jsonl 条目类型与处置（至少覆盖：用户消息的两种结构、以 user 角色记录的工具返回、attachment、assistant 正文与 thinking、file-history 等元数据），路径在 adapter.json 声明；②验收判「实现行为与该表一致」，不判验收方自拟口径；③**未知条目类型保守保留＋留痕**，不许静默丢弃；④「动过的文件、跑过的命令」限指工具调用声明的（Bash 间接改文件、子 agent 独立稿为已知盲区，见第三节注意点 8）
- AC4 体积对账：自证报告压缩前后体积，且底片 ≤ 逐字稿 **10%**（锚：现成件对真稿实测约 1.8%，留十倍余量；实测有充分理由可与 PO 重议）；超大稿有声明的行为（流式处理，或声明上限与超限动作——本仓库现存最大 9.19MB）
- AC5 产线故障不伤会话：写失败时静默降级、不阻塞散会链路；**错误留痕落点在底片目录之外**并在 adapter.json 声明（守卫类——D4 点烟：用注入开关造一次写失败，亲眼看降级与留痕）
- AC6 漏网场补捞：未触发结束事件的会话，其底片在下一个机械触发点（下场散会或梦触发时）补齐。四条硬口径：①**排除梦会话**——`CLAUDE_INVOKED_BY` 产生的逐字稿不得压成底片（防梦稿自吞污染底片）；②**活稿判别**——正在进行的会话不得被误冻（口径如 mtime 静默超阈值，写进规则表）；③台账写入原子、补捞可重入；④逐字稿已被官方 30 天清理的：记账跳过、不报错（稀有分支——D4 点烟：真造一场无结束事件的会话让补捞跑过一次）

**PBI-01.2 梦的进料口——夜里读得到** · size 待 developers 估
- AC1 梦报告出现进料对账行：**由受信任代码（run-dream.mjs）机械统计写入，不由模型自述**；对账须包含**触发本次梦的那场会话的底片**（session id 对得上）——底片写入与梦启动显式定序，不许靠时序侥幸
- AC2 梦对底片零写权：canUseTool 白名单不含底片目录；作恶模式**可指定目标路径**，令梦试写底片目录内具体文件，被拒且日志可见该路径（守卫类——D4 点烟）
- AC3 裁决回程有名分：用户对上一场梦的留话，散会后能在底片中按原文检索到（验法：埋一句标记话，底片里找得到）。本轮只兑现「留得住」，「翻得到」（梦定向去翻）归 PBI-02

**E0 开工首件事（Retro 改进项 2 + 欠账）· 先于一切**
- AC1（developers）真梦前置冒烟一条命令：查登录态/token/SDK 可达，红绿分明，红时一句话说清缺什么
- AC2（**执行人＝出卷 fork，非 developers**——Sprint-1 考卷对答卷人保密，不可捅破）Sprint-1 verify 在打分后改动的代码上重跑一次全绿，输出留档 acceptance 线，结论抄送 developers

### 交付接口约定（Sprint-2 版）

Sprint-1 原则沿用：凡属要求一律在此写明，只有怎么打分留在卷里；AC 之外无加码。

1. `commands.sessionEnd` **必须接受 stdin 上的 SessionEnd JSON**（至少 `session_id`/`transcript_path`/`cwd`）；stdin 空时的行为＝不落底片、留痕退出——**不许静默 fallback**（Sprint-1 老约定是 stdin 关闭裸跑，本轮起废止，老 `process.cwd()` 分支须重新定义）
2. 新增命令与落点键：`commands.backfill`（补捞入口）；`paths.negativeDir`（底片目录）、`paths.negativeLedger`（台账）、`paths.errorTrace`（错误留痕）、`paths.retainRules`（留/剔规则表）
3. 故障注入两个入口：写失败注入开关（环境变量，名字在 adapter 声明）；作恶模式支持指定目标路径（至少可指向底片目录）
4. 不预设项（选哪种都不扣分，但须守第三节注意点 5 禁区）：目录形制、文件命名、压缩实现、git 策略方案

*注记*：①吃紧时保 01.1＋01.2·AC1（goal 最小成立）；**守卫类 AC（01.1·AC5、AC6①②、01.2·AC2）不参与退让**，要退先退 01.2·AC3 与 01.1·AC4；developers 自估装不下时**先回 PO 重议再动工**，不得施工中自行砍；②AC 可随施工演进，改动须 PO 过目，**并由 PO 同步出卷方；开考前 AC 冻结**；③验收另行出卷（见 `acceptance/` 线，卷面保密）；④派发时请 developers 确认 Sprint-1 Retro 执行注记（D3 审阅停机条件）。

## 第三节 · 施工计划（起步纲要——本节属 developers，随学习随时改写）

建议顺序：E0·AC1 → 01.1 → 01.2。

**已知注意点（1–3、7 为官方文档查证事实）**：
1. **触发面**：SessionEnd 每场一次，触发于正常退出、`/clear`、切换会话、登出等（枚举含 `prompt_input_exit`/`bypass_permissions_disabled`/`other`）；强杀/崩溃不触发→AC6 兜底；resume 同段对话可多次散会、同稿多页→去重口径进规则表；compact 不算散会（盘上逐字稿保全量历史，跨 compact 底片完整性亲验一次）；fork 是新会话各落各的；**冷却只管梦不管底片**；hook 配置**别加 matcher**（全 reason 都要接）
2. **SessionEnd 硬预算**：全部 SessionEnd hook 共享默认 1.5 秒；settings 文件配的 timeout 可抬至 60 秒**但插件自带 hook 抬不动**（本产品用不上）；`CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS` 可显式覆盖（验收考场可用）。结论不变：压缩重活不得在 hook 内做，沿用「hook 只记账、分离进程干活」。**现存 `claude-dream/hooks/hooks.json` 里 SessionEnd 的 `timeout: 10` 是不生效的死配置，待清理**
3. **逐字稿格式是官方内部实现、随版本会变**（官方明示直接解析可能在任一次发版后失效）——这就是 AC3③「未知类型保守保留＋留痕」的由来；「格式漂移」列入 Sprint Review 已知风险
4. **现成件先读再动手**：`reference/claude-code-log/` 与 README「原料层是否可行」节有 jsonl 格式与压缩率实测（约 1.8%）——自建还是复用（含引入 Python 依赖的代价）**PO 已定（2026-08-14）：自建 Node 原生实现**；`claude-code-log` 只作只读参考（`models.py` 当 jsonl entry 类型字典用），1.8% 实测值继续当 AC4 体积锚。理由：目标形态不同（它是为人读设计的渲染器——emoji 标题、可折叠区块、DetailLevel 五档渐进展示；AC3 要的是机器可读、规则表可审计的底片）；本插件纯 Node/Agent SDK 栈，引入 Python+pip 依赖平添一层安装脆弱性；它 2500+ 行渲染逻辑大半覆盖 teammates/workflow/cron 等本项目用不上的功能面。安全网：AC3③「未知类型保守保留＋留痕」是自建路线兜底——解析拿不准的宁可多留、不静默丢
5. **底片目录禁区（硬约束）**：不得位于 `.claude/dream/`（白名单可写→01.2·AC2 结构上不可能成立）、不得位于 `.claude/memory/`（破 D2）、必须在 canUseTool 白名单之外、**不入梦前快照 pathspec**；落点在 adapter.json 声明
6. **git 策略在 01.1 动工前定版**：默认先忽略不入库（涉隐私）；若忽略，**精确忽略到文件、不要整目录 ignore**——Sprint-1 因整目录 ignore 让梦失败过一次（`5c04dd3`）
7. **定序**：底片写入与梦启动同源于散会事件，必须显式定序（先压完再拉梦，或梦等就绪信号）
8. **已知盲区**：Bash 间接改的文件逐字稿里无结构化记录；子 agent 活动在独立的 `subagents/agent-*.jsonl`，主稿里没有；「退出码」是否可取待实测，取不到降级为「命令与成败」——三条实测后取舍写回本节
9. **保留/清理规矩后置**：底片无限增长的清理策略不在本轮，记为已知边界
10. **已知盲区（D3 review 实测 + 官方文档确认，2026-08-14）**：`transcript_path` 是异步写入的，SessionEnd 触发那一刻文件可能还没追上内存里最新的对话——散会前最后几句话（含 01.2·AC3 最在意的裁决场景）有极小概率被漏进第一次压缩。实现侧已加有界的落盘稳定性等待（读之前查文件大小是否还在变化，见 `write-negative.mjs` 的 `waitForTranscriptToSettle`，最坏多花约 1 秒）缩小撞上的窗口，且只要这个项目还有下一场会话或下一次梦触发，AC6 补捞的增量游标机制会自动捞回滞后落盘的内容——**真正兜不住的唯一情形是"这场会话是该项目永远的最后一场"**，此时没有下一个触发点让补捞跑，这几句话会永久缺失。已确认不是本轮能彻底根治的问题（官方未承诺最大滞后时长），如实记录，不假装堵满
11. **D3 review 第二轮发现并已修复（2026-08-14）**：`backfillNegatives` 每次触发都重扫项目名下全部历史逐字稿，判定"已处理、无新内容"这件事本身原来要付出一次落盘稳定性等待＋整份文件读取的代价（`trigger-check.mjs` 旧注释误称这是 O(1)，实为随文件体积与历史会话数线性增长）。修法：台账新增 `lastProcessedBytes` 字段（记落盘稳定后的逐字稿字节数），`backfill.mjs` 用扫描时已经在做的 `statSync` 结果跟它比对，字节数相等直接短路（跳过 settle-wait、整读、cwd-peek 三步），只有字节数变化才走完整路径——已补安全网测试验证字节数变化时不会误判丢内容
12. **正式验收批卷第一轮打回（PO 转达，2026-08-14）**：12 过 / 9 不过 / 6 待办，判「打回」。核心机械管道是绿的（可寻址、8.35% 压缩、不可变、幂等、排除梦会话、并发、标记可检索均过），9 个「不过」没有一条是代码在真实环境跑坏了——全是接口对齐问题，已修复：
    - **adapter.json 键名未对齐（6 处，主因）**：验收脚本按一套键名读 adapter，实现填的是另一套，照改：`faultInjection.negativesWriteFailureEnvVar`（嵌套对象）→ `writeFailureEnv`（字符串＝环境变量名）；`report.negativeFeedReconciliationField` → `feedReconciliationMarker`（字符串＝报告里「进料对账」四字的字面标记，供脚本检索）；`source.negativesCompressor` → `negativeCompressor`；新增 `source.scopeGuard`；`commands.runDreamRogue` 内嵌 `{ROGUE_TARGET}` 占位符；`commands.backfill` 内嵌 `{TRANSCRIPTS_DIR}`/`{CWD}` 占位符。
    - **两个真欠账（代码级，已修复）**：①台账原子写竞态——`writeLedgerAtomic` 原先把 `.ledger-<hex>.tmp` 写在 negativeDir 里再 rename，外部把 negativeDir 当"稳定内容"目录枚举时可能撞见这个瞬时文件、下一刻再开它就 ENOENT，导致验收场中途崩；改成 tmp 落在 negativeDir 的同级兄弟目录 `.claude/.negatives-tmp/`（同文件系统保住 rename 原子性，但不再出现在 negativeDir 自己的目录枚举里）。②`oversizedPolicy` 未声明——补上真实行为：流式读取（node:readline + createReadStream），不设整稿体积上限，唯一截断点是 compress.mjs 对未知类型条目的单条 100KB 硬上限（RETAIN-RULES.md 早就承诺的截断行为，非整稿限制）。
    - **backfill 考场重定向需要的代码改动**：`backfillNegatives({root, transcriptsDir})` 新增可选覆盖参数，考场可指定自备的沙箱逐字稿目录，不再依赖按 root 反推编码目录名；CLI 入口加 `--transcripts-dir=` 解析。
    - **6 项「待办」**：PO 转达的消息只给了计数，未附具体清单内容，本轮未展开处理——如实记录这个信息缺口，待 PO/出卷方补充明细再排期。
    - 已为两个真欠账各补一条回归钉子（self-test.mjs：negativeDir 目录枚举不出现 .tmp 残留、transcriptsDir 覆盖参数确实生效），全量自证见 D1 命令重跑结果。
13. **重交前自查复核发现并已修复（2026-08-14）**：本轮新加进 adapter.json 的 `oversizedPolicy._note` 有一句话抄自 `write-negative.mjs` 顶部既有注释、没核实就直接抄了——"峰值内存只跟着这一页新增行数走"与实际不符。真实情况：`readTranscriptEntries` 的 I/O 读取确实是流式的（不会把整份文件当一个大字符串/buffer 一次性读进内存），但解析出的条目全部塞进一个装**全稿**的数组，等整份读完解析完才用 `sliceNewEntries` 切出新增段——峰值内存实际跟着"全稿条目数"走，不是只跟新增行数走。已订正 adapter.json 与 write-negative.mjs 源头注释两处措辞。**不是功能缺陷**（20MB 合成大稿压力测试仍然通过，真实现存最大 9.19MB 也远没到会成问题的量级），只是声明用词不准；真要让峰值内存做到"只随新增行数走"，需要重构读取顺序（先在锁内拿到台账游标、据此在流式读取阶段跳过已处理部分），改动量比声明订正大得多，本轮未做，记为已知边界，需要时再单独排期。另：复核提出一个不确定项——`source.negativeCompressor`（单数）与同组 `negativesOrchestrator`/`negativesLedgerModule`（复数）命名不一致，这是 PO 原话明确给的目标键名，未擅自改动，如实转告，是否有意为之需 PO/出卷方确认。

14. **正式验收批卷第二轮（PO 转达，2026-08-14）**：15 过 / 6 不过 / 6 待办（上轮 12/9/6）。键名对齐全部生效。这轮四个问题按置信度分开记，不混为一谈：
    - **【确认修复】H-A1/H-E1 新回归——sessionEnd 内部补捞污染考场**：`commands.sessionEnd` 只吃 stdin JSON、没有 CLI flag 通道，它内部顺带触发的补捞（`trigger-check.mjs` 调 `backfillNegatives({root})`）此前没有任何重定向能力，落回自动推导扫了真实 `~/.claude/projects`，把 3 个真实历史会话的底片污染进了考场（PO 已用考场目录列表实锤根因，不是猜的）。修法：`backfillNegatives` 新增 `CLAUDE_DREAM_BACKFILL_TRANSCRIPTS_DIR` 环境变量兜底（无显式 `transcriptsDir` 参数时读它），`session-end.mjs` 的 `spawn()` 本就不显式覆盖 `env`、子进程默认继承父进程环境变量（Node 官方文档默认行为），考场只需在起 `commands.sessionEnd` 那个进程上设这个变量即可透传到内部补捞，不用改 `session-end.mjs`/`trigger-check.mjs` 一行代码。
    - **【较强把握的假设修复】H-F1/H-F3——独立补捞带 `--transcripts-dir` 时 STALE/ORPHAN 没被捞出**：走查代码发现候选根因——`backfill.mjs` 的 cwd-mismatch 碰撞守卫（防"按 root 反推编码目录"多对一碰撞用）在显式指定 `transcriptsDir` 时依然生效，如果夹具内部 `cwd` 字段跟 `root`/`{CWD}` 参数对不上就会被误判成跨项目内容静默跳过——跟 PO 描述的现象（LIVE 正确跳过＝覆盖参数确实生效、定位到了文件，但 STALE 没被捞出）吻合。修法：新增 `isExplicitTranscriptsDir` 标志，显式指定扫描目录时跳过这条守卫（碰撞前提本就不存在），自动推导模式下守卫行为不变。这是代码走查得出的假设，不是拿到考场结果实锤，如果重考仍红需要更具体线索。
    - **【防御性改进，非实锤修复】H-D4——canUseTool 日志没记录被拒的具体路径**：没能定位到确切触发路径（考卷对开发方保密，猜不动）。防御性修法：`createCanUseTool` 的每条日志记录统一加一个顶层 `targetPath` 字段（此前路径只藏在 `input` 里或碰运气出现在 `reason` 文案拼接里），不管 `reason` 怎么写、`input` 结构如何都有固定字段名可读。如果重考仍红，需要 PO/出卷方给更具体的失败细节（比如 `reason` 字段是不是空的、`input.file_path` 本身是不是缺失）才能继续查。
    - **【疑似考卷侧，未改代码】H-D2——报告里没有 MAIN 的 session id**：核对过 `run-dream.mjs`，行为与 adapter.json 已声明的一致——不传 `--session` 时报告固定写"未指定触发会话"。如 PO 所判断，大概率是 verify.mjs 调 runDream 时没传 `--session=<MAIN>`，需两边对一下口径，不是 developers 侧代码问题。
    - self-test.mjs 补 5 条回归钉子（环境变量覆盖生效、显式覆盖模式跳过 cwd 守卫、两处 rogue 测试的 targetPath 字段），134/134 通过。

留白（developers 全权，守禁区）：目录形制、压缩规则细节、文件命名。

## 第四节 · Sprint-2 收口（2026-08-14 Sprint Review 记录）

**验收轨迹**：三轮逐次收敛——12过/9不过/6待办 → 15/6/6 → **16/5/6**。未全绿；PO 决定「本次 test 先收口」，残留移交后续，不追绿。

**5 不过归类**：
- 考卷侧（3，已修 verify.mjs、待重跑）：H-A1/H-E1（sessionEnd 内部补捞的重定向环境变量未设，扫了真实 `~/.claude/projects` 污染考场）、H-D2（runDream 未传 `--session`）。
- developers 侧（2）：H-F3（第二轮「跳过 cwd 守卫」的假设修复引入活稿回归——LIVE 被误冻）、H-D4（canUseTool 日志压根未生成）。

**两大发现**：
1. **自建 RETAIN-RULES.md 覆盖缺口**：用真实长会话（developers 场，5614 条）狗粮压测，冒出 4 种规则表未覆盖的顶层类型（`agent-setting`/`relocated`/`worktree-state`/`file-history-delta`），688 条走 AC3③ 保守留痕、压缩比 5%→8.85%。AC3③ 兜底正常（零静默丢），但暴露自建规则表在格式漂移下的维护成本 → 触发下面 PBI-06。
2. **考卷接口多轮脱靶（本轮最大教训，已入 DoD·D5）**：三轮逐次暴露 verify.mjs 没消费 adapter 声明的接口——先是私藏键名、再是 `--session`、再是环境变量。根因是「接口/考卷边界画高」：developers 照公开约定填、考卷照私藏键判，反复脱靶。

**PO 拍板（2026-08-14）**：
- 本次 test 先收口，不追绿；残留 F3/D4 与 verify.mjs 重跑移交下轮。
- 增设 PBI-06：底片压缩复用成熟开源方案（重做），不自建——「自建路线很可能有问题」。
- 覆盖缺口并入 PBI-06（复用即免自维护规则表）。

**DoD 对账**：D1 developers 自证 134/134 ✔；D2 部分（H-D4 日志未生成 ✖）；D3 独立 review 多轮 ✔；D4 部分（H-D4 ✖）；D5（接口公开、打分保密，本轮增设）✔。

**移交**：① PBI-06（复用重做）；② developers 修 H-F3 活稿回归 + H-D4 日志；③ verify.mjs 三处接线已修、待重跑确认；④ Retro 素材（考卷自检机制、接口边界）留待第五节。

## 第五节 · Sprint Retrospective（2026-08-14）

**病根共振**：三轮验收脱靶，根子是同一个——「接口/考卷边界」没在开工前划死。三份证据：①第1轮 adapter 键名私藏在保密考卷（接口没公开）；②第2轮 `--session` 旗标已声明进 adapter、但 verify.mjs 没消费；③第3轮环境变量已声明进 adapter、但 verify.mjs 没消费。**病名：接口脱靶**——考卷侧自己没接好线，却每次让 developers 背锅重改，接口对齐问题被伪装成答卷人的缺陷，三轮才剥干净。（对比 Sprint-1 的病「空转冒充覆盖」：一个是绿灯没走过，一个是考卷没接好。）

**改进项**：
1. 已落 DoD·D5「接口公开、打分保密」——堵「私藏键名」。
2. 新增 DoD·D6「开考先自检」——堵「声明了但没消费」。PO 批「可以加，未来再审」。
3. SOP（SM 派发 subagent 以接口 schema 为唯一喂料源）——PO 裁掉，不落。

**关账**：Review 落第四节，Retro 落本节；D5/D6 进 ProductBacklog DoD 区；PBI-06（复用重做）入 backlog。残留（H-F3 活稿回归、H-D4 日志、verify.mjs 重跑）随 PBI-06 与下轮 Planning 处置。Sprint-2 全部仪式完毕。
