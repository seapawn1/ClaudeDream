---
name: decider-review-via-plan-view
description: 白板级产物落盘前，用 plan mode 把拟稿全文推给 Decider 逐段审阅拍板
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 273a0660-2887-4bbf-8aa8-d810bb05855c
  modified: 2026-08-02T00:59:41.119Z
---

seapawn（Decider）审阅白板产物的偏好流程：拟落盘的文档**全文写进 plan 文件**推 plan-view，他在审批界面逐段批注（改定性、改归属、指出方法错误），批注即拍板口径，改完再 approve 落盘。2026-08-02 的 IdeaPool、Sketches/Storyboard 均走此流程，多次拒绝审批只为追问方法问题（"故事板对吗""claude 做梦要不要故事板"）——拒绝 ≠ 否定，常是深挖信号。

**Why**：他要的是"审阅一下"的实感——plan-view 提供逐段批注能力，比会话里滚屏可控。

**How to apply**：凡产出要进 `.IDEO/` 白板的定稿文档，先 plan mode 全文成稿 → ExitPlanMode 等批注 → 按批注改 → 再批准再落盘；落盘一律合入单一 Pool/定稿文件而非散多个文件，阶段产物开子文件夹（如 [[target-1-prototype-01]] 的 Prototype-01-FirstDream/ 模式，具体名字 designer 起）。
