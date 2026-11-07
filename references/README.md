# references 调研原料

## 这里是什么

ClaudeDream 的外部参照物：别人怎么做“给 agent 攒记忆”这件事，以及 Claude Code 自己内置了什么。
只放原料，不放结论。部分材料是 2026-07 的快照（各条目标有提取或克隆日期），使用前对照官方现状复核。

三类东西，处理方式各不同：

- **自己的提取文档**——入库。逐字从 `claude.exe` 二进制里逆出来的，上游没有，丢了要重来。
- **克隆的第三方仓库**——入库为普通文件（移除 `.git`，不保留上游仓库身份）。只读参考，不维护 fork。由根 `.gitignore`（`references/**/.git/`）防止子仓库的 `.git` 内脏混入。
- **上游官方文档 / 文章 / cookbook**——原样下载（含示例数据），不改写、不节选。

## 文件地图

### 自己的提取（入库）

| 文件 | 内容 |
|---|---|
| `auto-memory/auto-memory.md` | Claude Code 内置的**实时记忆层**：对话进行中 agent 自己判断什么值得记，当场写入 `~/.claude/projects/<cwd>/memory/`。默认开启。源：`claude.exe` v2.1.210 逐字提取 + 本会话系统提示词实测比对，2026-07-16 |
| `auto-dream/auto-dream.md` | Claude Code 内置的**离线整合层**：后台 agent 定期回看会话日志，把散落信号整合进记忆文件——去重、消解矛盾、清理过期、重建索引。REM 睡眠隐喻。本机从未运行（灰度未放行，不是“默认关闭”）。源同上，交叉验证 [Piebald-AI/claude-code-system-prompts](https://github.com/Piebald-AI/claude-code-system-prompts) 的 v2.1.120 抽取版 |

这两份直接关系到本项目的定位：ClaudeDream 想做的“做梦”，Claude Code 内置的 auto-dream 就是同一件事的官方实现。

### 上游官方文档、文章与 cookbook（原样下载）

| 目录 | 上游与内容 |
|---|---|
| `dreaming-cookbook/` | Anthropic 官方 cookbook [《Dreaming with a dynamic workflow》](https://github.com/anthropics/claude-cookbooks/blob/main/managed_agents/CMA_dreaming_with_a_dynamic_workflow.ipynb)，2026-11-07 从 `main` 下载。含 notebook 原件和完整的 `example_data/memory_distill/`：两张流程图、四个 prompt（lead / analyzer / organizer / work_request）、11 份示例 transcript（约 290 KB）。notebook 里的图片按相对路径可直接显示。 |
| `components-of-agent-memory/` | Anthropic 官方工程文章 [《The components of agent memory》](https://www.anthropic.com/research/components-of-agent-memory)，2026-11-06 发布，2026-11-07 抓取。`article.html` 原样快照；`article-readable.html` 是离线可读版（16 张图下载到 `assets/`，带最小样式）；`README.md` 是事实摘录与短引文（非全文翻译）。文章给出 transcript → memory notes → wiki → injected context 的记忆层级、dreaming 在各级之间的作用，以及 CL-Bench / Pokémon / wiki 的实测数据。 |
| `knowledge-wiki/` | Anthropic 官方 quickstart [《Knowledge wiki with a dynamic workflow》](https://github.com/anthropics/claude-quickstarts/tree/main/managed-agents/knowledge-wiki)，2026-11-07 从 `main` 稀疏克隆。含 README、`skill.md`、notebook、四个 prompt（analyzer / organizer / lead / baseline）、示例数据和图片。它把文档语料建成 wiki（记忆表示层），与 dreaming cookbook 的“transcript → 记忆笔记”互补。 |
| `official-docs/` | 4 份官方文档的 markdown 快照（2026-11-07 抓取）：Claude Code memory、Managed Agents Dreams、Managed Agents memory、API memory tool。定义 ClaudeDream 要写入或对接的存储与接口契约；索引见该目录 `README.md`。 |
| `official-articles/` | 官方文章筛选与 6 份 HTML 快照（2026-11-07）：evals、multi-agent、context engineering、long-running harnesses、Agent Skills、writing tools；另含 harness-design、Managed Agents、Claude Code best practices 的笔记或链接。总表和分篇笔记见该目录 `README.md`。 |

### 克隆的第三方仓库（已入库为普通文件，移除 .git）

| 目录 | 上游 | 克隆时的 commit | 用途 |
|---|---|---|---|
| `claude-memory-compiler/` | https://github.com/coleam00/claude-memory-compiler | `54eddd70` | Memory Compiler 原型——compile → index → log 模型，Design Sprint C 的主基座 |

新增参考项目时：clone → 删除 `.git`（或改名 `.git-bak`）→ `git add` 以普通文件入库。`.gitignore` 里的 `references/**/.git/` 防止误提交子仓库的 git 内脏。
