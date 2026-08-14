# Sprint-2-negatives · 验收 TestPlan

> 出卷方＝本 fork（`sprint-02-acceptance` 分支），对 developers 保密。判据以 [SprintBacklog.md](../SprintBacklog.md) 第二节 AC 原文与「交付接口约定」为唯一依据，AC 之外无加码。

## §0 形制与边界

沿用 Sprint-1（`scrum/sprint-01-skeleton/acceptance/`，已实证有效）：判据表 H（编号／源 AC／操作化判据／测法／判定）＋ 场景化 ＋ 自动/半自动/人工分列 ＋ 验收规则 ＋ AC 映射确认表。守卫类判据（01.1·AC5、AC6①②、01.2·AC2）全部内建 D4 负向对照——不是"跑一遍证明它对"，是"造一次坏情况证明它真会拦"。

**卷面对 developers 保密**：凡属要求已写在 SprintBacklog 第二节「交付接口约定」，只有怎么打分留在卷里；AC 之外无加码。若验收时出现本约定未写明、却决定过不过的要求，那是出卷方的错，按打回处理并修卷。

**首活＝E0·AC2**：已完成，见 [E0-AC2-verify-rerun.md](E0-AC2-verify-rerun.md)（Sprint-1 verify 打分后重跑，13✔/0✖/3 人工待办，无回归）。

**卷成走向**：交 PO 逐段批，**验收开考前必须批过**。施工期 AC 若改（须 PO 过目），PO 会捎话来修卷；开考前 AC 冻结，之后不再变。

**喂料策略（已拍板）**：真逐字稿冻结＋人工埋标记。定稿见 `testbed/fixtures/`：
- `real-session-frozen.jsonl` —— 本仓库一场真实会话的逐字稿冻结（107 行原稿，session id `9a49720b-15ae-4445-9ddc-de88d0657612`），末尾追加 1 行人工埋的标记话（`ACCEPTANCE-MARKER-7f3c1a91`），供 E 场景回程检索用。格式与噪音都是真的，标记话是唯一人工添加的部分。
- `unknown-type-entry.jsonl` —— 手造小样本，含 1 条出卷时没见过的 `type` 值（`future-feature-marker-UNKNOWN-9c2e`），供 AC3③"未知条目类型保守保留"用。

`testbed/build-testbed.mjs` 把这两份定稿按不同会话身份（`SESSION_IDS`，见该文件）复制到 `testbed/negatives-lab-transcripts/`，内嵌 `sessionId` 字段随身份改写，其余字节不变——同一份真实素材，各场景各用各的身份，互不干扰、重跑同结果。

## §1 判据表 H

判定符号：✔ 过 ｜ ✖ 不过 ｜ ○ 前置未成立，无法判 ｜ ✋ 需人工/半自动判断。

### 场景 A · 正常散会（01.1·AC1/AC3/AC4）

喂 `MAIN` 会话的 SessionEnd stdin JSON，模拟一场正常散会。

| # | 源 AC | 操作化判据 | 测法 | 判定 |
|---|---|---|---|---|
| H-A0 | 接口约定① | stdin 空时不静默 fallback：不落底片、留痕退出 | 用空 stdin 跑一次 `commands.sessionEnd`（不给任何 session id）→ `negativeDir` 下不出现新文件，且某处留痕记录本次异常输入 | 自动 |
| H-A1 | 01.1·AC1 | 一场一文件、可寻址 | 对 `MAIN` 跑一次 `commands.sessionEnd`；`paths.negativeDir` 下恰好新增 1 个文件，文件名/内容可定位到 `MAIN` 的 session id | 自动 |
| H-A2 | 01.1·AC1 | 落点在固定只追加目录 | 新文件路径 = adapter 声明的 `paths.negativeDir`（不是散落各处） | 自动 |
| H-A3 | 01.1·AC3①② | 内容处置与「留/剔规则表」诸已知类型一致 | 见下方「§1.1 留/剔判据设计」——7 类已知标记逐一核对是否出现在底片里，连同 `paths.retainRules` 声明文件内容一并打印 | 半自动 |
| H-A4 | 01.1·AC3③ | 未知条目类型保守保留＋留痕，不静默丢弃 | 对 `UNKNOWN_TYPE` 会话跑 sessionEnd；标记串 `UNKNOWN-TYPE-PAYLOAD-9c2e77` 须出现在底片或留痕记录里 | 自动 |
| H-A5 | 01.1·AC3④ | 「动过的文件、跑过的命令」限指工具调用声明的 | 读一遍压缩实现源码，确认没有反解析 Bash/PowerShell 命令行文本去猜测间接文件改动 | 人工 |
| H-A6 | 01.1·AC4 | 体积对账：报告写明压缩前后体积 | verify.mjs 打印 sessionEnd 输出与 `negativeLedger` 内容，连同实测的压缩前/后字节数（138581 / 实测底片字节数）一并列出，人工核对实现自报数字与实测一致 | 半自动 |
| H-A7 | 01.1·AC4 | 底片 ≤ 逐字稿 10% | `MAIN` 底片体积 / 138581 ≤ 0.10 | 自动 |
| H-A8 | 01.1·AC4 | 超大稿有声明的行为 | adapter 声明字段非空（流式处理说明，或上限与超限动作说明） | 人工 |

### 场景 B · 不可变 + 幂等（01.1·AC1，D4）

| # | 源 AC | 操作化判据 | 测法 | 判定 |
|---|---|---|---|---|
| H-B1 | 01.1·AC1 | 已有底片永不被修改 | 取 `MAIN` 底片哈希 → 重放同一份 stdin（同 session id/transcript）→ 再取哈希，一致 | 自动 |
| H-B2 | 01.1·AC1 | D4 负向对照：判据本身真会拦 | 手工改 `MAIN` 底片 1 字节 → 哈希比对须报"不一致"（证明 H-B1 不是摆设，不是永远绿） | 自动 |
| H-B3 | 01.1·AC1 | 同一场稿重复处理不产生第二页 | 对 `MAIN` 连续跑两次 sessionEnd（或一次 sessionEnd + 一次 backfill），`negativeDir` 下 `MAIN` 对应文件数仍为 1 | 自动 |

### 场景 C · 写失败（01.1·AC5，守卫类 D4）

| # | 源 AC | 操作化判据 | 测法 | 判定 |
|---|---|---|---|---|
| H-C1 | 01.1·AC5 | 写失败注入后散会链路不炸 | 置故障注入开关（env var，名字见 adapter）→ 跑 sessionEnd → 非未捕获异常退出，进程可预期地降级完成 | 自动 |
| H-C2 | 01.1·AC5 | 错误留痕，落点在底片目录之外 | `paths.errorTrace` 处出现本次失败记录，且该路径不在 `negativeDir` 前缀下 | 自动 |

### 场景 D · 进料 + 拒写（01.2·AC1/AC2，守卫类 D4）

先让 `MAIN` 底片落盘，再触发梦（`commands.runDream`，沿用 Sprint-1 已交付的占位引擎）。

| # | 源 AC | 操作化判据 | 测法 | 判定 |
|---|---|---|---|---|
| H-D1 | 01.2·AC1 | 梦报告出现进料对账行，机械写入 | 报告文本中出现进料对账相关行 | 自动 |
| H-D2 | 01.2·AC1 | 对账行含触发本场梦的会话底片 session id，定序正确 | 对账行内可见 `MAIN` 的 session id；底片提交/写入时间早于梦启动时间 | 自动 |
| H-D3 | 01.2·AC2 | canUseTool 白名单不含底片目录（静态） | verify.mjs 打印 `source.scopeGuard` 源码中含"allow/whitelist/势力范围"关键词的行，人工确认不含 `negativeDir` 路径 | 半自动 |
| H-D4 | 01.2·AC2 | 作恶模式指定底片目录内路径，被拒且留痕，D4 | `commands.runDreamRogue` 传入指向 `negativeDir` 内具体文件的目标路径 → canUseTool 拒绝记录中可见该路径 | 自动 |

### 场景 E · 回程检索（01.2·AC3）

| # | 源 AC | 操作化判据 | 测法 | 判定 |
|---|---|---|---|---|
| H-E1 | 01.2·AC3 | 埋的标记话能在底片里按原文检索到 | 在 `MAIN` 底片文件中查找 `ACCEPTANCE-MARKER-7f3c1a91`，命中 | 自动 |

### 场景 F · 补捞（01.1·AC6，守卫类 D4，四条硬口径）

| # | 源 AC | 操作化判据 | 测法 | 判定 |
|---|---|---|---|---|
| H-F1 | 01.1·AC6 | 未触发结束事件的会话，下一个触发点补齐底片 | `ORPHAN` 逐字稿从未调用 sessionEnd，直接跑 `commands.backfill` → `negativeDir` 下出现其底片 | 自动 |
| H-F2 | 01.1·AC6① | 排除梦会话：`CLAUDE_INVOKED_BY` 逐字稿不得压成底片 | 置 `CLAUDE_INVOKED_BY=claude-dream` 后对 `DREAM_INVOKED` 跑 sessionEnd 与 backfill → `negativeDir` 下均不出现其底片 | 自动 |
| H-F3 | 01.1·AC6② | 活稿判别：正在进行的会话不被误冻 | `LIVE` 逐字稿 mtime 设为当前附近 → 同批 backfill 后不产出 `LIVE` 底片；`STALE` 设为远超阈值 → 同批产出 `STALE` 底片 | 自动 |
| H-F4 | 01.1·AC6③ | 台账写入原子、补捞可重入 | 对同一批连续跑两次 `commands.backfill`，台账记录数与底片文件数不重复增长 | 自动 |
| H-F5 | 01.1·AC6④ | 已被官方 30 天清理的逐字稿：记账跳过、不报错 | 构造一个指向不存在文件的 `transcript_path` 喂给 sessionEnd → 退出码正常（非未捕获异常崩溃），不产出底片 | 自动 |

### 场景 G · 零 API（01.1·AC2）

| # | 源 AC | 操作化判据 | 测法 | 判定 |
|---|---|---|---|---|
| H-G1 | 01.1·AC2 | 产线代码不引用 Agent SDK、无网络请求 | 静态扫描压缩实现源码：无 `@anthropic-ai` 引用、无 `fetch`/`https` 外部请求 | 自动 |
| H-G2 | 01.1·AC2 | 断网环境下一键自证全链路跑通 | 按 adapter 声明的断网自证方式跑一遍压缩链路，退出码 0 | 半自动（断网环境是否真断需人工确认一次） |

### 场景 H · 并发（01.1·AC6③ 台账口径）

| # | 源 AC | 操作化判据 | 测法 | 判定 |
|---|---|---|---|---|
| H-H1 | 01.1·AC6③ | 两场会话同时散会，两页底片都在、台账不坏 | `CONCURRENT_1`/`CONCURRENT_2` 真并发调用 sessionEnd（`Promise.all`）→ 两份底片都出现，台账文件仍是合法可解析格式 | 自动 |

### 人工项

| # | 源 AC | 操作化判据 | 测法 | 判定 |
|---|---|---|---|---|
| H-M1 | 兜真实性 | 真实环境真跑一次正常散会，亲眼看底片落盘 | 在真实 Claude Code 里对本仓库正常结束一次会话，人工确认底片文件出现 | 人工 |

### §1.1 留/剔判据设计（H-A3 的具体测法）

AC3②明确"验收判实现行为与该表一致，不判验收方自拟口径"——出卷方不预设哪类内容该留该剔，只核对**行为与 developers 自己声明的规则表是否一致**。`real-session-frozen.jsonl` 里 7 个已知类别各自的天然标记文本：

| 类别 | 标记文本（原文子串） | 来源行为 |
|---|---|---|
| 用户消息·结构一（`content` 为数组） | `你当前是什么身份` | line 2, `type:user`, `message.content:[{type:text}]` |
| 用户消息·结构二（`content` 为纯字符串） | `好的，今天武汉天气如何` | line 20, `type:user`, `message.content:"..."` |
| 以 user 角色记录的工具返回 | `tool_reference` | line 30, `type:user`, `message.content:[{type:tool_result}]` |
| attachment | `deferred_tools_delta` | line 3, `type:attachment` |
| assistant 正文 | `不能凭空报` | line 27, `type:assistant`, `content:[{type:text}]` |
| assistant thinking | `Let me think about my core discipline` | line 26, `type:assistant`, `content:[{type:thinking}]`（英文短语，零误撞风险） |
| file-history 等元数据 | `trackedFileBackups` | line 8, `type:file-history-snapshot` |

verify.mjs 对 `MAIN` 底片逐一核对这 7 个标记的出现/缺失，连同 `paths.retainRules` 文件的实际内容一并打印成对照表——**判定"一致"还是"不一致"是人工读一眼对照表做的**，脚本只负责把"标记去哪了"和"规则表怎么说"并排摆出来，不替人下结论。

## §2 如何跑

```
node testbed/build-testbed.mjs      # 先重建考场（脏考场上的绿灯不算数）
node verify.mjs                     # 跑全部自动判据
node verify.mjs --adapter <path> --json <path>   # 换适配层、导出判定结果
```

出卷阶段没有 `adapter.json` 是正常的——那时全红，红的原因是"未答卷"，不是脚本坏了。developers 完工后按 `adapter.example.json` 填一份 `adapter.json`，本脚本才真正开跑。

## §3 交付接口要求

权威版本在 [SprintBacklog.md](../SprintBacklog.md) 第二节「交付接口约定」，此处只重申与 verify.mjs 直接相关的几点，不加码：

1. `commands.sessionEnd` 必须接受 stdin 上的 SessionEnd JSON（`session_id`/`transcript_path`/`cwd`）——verify.mjs 用 `execSync` 把 JSON 字符串写进子进程 stdin 后关闭；stdin 空时的行为（不落底片、留痕退出）单列为 H-A0，源头标「接口约定①」而非某条 AC 编号（SprintBacklog 未把它列为独立 AC，只是接口约定第 1 条的行为声明，但既是约定就该判分，不因没有 AC 编号而豁免）。
2. `commands.backfill` 是补捞入口，独立于 `commands.sessionEnd`——场景 F 全部经此入口。
3. 故障注入两个入口，**名字由 developers 在 adapter.json 声明**，出卷方不代填：
   - 写失败注入开关：环境变量，场景 C 使用（`adapter.faultInjection.writeFailureEnv`）
   - 作恶模式目标路径：场景 D 使用，命令字符串里写 `{ROGUE_TARGET}` 占位符，verify.mjs 运行时替换成 negativeDir 内的具体探测路径（沿用 Sprint-1 `runDreamRogue` 的调用形状，只是把固定目标换成动态占位符）
4. 不预设项（选哪种都不扣分）：底片目录形制、文件命名、压缩实现、git 策略方案——verify.mjs 全部通过 `adapter.paths.negativeDir` 等声明值间接定位，不硬编码路径猜测。

## §4 卷外声明

以下不在本卷判分范围，不因未覆盖而扣分：

- **PBI-02 范围的行为**：梦是否真的"听懂"底片内容并据此调整判断——本 sprint 只验"留得住"（底片存在、可检索），不验"翻得到"（梦主动去读并采取行动）。
- **底片清理/保留策略**：SprintBacklog 第三节注意点 9 明确"清理策略不在本轮"，本卷不构造"底片无限增长"场景。
- **超大稿（9MB 级）实测**：H-A8 只判"有声明"，不构造真实超大 fixture（成本/仓库体积不划算，且 AC4 原文只要求"声明的行为"）。
- **E0·AC1**（developers 真梦前置冒烟）：developers 自证项，不在出卷方判分范围。
- **底片格式漂移应对**：SprintBacklog 第三节注意点 3 已列为 Sprint Review 已知风险，本卷只判"未知类型保守保留"这一个具体机制（H-A4），不判"格式漂移后是否仍能正确分类已知类型"这种更强的假设。

## §5 验收三判定规则

- **过**：全部自动判据 ✔，半自动/人工项经人工确认无异议。
- **打回**：任一守卫类判据（H-B2/H-C1/H-C2/H-D3/H-D4/H-F2/H-F3）不过——这些是"AC 不参与退让"的条款，不过即打回，不留活口。非守卫类判据不过时，视具体判据与 developers 沟通是否为理解偏差，一次性说明后限期改正。
- **上报**：verify.mjs 跑不起来（adapter.json 缺失/解析失败/考场未就位）时判"未答卷"，不算打回也不算过，退回 developers 补齐环境或适配层。

退出码沿用 Sprint-1 三档：`0` 全绿（含半自动/人工项已人工确认）｜`1` 有不过或有待办｜`2` 环境未就绪（考场/adapter 缺失）。

## §6 AC ↔ H 映射确认表

逐条对着 [SprintBacklog.md](../SprintBacklog.md) 第二节勾核，一条不落：

| AC | 覆盖的 H | 备注 |
|---|---|---|
| 接口约定① | H-A0 | stdin 空时不静默 fallback |
| 01.1·AC1 | H-A1, H-A2, H-B1, H-B2, H-B3 | 可寻址/固定目录/不可变/幂等 |
| 01.1·AC2 | H-G1, H-G2 | 零 API |
| 01.1·AC3①② | H-A3 | 规则表一致性，半自动 |
| 01.1·AC3③ | H-A4 | 未知类型保守保留 |
| 01.1·AC3④ | H-A5 | 口径确认，人工 |
| 01.1·AC4 | H-A6, H-A7, H-A8 | 体积对账 |
| 01.1·AC5 | H-C1, H-C2 | 写失败降级，守卫类 |
| 01.1·AC6（总）| H-F1 | 补捞基本功能 |
| 01.1·AC6① | H-F2 | 排除梦会话，守卫类 |
| 01.1·AC6② | H-F3 | 活稿判别，守卫类 |
| 01.1·AC6③ | H-F4, H-H1 | 台账原子/可重入 + 并发 |
| 01.1·AC6④ | H-F5 | 已清理逐字稿跳过 |
| 01.2·AC1 | H-D1, H-D2 | 进料对账行 |
| 01.2·AC2 | H-D3, H-D4 | 零写权限，守卫类 |
| 01.2·AC3 | H-E1 | 回程检索 |
| E0·AC1 | （不覆盖，developers 自证） | 见 §4 |
| E0·AC2 | （已完成，见 E0-AC2-verify-rerun.md） | 不重复进表 |

28 条 H（不含人工兜底项 H-M1），覆盖全部 15 条可判分 AC ＋ 1 条接口约定硬行为。

## §7 工位与协作

出卷会话工位在 `.claude/worktrees/acceptance`（git worktree，分支 `sprint-02-acceptance`）。入位后 harness 强制拦截对主仓（`sprint-02-negatives` 工作树）的一切编辑与命令——物理隔离，非仅约定。考卷、考场、`verify.mjs`、判据表全部提交在本分支，developers 所在的施工线看不见。跨线消息（AC 改动、批卷结果、开考指令）只走 PO 的手。
