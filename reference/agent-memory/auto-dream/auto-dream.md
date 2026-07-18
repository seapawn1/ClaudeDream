# Auto-Dream(Claude Code 内置离线整合层)

来源:`claude.exe` v2.1.210 逐字提取(UTF-16 快照区 @117.8M / ASCII 源码区 @236.6M)
提取日期:2026-07-16
交叉验证:[Piebald-AI/claude-code-system-prompts](https://github.com/Piebald-AI/claude-code-system-prompts) 的 v2.1.120 抽取版,内容基本一致

## 一句话

隔一段时间起一个后台 agent,回看最近的会话日志,把散落的信号整合进 [auto-memory](auto-memory.md) 的记忆文件,
去重、消解矛盾、清理过期、重建索引。REM 睡眠隐喻。

## 二、状态:本机从未运行(灰度未放行,不是"默认关闭")

```js
function qzu(){ return Ze("tengu_onyx_plover", null) }        // 服务端 gate,本地兜底 null
function Utr(){ let e=qzu(); return e?.enabled===true || e?.available===true }
function $kt(){
  if(!Utr()) return false;              // ← gate 为 null 时这里就 return,不读用户设置
  let e = zn().autoDreamEnabled;
  if(e !== void 0) return e;            // 用户显式设置优先
  return qzu()?.enabled === true        // 否则跟随服务端
}
```

**关键不对称:关得掉,开不了。**
- `"autoDreamEnabled": false` → 永久关闭,免疫 gate 将来翻转
- `"autoDreamEnabled": true` → **无效**。gate 不放行时 `$kt()` 第一行就 return false

设置项自述:`"Enable background memory consolidation (auto-dream). When set, overrides the server-side default."`

**本机实证(2026-07-16):**
- 全盘无 `.consolidate-lock`,无 `logs/` 目录 → 从未跑过
- auto-memory 正常工作(记忆文件存在且 MEMORY.md 已注入上下文)→ `Hf()` 为真
- 故阻塞点只能是服务端 gate `tengu_onyx_plover`

## 三、触发条件(必须全部满足)

```js
h9u = { minHours: 24, minSessions: 5 }   // 默认值
BXg = 600000                             // 扫描节流 10 分钟
Sqg = 3600000                            // 锁超时 1 小时
UXg = 30                                 // 保留最近 turn 数
```

| 条件 | 默认 | 备注 |
|---|---|---|
| 距上次整合小时数 ≥ | `minHours: 24` | 读 `.consolidate-lock` 的 **mtime** |
| 距上次整合新会话数 ≥ | `minSessions: 5` | 排除当前会话 |
| 距上次扫描 ≥ | 10 分钟 | 节流,防重复扫 |
| auto-memory 开启 | 是 | `WXg()` 里 `if(!Hf()) return false` |
| 服务端 gate | 放行 | `tengu_onyx_plover` |

**`minHours` / `minSessions` 都可被服务端 gate 覆盖** —— Anthropic 可远程调这两个数。

> 网上博客普遍说"24 小时自动触发"是**不完整**的:24 小时**且** 5 个新会话,两个都要满足。

### 妙处:锁文件 mtime 双用

```js
function cis(){ return path.join(Dg(), ".consolidate-lock") }     // Dg() = 记忆目录
async function Lqr(){ try{ return (await stat(cis())).mtimeMs } catch { return 0 } }
```

一个文件同时是**并发锁**和**上次整合时间戳**,省掉独立 state 文件。锁内容是 PID,超时 1 小时。

## 四、运行时(不是流水线)

```js
xso = { name:"DreamTask", type:"dream", ... }
c9u() → { type:"dream", status:"running", phase:"starting", sessionsReviewing, filesTouched:[], turns:[] }
u9u() → phase 变 "updating"(当 filesTouched 增长时)
d9u() → status "completed";  p9u() → status "failed"
```

运行时 `phase` **只有 `starting` 和 `updating` 两个值,纯 UI 显示**。
后台任务列表显示为 `dreaming`。完成后进 `pendingMemoryUpdates`,summary 形如
`consolidated N memory files`。

**核心认知:那 4 个 "Phase" 是提示词里的章节标题,不是代码状态机。**
工程层只做:门控、加锁、拉起任务、记录 filesTouched。所有智能都在提示词里。
这与 [claude-memory-compiler](claude-memory-compiler.md) 的确定性 `compile.py` 是两种哲学。

遥测事件:`tengu_auto_dream_toggled` / `_fired` / `_skipped`(带 reason)/ `_completed` / `_failed`

## 五、提示词全文

生成函数 `a9u(e, t, r, n=false)`:
- `e` = 记忆目录
- `t` = transcript 目录
- `r` = 附加上下文(ADDITIONAL_CONTEXT)
- `n` = 是否存在 `team/` 子目录

变量解析:`Xje` = 目录说明,`cx` = `MEMORY.md`(经本会话系统提示词实证),`Nee` = **200**,
`$Xg` = 团队块,`FXg` = CLAUDE.md 冲突块,`o9u()`/`i9u()` = 注入点(恒空,见下)

````markdown
# Dream: Memory Consolidation

You are performing a dream — a reflective pass over your memory files. Synthesize
what you've learned recently into durable, well-organized memories so that future
sessions can orient quickly.

Memory directory: `${MEMORY_DIR}`
This directory already exists — write to it directly with the Write tool (do not run
mkdir or check for its existence).

Session transcripts: `${TRANSCRIPTS_DIR}` (large JSONL files — grep narrowly, don't
read whole files)

[⟵ n=true 时注入「团队记忆块」]
---

## Phase 1 — Orient

- `ls` the memory directory to see what already exists
- Read `MEMORY.md` to understand the current index
- Skim existing topic files so you improve them rather than creating duplicates
- `ls -R logs/` — recent activity logs (one file per session under `YYYY/MM/DD/`).
  If a `sessions/` subdirectory also exists, review recent entries there too

## Phase 2 — Gather recent signal

Look for new information worth persisting. Sources in rough priority order:

1. **Session logs** (`logs/YYYY/MM/DD/<id>-<title>.md`) — the append-only activity
   stream, one file per session. Read the most recent 1–3 days of sessions (the
   filename title tells you what each was about); each line is prefix-coded
   (`>` user, `<` assistant, `.` tool call)
2. **Existing memories that drifted** — facts that contradict something you see in
   the codebase now
3. **Transcript search** — if you need specific context (e.g., "what was the error
   message from yesterday's build failure?"), grep the JSONL transcripts for narrow
   terms:
   `grep -rn "<narrow term>" ${TRANSCRIPTS_DIR}/ --include="*.jsonl" | tail -50`

Don't exhaustively read transcripts. Look only for things you already suspect matter.

[⟵ POST_GATHER_FN() 注入点,恒空]
## Phase 3 — Consolidate

For each thing worth remembering, write or update a memory file at the top level of
the memory directory. Use the memory file format and type conventions from your
system prompt's auto-memory section — it's the source of truth for what to save, how
to structure it, and what NOT to save.

Focus on:
- Merging new signal into existing topic files rather than creating near-duplicates
- Converting relative dates ("yesterday", "last week") to absolute dates so they
  remain interpretable after time passes
- Deleting contradicted facts — if today's investigation disproves an old memory, fix
  it at the source

## Phase 4 — Prune and index

Update `MEMORY.md` so it stays under 200 lines AND under ~25KB. It's an **index**, not
a dump — each entry should be one line under ~150 characters:
`- [Title](file.md) — one-line hook`. Never write memory content directly into it.

- Remove pointers to memories that are now stale, wrong, or superseded
- Demote verbose entries: if an index line is over ~200 chars, it's carrying content
  that belongs in the topic file — shorten the line, move the detail
- Add pointers to newly important memories
- Resolve contradictions — if two files disagree, fix the wrong one

### Reconcile memories against CLAUDE.md

Project CLAUDE.md instructions are loaded in your system prompt. For each `feedback`
or `project` memory, check whether it contradicts a CLAUDE.md instruction on the same
topic:

- **Memory is stale** — CLAUDE.md and the memory describe different procedures for the
  same task: CLAUDE.md is the maintained, checked-in source. Delete the memory, or
  rewrite it to agree if it carries context worth keeping (the *why* is still useful
  but the *how* is wrong).
- **CLAUDE.md may be stale** — the memory is clearly dated after CLAUDE.md and
  explicitly corrects it: do NOT edit CLAUDE.md during a dream. Annotate the memory
  with "contradicts CLAUDE.md — verify which is current" and list it in your summary
  so the user can update CLAUDE.md.
- **Not a conflict** — the memory adds detail CLAUDE.md doesn't cover, or narrows a
  CLAUDE.md rule with a stated reason. Leave it.

A `feedback` memory's "Why: the user corrected me" framing is not evidence it's newer
than CLAUDE.md — CLAUDE.md may have been updated since.

[⟵ ADDITIONAL_DREAM_GUIDANCE_FN() 注入点,恒空]
---

Return a brief summary of what you consolidated, updated, or pruned. If nothing
changed (memories are already tight), say so.

[⟵ r 非空时:## Additional context + ${r}]
````

### 团队记忆块(`$Xg`,仅 n=true)

````markdown
## Team memory (`team/` subdirectory)

The `team/` subdirectory holds memories shared across everyone working in this repo.
Other teammates' Claude sessions write here too — treat it differently from your
personal files:

- **Phase 1:** `ls team/` and skim it alongside your personal files. A teammate may
  have already captured something you'd otherwise duplicate.
- **Phase 3:** Merge near-duplicates *within* `team/` the same way you would personal
  memories. If a personal memory restates a team memory, delete the personal one.
- **Phase 4 — be conservative pruning `team/`:**
  - DO delete or fix a team memory that is clearly contradicted by the current code,
    or that a newer team memory marks as superseded.
  - DO NOT delete a team memory just because you don't recognize it or it isn't
    relevant to *your* recent sessions — a teammate may rely on it.
  - When unsure, leave it. A stale team memory costs little; deleting a teammate's
    load-bearing note costs a lot.

Do not promote personal memories into `team/` during a dream — that's a deliberate
choice the user makes via `/remember`, not something to do reflexively.
````

### 两个死掉的插件注入点

```js
function PXg(){ return false }                        // 恒 false
function o9u(){ if(!PXg()) return ""; return `${LXg.join("\n")}` }
var LXg; als = S(()=>{ LXg = [] })                    // 空数组

function OXg(){ return false }                        // 恒 false
function i9u(){ if(!OXg()) return ""; return `${NXg.join("\n")}` }
var NXg; s9u = S(()=>{ NXg = [] })                    // 空数组
```

Phase 2 后、Phase 4 后各留一个**注册表**,当前硬关闭且为空。
若将来打开,插件可往 dream 里注入自定义指引。

## 六、dream 不只管记忆:还提议技能

技能 frontmatter 里有来源标记:

```js
created_by:  "@internal — provenance marker (e.g. dream-proposal)"
improved_by: "@internal — provenance marker (e.g. dream-proposal)"
```

即 dream 可以**创建/改进 skill**,不只写笔记。与 auto-memory 的 `tengu_gorse_fathom`
技能维护块是同一方向:让反思结果落到可执行能力上。

## 七、设计洞见(对 claude-dream 最有价值的部分)

### 1. 主数据源是 `logs/`,不是 transcript

dream 真正读的是 `logs/YYYY/MM/DD/<id>-<title>.md` —— 预先消化好的活动流,
每会话一个文件,行前缀 `>` 用户 / `<` 助手 / `.` 工具。
transcript 只是"需要具体细节时"的兜底 grep。

**即 dream 之前还有一层压缩。** 本机没有 `logs/` 目录 —— 这层和 dream 一起是暗的。
自建 claude-dream 必须自己造这层(或复用 compiler 的 `daily/`)。

### 2. 人写的层,agent 永远不许自己动

CLAUDE.md 冲突规则里最关键的一条:即使记忆明显更新且明确纠正了 CLAUDE.md,
也 **"do NOT edit CLAUDE.md during a dream"** —— 只标注 + 报告,让用户自己改。
这是一条清晰的信任边界:自动化可以改自己写的东西,不能改人写的东西。

### 3. 不对称成本推理

`"A stale team memory costs little; deleting a teammate's load-bearing note costs a lot."`

删错的代价远大于留错 → 不确定时保留。这个推理模式值得照抄。

### 4. Token 纪律

`"grep narrowly, don't read whole files"` / `"Don't exhaustively read transcripts.
Look only for things you already suspect matter."`

宁可漏,不可烧光预算。
