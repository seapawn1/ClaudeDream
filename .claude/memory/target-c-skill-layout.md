---
name: target-c-skill-layout
description: Target C 在 SKILL.md 中的落地形态——格 5 单 agent compile 流程，Gate→Extract→印证→四分类→写入→索引+摘要一次做完
metadata:
  type: project
sources:
  - session: 1784414839
  - git: 2b3f9b2
created: 2026-07-19T11:00:00+08:00
---

# Target C · SKILL.md 落地形态

C 编译层落地为 ClaudeDream 插件 SKILL.md 的**格 5 · 编译落盘**，格 5 内部按流程分成 8 个子节，在单次 agent 调用中顺序执行。

## 落地结构

| 格 5 子节 | 对应 PBI | 对标 compiler |
|---|---|---|
| 5.1 Gate 硬约束排除 | PB-Base-7 | compiler `flush.py` sentinel + auto-memory 排除清单 |
| 5.2 Extract 提取概念 | PB-Base-8 ① | compiler `compile.py` "3-7 distinct concepts" |
| 5.3 Cross-Reference 交叉印证 | PB-Base-8 ②③ | compiler whole-KB-in-context（全部记忆原文灌入） |
| 5.4 Classify 四分类判定 | PB-Base-9 | ⚠️ compiler **无**此类——ClaudeDream 改进 |
| 5.5 防腐涂料（三个标注模板） | PB-Base-10 | ClaudeDream 原创（双源/superseded/git 漂移） |
| 5.6 Write 写入执行 | PB-Base-11 | compiler Write/Edit + acceptEdits |
| 5.7 收尾（索引+摘要） | PB-Base-12+13 | compiler index.md + log.md |
| 5.8 结束 | — | — |

## 关键设计决策

1. **单 agent 流程**：对标 compiler `compile.py`——一个大 prompt 承载全部，Python 只写 state.json。C 的 5.1-5.7 是一次 LLM 调用内的顺序执行。
2. **allowed-tools**：SKILL.md frontmatter 从 `Bash, Read` 扩展到 `Bash, Read, Write, Edit`——C 需要写盘。
3. **Sentinel 契约**：5.1 结束若零条可记 → 输出 `NOTHING_WORTH_RECORDING` → 跳到 5.8 结束。类比 compiler flush.py 的 `FLUSH_OK`。
4. **保守删除**：删除只在「对话明确推翻」或「git 明确漂移」时执行。拿不准 → 降级为 Update+标注。
5. **更新优于新建**：能 Edit 已有文件就不 Write 新文件。

**Why:** compiler 的 compile.py 已验证「单 prompt 承载全流程 + acceptEdits」在 50-2000 条规模下可行。ClaudeDream 当前 6 条，远未触顶。格 5 在 compiler 基础上增加四分类+防腐涂料+理由字段——三项原创改进。

**How to apply:** 格 5 的修改只需编辑 SKILL.md。不要引入独立 Python 脚本——当前规模下 agent prompt 就够了。未来 hooks 自动化（PB-Auto-3）时才需要独立的 compile 脚本。
