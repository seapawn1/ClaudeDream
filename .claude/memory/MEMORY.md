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

## IDEO Index

- [设计冲刺·顶层蒸馏（DesignMap/DesignReview）](design-sprint-core-distilled.md) — 长期目标双承诺·11 步数据流·四条冲刺问题答案·五条验收信号结算·方法论六条与去向
- [设计冲刺·Target-1 主靶档案蒸馏](design-sprint-target1-distilled.md) — 定稿方案全骨架（M1-M5/S1-S3·L0-L3·三阀·报告六节·阀门六键）·四派草图·三场真梦+故障注入·C1–C7·testbed 模式·测试方法论

## Scrum Index

- [Sprint-1 骨架回环 Review 蒸馏](scrum-sprint01-skeleton-distilled.md) — 触发链/壳与围栏/留证回环；canUseTool spike 四深坑（permissionMode default·settingSources·PowerShell 工具名·绝对路径拦截）；D3 四轮 git 语义陷阱；「空转冒充覆盖」→DoD·D4
- [Sprint-2 底片层 Review 蒸馏](scrum-sprint02-negatives-distilled.md) — 底片产线硬口径（零 API·保守保留·补捞四口径）·SessionEnd 官方事实·三轮「接口脱靶」→DoD·D5/D6·RETAIN-RULES 缺口→PBI-06·已知盲区清单
- [Sprint-3 引擎主干 Review 蒸馏](scrum-sprint03-engine-distilled.md) — 六拆条关键口径（阀门六键·M4 两级证据·无讣告不删·熔断净消失口径·G9 底片消费契约）·D3 三阻断·七站亲验三硬伤·双盲对照胜出·流程三条
