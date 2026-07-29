---
name: target-b-decision
description: Target B (输入读取) 方案选定——顺序 Shell 管线，Map B/C 边界重新厘清
metadata: 
  node_type: memory
  type: project
  originSessionId: 455b3371-724a-4c88-826c-3691c3e76a64
  modified: 2026-07-18T09:16:42.983Z
---

# Target B: 输入读取与解析 — 方案决策

**决策**：采用顺序 Shell 管线方案。触发后依次执行：确认项目 → 项目背景 → git 历史 → 现有记忆 → 对话历史 → 汇总交给 C。

**Map 调整**：R0 层（读取层）与 R3（判定层）的边界重新厘清。B 只负责"读取并输出原始数据"，C 负责"基于输入做判定"。三个参考项目（auto-dream、auto-memory、claude-memory-compiler）全都不读 git 或项目文件——项目状态感知是 ClaudeDream 原创需求。

**DesignMapping.md** R0 节点更新：
- R0a: "解析新对话 → 提取候选记忆" → "读取 transcript JSONL → 输出原始对话内容"
- R0b: "检测项目漂移（git 历史）→ 标记需复核记忆" → "读取 git 历史 + 项目文件 → 输出项目背景与变更轨迹"
- R0c: "读取 MEMORY.md 作为比对基线" → "读取 MEMORY.md + 记忆文件 → 输出记忆基线"

**Why:** 原 Map 在 Define 阶段混合了 B 和 C 的职责。深入设计方案时发现边界模糊导致逻辑混乱——B 应该只负责取数据，判定属于 C 的领域。三个参考项目的输入模式验证了"先读基线，再判增量"的顺序结构。

**How to apply:** Target C 设计时以 B 的"四路结构化摘要"作为输入起点，不再考虑原始数据源的位置和格式。C 的 Map 已同步更新。
