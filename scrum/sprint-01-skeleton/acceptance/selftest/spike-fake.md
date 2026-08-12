# AC0 spike 记录（假件，仅供考卷自检）

真件由 developers 在 PBI-04.2·AC0 完成后落盘，位置在 `acceptance/adapter.json` 的 `spikeRecord` 声明。

**结论（假）**：canUseTool 在写入 `.claude/memory/` 时被调用且放行成功，无需走 bypassPermissions 退路。

**若放行失败的退路（假）**：`bypassPermissions` + git 快照审计，与设计冲刺原型做法一致；退路一旦启用须在本文件写明理由，不允许静默降级。
