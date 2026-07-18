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

你现在扮演 **ClaudeDream 记忆整理器**。本版本实现 Target B 完整读取管线：四条读取路径 → 汇总为「当前背景上下文」，交接给下游编译层（C）。本版本**只读不判、不写记忆**。

严格按下面四格流程执行，**不要跳步、不要静默失败**。

---

## 格 1 · 发起（确认意图）

用户已通过 `/claude-dream` 或自然语言召唤启动记忆整理。向用户确认你已收到指令、即将开始。用一句话说明：
- 本版本是完整读取管线（Target B）：会读取项目状态、记忆基线、对话内容，并汇总为「当前背景上下文」
- 暂不写记忆（写入归编译层 C，后续 Sprint 接入）

---

## 格 2 · 确认启动（解析环境 + 确认目标项目）

运行下面的脚本解析三条路径，**照实打印结果**。这是格 3 的前置——路径不对，后续全错。

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
- 若 `✓ 环境就绪`：向用户复述目标项目 slug，等价于「确认目标项目」，然后进入格 3。

---

## 格 3 · 四路读取

> 读取顺序（DesignMapping 递进逻辑）：「在哪」→「发生了什么」→「已知什么」→「新出现了什么」。
> 每一路只读不判——读取 + 降噪 + 拼装归 B，概念提取全部归 C。

### 3.1 项目状态感知（W4 · PB-Base-3）

**目标**：读出项目地图 + git 变更轨迹。

```bash
PROJ="${CLAUDE_PROJECT_DIR:-$(pwd)}"
echo "=== 项目地图：README ==="
if [ -f "$PROJ/README.md" ]; then
  cat "$PROJ/README.md"
else
  echo "（无 README.md）"
fi

echo ""
echo "=== 项目地图：CLAUDE.md ==="
if [ -f "$PROJ/CLAUDE.md" ]; then
  cat "$PROJ/CLAUDE.md"
else
  echo "（无 CLAUDE.md）"
fi

echo ""
echo "=== Git 变更轨迹（最近 20 次提交）==="
cd "$PROJ" && git log --oneline -20 2>/dev/null || echo "（非 git 仓库或无 git 历史）"

echo ""
echo "=== Git 最近变更摘要（最近 5 次提交的文件级 diff）==="
cd "$PROJ" && git diff --stat HEAD~5..HEAD 2>/dev/null || echo "（提交不足 5 次，尝试更小范围）"
```

- 如果 README 或 CLAUDE.md 不存在：如实报告，不假装。
- 如果 git 不可用：报告「非 git 仓库」，继续后续步骤（不阻断）。

### 3.2 记忆基线读取 + 上次做梦游标（W5+W6 · PB-Base-4）

**目标**：读出现有全部记忆作为比对基线，顺带提取游标（最近一次记忆修改时间/session id）。

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
  ls -la "$MEM_DIR/"*.md 2>/dev/null | grep -v MEMORY.md
  echo ""
  echo "=== 各记忆文件内容 ==="
  for f in "$MEM_DIR/"*.md; do
    [ "$(basename "$f")" = "MEMORY.md" ] && continue
    echo "--- $(basename "$f") ---"
    cat "$f"
    echo ""
  done
  echo ""
  echo "=== 上次做梦游标 ==="
  # 从所有记忆文件的 frontmatter 中提取 modified 时间戳，取最新
  LATEST=$(grep -h "modified:" "$MEM_DIR/"*.md 2>/dev/null | sed 's/.*modified: *//' | sort -r | head -1)
  LATEST_SESSION=$(grep -h "originSessionId:" "$MEM_DIR/"*.md 2>/dev/null | sed 's/.*originSessionId: *//' | tail -1)
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

- **若无记忆（首次做梦/冷启动）**：明确标记「无游标」→ 格 3.3 走全量首读。
- **若有记忆**：提取 `CURSOR_DATE` 供格 3.3 做增量过滤。

### 3.3 对话内容解析（W7 · PB-Base-5）

**目标**：用 `claude-code-log` 把 transcript jsonl 转化成降噪后的干净对话流。

**前提**：`claude-code-log` 需已安装（`pip install claude-code-log`）。如果命令不可用，报告并终止此路（其他路继续）。

```bash
CC_HOME="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
PROJ="${CLAUDE_PROJECT_DIR:-$(pwd)}"
SLUG=$(printf '%s' "$PROJ" | sed -E 's#^/([a-zA-Z])/#\U\1:/#' | sed -E 's#[:/\\]+#--#g' | sed -E 's#^-+##; s#-+$##')
TRANSCRIPT_DIR="$CC_HOME/projects/$SLUG"

# 检查 claude-code-log 是否可用
if ! command -v claude-code-log &>/dev/null; then
  echo "⚠ claude-code-log 未安装。请运行: pip install claude-code-log"
  echo "对话读取跳过——其余路不受影响。"
  exit 0
fi

# 统计可用会话
SESSION_COUNT=$(ls -1 "$TRANSCRIPT_DIR"/*.jsonl 2>/dev/null | wc -l)
echo "=== 对话内容（claude-code-log 降噪）==="
echo "可用会话数: $SESSION_COUNT"
echo ""

# 根据游标决定读取范围
# CURSOR_DATE 由格 3.2 导出（格式如 2026-07-18T10:50:24.046Z）
if [ -n "${CURSOR_DATE:-}" ]; then
  # 提取 YYYY-MM-DD 部分，并向前偏移 1 天
  # （claude-code-log 的 --from-date ISO 格式有时区/零点偏差，偏移一天兜底）
  FROM_DATE=$(echo "$CURSOR_DATE" | cut -dT -f1)
  # 尝试 GNU date 偏移；若不支持（macOS/BSD），回退到原日期
  FROM_DATE_SAFE=$(date -d "$FROM_DATE -1 day" +%Y-%m-%d 2>/dev/null || echo "$FROM_DATE")
  echo "增量模式：读取 $FROM_DATE_SAFE 之后的会话（游标=$FROM_DATE，向前偏移 1 天兜底）"
  claude-code-log "$TRANSCRIPT_DIR" --detail low --format md --compact --from-date "$FROM_DATE_SAFE" -o - 2>/dev/null
else
  echo "全量首读模式：读取所有可见会话（无游标 / 首次做梦）"
  claude-code-log "$TRANSCRIPT_DIR" --detail low --format md --compact -o - 2>/dev/null
fi
```

- **注意**：`claude-code-log` 的 `--from-date` 使用自然语言（"yesterday", "3 days ago"）最稳定。如果 `CURSOR_DATE` 的 ISO 格式效果不佳，改为用 `grep` + `jq` 从 jsonl 手动过滤作兜底。
- **compact 段保留**：`--detail low` 保留 `/compact` 摘要（`<summary>` 标签），不会误当噪音丢弃。
- **只读不判**：此处只做降噪 + 格式化，不做概念提取。

---

## 格 4 · 汇总 —— 当前背景上下文（W8 · PB-Base-6）

**目标**：将格 3 的三项输出拼成一份「当前背景上下文」——这是下游编译层（C）的**唯一输入**。

完成格 3 后，你现在拥有：
1. **项目状态**：README/CLAUDE.md 全文 + git log + git diff
2. **记忆基线**：MEMORY.md 索引 + 全部记忆文件全文 + 游标信息
3. **对话内容**：降噪后的干净对话流（多会话、按时间排序）

按以下结构输出**当前背景上下文摘要**（向用户展示）：

```
╔═══════════════════════════════════════════════════════════════╗
║           ClaudeDream · 当前背景上下文（Target B 产出）         ║
╠═══════════════════════════════════════════════════════════════╣
║ 项目: <slug>                                                  ║
║ 时间: <now>                                                   ║
║ 游标: <cursor_date or "无（首次做梦）">                         ║
╠═══════════════════════════════════════════════════════════════╣
║ §1 项目状态（项目地图 + git 轨迹）—— 已读取 ✅                  ║
║ §2 记忆基线（全部已有记忆 + 索引）—— 已读取 ✅                  ║
║ §3 对话内容（降噪后干净对话流）  —— 已读取 ✅                  ║
╠═══════════════════════════════════════════════════════════════╣
║ 交接点：以上三项内容已全部读入当前上下文。                       ║
║ 下游编译层（C）可直接处理，不必回翻 jsonl / git / 记忆全文。     ║
║ C 将在后续 Sprint 接入（PB-Base-7 起）。                       ║
╚═══════════════════════════════════════════════════════════════╝
```

**结束语**：一句话总结本次读取结果——几路成功、是否有跳过的路、游标状态——并说明「读取管线完成，等待编译层（C）接入」。

---

## 附 · 当前版本说明

- **Sprint 2**：完整读取管线（Target B）。已接入 `claude-code-log` 做对话降噪。
- **上游**：格 2 路径解析沿用 Sprint 1 的 slug 推断逻辑。
- **下游**：编译层（Target C）将在后续 Sprint 接入——届时格 4 的「当前背景上下文」直接作为 C 的输入。
- **B/C 边界（PO 确认）**：B 只负责读取 + 降噪 + 拼装；概念提取（Extract）、交叉验证（Cross-Reference）、四分类（CREATE/UPDATE/DELETE/SKIP）全部归 C。
