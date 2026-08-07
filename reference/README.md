# reference 调研原料

## 这里是什么

ClaudeDream 的外部参照物：别人怎么做"给 agent 攒记忆"这件事，以及 Claude Code 自己内置了什么。
只放原料，不放结论——从这些材料里读出的洞察归 `scrum/.IDEO/design-sprint/`。

**这些原料在设计冲刺中被怎么用了**：三场闪电演示拆解全部六份材料，产出 14 条 big idea 与 6 条反面清单（[IdeaPool](../scrum/.IDEO/design-sprint/Target-1-Consolidation/Ideate/IdeaPool.md)）；定稿方案的多处设计可溯源至此——机械体检判据源自 compiler 的 `lint.py`、工具缴械思路源自 claude-mem 的 `hardened-options.ts`、"人不参与梦、报告即汇报"的流程对照官方 auto-dream（但反其道做了留证与改 CLAUDE.md）。结论见 [DesignReview](../scrum/.IDEO/design-sprint/DesignReview.md)。

三类东西，处理方式各不同：

- **自己的提取文档**——入库。逐字从 `claude.exe` 二进制里逆出来的，上游没有，丢了要重来。
- **克隆的第三方仓库**——入库为普通文件（移除 `.git`，不保留上游仓库身份）。只读参考，不维护 fork。由根 `.gitignore`（`reference/**/.git/`）防止子仓库的 `.git` 内脏混入。
- **AI 转化产物**——由 AI（非本项目 agent）把已入库的第三方仓库改写成另一种形态，无独立上游、无 commit 可追溯。当"转化依据"本身即是研究对象时才收，只读，不当作可信实现验证。

## 文件地图

### 自己的提取（入库）

| 文件 | 内容 |
|---|---|
| `agent-memory/auto-memory/auto-memory.md` | Claude Code 内置的**实时记忆层**：对话进行中 agent 自己判断什么值得记，当场写入 `~/.claude/projects/<cwd>/memory/`。默认开启。源：`claude.exe` v2.1.210 逐字提取 + 本会话系统提示词实测比对，2026-07-16 |
| `agent-memory/auto-dream/auto-dream.md` | Claude Code 内置的**离线整合层**：后台 agent 定期回看会话日志，把散落信号整合进记忆文件——去重、消解矛盾、清理过期、重建索引。REM 睡眠隐喻。本机从未运行（灰度未放行，不是"默认关闭"）。源同上，交叉验证 [Piebald-AI/claude-code-system-prompts](https://github.com/Piebald-AI/claude-code-system-prompts) 的 v2.1.120 抽取版 |

这两份直接关系到本项目的定位：ClaudeDream 想做的"做梦"，Claude Code 内置的 auto-dream 就是同一件事的官方实现。

### 克隆的第三方仓库（已入库为普通文件，移除 .git）

| 目录 | 上游 | 克隆时的 commit | 用途 |
|---|---|---|---|
| `agent-memory/claude-memory-compiler/` | https://github.com/coleam00/claude-memory-compiler | `54eddd70` | Memory Compiler 原型——compile → index → log 模型，Design Sprint C 的主基座 |
| `claude-mem/` | https://github.com/thedotmack/claude-mem | `a90066f9` / 2026-08-02 clone | Claude Code 跨会话持久记忆系统（数万 star，star 数快照见根 [README.md](../README.md)「差异化在哪」节 ③）：5 个生命周期钩子捕获 → AI 压缩语义摘要 → SQLite+FTS5+Chroma 存储 → 新会话自动注入；差异化点③"本地可控"的一手证据来源，Target-1 闪电演示场 3 原料 |
| `claude-code-log/` | https://github.com/daaain/claude-code-log | 2026-07-19 clone | `pip install claude-code-log`（v1.5.0）。旧 Sprint 2 曾宣称 `--detail low --format md --compact` 降噪 98.2%——2026-08-01 Design Sprint 专家研究同版本复测三个真实会话：相对 `--detail full` 的 Markdown 体积降至约 1/4–1/7（77.6%–86.2%），相对原始 jsonl 降至约 1/20–1/170，随会话工具密度大幅波动；旧的 98.2% 为单样本、口径未声明（未说明是行数还是字节、基线是 full 还是原始 jsonl），疑似残缺输出导致的离群值，不可沿用 |

新增参考项目时：clone → 删除 `.git`（或改名 `.git-bak`）→ `git add` 以普通文件入库。`.gitignore` 里的 `reference/**/.git/` + `reference/claude-code-log/` 防止误提交子仓库的 git 内脏。

### AI 转化产物（无独立上游，只读不可信）

| 目录 | 转化依据 | 转化方式 | 用途 |
|---|---|---|---|
| `claude-dream/` | `agent-memory/claude-memory-compiler/`（原型） | 由 AI 改写：`claude-agent-sdk` 后台进程 → Claude Code 原生 slash commands（`/flush` `/compile` `/query` `/lint`）+ subagents（compiler / query-engine / linter），去掉独立 API 计费 | 展示"同一套 compile→lint→query 架构，换成 Claude Code 插件形态长什么样"——**不是**上游仓库，无 commit 可追溯，不能当作已验证的实现直接抄；此前提炼的设计结论记忆已随 2026-07-29 项目重启丢失，需要时以 `claude-memory-compiler` 原型源码为准
