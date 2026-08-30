---
name: product-rationale-distilled
description: 产品立论蒸馏（原根 README「为什么需要它」抢救，2026-08-30）——官方三缺口与两社区事故、前人三路径同构、原料层可行性与 logs/ 缺失、差异化三点及限定
metadata:
  type: project
---

根 README 2026-08-30 按一般规约瘦身时抢救出的立论事实，档案已删，本记忆为载体。上游见 [[design-sprint-core-distilled]]；效力：带「推测」标注的判断不作决策依据。

## 官方现状：不是「还没做」，是「做了但没写文档、没做透明层」

设计冲刺 Ask the Experts（2026-08-01）证实：内置离线整合（内部称 Auto Dream）已在其他用户机器真实运行、却始终未进官方文档（code.claude.com/docs/en/memory）。触发条件 = 24 小时冷却期 **且** 5 次新会话（两条件都满足）+ 服务端 gate 放行。社区两起事故（anthropics/claude-code）：

- **[#47959](https://github.com/anthropics/claude-code/issues/47959)**：Auto Dream 约 24 小时内静默删除 23 个记忆文件（5 用户画像 + 14 反馈 + 4 参考），含用户反复强调过 3 次的规则；无确认、无变更日志，靠用户自建备份对比才发现；作者事后永久关闭该功能。2026-05-23 被 stale 关闭，标签 bug / has repro / data-loss。
- **[#38493](https://github.com/anthropics/claude-code/issues/38493)**：归纳官方三缺口——**身份**（项目改名记忆变孤儿，新记忆按会话主题而非项目命名）、**准确性**（整合时写 "18 of 21 items resolved" 却不读原文核实）、**透明度**（唯一线索是 /memory 里 "上次运行于 X 秒前"）。

两 issue 全部评论来自 github-actions[bot]，无产品团队正面回应（逐条核实过评论作者）。三缺口与「可溯源、可撤销」的要求一一对应——问题真实、官方知晓、短期不打算正面处理。另：本机 Auto Dream 从未跑起（gate `tengu_onyx_plover` 未放行），推测与本机第三方网络中转有关——无证据，不作立项依据。

## 前人三条路径：四阶段流程同构，抄哪条都不构成差异化

| 路径 | 取料 | 提炼与整合 | 索引/体检 | 最先撞的墙 |
|---|---|---|---|---|
| 官方 Auto Dream（claude.exe v2.1.210 逐字提取） | Orient/Gather：主读 `logs/` 逐日活动流，transcript 仅窄词 grep 兜底 | Consolidate：并入主题文件、相对日期转绝对、删被推翻事实 | MEMORY.md ≤200 行/25KB；与 CLAUDE.md 对账 | **不敢改人写的层**（do NOT edit CLAUDE.md）、无变更日志、实测误删 23 文件 |
| claude-memory-compiler（clone `54eddd70`） | flush.py：SessionEnd/PreCompact 钩子 → SDK 提取 → `daily/` | compile.py：knowledge/concepts + connections + qa 交叉引用 | lint.py 7 项（断链/孤儿页/孤儿源/陈旧/矛盾/缺反链/稀疏） | **只报不删**；stale 判的是源日志 hash 漂移 ≠ 内容过期 |
| claude-dream（AI 转化产物，无上游） | 同 compiler | slash commands + subagents | 同 compiler | **不可作实现依据**——无 commit 可追溯、未经验证 |

三条路径的取料层都依赖一层「预先消化好的活动流」（官方 `logs/`、compiler `daily/`）。

## 原料层是否可行

会话日志 jsonl 本机真实可得（`~/.claude/projects/` 约 30 项目、单项目常 40+ 会话，2026-07-16 核查）；官方依赖的 `logs/` 逐日活动流压缩层本机全部项目不存在——**这层必须自建**。自建三件事：①挂哪个钩子（SessionEnd 触发后没有 LLM 在运行，插件形态没有免费离线时刻）；②压缩到什么程度（claude-code-log 实测：相对 `--detail full` 降至 1/4–1/7，相对原始 jsonl 1/20–1/170，随工具密度大幅波动）；③丢什么留什么（压缩不可逆，取舍必须写死留档，否则无法判断「记忆里没有」是没发生还是被压掉）。

## 差异化在哪（信任与所有权层，非整合算法）

① **变更凭证 + git 可回滚**——官方不敢让 Auto Dream 改 CLAUDE.md 的本质是没有回滚层；我们有 git 所以敢做（「有 git 就够」曾是待验证假设，设计冲刺问题 3 已结算：回看必须经得起查证才够）。
② **记忆容器身份稳定性**——官方按工作目录路径字符串键控，项目改名/搬盘静默孤立记忆（本项目 2026-07-29 搬盘实际踩过；#38493 独立报告同一问题）。「官方尚未着手解决」有依据（stale 关闭无回应），「官方没意识到」是推测。
③ **本地可控、可否决**——claude-mem 在官方方案已上线的情况下仍获数万 star，证明「更可控、更本地」需求真实。star 数各源分歧且快速增长，引用必须带快照日期（46.1K@2026-04-07、65.8K@2026-04-23 等），任何单一快照不可作当前值。
