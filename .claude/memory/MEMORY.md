# Memory Index

- [Map 落盘用 TD 方向](map-renders-top-down.md) — mermaid 地图写入文档时从上到下排列
- [白板产物走 plan-view 审阅](decider-review-via-plan-view.md) — 定稿全文进 plan 推给 Decider 逐段批注后再落盘；单一 Pool 文件 + 阶段子文件夹
- [headless 下 .claude/ 写保护实测结论](headless-claude-dir-protection.md) — 只有 bypass 可写、hook 嵌套不加载；梦产物必走 Agent SDK canUseTool
- [review 结果先汇报再动手](review-report-before-fix.md) — 独立 review 出结果后先整理汇报给 PO，别自己直接开始改
- [旧冲刺 Python 代码不搬用](python-sprint-code-no-reuse.md) — PO 澄清「安装税」≠语言禁令，是不要复用设计冲刺 Python 代码；testbed 方案层复用、builder Node 重写
- [验收只走端到端七站](acceptance-e2e-only.md) — PO 裁定 AC 判分线收口作废；七站亲验三处硬伤双盲对照，我方 agent 版胜出，Sprint-3 验收通过（2026-08-16）；流程三条入 ProductBacklog 验收流程约定
- [产品立论蒸馏](product-rationale-distilled.md) — 官方三缺口与两事故·前人三路径同构·logs/ 缺失须自建·差异化三点及限定（原根 README「为什么需要它」抢救）
- [README 静态、状态归 CLAUDE.md](readme-static-status-in-claude-md.md) — README 只留「这里是什么/文件地图」两段；当前阶段单一来源在 CLAUDE.md，勿写回 README
- [工作流现状：main 直提](pr-based-merge-workflow.md) — 重构收口后 main == origin/main == 基线 5b2fffd，PO 指挥下直接在 main 提交；旧 PR 工作流弃用；收口类推送即推、日常等指令
- [工作树本地设置技术事实](worktree-settings-local-per-cwd.md) — settings.local.json 不入 git·按 cwd 生效·单一 autoMemoryDirectory；「每 Sprint 施工工作树」模式已成历史
- [工作树分支操作先报再动](worktree-git-ops-report-first.md) — ff/merge/reset/删工作树分支等 PO 指令；集成分支档案提交照旧
- [Sprint-4 主线走向定局与重构收口](sprint-04-mainline-intent.md) — 2026-08-30 定局重构并当日收口：merge 5b2fffd、tag restructure-2026-08-30 已推、repo-restructure 已删；残余旧物（22 本地 tag 含三条打偏、origin/sprint-03-engine、reflog 末梢）未清；含 tag 教训
- [CLAUDE.md 定位 .claude/](claude-md-at-claude-dir.md) — PO 2026-08-30 移动定局「以后保持如此」；.worktreeinclude 同批入库
- [PS 5.1 无 BOM UTF-8 读写陷阱](ps51-utf8-no-bom-trap.md) — 写保护下禁用 PS 管道读写 UTF-8 文本；Write 到 tmp + cmd copy 字节级落盘 + Read 核验再提交
- [梦 LLM 层活规格与验收方法论](dream-llm-spec.md) — S1/S2/S3 三判据·无证不理·删除票机械开票·C1–C7 信任改造·testbed 对答案卡模式（PBI-07 直接输入；蒸馏全文已迁 docs/ideo-design/）
