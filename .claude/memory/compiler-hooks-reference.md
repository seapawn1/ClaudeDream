---
name: compiler-hooks-reference
description: compiler 的 hooks 架构（SessionEnd/PreCompact → flush.py → daily/）可作为 ClaudeDream 未来自动化的参考
metadata: 
  node_type: memory
  type: reference
  originSessionId: 455b3371-724a-4c88-826c-3691c3e76a64
  modified: 2026-07-18T10:49:57.166Z
---

# compiler Hooks 架构参考

compiler 的 hooks 系统可作为 ClaudeDream 未来的自动化参考（原型阶段不做）。

**hooks 链路**：
- SessionEnd / PreCompact → 捕获 transcript → 复制到 temp 文件
- → spawn flush.py（完全 detached 后台进程）
- → flush.py 调 Agent SDK（max_turns=2, ~$0.02/session）提取对话要点
- → 追加到 `daily/YYYY-MM-DD.md`
- → 如果过了 18:00 且 daily log 有变化 → 自动 spawn compile.py

**关键设计**：
- `CLAUDE_INVOKED_BY=memory_flush` 环境变量防递归
- 60 秒去重（同 session 不重复 flush）
- Windows: `CREATE_NEW_PROCESS_GROUP | DETACHED_PROCESS`
- PreCompact 是 SessionEnd 的补充——长会话中多次 compaction 会丢失上下文

**Why:** compiler 的 hooks 链路解决了"如何自动捕获对话"的问题——这正是 ClaudeDream 长期需要的能力。当前 B 的读取步骤是手动版，未来可以用 hooks 自动化。

**How to apply:** 等 B+C 原型跑通后，参考这套 hooks 架构替换 B 的手工读取步骤。关联 [[target-c-decision]]。

---

### 本对话补充：compiler hooks 完整链路

从 `compile.py` + `flush.py` + `AGENTS.md` 全套源码确认的完整流程：

```
SessionEnd hook（或 PreCompact）
  │  读取 transcript_path（stdin JSON）
  │  复制到 temp .md 文件
  ▼
flush.py（完全 detached 后台进程）
  │  CLAUDE_INVOKED=memory_flush（防递归）
  │  60 秒去重
  │  Agent SDK query（max_turns=2, allowed_tools=[]）
  │  提取对话要点 → FLUSH_OK 或结构化 bullets
  ▼
Append → daily/YYYY-MM-DD.md
  │
  │  如果过了 18:00（COMPILE_AFTER_HOUR=18）
  │  且 daily log hash 较上次 compile 时变化了
  ▼
spawn compile.py（也 detached）
  │  读 state.json → 对比 hash → 有变化才跑
  │  Agent SDK query（max_turns=30, permission=acceptEdits）
  ▼
更新 knowledge/（concepts/ + connections/ + index.md + log.md）
```

**关键数字**：
- flush.py 每次 ~$0.02-0.05
- compile.py 每次 ~$0.45-0.65
- flush 去重窗口：60 秒
- 自动编译阈值：18:00 本地时间
- state.json 追踪：SHA-256 hash（前 16 位 hex）

**对 ClaudeDream 的参考价值**：当前 B 方案的手动 Shell 管线可以先用着。未来当 ClaudeDream 需要"自动捕获对话"时，compiler 的 hooks 链路是现成架构——唯一需要适配的是把 ClaudeDream 的 Compile prompt 替换 compiler 的 prompt。
