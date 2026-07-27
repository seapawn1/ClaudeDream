# Sprint 5 — 系统性 eval 环境（PB-Eval-1 · eval-test-set）

> 本文件是 ClaudeDream 第五个 Sprint 的 **Sprint Backlog**（Scrum 工件）：Sprint Goal（为什么）+ 选中 PBI（做什么）+ 工作项分解（怎么做）。
>
> 关联工件：[Product Backlog](../ProductBacklog.md) · [Definition of Done](../DefinitionOfDone.md) · 上一 Sprint [Sprint 4 Review](../sprint-04-compile-write/SprintReview.md)
>
> **落盘约定**：本 Sprint 的所有产出文件放在本文件夹 `sprint-05-eval-test-set/` 下，eval 主体项目为独立仓库（另建）。

---

## 一 · Sprint Goal

> **为 ClaudeDream 的编译行为建立可量化基线——定义「什么结果算正确」，并产出一套可重复运行的测试集，使每次改进都有客观依据而非靠目测。**

- **为什么有价值**：Sprint 4 交付了完整编译链，但"编译对了"靠的是目测和主观判断。即将到来的架构重构（PB-Import-1）会大幅改写编译层——没有基线，无法证明重构没有退化。eval 基线让 ClaudeDream 的质量从「感觉还好」升级为「数据可查」。
- **凝聚性**：一个目标（建立 eval 基线），围绕一个端到端测试主体项目展开，完成后 PB-Eval-1 和 PB-Comp-1 同时可标记已完成。
- **可 demo**：Sprint Review 展示：① eval 主体仓库（独立 git）② claude project 目录 git 化后的 commit 历史 ③ 跑一遍 `/claude-dream` 后的 git diff ④ 首轮基线报告（各路径通过率）。

---

## 二 · 选中的 PBI

摘抄自 [Product Backlog](../ProductBacklog.md) 待做区。

| 编号 | 标题（size） | 用户故事 | Acceptance Criteria | 依赖 | 状态 |
|---|---|---|---|---|---|
| PB-Eval-1 | 系统性 eval 环境（L） | 作为 ClaudeDream 的开发者，我想要一个可重复运行的 eval 环境，给定一个真实项目作为测试对象，每次跑 `/claude-dream` 后用 git diff 观察记忆变化，从而量化评估编译质量、证明每次改进没有退化。 | ① **eval 主体项目存在**：独立 git 仓库，含预置项目结构和模拟对话历史，能触发各测试路径；② **claude project 目录全量 git 化**：`~/.claude/projects/<eval-subject-slug>/` 整个文件夹独立 git 追踪（全量，不做 .gitignore 过滤），每次 `/claude-dream` 后可 commit；③ **测试路径覆盖**：能触发 Gate（噪音/有效内容）、四分类（🆕/⚡/🗑️/🔁）、防腐涂料（git漂移/双源/superseded）；④ **可重复运行**：eval 流程有文档化步骤；⑤ **基线报告存在**：对 Sprint 4 系统跑一遍，git diff 展示完整变化，人工评分各路径通过率；⑥ **可迁移性**：eval 主体与实现无关，SKILL.md 和重构后的 commands 均可用同一主体。 | Sprint 4 已交付（有可运行的 `/claude-dream`） | 就绪 |
| PB-Comp-1 | 判定深化测试（M）· **并入本 Sprint** | 作为 ClaudeDream 的开发者，我想验证 Sprint 4 原型未覆盖的四条判定路径（🗑️删除/⚡冲突/SQ3漂移/SQ4边界），以确认编译链在极端情况下行为可信。 | eval 主体预置场景须覆盖：① 🗑️ 对话明确推翻旧记忆 → 触发删除；② ⚡ 新旧信息冲突 → 触发 superseded 标注；③ SQ3 git 漂移候选 → 触发 possibly-stale 标注；④ SQ4 边界场景 → 保守降级（拿不准则 Update 而非 Delete）。**无独立交付物**，通过 PB-Eval-1 的 eval 运行验证，完成后 PB-Comp-1 标记已完成。 | PB-Eval-1 | 就绪 |

*说明：PB-Comp-1 的四条未测路径是 eval 主体需要覆盖的高价值场景，并入本 Sprint 一起验证，不单独交付。*

---

## 三 · Definition of Done

> 摘自 [DefinitionOfDone.md](../DefinitionOfDone.md)，全局底线，本 Sprint 每条交付增量均须满足。

| 类别 | 完成项 | 如何验证 |
|---|---|---|
| 功能可用 | `/claude-dream` 端到端跑通，不半途失败 | 在**至少两个**异构项目上真机实跑——开发项目 + 一个外部项目（含 eval 主体） |
| 记忆质量 | frontmatter 完整（含 sources 双源：session id + git commit hash）；用绝对日期；冲突时保留旧内容 + superseded 标注 | 输出文件逐条对照 |
| 信任边界 | 不编辑 CLAUDE.md；不存 repo 已有内容 | diff 检查 |
| 可审阅 | 生成变更摘要报告 | 报告存在 |
| 索引一致 | `MEMORY.md` 索引与实际记忆文件一致（无断链 / 漏项） | 索引核对 |
| 独立验证 | 以上所有条目通过判定**不得由执行者自评** | 由 **subagent**（独立审计）或 **seapawn（PO）** 逐条检验并给出通过 / 不通过结论 |
| 优雅结构 | 新增 PBI 实现时，目录结构对标参考项目模式（`scripts/`、`hooks/`、`daily/` 分层），不把所有实现塞进单一 SKILL.md | code review 检查目录结构符合分层约定 |

---

## 四 · eval 主体项目设计

**方案**：两个真实项目作为双 eval 主体（2026-07-27 更新）

| 主体 | 项目路径 | claude project dir | transcript | memory/ | 角色 |
|---|---|---|---|---|---|
| **IDEO-Scrum** | `F:\IDEO-Scrum` | `~/.claude/projects/F--IDEO-Scrum/` | 14 个 jsonl（~36MB） | 无（冷启动） | Gate + 🆕 Create 路径为主 |
| **DiaryAgent** | `F:\DiaryAgent` | `~/.claude/projects/f--DiaryAgent/` | 5 个 jsonl | 已有 2 个记忆文件 | ⚡ Update / 🗑️ Delete / SQ3/SQ4 路径为主 |

两个 claude project 目录均已在 2026-07-27 完成 `git init` + baseline commit（全量纳入，无 `.gitignore`）。

```
~/.claude/projects/<slug>/     ← 独立 git 追踪，全量
    ├── memory/
    │   ├── MEMORY.md
    │   └── *.md（记忆文件）
    ├── *.jsonl（transcript，全量纳入）
    └── 其他 Claude Code 生成文件
```

**每次 eval 跑法**（两主体各跑一遍）：
1. 在目标主体的项目目录下触发 `/claude-dream`
2. 完毕后两仓库（项目本身 + claude project dir）各自 `git add -A && git commit`
3. `git diff HEAD^` 展示本轮完整变化
4. 对照 `test-path-matrix.md` 的预期：各路径正确触发？人工评分

**可行性**：无需架构改动，eval 基础设施（git 追踪）已就绪（W2 ✅）。

---

## 五 · 工作项

> Developer 在 2026-07-27 执行启动前补充（Sprint Goal + AC 由上轮 Planning 确认）。

| # | 工作项 | 归属 AC | 验收信号 |
|---|---|---|---|
| W1 | 创建 eval-subject 仓库骨架：`git init eval-subject` + `README.md`（项目简介 + eval 用途）+ `CLAUDE.md`（告知 Claude 这是测试项目）+ 初始 commit | AC① | 仓库存在，`git log` 有初始 commit |
| W2 | git 化 claude project 目录：对 `~/.claude/projects/<eval-subject-slug>/` 执行 `git init`，全量纳入（无 `.gitignore`），commit 初始状态 | AC② | 目录下 `git status` 干净，`git log` 有 commit |
| W3 | 设计测试路径矩阵：列出 6 条测试路径（Gate噪音 / 🆕纯新知识 / ⚡冲突更新 / 🗑️明确推翻 / SQ3 git漂移 / SQ4保守边界），每条写明「对话说了什么 → 预期触发哪条规则 → 预期产出」，落盘 `test-path-matrix.md` | AC①③ + PB-Comp-1①②③④ | 矩阵文档存在，PB-Comp-1 的 4 条判定路径均有对应行 |
| W4 | 构造模拟对话 transcript：按 W3 路径矩阵，在 eval-subject 目录下进行实际对话（产生 `.jsonl` transcript），内容覆盖各路径触发场景 | AC①③ | `.jsonl` 文件可被 `claude-code-log` 正确解析，内容可触发对应路径 |
| W5 | 预置 baseline memories：在 claude project 目录的 `memory/` 写入若干初始记忆文件（为⚡/🗑️/SQ3 路径提供印证基准），更新 MEMORY.md 索引，commit 为"baseline"状态 | AC②③ | `memory/` 有文件，MEMORY.md 无断链，git log 有 baseline commit |
| W6 | 首跑 eval（Sprint 4 系统）：在 eval-subject 目录触发 `/claude-dream`，完毕后两仓库各 `git add -A && git commit`，保存完整 git diff 记录 | AC⑤ | 两仓库均有新 commit，`git diff HEAD^` 展示完整变化 |
| W7 | 人工评分 + 撰写基线报告：对照 W3 的预期矩阵，逐路径判断通过 / 不通过，写 `eval-report-baseline.md` | AC⑤ | 报告存在，各路径有 ✅/❌ 判定 + 通过率小结 |
| W8 | Runbook + DoD 独立验证：写 `eval-runbook.md`（reset → run → diff → score 四步）；独立 subagent 或 seapawn 逐 AC 核查并给出通过 / 不通过结论 | AC④⑥ + DoD独立验证 | Runbook 存在，DoD 每条有明确结论 |

---

## 六 · 开始日期与分支

开始日期：2026-07-27。

Branch：`sprint-05-eval-test-set--06`（当前活跃分支，含 Sprint 5 + Sprint 6 Planning 文档）。
