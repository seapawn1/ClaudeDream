---
name: productbacklog-claudedream-naming
description: ClaudeDream 手动触发命令统一写作 /claude-dream（带连字符），Product / 架构 / Sprint 各层一致
metadata: 
  node_type: memory
  type: project
  originSessionId: 99369f3a-3746-4145-ac36-9b9014602d34
  modified: 2026-07-18T18:42:56.867Z
---

ClaudeDream 的手动触发命令，所有文档层统一写作 `/claude-dream`（带连字符）——Product Backlog / Product Goal、Architecture、SprintBacklog / SprintReview 一律以此为准。

**Why：** Sprint 1 曾出现命名不一致：Planning 文档写 `/claudedream`，但真机验证的真实命令是双段 `/claudedream:claudedream`（插件命名空间机制）。Sprint 1 收尾时插件已改名并统一为 `/claude-dream`（见 git commit `0d2a3fd 改名 claude-dream`、`e7e8093 命令名统一为 /claude-dream`）。Sprint 2 Planning 中 PO（seapawn）明确拍板：**以 `/claude-dream` 为准**，此前记忆里"Product 层写 /claudedream、不必跟真实命令名"的旧约定已作废。

**How to apply：** 写任何 ClaudeDream 文档、代码、命令引用时，手动触发一律写 `/claude-dream`（带连字符），不要退回无连字符的 `/claudedream`。若发现残留的旧写法（如某些历史 Sprint 文档），可在顺手更新时修正，但不必为此单独返工。关联 [[target-a-decision]]（手动触发是 Target A 的当前形态）。
