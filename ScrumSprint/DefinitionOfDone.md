# ClaudeDream — Definition of Done（DoD）

> **DoD 是 Increment 的 commitment**——一条**全局**质量底线，**每条**交付的记忆增量都必须满足。区别于逐条 Acceptance Criteria（AC 只约束单条，见 [ProductBacklog · 三 细化](ProductBacklog.md#三--backlog-细化refinement)）：一个 backlog 条目达到 DoD 才算"完成"，才能进 Sprint Review；否则退回 Backlog。DoD 是活的，Retrospective 时复审增删。
>
> 状态：草案，待 seapawn 审核。

| 类别 | 完成项（每条增量必须满足） | 如何验证 |
|---|---|---|
| 功能可用 | `run claudedream` 端到端跑通，不半途失败 | 在一次真实会话上实跑一遍 |
| 记忆质量 | frontmatter 完整（含 sources 双源：session id + git commit hash）；用绝对日期；冲突时保留旧内容 + superseded 标注 | 输出文件逐条对照 |
| 信任边界 | 不编辑 CLAUDE.md；不存 repo 已有内容 | diff 检查 |
| 可审阅 | 生成变更摘要报告 | 报告存在 |
| 索引一致 | `MEMORY.md` 索引与实际记忆文件一致（无断链 / 漏项） | 索引核对 |
