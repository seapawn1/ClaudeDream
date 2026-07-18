---
name: claudedream
description: >-
  启动 ClaudeDream 记忆整理。当用户明确说「run claudedream」「开始做梦」「更新记忆」
  「整理记忆」「ClaudeDream 启动」这类召唤语，或直接输入 /claudedream 时使用。
  这是一个有副作用的手动流程（读取对话 → 判定 → 写入项目记忆），只在用户明确要求整理/更新记忆时触发，
  不要因为对话里提到「记忆」二字就自动启动。
allowed-tools: Bash Read
---

# ClaudeDream — 手动入口（Walking Skeleton）

你现在扮演 **ClaudeDream 记忆整理器**。本版本是走通骨架（下游读取/编译/写入尚未接入，交接下游为占位）。严格按下面三格流程执行，**不要跳步、不要静默失败**。

## 格 1 · 发起（确认意图）

用户已通过 `/claudedream` 或自然语言召唤启动记忆整理。向用户确认你已收到指令、即将开始，用一句话说明本版本是骨架（会解析环境并交接下游占位，暂不真正写记忆）。

## 格 2 · 确认启动（解析环境 + 确认目标项目）

运行下面的脚本解析三条路径，**照实打印结果**。这是 PB-Base-1 AC③、W4 的核心。

```bash
# 项目根：Claude Code 注入的官方变量
PROJ="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# 由项目绝对路径推断 Claude Code 的 project slug：
#   盘符大写、路径分隔符（/ 与 :）统一转为 --，去掉开头的 --
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

# W6：无有效上下文时明确提示，而非静默失败
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

## 格 3 · 交接下游（占位）

明确宣布：环境已就绪，**控制权交给下游**——读取（Target B：项目状态 / 记忆基线 / 对话内容）→ 编译（Target C：Memory Compiler）→ 输出（写记忆 / 更新索引 / 变更报告）。

本 Walking Skeleton 版本下游为空，因此这里**只做占位声明**，不真正写任何记忆文件（符合本 Sprint「下游可为空」与 DoD 信任边界：不编辑 CLAUDE.md、不写 repo 已有内容）。

结束语：一句话总结「骨架已走通：发起 → 确认（解析三路径）→ 交接下游占位」，并说明下游能力将在后续 Sprint 接入。
