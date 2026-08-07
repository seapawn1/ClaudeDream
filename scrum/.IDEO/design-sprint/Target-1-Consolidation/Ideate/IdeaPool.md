# IdeaPool · Target-1 整合段灵感板

**这是什么**：Ideate 第一步 Lightning Demos（2026-08-02，三场：官方双层机制 / claude-memory-compiler+claude-dream / claude-code-log+claude-mem）的蒸馏产物——14 条 big idea + 6 条反面清单 + S4 证据对摆，是 Sketch 阶段的弹药库。

**效力**：三场演示稿原文未落盘（仅存 2026-08-02 会话），需复查须重跑对应场次；每条 idea 的出处指向 `reference/` 下原料，与原料冲突时以原料为准。

## 判据从哪来（S6 体检）

| # | Big Idea | 机制 | 出处 |
|---|---|---|---|
| 1 | **拿外部现实当判据，不拿记忆互相投票** | 官方三面镜子：当前代码库、CLAUDE.md、更新的记忆——"今天的调查证伪了旧记忆，就在源头修正"（原文：deleting contradicted facts — if today's investigation disproves an old memory, fix it at the source） | `reference/agent-memory/auto-dream/auto-dream.md` §五 Phase 2/3/4 |
| 2 | **把"过期"定义成可操作检查：记忆引用的实体现在还在吗** | "The memory says X exists" is not the same as "X exists now"——文件/函数/flag 存在性可机械核验，可作体检第一条机械判据 | `reference/agent-memory/auto-memory/auto-memory.md` §二/§四 |
| 3 | **判据分层：机械免费打底，LLM 只判语义矛盾** | lint 7 项中 6 项纯文件 I/O 零成本即时（断链/孤儿页/孤儿源/stale/缺反链/稀疏），仅"矛盾检测"动 LLM 且可 `--structural-only` 跳过 | `reference/agent-memory/claude-memory-compiler/scripts/lint.py:250-285` |

## 谁有权删（S7 所有权与安全阀）

| # | Big Idea | 机制 | 出处 |
|---|---|---|---|
| 4 | **不对称成本安全阀：删错≫留错** | "When unsure, leave it. A stale team memory costs little; deleting a teammate's load-bearing note costs a lot"；且明令不得因"不认识"而删——删除许可与归属+成本绑定，清晰被证伪才删 | `auto-dream.md` §五 团队记忆块 Phase 4 |
| 5 | **CLAUDE.md 修改权做成阀门：默认改，可关**（Decider 2026-08-02 定向） | 官方红线是反面参照：即使记忆明确纠正 CLAUDE.md 也 "do NOT edit CLAUDE.md during a dream"，只标注 "contradicts CLAUDE.md" 并列入 summary——官方不敢改的本质是没有回滚层。本项目立场：**默认修改 CLAUDE.md**（凭 git 回滚层，见 TargetMap 赌注），但设用户可关的阀门（关闭时退回官方式"标注+汇报"）；阀门形态是 Sketch 的一格 | `auto-dream.md` §五 Phase 4；Decider 拍板 2026-08-02 |
| 6 | **梦 agent 的权限在配置层缴械，不靠提示词自觉** | claude-mem 五层冗余：`tools:[]` + `allowedTools:[]` + 显式 deny-list + `permissionMode:'dontAsk'` + `canUseTool` 全拒并写审计日志（"The redundancy IS the security property"）；claude-dream 同思想的轻量版：agent frontmatter 工具白名单 | `reference/claude-mem/src/sdk/hardened-options.ts`；`reference/claude-dream/.claude/agents/linter.md` |
| 7 | **用户在写入端一票否决：`<private>` 标签双保险剥离** | 进提示词前正则剥除一次，产物"完全派生自私有内容"再丢弃一次——敏感内容根本不入库，不必事后清 | `reference/claude-mem/src/utils/tag-stripping.ts`、`src/server/generation/providers/shared/prompt-builder.ts:30` |
| 8 | **问题分级即处置分级** | severity 三级（error/warning/suggestion）+ `auto_fixable` 标记——天然是"必须问我 / 该修 / 随手处理"分界的骨架 | `claude-memory-compiler/scripts/lint.py:107-129` |

## 凭证长什么样（S8 留证）

| # | Big Idea | 机制 | 出处 |
|---|---|---|---|
| 9 | **留痕三件套：不可变源 + frontmatter 溯源链 + append-only 构建日志** | `daily/` 声明 append-only 事后不改；每篇知识 frontmatter 必带 `sources:` 指回源日志；每次 compile 在 `log.md` 追加 created/updated/source——每条知识可辩护"你从哪知道的" | `claude-memory-compiler/AGENTS.md` §Layer 1/§Conventions、`scripts/compile.py:106-112` |
| 10 | **每条记忆发身份证号，引用按 ID** | search 返回 `ID / Time / Title` 索引表，再按 ID fetch 全文（三层工作流 search→filter→fetch）；Web Viewer 全量可翻——可指认的 ID 是留痕最小单位 | `reference/claude-mem/plugin/skills/mem-search/SKILL.md`、`src/ui/viewer/components/` |
| 11 | **索引即摘要凭证：一行一钩子 + 硬上限** | MEMORY.md "one line per memory, never put memory content there"；200 行/25KB 封顶，超长行"缩行、挪详情"——梦报告可读性的现成模板 | `auto-memory.md` §二、`auto-dream.md` §五 Phase 4 |

## S4 原料层 + S5 触发（随段建设，标"随段取用"）

| # | Big Idea | 机制 | 出处 |
|---|---|---|---|
| 12 | **取舍规则声明在数据类型上，完全可审计** | 每个消息类声明 `detail_visibility` 阈值，五级（full>high>low>minimal>user-only）单调过滤——"丢什么留什么写死"的现成工程形态 | `reference/claude-code-log/claude_code_log/models.py:483-498` |
| 13 | **官方 S4 答案：机械压缩打底，LLM 带着假设窄 grep** | 主读前缀编码活动流（`>` 用户 `<` 助手 `.` 工具），transcript 只兜底："grep narrowly, don't read whole files"、"Look only for things you already suspect matter" | `auto-dream.md` §五 Phase 2、§七.1 |
| 14 | **"无免费离线时刻"的实证绕法：hook 零 API + 分离进程自己跑 Agent SDK** | hook <10s 只做本地 I/O 写临时文件，`Popen` 分离进程调 Agent SDK（走 Claude Code 本地凭据，`CLAUDE_INVOKED_BY` 环境变量防递归）；附赠无 cron 触发："过 18 点且今日日志 hash 变了"即后台整合 | `claude-memory-compiler/hooks/session-end.py`、`scripts/flush.py:142-189` |

## 反面清单（不偷，6 条）

1. **零留证收尾**——官方梦的全部凭证是一句会话内 summary，无报告文件、无变更日志、无 git、不可回滚（`auto-dream.md` §四/§五末尾）。这正是本项目的差异化位置。
2. **只报不删的断头体检**——lint 检出矛盾后唯一动作是写 `reports/lint-*.md`，全文无 fix/delete 路径（`lint.py` 源码核实）。S6 体检必须接 S7 处置，否则重蹈冲刺问题 3 失败想象"回看了但没人真的去看"。
3. **它的 stale ≠ 我们的过期**——`check_stale_articles()` 判"源日志 hash 漂移"（`lint.py:87-104`），即"文章落后于源"，不是"记忆内容被现实推翻"。判据不可挪用。
4. **单向所有权**——"The LLM owns this directory entirely. Humans read it but rarely edit it directly"（`AGENTS.md` §Layer 2），且系统对用户手改无感知无保护。所有权 HMW 的反面教材。
5. **纯提示词无工程护栏**——官方 4 个 Phase 只是提示词章节标题，非代码状态机；删并改全凭 LLM 自觉（`auto-dream.md` §四）。体检判据至少一部分要落成可执行检查。
6. **写入即定稿 + 高频常驻**——claude-mem 观察在写入时生成、写错无回滚层（无 git）；PostToolUse 每次工具调用喂 LLM + bun worker/SQLite/Chroma 常驻运维面，与低频离线整合形态不匹配（`reference/claude-mem/plugin/hooks/hooks.json` 等）。

## S4 证据对摆（本轮只摆证据，不做决定）

| | 机械压缩：claude-code-log（本机实跑 v1.5.0，2026-08-02） | LLM 提炼：claude-mem 实物 + compiler 形态 |
|---|---|---|
| 实测 | 197,241 字节 jsonl → 3,628 字节 md（1.8%）；另一例 97,279 → 2,896。零 LLM 成本，每条带时间戳可回指原始 jsonl | claude-mem：PostToolUse 异步喂 haiku（tier 路由简单→haiku/复杂→sonnet）产出 `<observation>`（type/title/facts×3/narrative/concepts/files_read/files_modified schema，`src/sdk/prompts.ts`）；compiler：$0.45–0.65/日（`AGENTS.md` §Costs） |
| 性格 | **卷宗**：无判断力，但无损可回溯 | **笔录**：有判断力，但写入即定稿 |
| 注意 | `--detail low` 白名单只留 `WebSearch/WebFetch/Task/Agent`，Read/Edit/Write 全丢（`renderer.py:3827`）——体检最需要的"哪个文件被改过"恰好不在；keep-list 须按体检需求自定 | LLM 路也在向机械纪律靠拢：超长工具输出 60% 头+30% 尾截断，留 `<elided>` 标记并明令"do not infer details about the elided range"（`prompts.ts:100-118`） |
| 佐证 | 官方同路线（idea #13）；compiler 的 hook 侧更粗暴：工具调用全丢、尾部截断 30 turns/15K 字符（`session-end.py:39-91`） | claude-mem 源码 grep `consolidat` 零命中、无 expiry/prune 作用于记忆本身——数万 star 用户接受"只攒不整"；另核实其默认纯本地：云同步三配置项默认全空，显式 Connect 才激活（`SettingsDefaultsManager.ts:68-70/:166`），差异化③证据保住 |

**场 3 演示官收尾判断（供参考）**：S6 要断案，卷宗（机械路）该是地基；笔录 schema（type/facts/files_modified + ID 引用）是笔录该长的样子。

## 取用指引

- Sketch 围绕三件事发散时，本板是弹药库不是清单作业——不必每条都用。
- **#5 已有 Decider 定向（默认改 CLAUDE.md + 可关阀门），Sketch 中需设计该阀门的具体形态**：开/关的粒度、关闭时的降级行为（标注+汇报）、以及阀门本身怎么让用户看得见。
- #12–14 属 S4/S5 基建，随段取用，不占 Sketch 主位。
