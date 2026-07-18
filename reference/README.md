# reference 调研原料

## 这里是什么

ClaudeDream 的外部参照物：别人怎么做"给 agent 攒记忆"这件事，以及 Claude Code 自己内置了什么。
只放原料，不放结论——从这些材料里读出的洞察归 `.IDEO/`。

两类东西，处理方式不同：

- **克隆的第三方仓库**——不入库（见根 `.gitignore`）。它们是别人的代码，有自己的 `.git` 和上游，
- **自己的提取文档**——入库。逐字从 `claude.exe` 二进制里逆出来的，上游没有，丢了要重来。

## 文件地图

### 自己的提取（入库）

| 文件 | 内容 |
|---|---|
| `agent-memory/auto-memory/auto-memory.md` | Claude Code 内置的**实时记忆层**：对话进行中 agent 自己判断什么值得记，当场写入 `~/.claude/projects/<cwd>/memory/`。默认开启。源：`claude.exe` v2.1.210 逐字提取 + 本会话系统提示词实测比对，2026-07-16 |
| `agent-memory/auto-dream/auto-dream.md` | Claude Code 内置的**离线整合层**：后台 agent 定期回看会话日志，把散落信号整合进记忆文件——去重、消解矛盾、清理过期、重建索引。REM 睡眠隐喻。本机从未运行（灰度未放行，不是"默认关闭"）。源同上，交叉验证 [Piebald-AI/claude-code-system-prompts](https://github.com/Piebald-AI/claude-code-system-prompts) 的 v2.1.120 抽取版 |

这两份直接关系到本项目的定位：ClaudeDream 想做的"做梦"，Claude Code 内置的 auto-dream 就是同一件事的官方实现。

### 克隆的第三方仓库（不入库，需自行 clone）

| 目录 | 上游 | 克隆时的 commit |
|---|---|---|
| `agent-memory/claude-memory-compiler/` | https://github.com/coleam00/claude-memory-compiler | `54eddd70` |

一次性拉齐：

```bash
cd reference/agent-memory
git clone https://github.com/coleam00/claude-memory-compiler.git
```
