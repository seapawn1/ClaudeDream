# ClaudeDream — Definition of Done（DoD）

> **DoD 是 Increment 的 commitment**——一条**全局**质量底线，**每条**交付的记忆增量都必须满足。区别于逐条 Acceptance Criteria（AC 只约束单条，见 [ProductBacklog · 三 细化](ProductBacklog.md#三--backlog-细化refinement)）：一个 backlog 条目达到 DoD 才算"完成"，才能进 Sprint Review；否则退回 Backlog。DoD 是活的，Retrospective 时复审增删。
>
> 状态：PO 已认可（Sprint 1）。Sprint 2 增补换环境验证。Retrospective 时复审。

| 类别 | 完成项（每条增量必须满足） | 如何验证 |
|---|---|---|
| 功能可用 | `/claude-dream` 端到端跑通，不半途失败 | 在**至少两个**异构项目上真机实跑——开发项目 + 一个外部项目（确保跨项目可用、冷/热启动路径均覆盖） |
| 记忆质量 | frontmatter 完整（含 sources 双源：session id + git commit hash）；用绝对日期；冲突时保留旧内容 + superseded 标注 | 输出文件逐条对照 |
| 信任边界 | 不编辑 CLAUDE.md；不存 repo 已有内容 | diff 检查 |
| 可审阅 | 生成变更摘要报告 | 报告存在 |
| 索引一致 | `MEMORY.md` 索引与实际记忆文件一致（无断链 / 漏项） | 索引核对 |
| 独立验证 | 以上所有条目的通过判定，**不得由执行者自评** | 由 **subagent**（独立审计）或 **seapawn（PO）** 逐条检验并给出通过/不通过结论。自评不予通过 |
| 优雅结构 | 新增 PBI 实现时，目录结构对标参考项目模式（`scripts/`、`hooks/`、`daily/` 分层），不把所有实现塞进单一 SKILL.md | code review 检查目录结构符合分层约定 |
