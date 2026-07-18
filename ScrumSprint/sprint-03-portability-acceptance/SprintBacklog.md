# Sprint 3 — 插件可迁移性与真人验收

> 本文件是 ClaudeDream 第三个 Sprint 的 **Sprint Backlog**（Scrum 工件）：Sprint Goal（为什么）+ 选中 PBI（做什么）+ 工作项分解（怎么做）。
>
> 关联工件：[Product Backlog](../ProductBacklog.md) · [Definition of Done](../DefinitionOfDone.md) · [Architecture](../Architecture.md) · 上一 Sprint [Sprint 2 Review](../sprint-02-read-pipeline/SprintReview.md)
>
> 开始日期：2026-07-19。Planning 由 Developer（pawn）主持，PO（seapawn）拍板。

---

## 一 · Sprint Goal

> **让插件离开开发者机器也能活，并且 seapawn（PO）异地亲手安装、亲手跑通、亲口说"满意"——以真人验收作为 Sprint 3 的完成标志。**

- **为什么有价值**：Sprint 2 的插件功能上能跑，但 `claude-code-log` 依赖开发者本机全局 pip 安装——换机器即不可用。seapawn 从未在异地项目亲手安装使用过。这两个 gap 堵上之前，插件不算真正"可交付"。
- **凝聚性**：两个 S 级 PBI（依赖自包含 + 真人验收）构成一个完整的"产品就绪"闭环——技术上自包含、体验上真人认可。

---

## 二 · 选中的 PBI

摘抄自 [Product Backlog](../ProductBacklog.md) 待做区前两条。scope = 全部纳入（PO 拍板）。C 延后至 Sprint 4。

| 编号 | 标题 | size | 用户故事 | Acceptance Criteria | 依赖 | 状态 |
|---|---|---|---|---|---|---|
| PB-Base-5.2 | 插件可迁移性——依赖自包含 | S | 作为 Claude Code 用户，我想在任何项目上安装 ClaudeDream 插件后直接使用，不需要提前手动 pip install 任何东西。 | ① SKILL.md 格 3.3 检测 `claude-code-log` 不可用时**自动 `pip install`**——不需用户手动操作；② 在新环境（无全局 claude-code-log）上验证：安装插件后 `/claude-dream` 格 3.3 自动安装依赖并正常执行；③ 自动安装失败时给出清晰的手动指引，不静默跳过。 | 无 | 就绪 |
| PB-Base-5.3 | 用户手动安装验收——异地真机 | S | 同上 | 同上 | PB-Base-5.2 | 就绪 |
| PB-Base-5.3 | 用户手动安装验收——异地真机 | S | 作为 PO（seapawn），我想在任意一个非 ClaudeDream 项目上，从零手动安装插件 → 执行 `/claude-dream` → 对产出结果满意——整个过程不卡壳、不需开发者指导。 | ① seapawn 在终端 `cd <异地项目>` → 安装插件（`--plugin-dir` 或 marketplace，行为等价）→ 插件被识别；② 执行 `/claude-dream`，四格流程完整走完，不报错、不卡壳、不需 pawn 远程指导；③ seapawn 阅读格 4 汇总框 + 对话降噪产物后，主观判断「这东西有用、我愿意继续用」；④ 过程中遇到的任何摩擦点记录为 feedback，不要求 Sprint 内全部解决但必须记录。 | PB-Base-5.2 | 就绪 |

**PB-Base-5.2 方案**（PO 已拍板）：SKILL.md 格 3.3 自动检测 + `pip install claude-code-log`——不 vendored（尊重上游开源项目），不要求用户手动操作。

---

## 三 · 工作项分解（≤1 天/项）

| # | 工作项 | 归属 | 验收信号 |
|---|---|---|---|
| W1 | SKILL.md 格 3.3 加入自动检测+安装逻辑：`command -v` 失败 → `pip install` → 再试 | PB-Base-5.2 ①③ | 首次运行自动安装，无需用户干预 |
| W2 | 真机验证：在无全局 claude-code-log 的环境，确认 `/claude-dream` 格 3.3 自动安装后正常执行 | PB-Base-5.2 ② | 新环境端到端通过 |
| W3 | seapawn 异地项目亲手安装 + 执行——pawn 观察、不指导 | PB-Base-5.3 ①② | 插件被识别、四格无卡壳 |
| W4 | seapawn 满意度判定 + 摩擦点收集 → 记录为 Product Backlog feedback | PB-Base-5.3 ③④ | seapawn 说"满意" |
| W5 | 根据 W4 反馈做一轮快速 polish（如果 feedback 有可速修项） | PB-Base-5.3 闭环 | feedback 项修复或记录 |

*W1→W2 vendored 自包含验证 → W3→W4 seapawn 真人验收 → W5 polish*

---

## 四 · Definition of Done

**所有产出必须通过 [全局 DoD](../DefinitionOfDone.md) 全部 6 类底线标准，无一例外。此为最高验收准则，不得降级通过。**

本 Sprint 无记忆落盘——「记忆质量」「可审阅」「索引一致」不适用（同 Sprint 1/2）。其余三条完全适用：

- **功能可用**：seapawn 异地亲手跑通 + 主观满意
- **信任边界**：不编辑 CLAUDE.md，不存 repo 已有内容
- **独立验证**：最终判定权在 seapawn（PO）——他说通过才算通过，pawn 自评无效
