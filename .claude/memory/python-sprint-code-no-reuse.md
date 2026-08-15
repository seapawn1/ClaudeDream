---
name: python-sprint-code-no-reuse
description: PO 澄清——「不引入安装税（Python 依赖等）」不是语言禁令，是不要复用设计冲刺的旧 Python 代码
metadata:
  type: project
---

PO 于 2026-08-15 澄清：ProductBacklog PBI-06 的「不引入安装税（Python 依赖等）」不是「产品侧 Python 禁入」——真实意图是**不要复用设计冲刺的旧 Python 代码**（原型引擎、假数据 builder 等冲刺产物，不直接搬进产品或工具链）。语言选择按场景定：产品用 JS（零安装税）；考卷 testbed 复用只到方案层（种植清单、rot-manifest 对答案卡、固定 git 时间线设计），builder 以 Node 重写。

**Why:** 这是 PO 对书面准则的口头澄清，repo 文本读不出这层意思——照字面读会再泛化成「Python 禁入」（本次对话实际发生过）。

**How to apply:** 涉及复用设计冲刺资产时——复用设计/方案/数据可以；直接运行或搬移旧 Python 代码不可以；新工具一律按产品语言栈（JS/Node）写。
