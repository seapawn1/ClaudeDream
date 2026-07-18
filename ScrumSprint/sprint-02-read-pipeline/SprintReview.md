# Sprint 2 — 完整读取管线 · Sprint Review

> 本文件记录 Sprint 2 的 **Increment 验收结论**：10 个工作项的完成情况、5 条 PBI 的 AC 逐条核对、DoD 达标核对，以及 Review 中暴露的问题与修复。供 Sprint Review 向 PO（seapawn）展示。
>
> 验收日期：2026-07-19。所有验证均在真实 Claude Code 会话实跑（本会话逐命令验证 + DiaryAgent headless 真机验证），非纸面推演。

---

## 一 · 可用 Increment（能跑的东西）

**产物**：升级后的 `claude-dream/` 插件 —— Sprint 1 的空占位已被替换为一条完整的四路读取管线。

```
claude-dream/
├── .claude-plugin/
│   └── plugin.json          # name=claude-dream, version=0.2.0（✔ validate 通过）
└── skills/
    └── claude-dream/
        └── SKILL.md          # 完整四格流程：发起→确认→三路读取→汇总上下文
```

**Sprint 1 → Sprint 2 增量变化**：

| 维度 | Sprint 1 (v0.1.0) | Sprint 2 (v0.2.0) |
|---|---|---|
| 格 1 | 确认意图 | 同（微调措辞） |
| 格 2 | 解析三路径 + 确认项目 | 同（保留 slug 推断） |
| 格 3 | **空占位**：「交接下游占位，不做任何事」 | **四路读取**：项目感知 → 记忆基线+游标 → 对话降噪落盘 |
| 格 4 | 无 | **新增**：汇总摘要框 + 落盘文件路径 |
| 对话处理 | 无 | claude-code-log 降噪（98.2% 噪音剥除） |
| 跨项目 | 仅 ClaudeDream | ClaudeDream + DiaryAgent 双项目验证 |

**关键设计决策（Review 中 PO 拍板）**：

- Claude Code 原生能力（README/CLAUDE.md 自动加载、git 感知）不重复造轮子——Skill 只用提示词确认，不 Bash cat
- Bash 只做两件事：游标提取 + 外部工具调用（claude-code-log）
- Read 工具做记忆文件 + 对话降噪文件的静默加载，不喷 stdout
- 对话降噪落盘为 `.claude-dream-context.md`，供下游 C 直接 Read

---

## 二 · 工作项完成情况

| # | 工作项 | 状态 | 真机验证证据 |
|---|---|---|---|
| W1 | 实测 skill 环境的 shell/PATH | ✅ | Python 3.11.5 + pip 在 PATH，claude-code-log v1.5.0 已全局安装、直接可调用 |
| W2 | 定接入方式 + 命令模板 | ✅ | 直接 CLI：`claude-code-log <dir> --detail low --format md --compact -o <file>`，落盘于 SKILL.md 格 3.3 |
| W3 | 真实 jsonl 验证降噪 | ✅ | 277KB jsonl：full 4,452 行→low 79 行（98.2%）；6MB jsonl→2,678 行；compact 摘要段保留 |
| W4 | 读项目状态 | ✅ | 最终方案：Claude Code 原生加载 README/CLAUDE.md + git 感知，Skill 用提示词确认（Review 后修正） |
| W5 | 读记忆基线 | ✅ | MEMORY.md + 6 记忆文件，两阶段：bash 提取游标+文件列表 → Read 工具静默加载全文 |
| W6 | 取上次做梦游标 | ✅ | 从 frontmatter 提取最新 `modified` + 对应 `originSessionId`。有记忆→增量，无记忆→冷启动全量 |
| W7 | 对话解析 | ✅ | claude-code-log 落盘 `.claude-dream-context.md` + Read 加载；增量（41 会话/12,506 行）和全量（DiaryAgent 8 会话）两种模式各验证一次 |
| W8 | 汇总当前背景上下文 | ✅ | 格 4 摘要框：项目/时间/游标/三路状态/落盘路径。Sprint 1 空占位已替换 |
| W9 | DiaryAgent 插件加载 | ✅ | `claude --plugin-dir /d/ClaudeDream/claude-dream -p "/claude-dream"` 在 DiaryAgent 上成功加载+skill 命中+四格执行 |
| W10 | DiaryAgent 端到端 | ✅ | 冷启动路径正确：无记忆基线→全量首读；README+CLAUDE.md+git 10 commits 正常；8 会话降噪产出；格 4 汇总框完整展示设计决策轨迹 |

---

## 三 · AC 逐条核对

### PB-Base-5.1 · 对话读取工具接入（S·探路）

- ① 实测插件 skill 执行环境下能否调用 `claude-code-log` → ✅ 本会话实测：命令在 PATH、v1.5.0 全局安装、可直接调用
- ② 确定并落盘接入方式 + 调用命令模板 → ✅ 直接 CLI 调用，模板落盘于 SKILL.md 格 3.3 + SprintBacklog §4.1
- ③ 用本项目真实 jsonl 验证 `--detail low --format md --compact` 产出干净对话流 → ✅ 277KB jsonl 降噪 98.2%，6MB→2,678 行，compact 摘要段保留

### PB-Base-5 · 对话内容解析（M）

- ① 用 python 工具把 jsonl 转化成降噪后的干净对话、再读入 → ✅ claude-code-log 落盘 `.claude-dream-context.md` → Read 工具加载（Review 后修正：不再喷 stdout）
- ② 覆盖多会话：有游标→增量、无游标→全量首读 → ✅ ClaudeDream（增量 41 会话/12,506 行）+ DiaryAgent（全量 8 会话）两种模式各验证一次
- ③ 识别并保留 `/compact` 压缩摘要段 → ✅ `--detail low` 保留 `<summary>` 标签，DiaryAgent 输出 39 个标签
- ④ 只读不判 → ✅ SKILL.md 明确「只读不判」边界，Bash+Read only，不涉概念提取

### PB-Base-3 · 项目状态感知（M）

- ① 读出项目地图文件内容（README / CLAUDE.md） → ✅ Claude Code 自动加载（Review 后修正：不再重复 Bash cat）
- ② 读出 git 轨迹（log + diff） → ✅ Claude Code 原生 git 感知可用，Skill 提示词确认
- ③ 输出项目背景 + 变更轨迹两块内容 → ✅ 已在 agent 上下文中，格 4 摘要框确认
- ④ 只读不判 → ✅ 无任何写入操作

### PB-Base-4 · 记忆基线读取（S）

- ① 读出 MEMORY.md + 全部记忆文件内容 → ✅ bash 打印索引+文件列表 → Read 工具静默加载 6 个记忆文件全文
- ② 取出「上次做梦游标」；无游标→明确标记 → ✅ `CURSOR_DATE=2026-07-18T18:42:56.867Z`（ClaudeDream）/ `CURSOR_DATE=` 空（DiaryAgent），两态均明确
- ③ 输出记忆基线内容（记忆全文，不压成摘要） → ✅ Read 工具加载全文到上下文
- ④ 只读不判 → ✅ 无写入

### PB-Base-6 · 汇总交接 C · 当前背景上下文（S）

- ① 三项内容拼成一份当前背景上下文（不摘要、不压缩） → ✅ 项目感知已在上下文 + 记忆文件 Read 加载 + 对话降噪文件 Read 加载；落盘 `.claude-dream-context.md` 为持久化副本
- ② 自包含——C 读这一份即可开工 → ✅ 落盘文件 + agent 上下文，C 可直接 Read，不需回溯 jsonl / git / 记忆全文
- ③ 交接点替换 Sprint 1 空占位 → ✅ 格 3 从「交接下游占位」变为四路读取；新增格 4 汇总框

---

## 四 · DoD 达标核对

| 类别 | 结论 | 证据 |
|---|---|---|
| 功能可用 | ✅ | ClaudeDream 本会话重测全流程通过 + DiaryAgent headless 真机通过（`claude --plugin-dir ... -p "/claude-dream"`） |
| 记忆质量 | — 本 Sprint 不适用 | 无记忆落盘对象（读取阶段，写入归后续 Sprint） |
| 信任边界 | ✅ | `allowed-tools: Bash Read`；不编辑 CLAUDE.md；不写 repo 已有内容 |
| 可审阅 | ✅ | 本 Review 文档即变更摘要 |
| 索引一致 | ✅ | 未新增/修改记忆文件，MEMORY.md 索引无变动 |

**结论**：5 条 PBI 全部达到 DoD，可进 Sprint Review 展示。

---

## 五 · Review 中暴露的问题与修复

> Sprint 2 的 Review 不是走形式——PO（seapawn）在 Review 中发现了三个层面的设计问题，全部已修复并重测。

| # | 问题 | 严重度 | 修复 | 状态 |
|---|---|---|---|---|
| 1 | **Bash 当万能锤子**：格 3.1 用 Bash `cat` 读 README/CLAUDE.md，格 3.2 用 Bash `cat` 读记忆文件——这些是 Read 工具的活 | P0 设计缺陷 | 格 3.1 改为提示词确认（Claude Code 已自动加载）；格 3.2 记忆文件切 Read 工具 | ✅ |
| 2 | **没区分「加载」与「展示」**：对话 12,000 行直接喷 stdout、记忆全文 dump——数据展示和上下文加载混在一起 | P0 设计缺陷 | Bash 采集+落盘 → Read 静默加载 → 格 4 只展示摘要 | ✅ |
| 3 | **格 3.3 对话被截断**：`head -120` 导致 99% 对话内容丢失 | P1 数据丢失 | 改 `-o -` 为 `-o .claude-dream-context.md`，不再依赖 stdout | ✅ |
| 4 | **当前背景上下文未持久化**：PB-Base-6 AC② 要求「C 可直接处理」，但无任何文件落盘 | P1 完整性 | 对话降噪落盘 + 文件路径写入格 4 摘要框 | ✅ |
| 5 | **`LATEST_SESSION` 与 `LATEST` 不同步**：`LATEST` 取最新时间（`sort -r \| head -1`），`LATEST_SESSION` 取字典序末尾（`tail -1`） | P1 数据正确性 | 统一为 `sort -r \| head -1` | ✅ |
| 6 | **格 3.2 全文 dump 炸对话**：6 个记忆文件逐个 cat，内容长、噪音大 | P2 体验 | 改为 Read 工具静默加载，bash 只输出文件列表+游标摘要 | ✅ |
| 7 | **格 3.1 重复加载**：Claude Code 启动时已自动加载 README/CLAUDE.md，Skill 再 cat 一遍是浪费 | P2 体验 | 砍掉 Bash cat，提示词确认即可 | ✅ |

### 设计原则（Review 后确立，写入 SKILL.md 附录）

- **Bash**：只做游标提取（grep frontmatter）+ 外部工具调用（claude-code-log）
- **Read 工具**：做文件静默加载（记忆文件、对话降噪文件）
- **Claude Code 原生能力**：README/CLAUDE.md 自动加载、git 感知——不重复造轮子
- **落盘**：对话降噪产物持久化到 `.claude-dream-context.md`，C 可直接 Read

---

## 六 · 跨项目验证

| 项目 | 记忆状态 | 对话模式 | 会话数 | 输出行数 | 结果 |
|---|---|---|---|---|---|
| ClaudeDream | 6 记忆文件，游标 2026-07-18 | 增量（from 2026-07-17） | 41 | 12,506 | ✅ |
| DiaryAgent | 零记忆（冷启动） | 全量首读 | 8 | 8,547 | ✅ |

两种模式（有基线增量 / 首次全量）各覆盖一次。跨项目可用性验证通过。

---

## 七 · 环境变化 / 待 PO 决策

| # | 事项 | 说明 |
|---|---|---|
| E1 | SKILL.md 设计原则确立 | Bash/Read/Claude Code 原生能力三分工，写入附录。后续 Sprint 开发须遵守 |
| E2 | `.claude-dream-context.md` 落盘 | 对话降噪产物写入 transcript 目录下隐藏文件。C（Sprint 3+）可直接 Read。需在 `.gitignore` 排除？目前该目录本身不在 repo 内 |
| N1 | `--from-date` ISO 日期偏差 | dateparser 对 ISO 格式有时区/零点偏差，向前偏移 1 天兜底。偏差 ≤1 天，对增量做梦精度无实质影响。后续可探索更精确的游标机制 |
| N2 | 游标推断依赖 frontmatter | 当前从记忆文件 `modified` 推断。没有正式的"上次做梦记录"——如果记忆是手工写的（如当前 6 条来自 Design Sprint），游标准确但不够 formal。后续可在 C 落盘时写入一个专门的游标文件 |

---

## 八 · 总结

**Sprint Goal 达成**：ClaudeDream 的下游第一次真正「读到东西」——Sprint 1 的空占位已被替换为完整的四路读取管线。41 个会话经 claude-code-log 降噪（98.2% 噪音剥除）后落盘，6 条记忆基线就绪，当前背景上下文可供下游编译层（C）直接消费。

**Sprint 2 增量**：
- `SKILL.md`：从三格骨架扩展为四格完整流程（+85 行净增，砍掉冗余 Bash 后的实际增量）
- `plugin.json`：v0.1.0 → v0.2.0
- `.claude-dream-context.md`：对话降噪落盘产物（Sprint 2 首次产出）
- `SprintBacklog.md`：10 工作项完成记录 + 6 风险关闭 + 技术事实更新

**下一步**：编译层（Target C，PB-Base-7 起）——Gate 硬约束排除 → Extract → Cross-Reference → 四分类（CREATE/UPDATE/DELETE/SKIP）→ 写记忆文件。
