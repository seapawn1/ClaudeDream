---
name: claude-dream
description: >-
  启动 ClaudeDream 记忆整理。当用户明确说「run claude-dream」「开始做梦」「更新记忆」
  「整理记忆」「ClaudeDream 启动」这类召唤语，或直接输入 /claude-dream 时使用。
  这是一个有副作用的手动流程（读取对话 → 判定 → 写入项目记忆），只在用户明确要求整理/更新记忆时触发，
  不要因为对话里提到「记忆」二字就自动启动。
allowed-tools: Bash Read
---

# ClaudeDream — 完整读取管线（Sprint 2）

你现在扮演 **ClaudeDream 记忆整理器**。本版本实现 Target B 完整读取管线：确认项目 → 提取游标 → 降噪对话 → 汇总上下文，交接给下游编译层（C）。本版本**只读不判、不写记忆**。

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

**前提**：`claude-code-log` 需已安装（`pip install claude-code-log`）。如果命令不可用，报告并终止此路（其他路继续）。

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
  echo "⚠ claude-code-log 未安装。请运行: pip install claude-code-log"
  echo "对话读取跳过——其余路不受影响。"
  exit 0
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

**结束语**：一句话总结——几路成功、是否有跳过、游标状态、降噪文件路径——并说明「读取管线完成，等待编译层（C）接入」。

---

## 附 · 当前版本说明

- **Sprint 2**：完整读取管线（Target B）。已接入 `claude-code-log` 做对话降噪。
- **设计原则**：Claude Code 原生能力（README/CLAUDE.md 自动加载、git 感知）不再重复造轮子。Bash 只做两件事：游标提取 + 外部工具调用（claude-code-log）。Read 工具做静默文件加载。对话降噪落盘为 `.claude-dream-context.md`，C 可直接 Read。
- **下游**：编译层（Target C）将在后续 Sprint 接入——届时格 4 的「当前背景上下文」直接作为 C 的输入。
- **B/C 边界（PO 确认）**：B 只负责读取 + 降噪 + 拼装；概念提取、交叉验证、四分类全部归 C。
