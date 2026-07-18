---
name: claude-dream
description: >-
  启动 ClaudeDream 记忆整理。当用户明确说「run claude-dream」「开始做梦」「更新记忆」
  「整理记忆」「ClaudeDream 启动」这类召唤语，或直接输入 /claude-dream 时使用。
  这是一个有副作用的手动流程（读取对话 → 判定 → 写入项目记忆），只在用户明确要求整理/更新记忆时触发，
  不要因为对话里提到「记忆」二字就自动启动。
allowed-tools: Bash, Read, Write, Edit
---

# ClaudeDream — 完整做梦流程（Sprint 4）

你现在扮演 **ClaudeDream 记忆整理器**。本版本实现完整做梦流程：Target B 完整读取管线 + Target C 编译落盘（首发）。严格按下面五格流程执行，**不要跳步、不要静默失败**。

严格按下面四格流程执行，**不要跳步、不要静默失败**。

---

## 格 1 · 发起（确认意图）

用户已通过 `/claude-dream` 或自然语言召唤启动记忆整理。向用户确认你已收到指令、即将开始。用一句话说明：
- 本版本是完整读取管线（Target B）：会利用 Claude Code 已有的项目感知 + 游标提取 + 对话降噪，汇总为「当前背景上下文」
- 暂不写记忆（写入归编译层 C，后续 Sprint 接入）

---

## 格 2 · 确认启动（解析环境 + 确认目标项目）

运行下面的脚本解析三条路径，**照实打印结果**。这是后续步骤的前置——路径不对，后续全错。

```bash
# 项目根：Claude Code 注入的官方变量
PROJ="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# 由项目绝对路径推断 Claude Code 的 project slug：
#   盘符大写、路径分隔符（/ 与 \）统一转为 --，去掉开头的 --
# 例：/d/ClaudeDream 或 D:\ClaudeDream → D--ClaudeDream
SLUG=$(printf '%s' "$PROJ" \
  | sed -E 's#^/([a-zA-Z])/#\U\1:/#' \
  | sed -E 's#[:/\\]+#--#g' \
  | sed -E 's#^-+##; s#-+$##')

CC_HOME="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
PROJ_STORE="$CC_HOME/projects/$SLUG"
MEM_DIR="$PROJ_STORE/memory"          # 记忆目录（MEMORY.md + 记忆文件）
TRANSCRIPT_DIR="$PROJ_STORE"          # transcript：该目录下的 *.jsonl，每 session 一个

echo "① 项目目录      : $PROJ"
echo "② 记忆目录      : $MEM_DIR"
echo "③ transcript 目录: $TRANSCRIPT_DIR  (*.jsonl)"

# 有效性检查
MISSING=0
[ -d "$PROJ" ]        || { echo "⚠ 未找到项目目录：$PROJ"; MISSING=1; }
[ -d "$PROJ_STORE" ]  || { echo "⚠ 未找到该项目的 Claude Code 存储目录：$PROJ_STORE（可能是新项目或 slug 推断偏差）"; MISSING=1; }
if [ "$MISSING" = 0 ]; then
  echo "✓ 环境就绪，目标项目已确认：$SLUG"
else
  echo "✗ 上下文不完整，已如实报告上述缺失项，未静默继续。"
fi
```

- 若脚本报告 `✗ 上下文不完整`：**停在这里**，把缺失项讲清楚，让用户确认或修正后再继续，不要硬闯下游。
- 若 `✓ 环境就绪`：向用户复述目标项目 slug，然后进入格 3。

---

## 格 3 · 三件事

> 注意：项目背景（README、CLAUDE.md、git 状态）**不需要你手动读取**——Claude Code 在本次会话启动时已自动加载这些文件，你已拥有项目知识。你只需要做三件事：确认你已经了解项目 → 提取游标+读记忆 → 降噪对话。

### 3.1 确认项目感知

**不需要运行任何命令。** Claude Code 启动时已将 README.md、CLAUDE.md 加载到你上下文中，git 仓库状态也可用。花几秒钟在心里确认：
- 你了解当前项目是什么、处于什么阶段
- 你了解项目的 git 分支和最近的变更方向

然后向用户报告：「项目背景已确认——Claude Code 已加载 README/CLAUDE.md，git 状态可用，无需重新读取。」

### 3.2 记忆基线读取 + 上次做梦游标（W5+W6 · PB-Base-4）

**目标**：读取记忆索引 + 提取游标（最近一次记忆修改时间）。记忆文件**内容**用 Read 工具静默加载，不喷到对话里。

**步骤一**：运行下面脚本——它只输出摘要信息 + 游标，不 dump 记忆全文。

```bash
CC_HOME="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
PROJ="${CLAUDE_PROJECT_DIR:-$(pwd)}"
SLUG=$(printf '%s' "$PROJ" | sed -E 's#^/([a-zA-Z])/#\U\1:/#' | sed -E 's#[:/\\]+#--#g' | sed -E 's#^-+##; s#-+$##')
MEM_DIR="$CC_HOME/projects/$SLUG/memory"

if [ -d "$MEM_DIR" ] && [ -f "$MEM_DIR/MEMORY.md" ]; then
  echo "=== 记忆索引 MEMORY.md ==="
  cat "$MEM_DIR/MEMORY.md"
  echo ""
  echo "=== 记忆文件列表 ==="
  ls -1 "$MEM_DIR/"*.md 2>/dev/null | grep -v MEMORY.md | while read f; do
    MOD=$(grep "modified:" "$f" 2>/dev/null | sed 's/.*modified: *//')
    echo "$(basename "$f")  |  $MOD"
  done
  echo ""
  echo "=== 上次做梦游标 ==="
  # 取 modified 最新的那条；同步提取对应 session（从同文件取）
  LATEST_FILE=$(grep -l "modified:" "$MEM_DIR/"*.md 2>/dev/null | xargs grep -l "modified:" | head -1)
  LATEST=$(grep -h "modified:" "$MEM_DIR/"*.md 2>/dev/null | sed 's/.*modified: *//' | sort -r | head -1)
  LATEST_SESSION=$(grep -h "originSessionId:" "$MEM_DIR/"*.md 2>/dev/null | sed 's/.*originSessionId: *//' | sort -r | head -1)
  if [ -n "$LATEST" ]; then
    echo "最近记忆修改时间: $LATEST"
    echo "最近记忆来源 session: $LATEST_SESSION"
    echo "CURSOR_DATE=$LATEST"
  else
    echo "无游标（记忆文件无 modified 字段）"
    echo "CURSOR_DATE="
  fi
else
  echo "=== 无记忆基线 ==="
  echo "记忆目录不存在或无 MEMORY.md——这是首次做梦（冷启动）。"
  echo "CURSOR_DATE="
fi
```

**步骤二**：用 **Read 工具**加载记忆文件内容到上下文（静默，不污染对话）：
- 读取 `MEMORY.md` 索引
- 读取每个记忆文件（`$MEM_DIR/` 下除 MEMORY.md 外的全部 `.md` 文件）

> ⚠️ 游标传递：从上面脚本的输出中提取 `CURSOR_DATE=` 后面的实际值，在格 3.3 中用。脚本输出 `CURSOR_DATE=` 为空或不存在 → 格 3.3 走全量首读。

### 3.3 对话内容解析（W7 · PB-Base-5）

**目标**：用 `claude-code-log` 把 transcript jsonl 降噪后**落盘到文件**，再用 Read 工具加载。

**前提**：`claude-code-log` 需可用。如果命令不可用，**自动安装**（`pip install claude-code-log`）后继续——不要求用户手动操作。

**步骤一**：构造并运行下面的 bash 脚本。根据格 3.2 的游标状态，在脚本**第一行之前**插入（或不插入）`CURSOR_DATE`。

- 有游标（如 `CURSOR_DATE=2026-07-18T18:42:56.867Z`）→ 插入 `CURSOR_DATE="<值>"`
- 无游标 → 不插入，脚本自动走全量首读分支

```bash
CC_HOME="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
PROJ="${CLAUDE_PROJECT_DIR:-$(pwd)}"
SLUG=$(printf '%s' "$PROJ" | sed -E 's#^/([a-zA-Z])/#\U\1:/#' | sed -E 's#[:/\\]+#--#g' | sed -E 's#^-+##; s#-+$##')
TRANSCRIPT_DIR="$CC_HOME/projects/$SLUG"
OUTPUT_FILE="$TRANSCRIPT_DIR/.claude-dream-context.md"

if ! command -v claude-code-log &>/dev/null; then
  echo "claude-code-log 未安装，正在自动安装..."
  pip install claude-code-log 2>&1 || { echo "⚠ 自动安装失败，请手动运行: pip install claude-code-log"; exit 0; }
  echo "✓ claude-code-log 安装完成"
fi

SESSION_COUNT=$(ls -1 "$TRANSCRIPT_DIR"/*.jsonl 2>/dev/null | wc -l)
echo "可用会话数: $SESSION_COUNT"
echo "输出文件: $OUTPUT_FILE"

if [ -n "${CURSOR_DATE:-}" ]; then
  FROM_DATE=$(echo "$CURSOR_DATE" | cut -dT -f1)
  FROM_DATE_SAFE=$(date -d "$FROM_DATE -1 day" +%Y-%m-%d 2>/dev/null || echo "$FROM_DATE")
  echo "增量模式：读取 $FROM_DATE_SAFE 之后的会话（游标=$FROM_DATE，偏移-1天兜底）"
  claude-code-log "$TRANSCRIPT_DIR" --detail low --format md --compact --from-date "$FROM_DATE_SAFE" -o "$OUTPUT_FILE" 2>/dev/null
  CCLOG_EXIT=$?
else
  echo "全量首读模式：读取所有可见会话（无游标 / 首次做梦）"
  claude-code-log "$TRANSCRIPT_DIR" --detail low --format md --compact -o "$OUTPUT_FILE" 2>/dev/null
  CCLOG_EXIT=$?
fi

if [ $CCLOG_EXIT -eq 0 ] && [ -f "$OUTPUT_FILE" ]; then
  LINE_COUNT=$(wc -l < "$OUTPUT_FILE")
  echo "✓ 降噪完成：$LINE_COUNT 行 → $OUTPUT_FILE"
else
  echo "⚠ claude-code-log 退出码=$CCLOG_EXIT，输出可能不完整。"
fi
```

**步骤二**：脚本执行成功后，用 **Read 工具**加载 `$OUTPUT_FILE`（静默，不喷到对话）。输出文件路径记作 `.claude-dream-context.md`，位于 transcript 目录下。

- **compact 段保留**：`--detail low` 保留 `/compact` 摘要（`<summary>` 标签），不会误当噪音丢弃。
- **只读不判**：此处只做降噪 + 格式化，不做概念提取。

---

## 格 4 · 汇总 —— 当前背景上下文（W8 · PB-Base-6）

**目标**：确认三件事已完成，汇总为一个摘要框。**不需要重新打印已加载的内容。**

完成格 3 后，你现在拥有：
1. **项目状态**：Claude Code 自动加载的 README/CLAUDE.md + git 上下文
2. **记忆基线**：通过 Read 工具加载的记忆文件全文 + 格 3.2 提取的游标
3. **对话内容**：通过 Read 工具加载的 `.claude-dream-context.md`（降噪后对话流）

按以下结构输出**当前背景上下文摘要**：

```
╔═══════════════════════════════════════════════════════════════╗
║           ClaudeDream · 当前背景上下文（Target B 产出）         ║
╠═══════════════════════════════════════════════════════════════╣
║ 项目: <slug>                                                  ║
║ 时间: <now>                                                   ║
║ 游标: <cursor or "无（首次做梦）">                              ║
╠═══════════════════════════════════════════════════════════════╣
║ §1 项目状态  — Claude Code 原生加载 ✅                         ║
║ §2 记忆基线  — <N> 个记忆文件 + Read 加载 ✅                    ║
║ §3 对话内容  — <N> 会话 / <N> 行降噪 / .claude-dream-context.md ║
╠═══════════════════════════════════════════════════════════════╣
║ 交接点：三项内容已全部在本会话上下文中。                         ║
║ 对话降噪文件: .claude-dream-context.md（C 可直接 Read）          ║
║ C 将在后续 Sprint 接入（PB-Base-7 起）。                       ║
╚═══════════════════════════════════════════════════════════════╝
```

**结束语**：一句话总结——几路成功、是否有跳过、游标状态、降噪文件路径——然后**进入格 5（编译落盘）**。

---

## 格 5 · 编译落盘 —— Target C（Sprint 4 · 首发）

**目标**：把当前背景上下文编译成项目记忆——Gate 排噪 → Extract 提概念 → Cross-Reference 印证 → 四分类判定 → 写/改/删记忆文件 → 同步 MEMORY.md + 出变更摘要。

> **核心设计**（对标 compiler compile.py）：本格是一次完整的 agent 流程，你要依次完成下面各节，最后把结果写进磁盘、打印变更摘要。**只动 `$MEM_DIR` 下的记忆文件 + MEMORY.md；绝不动其他文件（尤其 CLAUDE.md、项目源码、README）。**

### 5.1 Gate · 硬约束排除（PB-Base-7）

先把不记的东西滤掉。逐一检查当前背景上下文里的每条潜在信息，命中以下任一条件 → **SKIP、不提**：

| # | 排除项 | 判据 |
|---|---|---|
| 1 | 例行工具调用 / 文件读取 | 对话只是 agent 在跑工具，没有人的输入或决策 |
| 2 | 琐碎寒暄 / 临时交流 | "好""OK""继续""明白""收到"等无信息量的话 |
| 3 | 工具知识 / 方法论讨论 | IDEO、Scrum、设计思维等方法论引用——记的是项目决策，不是"我们用了什么流程" |
| 4 | CLAUDE.md 已有内容 | 项目定位、核心纪律等已在 CLAUDE.md 文件中写明的——无需重复进记忆 |
| 5 | Repo 已有内容 | README、Architecture.md、源码等 repo 文件已包括的事实 |
| 6 | `.claude-dream-context.md` 自身元信息 | 降噪工具的输出格式、行数统计等——不是项目知识 |

**Sentinel 契约**：若经过以上全部排除后，**零条**值得记 → 输出以下 EXACT 行，然后**跳到 5.8 打印摘要（本次无可记）并停止，不进行后续 extract/写入**：

```
NOTHING_WORTH_RECORDING
```

无此输出 = 继续 5.2。

### 5.2 Extract · 提取概念（PB-Base-8 ①）

从经过 Gate 的上下文中，提取 **3–7 个**离散的、值得单独成记忆的概念。每个概念 = 一句话定义 + 来源引用（上下文里哪句话/哪个发现）。

- **粒度原则**：一个概念 = 一个可独立被查到的点。太细（"某行代码写了什么"）归入相关概念；太粗（"这次对话很长"）拆成子概念。
- **上限 7 个**（compiler 基数上限）：防过碎。少于 3 个是正常的——不硬凑。
- 每个概念给一个 kebab-case slug（用于文件名）。

### 5.3 Cross-Reference · 交叉印证（PB-Base-8 ②③）

**必须先做**：用 Read 工具加载 `$MEM_DIR/` 下全部记忆文件（`*.md`）到上下文。Claude Code 启动时已自动加载了 MEMORY.md 索引，但每个记忆文件的**原文**你需要自己加载。

现在把 5.2 提取的每个概念，和全部已有记忆做印证：

| 印证维度 | 检查方式 |
|---|---|
| 碰到哪条旧记忆？ | 概念的内容和已有哪条记忆相关——直接覆盖、部分重叠、还是引用同一文件/决策？ |
| 碰到什么程度？ | 是同一件事的新信息（补充）、还是矛盾的（冲突）、还是旧事重提（重复）？ |
| git 漂移候选 | 概念引用的文件，在 git diff 中是否变了？变了 → 标记 `⚠️ possibly-stale 候选` |

**产出**：每个概念配一条印证结论——「这条概念和 `[[旧记忆名]]` 的关系是 X」。

**印证不打分类标签**——分类归 5.4。

### 5.4 Classify · 四分类判定（PB-Base-9）

对每个概念，根据 5.3 的印证结论，判入四类之一：

| 分类 | 触发条件 | 动作 |
|---|---|---|
| 🆕 **Create** | 记忆中没有——全新知识 | 新建记忆文件 |
| ⚡ **Update** | 已有相关记忆，这里是**新信息或冲突** | 编辑已有文件，添加新内容 + 来源；**冲突时保留旧内容，加 superseded 标注** |
| 🗑️ **Delete** | 对话**明确推翻**旧记忆，或 git **明确漂移**证明过时 | 删除记忆文件（同时从 MEMORY.md 撤行） |
| 🔁 **Skip** | 和已有记忆**重复**——内容已被覆盖，无新信息 | 不操作 |

**保守删除原则（hard rule）**：
- 删除只在「对话明确推翻」或「git 明确漂移」时执行。
- **拿不准 → 降级为 ⚡ Update + 标注**（因为删错 > 留错）。
- 不确定时问自己：这条旧记忆是否**确定是错的**？只要可能对，就不删。

**更新优于新建（hard rule）**：
- 能改已有文件就不新建——先 Read 已有文件，再 Edit 追加，不建近似重复文件。

**每条判定必须给理由**——一行说清「为什么判 Create/Update/Delete/Skip」。

### 5.5 防腐涂料 · 三个标注模板（PB-Base-10）

以下三个模板，在 5.6 写入时**对应场景必须套用**。

**① 双源 sources（每条新/改记忆必填）**：
```yaml
sources:
  - session: <当前 sessionId>    # 从哪里来的
  - git: <当前 HEAD commit hash>  # 项目在哪个版本
```

**② superseded 标注（冲突时，在旧内容上方加）**：
```
⚡ superseded 2026-07-19T12:00:00+08:00: <冲突原因——新对话说了X，推翻了旧结论Y>
```

**③ possibly-stale 标注（git 漂移候选，加在记忆文件 frontmatter 的 description 后）**：
```
⚠️ possibly stale: <filename> changed <date> — 此记忆引用的文件已变更，本记忆可能需要复核
```

### 5.6 Write · 写入执行（PB-Base-11）

按 5.4 的结论执行写盘。**所有写入目标在 `$MEM_DIR/` 下**——这个路径 格 2 脚本已计算。其他目录一律不碰。

**新建文件模板**（`$MEM_DIR/<slug>.md`）：
```markdown
---
name: <kebab-case-slug>
description: <一句话>
metadata:
  type: <feedback | project | reference | user>
sources:
  - session: <sessionId>
  - git: <commitHash>
created: <ISO8601 绝对日期>
---

<记忆正文——中性、全面、像百科条目>

**Why:** <这条记忆为什么重要>
**How to apply:** <以后怎么用这条记忆>
```

**编辑文件**（用 Edit 追加 / 更新）：
- 先 Read 已有文件
- **冲突时**：在旧内容上方插入 `⚡ superseded` 行 + 下面写新内容。旧内容保留。
- 非冲突补充：追加新信息段 + 更新 `modified` 为当前时间
- 追加当前 session 到 sources 列表

**删除文件**（仅限 5.4 判定为 🗑️ 的）：
- 保守删除原则兜底——再次确认是不是**确定错**
- 删除后 MEMORY.md 同步撤行（5.7）

**游标刷新**：每次写入/编辑操作，在文件 frontmatter 中写/更新：
```yaml
modified: <ISO8601 now>
originSessionId: <当前 sessionId>
```

**信任边界护栏（不可违反）**：
- ❌ 绝不编辑 `CLAUDE.md`
- ❌ 绝不存 repo 已有内容（README、源码、架构文档等）
- ❌ 绝不写 `$MEM_DIR/` 以外的文件
- ❌ 绝不创建空文件或仅 frontmatter 无正文的文件

### 5.7 收尾 · 索引 + 变更摘要（PB-Base-12 + 13）

**MEMORY.md 同步**：
- 🆕 新增文件 → 在 MEMORY.md 末尾补一行：`- [Title](file.md) — 一句钩子`
- ⚡ 更新文件 → 检查 hook 描述是否还准确，不准就修正
- 🗑️ 删除文件 → 删除对应的那一行
- 同步后检查：MEMORY.md 的每条索引都对应一个存在的 `.md` 文件，无断链、无漏项

**变更摘要**（打印给用户）：
```
╔═══════════════════════════════════════════════════════════════╗
║              ClaudeDream · 变更摘要（Target C 本轮）            ║
╠═══════════════════════════════════════════════════════════════╣
║ Session: <sessionId>                                          ║
║ Git:     <commitHash>                                         ║
║ 游标:    <游标值 | "无（首次做梦）">                             ║
╠═══════════════════════════════════════════════════════════════╣
║ 🆕 Created (N):                                               ║
║   - [[slug]] — 理由（一句）                                    ║
║ ⚡ Updated (N):                                               ║
║   - [[slug]] — 理由（一句）                                    ║
║ 🗑️ Deleted (N):                                               ║
║   - [[slug]] — 理由（一句）                                    ║
║ 🔁 Skipped (N):                                               ║
║   - slug — 理由（一句）                                        ║
╠═══════════════════════════════════════════════════════════════╣
║ MEMORY.md 同步状态: ✅ 无断链 / ⚠ 需手工复核                    ║
╚═══════════════════════════════════════════════════════════════╝
```

### 5.8 结束

全程结束后，一句话收尾——告诉用户这轮做了什么（几 writing、几 skip、游标更新）。

---

## 附 · 当前版本说明

- **Sprint 4**：Target C 编译落盘（首发）——完整做梦流程：B 读取管线 + C Gate→Extract→印证→四分类→写入→索引+摘要。
- **Sprint 2**：完整读取管线（Target B）。已接入 `claude-code-log` 做对话降噪。
- **设计原则**：Claude Code 原生能力（README/CLAUDE.md 自动加载、git 感知）不再重复造轮子。Bash 做游标提取 + 外部工具调用。Read 做文件加载。C 的 compile 为单次 agent 流程——Gate→Extract→印证→四分类→写入→索引+摘要一次做完（对标 compiler compile.py）。
- **B/C 边界（PO 确认）**：B 只负责读取 + 降噪 + 拼装；概念提取、交叉印证、四分类、写入全部归 C。
- **信任边界**：绝不编辑 CLAUDE.md；不存 repo 已有内容；只动 `$MEM_DIR/` 下的记忆文件和 MEMORY.md。
