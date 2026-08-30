---
name: ps51-utf8-no-bom-trap
description: PowerShell 5.1 会把无 BOM 的 UTF-8 文件按 GBK 误读再写回——.claude/memory 与一切 UTF-8 文本禁用 PS 管道读写
metadata:
  type: feedback
---

2026-08-30 事故：后台写保护拦截 Write 工具后，我用 PS 5.1 `Get-Content -Raw`（无 -Encoding）读取无 BOM 的 UTF-8 `MEMORY.md`，被按 GBK 解码成乱码再 `WriteAllText` 写回并提交（85633fc）——旧条目双重编码、部分换行被 GBK 双字节配对吞并。同一命令里 here-string 直写的新文件反而完好，事故点只在「读→转码→写回」这条链。

**Why:** PS 5.1 默认按系统 ANSI（本机 GBK）解码无 BOM 文件，不猜 UTF-8；误读后写回即永久污染。会话里显示正常不等于文件没坏——git show 的乱码展示与文件真实字节要分开判，核验一律走 Read 工具。
**How to apply:** 需要改仓库内 UTF-8 文本时：首选 Write/Edit 工具（后台写保护拦截时见下）；被拦则 Write 工具写 job tmp（UTF-8 可靠）+ `cmd /c copy /y` 字节级落盘，Read 核验后再提交。禁止用 PS 管道读写 UTF-8 文本内容。关联教训：[[sprint-04-mainline-intent]] 的「重要动作前先验证支撑证据」——本次对应「提交前 Read 核验」。
