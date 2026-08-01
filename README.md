# ClaudeDream

ClaudeDream 是一个 Claude Code 插件，目标是升级 Claude Code 的记忆系统，使 agent 系统免于腐烂，与用户和项目保持同步。

## 这里是什么

一个 Claude Code 插件，聚焦 Claude Code 记忆机制的改进——让 agent 在长期对话和跨会话中保持上下文一致性，避免漂移与信息丢失。不做对话前端、不做模型推理、不碰 CLI 核心流程。

## 文件地图

| 文件/目录 | 内容 |
|---|---|
| `.gitignore` | Git 忽略规则 |
| `.env` | 本地环境变量，不可阅读 |
| `seapawn.md` | 本地私人笔记，不可阅读 |
| `.claude-plugin/` | `marketplace.json` — 插件分发骨架，指向 `./claude-dream`（产物代码待重新设计，目录暂不存在） |
| `.IDEO/` | 设计思考工作区，Design Sprint 进行中（Challenge、长期目标/冲刺问题、Map、HMW、Target 已拍板；当前 Ideate）— [README](.IDEO/README.md) |
| `reference/` | 方案类比参考资料 — auto-dream · auto-memory · claude-memory-compiler · claude-code-log · **claude-dream/**（AI 转化产物：claude-memory-compiler 改写为插件形态，无独立上游，只读不可信）— 详见 [reference/README](reference/README.md) |

## 当前状态

2026-07-29：项目重启。此前的 Design Sprint 产出（原 `.IDEO/DesignSprint/`）和 Scrum Sprint 1-6 开发记录（原 `ScrumSprint/`，含 claude-dream 插件产物代码）已作废，不再是当前工作基础——完整历史仍保留在 Git 里，`main` 之前的提交、以及 `sprint-01` ~ `sprint-05-eval-test-set--06`、`DesignSprint--跑通全流程` 等分支上随时可查。当前只保留 `reference/` 参考资料与基础设施骨架。

2026-07-29（续）：新一轮 Design Sprint 启动（分支 `design-sprint`）。Monday Define 已拍板 Challenge 与长期目标/冲刺问题，落盘于 `.IDEO/ChallengeBackground.md`、`.IDEO/DesignMap.md`；下一阶段 Ask the Experts。

2026-08-01：Ask the Experts 完成（四模块：官方机制+项目考古、前人方案深读、社区之声调研、决策者访谈）。Challenge 补全整合原料层可行性与差异化定位；Map 修订至 11 步；冲刺问题由 3 条修订为 4 条（过期升首位、新增所有权问题）；均已拍板落盘。

2026-08-01（续）：HMW 收敛完成——四模块 40 条原始候选合并为 21 条，选定 8 条挂上 Map。POV+HMW 阶段结束。

2026-08-01（续二）：两份白板审阅整改。`DesignMapping.md` 更名 `DesignMap.md`；两份文件对齐成熟参照的章节骨架；补齐全部证据出处（两个 issue 核实为 `anthropics/claude-code#47959`/`#38493`，claude-mem star 数补快照日期与各源分歧）；新增角色与结果表、HMW 族标记、Target 占位、Map 闭环回边；v0→v1 过程留痕清出白板交由 git 承载。

2026-08-01（续三）：Pick a Target 完成——圈定 **长期用户 + S6–S8 整合段**（体检 → 整合 → 梦报告）。依据：8 条 HMW 中 6 条落此段、过期/透明/所有权三族全覆盖；对齐权重第一的冲刺问题（过期）；官方 Auto Dream 正是在 S7 翻车（误删 23 个记忆文件）——机会与风险都最大处。落盘于 `.IDEO/Target-1-Consolidation/TargetMap.md`。取用段（S10–S11）列为候选 Target-2，待本段通过后再议。下一阶段 Ideate。
