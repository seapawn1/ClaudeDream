# Memory Index

- [Map 落盘用 TD 方向](map-renders-top-down.md) — mermaid 地图写入文档时从上到下排列
- [白板产物走 plan-view 审阅](decider-review-via-plan-view.md) — 定稿全文进 plan 推给 Decider 逐段批注后再落盘；单一 Pool 文件 + 阶段子文件夹
- [headless 下 .claude/ 写保护实测结论](headless-claude-dir-protection.md) — 只有 bypass 可写、hook 嵌套不加载；梦产物必走 Agent SDK canUseTool
- [review 结果先汇报再动手](review-report-before-fix.md) — 独立 review 出结果后先整理汇报给 PO，别自己直接开始改
- [旧冲刺 Python 代码不搬用](python-sprint-code-no-reuse.md) — PO 澄清「安装税」≠语言禁令，是不要复用设计冲刺 Python 代码；testbed 方案层复用、builder Node 重写
- [验收只走端到端七站](acceptance-e2e-only.md) — PO 裁定 AC 判分线收口作废；七站亲验后三处硬伤（M2 误杀/熔断回滚失败/CLI 无冷却）派 developers 修，任务书 e2e-fix-brief.md
