---
name: scrum-sprint02-negatives-distilled
description: Sprint-2（底片层，2026-08-14 收口）Review 蒸馏——底片产线硬口径、SessionEnd 官方事实、三轮「接口脱靶」与 DoD·D5 由来、RETAIN-RULES 缺口触发 PBI-06、已知盲区清单
metadata:
  type: project
---

Sprint-2 档案（`scrum/sprint-02-negatives/`，待重构收尾删除，本记忆为知识载体）按 Sprint Review 原则蒸馏，2026-08-30。验收考卷未读未引（standing 约定）。上游 [[scrum-sprint01-skeleton-distilled]]，下游 [[scrum-sprint03-engine-distilled]]。

## Sprint Goal 与达成

> 白天留底，夜里读得到——每场会话散会机械落一页底片（只追加、不可变、零 API），梦开工时真读得到它（含刚散会那场）。管道级承诺：落盘、送到梦嘴边、报告有受信任代码写的进料对账；「听懂用户裁决并照办」归真引擎（PBI-02），本轮不承诺。

**达成（PO 裁不追绿先收口）**：验收三轮逐次收敛 12/9/6 → 15/6/6 → 16/5/6；核心机械管道全绿；移交项（H-F3 活稿回归、H-D4 日志、verify 重跑）2026-08-15 核实修入 main 并经 PO 确认通过。

## Increment（PBI-01 拆二 + E0）

- **01.1 底片产线**：一稿一页可寻址、幂等不重复处理、**零 API（断网可跑全链）**、行为以留/剔规则表为锚、**未知条目类型保守保留+留痕（零静默丢）**、体积 ≤ 逐字稿 10%（锚：claude-code-log 实测 1.8%，留十倍余量）、写失败静默降级不阻塞散会且错误留痕在底片目录外、补捞四硬口径（**排除梦会话防自吞**、活稿 mtime 判别不误冻、台账原子可重入、官方 30 天清理的记账跳过）。
- **01.2 梦的进料口**：进料对账行由 run-dream.mjs 受信任代码机械统计（不由模型自述）、底片写入与梦启动显式定序、梦对底片零写权（作恶模式可指定底片路径验证被拒）、裁决回程「留得住」（用户留话在底片按原文检索得到）。
- **E0 开工首件事**：smoke-check.mjs 真梦前置冒烟（登录态/token/SDK 红绿分明）；Sprint-1 verify 在改动后代码重跑全绿（执行人=出卷 fork 防泄卷）。

## SessionEnd 官方事实（施工期查证，长期有效）

SessionEnd 每场一次（正常退出//clear/切会话/登出；**强杀崩溃不触发→补捞兜底**；resume 可多次散会同稿多页→去重进规则表；compact 不算散会；fork 各落各的；hook 配置别加 matcher）；**全部 SessionEnd hook 共享默认 1.5 秒**，settings 可抬至 60s 但插件自带 hook 抬不动——压缩重活必须「hook 只记账、分离进程干活」（hooks.json 里 `timeout:10` 是死配置，Sprint-3 已清）；**逐字稿格式是官方内部实现随版本会变**——「未知类型保守保留」由此而来，格式漂移常驻风险表。

## 三轮「接口脱靶」（本轮最大教训 → DoD·D5/D6）

第 1 轮 adapter 键名私藏在保密考卷（6 处不对齐）；第 2 轮 `--session` 已声明但 verify.mjs 没消费；第 3 轮环境变量同病。**病根：接口/考卷边界开工前没划死，考卷没接好线却每次让 developers 背锅重改。** → DoD·D5「接口公开、打分保密」+ D6「开考先自检」（2026-08-15 refinement 归位：D5 留 DoD，考卷侧规则移入 ProductBacklog「验收流程约定」）。

## 两大发现

1. **自建 RETAIN-RULES 覆盖缺口**：真实长会话（5614 条）狗粮压测冒出 4 类未覆盖顶层类型（agent-setting/relocated/worktree-state/file-history-delta），688 条走保守留痕、压缩比 5%→8.85%。兜底正常（零静默丢）但暴露自建规则表在格式漂移下的维护成本 → **PO 拍板新立 PBI-06：复用成熟开源方案重做，不自建**（「自建路线很可能有问题」）。底片消费契约已随 Sprint-3 定为稳定公开接口，重做必须保住（见 [[scrum-sprint03-engine-distilled]]）。
2. 自建决策记录（2026-08-14 PO 定）：不复用 claude-code-log——它是为人读的渲染器（emoji/折叠/五档 DetailLevel），AC3 要机器可读可审计；本插件纯 Node 栈，Python 依赖平添安装脆弱性；2500+ 行大半覆盖用不上的功能面。只当 jsonl 类型字典只读参考。

## 实现级 Learnings（代码仍在产线上）

台账原子写竞态（tmp 同目录 rename 被目录枚举撞见 ENOENT）→ tmp 移兄弟目录 `.claude/.negatives-tmp/`；`backfillNegatives` 全量重扫代价随历史线性 → 台账 `lastProcessedBytes` 字节相等短路；sessionEnd 内部补捞污染考场（扫了真实 `~/.claude/projects`）→ `CLAUDE_DREAM_BACKFILL_TRANSCRIPTS_DIR` 环境变量重定向；流式读取声明订正——I/O 流式但解析数组装全稿，**峰值内存跟全稿条目数走**（20MB 压测过，真实最大 9.19MB，不重构不改口径）。

## 已知盲区（如实记录，不假装堵满）

①`transcript_path` 异步写入，散会前最后几句极小概率漏进首次压缩——settle-wait（~1s 有界等待）+补捞增量游标自动捞回，**唯一兜不住：这场是项目永远的最后一场**（官方未承诺最大滞后）；②Bash 间接改的文件无结构化记录；③子 agent 活动在独立 `subagents/agent-*.jsonl`，主稿没有；④底片无限增长的清理策略未做，记为已知边界。

## 回 backlog（不展示项）

PBI-06 新立；6 项「待办」验收明细 PO 只给了计数未附清单，信息缺口如实记录待补。
