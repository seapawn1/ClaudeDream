# Memory Index

- [Map 落盘用 TD 方向](map-renders-top-down.md) — mermaid 地图写入文档时从上到下排列
- [白板产物走 plan-view 审阅](decider-review-via-plan-view.md) — 定稿全文进 plan 推给 Decider 逐段批注后再落盘；单一 Pool 文件 + 阶段子文件夹
- [headless 下 .claude/ 写保护实测结论](headless-claude-dir-protection.md) — 只有 bypass 可写、hook 嵌套不加载；梦产物必走 Agent SDK canUseTool
- [review 结果先汇报再动手](review-report-before-fix.md) — 独立 review 出结果后先整理汇报给 PO，别自己直接开始改
- [旧冲刺 Python 代码不搬用](python-sprint-code-no-reuse.md) — PO 澄清「安装税」≠语言禁令，是不要复用设计冲刺 Python 代码；testbed 方案层复用、builder Node 重写
- [验收只走端到端七站](acceptance-e2e-only.md) — PO 裁定 AC 判分线收口作废；七站亲验三处硬伤双盲对照，我方 agent 版胜出，Sprint-3 验收通过（2026-08-16）；流程三条入 ProductBacklog 验收流程约定
- [PR 工作流：main 只经 PR 前进](pr-based-merge-workflow.md) — Sprint-4 起 main 本地==origin/main，全部提交走 sprint 分支；推送等 PO 指令；main 工作树旧状态以分支工作树为准
- [工作树本地设置按目录生效](worktree-settings-local-per-cwd.md) — settings.local.json 不入 git；施工工作树 developer 风格、主文件夹 scrum-master；单一 autoMemoryDirectory
- [工作树分支操作先报再动](worktree-git-ops-report-first.md) — ff/merge/reset/删工作树分支等 PO 指令；集成分支档案提交照旧
- [Sprint-4 主线走向定局](sprint-04-mainline-intent.md) — 2026-08-30 再定局为全仓库重构：旧物（三分支/tag/远端）全部弃用，等重构指令；含「tag 未带目标=打在 HEAD」教训与事实校正
- [CLAUDE.md 定位 .claude/](claude-md-at-claude-dir.md) — PO 2026-08-30 移动定局「以后保持如此」；.worktreeinclude 同批入库
- [PS 5.1 无 BOM UTF-8 读写陷阱](ps51-utf8-no-bom-trap.md) — 写保护下禁用 PS 管道读写 UTF-8 文本；Write 到 tmp + cmd copy 字节级落盘 + Read 核验再提交

## IDEO Index

- [设计冲刺·顶层蒸馏（DesignMap/DesignReview）](design-sprint-core-distilled.md) — 长期目标双承诺·11 步数据流·四条冲刺问题答案·五条验收信号结算·方法论六条与去向
- [设计冲刺·Target-1 主靶档案蒸馏](design-sprint-target1-distilled.md) — 定稿方案全骨架（M1-M5/S1-S3·L0-L3·三阀·报告六节·阀门六键）·四派草图·三场真梦+故障注入·C1–C7·testbed 模式·测试方法论

## Scrum Index
