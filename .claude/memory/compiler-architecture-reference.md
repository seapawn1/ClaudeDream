---
name: compiler-architecture-reference
description: claude-memory-compiler 完整三层架构（compile → lint → query）及其对 ClaudeDream 的设计影响
metadata: 
  node_type: memory
  type: reference
  originSessionId: 455b3371-724a-4c88-826c-3691c3e76a64
  modified: 2026-07-19T11:00:00+08:00
---

# compiler 三层架构参考

从 `AGENTS.md` + `compile.py` + `lint.py` + `query.py` 全套源码确认的架构。

## 三层架构

```
source（daily/）→ compile（knowledge/）→ lint（reports/）→ query（QA/）
                                                           │
                                                           └→ --file-back → qa/（知识复利）
```

**compile 层**（核心，~$0.45-0.65/次）：
- Hash gate：对比 state.json 中的 daily log hash，未变则跳过
- 全量上下文：AGENTS.md（spec）+ index.md（目录）+ 全部 wiki articles + daily log
- 输出：创建/更新 concepts/ + connections/ 文章，更新 index.md，追加 log.md
- `permission_mode="acceptEdits"`——自动批准所有文件操作

**lint 层**（6 项确定性 + 1 项 LLM，~$0.15-0.25/次）：
- Structural（免费）：broken_links、orphan_pages、orphan_sources、stale_articles、missing_backlinks、sparse_articles
- Semantic（收费）：contradictions（LLM 跨文章矛盾检测）
- 输出：reports/lint-YYYY-MM-DD.md（error/warning/suggestion）

**query 层**（index-guided retrieval，无 RAG）：
- 读 index.md → 选 3-10 篇相关文章 → 综合回答
- `--file-back` → 创建 qa/ 文章 → 更新 index.md + log.md（知识复利）
- "LLM reading a structured index outperforms cosine similarity"

## 对 ClaudeDream 的影响

| compiler 层 | ClaudeDream 对应 |
|---|---|
| compile | ✅ C 的核心——照抄 |
| lint | ⏸ 延后——原型通过后再做 |
| query | ❌ 不需要——Claude Code 自动加载 MEMORY.md |
| state.json hash 追踪 | ✅ 照抄——原型阶段手工判断 |

**Why:** compiler 的 architecture 验证了一个关键设计原则——确定性层和语义层分离。确定性层（hash、lint structural checks）是廉价、可预测的代码；语义层（compile、lint contradictions）是昂贵、智能的 LLM 判断。两层各司其职，互不干扰。

**How to apply:** ClaudeDream 当前原型只实现了语义层（Compile prompt）。确定性和质量门禁（hash gate、lint）在原型通过后补上。关联 [[target-c-decision]]。[compiler hooks 的自动化链路](compiler-hooks-reference.md) 可作为未来 B 读取的长期方向。

---

## compiler compile.py 写入侧勘探（Sprint 4 Planning 补充，2026-07-19）

从 compiler 全套源码（`compile.py`、`AGENTS.md`、`lint.py`）深度勘探，确认以下写入侧设计事实：

**compile.py 的核心机制**：
- **单 prompt 驱动**：`compile.py:132-140` 构造一个大 prompt 交给 Claude Agent SDK，`allowed_tools=[Read,Write,Edit,Glob,Grep]` + `permission_mode=acceptEdits`——LLM 自己写文章/改 index/追加 log；Python 只写 `state.json`
- **whole-KB-in-context**：`compile.py:52-63` 把全部已有 wiki articles 原文灌进 prompt；`utils.read_all_wiki_content()` 是组装 helper
- **Extract 基数上限**：`compile.py:94` 指令「提取 3-7 个值得单独成文的概念」——防过碎
- **无写入时四分类器**：参考项目**不做** new/冲突/过时/重复 四分类；只有事后 `lint.py:148-211` 的 LLM 矛盾检测（detection-only，不自动解决）——这是 ClaudeDream 对 compiler 的**改进**点

**对 Sprint 4 的设计影响**：
- C 的 SKILL.md 格 5 对标 compile.py 单 prompt 形态
- 四分类判定（PB-Base-9）是 ClaudeDream **原创改进**——参考实现不存在，需亲手验证
- Sentinel 契约（`NOTHING_WORTH_RECORDING` / `FLUSH_OK` / `NO_ISSUES`）是 compiler 的可靠解析模式，直接借用到格 5.1

**来源**：`compile.py:52-140`、`flush.py:105-229`、`lint.py:148-211`、`AGENTS.md:90-115`
