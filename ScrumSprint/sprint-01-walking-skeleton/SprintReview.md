# Sprint 1 — Walking Skeleton · Sprint Review

> 本文件记录 Sprint 1 的 **Increment 验收结论**：8 个工作项的完成情况、AC 逐条核对、DoD 达标核对，供 Sprint Review 向 PO（seapawn）展示。
>
> 验收日期：2026-07-18。所有验证均在真实 Claude Code（v2.1.214）headless 模式实跑，非纸面推演。

---

## 一 · 可用 Increment（能跑的东西）

**产物**：`claude-dream/` —— 一个通过官方 `plugin validate` 的 Claude Code 插件。

```
claude-dream/
├── .claude-plugin/
│   └── plugin.json          # name=claude-dream, version=0.1.0（✔ validate 通过）
└── skills/
    └── claude-dream/
        └── SKILL.md          # 入口：三格流程 + 路径解析 + 无上下文提示
```

**唤起方式**（两条通路，均真机验证）：
- 命令触发：`/claude-dream:claude-dream`（插件命名空间化命令名）
- 语义触发（薄版）：自然语言「开始做梦」等窄触发短语

---

## 二 · 工作项完成情况

| # | 工作项 | 状态 | 真机验证证据 |
|---|---|---|---|
| W1 | 插件目录 + `plugin.json` | ✅ | `plugin validate` → `✔ Validation passed` |
| W2 | `SKILL.md` 入口骨架 | ✅ | headless 列出命令 `claude-dream:claude-dream` |
| W3 | 本地加载验证 `--plugin-dir` | ✅ | 插件被识别、命令出现在可用列表 |
| W4 | 解析三条路径 | ✅ | slug 推断实测 = `D--ClaudeDream`（与真实目录一致）；三路径打印正确 |
| W5 | 三格流程 | ✅ | `/claude-dream:claude-dream` 走完 发起→确认→交接下游占位 |
| W6 | 无上下文明确提示 | ✅ | 伪造不存在项目路径 → skill 停在格2、如实报告缺失、不硬闯 |
| W7 | 端到端真机跑 | ✅ | 完整三格输出 + 目标项目确认，未写任何记忆 |
| W8 | 语义触发薄版 | ✅ | 「开始做梦」跳入同一入口，走完三格 |

---

## 三 · AC 逐条核对

**PB-Base-1 · 插件骨架与入口**
- ① 目录结构 + manifest 就位，Claude Code 能识别加载 → ✅ validate 通过 + headless 加载成功
- ② 入口（`/claude-dream:claude-dream`）命中并返回可见响应，下游可为空 → ✅ 三格输出可见
- ③ 解析出项目 / 记忆 / transcript 三条路径 → ✅ 三路径正确打印，slug 推断实测正确

**PB-Base-2 · 手动触发**
- ① 三格流程走通（发起→确认→交接下游）→ ✅ W7 实跑
- ② 触发后先确认目标项目再继续 → ✅ 格2 确认 `D--ClaudeDream` 后才进格3
- ③ 未识别到有效上下文时明确提示，非静默失败 → ✅ W6 实测报告缺失并停下

**PB-Auto-1.1· 语义召唤触发**
- ① `description` 写入窄触发短语 → ✅ SKILL.md frontmatter
- ② 去掉 `disable-model-invocation`，可自动识别跳入 → ✅ 未加该锁
- ③ 真机验证「开始做梦」跳入同一入口 → ✅ W8 实跑

---

## 四 · DoD 达标核对

| 类别 | 结论 | 证据 |
|---|---|---|
| 功能可用 | ✅ | 端到端在真实会话实跑，不半途失败 |
| 记忆质量 | — 本 Sprint 不适用 | 下游为空，无记忆落盘对象（见 SprintBacklog 五节说明） |
| 信任边界 | ✅ | git status 仅新增 `claude-dream/`；CLAUDE.md 未动；记忆目录零写入 |
| 可审阅 | ✅ | 本 Review 文档即变更摘要 |
| 索引一致 | ✅ | 未新增记忆文件，MEMORY.md 索引无需变动，无断链 |

**结论**：3 条 PBI 全部达到 DoD，可进 Sprint Review 展示。

---

## 五 · 环境变化 / 待 PO 决策（透明汇报）

| # | 事项 | 说明 |
|---|---|---|
| E1 | 真实命令名是 `/claude-dream:claude-dream`（双段） | 插件命名空间机制 `plugin:skill` 决定。SprintBacklog 写的是 `/claude-dream`。功能不受影响，但命令略啰嗦——是否重命名 skill 或调整插件名，归 PO 定。 |
| R3（承接） | Product Backlog 措辞 `run claudedream` vs 实际 `/claude-dream:claude-dream` | 已通过 6.1 改名解决（PO 决定统一为 `claude-dream`）。 |
| N1 | 语义触发薄版无防误触发 | 已知接受项（SprintBacklog R2）。`description` 已写「不要因对话提到记忆就自动启动」以降误触，但不承诺零误触；完整方案待 PB-Auto-1 补 IDEO。 |


六 · 待做（PO review 后承接）
Sprint 1 Increment 已交付后，PO 在 review 中追加的两块工作，尚未执行。记录待办步骤与已查清的机制事实，供后续承接。

6.1 三处统一改名 → claude-dream
PO 决定把插件相关命名统一为 claude-dream（原为 claudedream / claudedream-plugin，不一致）。范围：

对象	现值	目标值
插件目录	claudedream-plugin/	claude-dream/
manifest name（plugin.json）	claudedream	claude-dream
skill 目录名（= skill 名）	skills/claudedream/	skills/claude-dream/
SKILL.md frontmatter name + 正文自指	claudedream / /claudedream	claude-dream / /claude-dream
连锁影响：改名后真实命令从 /claudedream:claudedream → /claude-dream:claude-dream。

待 PO 一并处理的措辞同步（这些是 PO 在 Backlog/IDEO 拍板的命令措辞，不随本次机械改名自动改）：

ScrumSprint/ProductBacklog.md：Product Goal、PB-Base-1/2、PB-Auto-1.1 里的 /claudedream
ScrumSprint/sprint-01-walking-skeleton/SprintBacklog.md：Sprint Goal 等处 /claudedream
ScrumSprint/Architecture.md、.IDEO/DesignSprint/*：run claudedream（历史记录，是否改由 PO 定）
本文件（SprintReview）第一~五节中的 claudedream-plugin/、/claudedream:claudedream
改完必须：重跑 plugin validate + headless 真机验证命令名与三格流程（等同 W3/W7 重验一遍）。

6.2 安装与分发（已查清官方机制）
超出 Sprint 1 Goal 的新能力。目标：本项目自动用 + 可分发给别的项目/别人。三种加载机制事实：

机制	做法	范围	适用
A · --plugin-dir	启动加 --plugin-dir ./claude-dream	仅当前会话	开发调试（Sprint 1 已用）
B · skills-directory	插件放进 .claude/skills/ 下	自动加载，无需 install/marketplace	本项目/个人自动用
C · marketplace	建 marketplace.json → /plugin install	可跨项目、可分发	分发
关键澄清：settings.json 不能直接指定本地插件目录加载；其 enabledPlugins / extraKnownMarketplaces 是配合 marketplace（机制 C） 用的。

建议路径（机制 C 一箭双雕，待 PO 拍板）：

建 marketplace catalog .claude-plugin/marketplace.json，列出 claude-dream 插件及 source（本地路径或 GitHub repo）。
本项目 .claude/settings.json 写 extraKnownMarketplaces + enabledPlugins，团队 clone 后被提示安装。
别人：/plugin marketplace add <源> → /plugin install claude-dream@<marketplace>。
已知坑：project-scope 的 @skills-dir 插件只从「启动 Claude Code 的那个目录」的 .claude/skills/ 加载，不向上找仓库根——从子目录启动会漏。

Scrum 定位：6.2 是新产品能力，宜作为新 PBI 进 Product Backlog 由 PO 排优先级，而非直接在本 Sprint 追加。