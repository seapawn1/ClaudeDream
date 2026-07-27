# 测试路径矩阵（Sprint 5 · eval-test-set）

> 本文档定义 6 条测试路径，映射到两个 eval 主体（IDEO-Scrum / DiaryAgent），说明"对话怎么说 → 预期触发什么 → 预期产出是什么"。

---

## 路径 P1：Gate 噪音过滤

**目标**：验证 Gate 硬约束排除清单正确过滤无信息量内容。

| 维度 | 内容 |
|---|---|
| **对话特征** | 纯工具调用记录（Read/Edit/Bash）；寒暄（"好""OK""继续"）；CLAUDE.md 已有内容的重复；repo 文件的照搬 |
| **预期触发** | SKILL.md 格 5.1 Gate 六条排除规则命中 → sentinel `NOTHING_WORTH_RECORDING` 或全部 🔁 Skip |
| **预期产出** | 变更摘要显示 0 Created + 0 Updated + N Skipped；memory/ 无新增 |
| **主体** | IDEO-Scrum（14 transcript 中必有例行操作）或 DiaryAgent |
| **评分标准** | ✅ 噪音对话未产生记忆 / ❌ 噪音被当成有效概念写入 |

---

## 路径 P2：🆕 Create 纯新知识

**目标**：验证全新概念被正确识别并创建记忆文件。

| 维度 | 内容 |
|---|---|
| **对话特征** | 实质性讨论项目内容（Scrum 事件、Diary 设计）；与已有记忆无重叠 |
| **预期触发** | SKILL.md 格 5.2 Extract 提取概念 → 5.3 印证发现"无碰撞" → 5.4 判定 🆕 Create |
| **预期产出** | 新 `.md` 文件出现在 `memory/`；frontmatter 完整（`sources.session` + `sources.git` + `created`）；MEMORY.md 新增索引行 |
| **主体** | **IDEO-Scrum**（冷启动，所有实质概念都是新的） |
| **评分标准** | ✅ 新概念正确建文件，frontmatter 齐全 / ❌ 概念漏记或重复建文件 |

---

## 路径 P3：⚡ Update 冲突更新 + superseded 标注

**目标**：验证新信息与已有记忆冲突时，保留旧内容 + 添加 superseded 标注。

| 维度 | 内容 |
|---|---|
| **对话特征** | 对已有记忆主题的新讨论，且新内容与旧记忆部分矛盾（如"diary 格式从 freeform 改为 structured"） |
| **预期触发** | 格 5.3 印证发现"碰到旧记忆 + 冲突" → 5.4 判定 ⚡ Update + 冲突处理 |
| **预期产出** | 已有 `.md` 文件被 Edit；旧内容上方插入 `⚡ superseded <日期>: <原因>`；新内容追加；`sources` 列表追加当前 session；`modified` 时间更新 |
| **主体** | **DiaryAgent**（已有 `diary-freeform-no-template.md` / `diary-quantitative-json-layer.md`，可能有更新信息） |
| **评分标准** | ✅ 旧内容保留 + superseded 行存在 + 新内容追加 / ❌ 旧内容被直接覆盖 或 未标注冲突 |

---

## 路径 P4：🗑️ Delete 明确推翻

**目标**：验证对话明确否定旧记忆时，记忆文件被删除。

| 维度 | 内容 |
|---|---|
| **对话特征** | 明确语句："之前的 X 方案已废弃" / "不再用 Y 方法" / "决定删掉 Z" |
| **预期触发** | 格 5.3 印证发现"明确推翻" → 5.4 判定 🗑️ Delete（保守删除原则：确定错才删） |
| **预期产出** | 对应 `.md` 文件从 `memory/` 删除；MEMORY.md 索引对应行删除 |
| **主体** | **DiaryAgent**（需有推翻旧 diary 方法的对话；如无，需补充针对性对话） |
| **评分标准** | ✅ 文件删除 + 索引同步 / ❌ 文件未删 或 删除过度（非明确推翻也删了） |
| **⚠️ 风险** | 现有 transcript 可能不包含明确推翻语句——W4 需检查，缺失则补对话 |

---

## 路径 P5：SQ3 git 漂移感知（possibly-stale）

**目标**：验证记忆引用的文件在 git 中变更后，记忆被标注 `possibly-stale`。

| 维度 | 内容 |
|---|---|
| **对话特征** | 记忆文件正文引用项目文件（如 `README.md` / `SKILL.md`），而对应文件在 git log 中有更新 |
| **预期触发** | 格 5.3 印证阶段"git 漂移候选——引用文件在 git diff 中变了" → 5.5 防腐涂料模板③ |
| **预期产出** | 记忆文件 frontmatter 的 `description` 后追加 `⚠️ possibly stale: <file> changed <date> — 此记忆引用的文件已变更...` |
| **主体** | DiaryAgent 或 IDEO-Scrum（需检查已有记忆是否引用项目文件 + 该文件是否有 git 更新） |
| **评分标准** | ✅ 引用变更文件的记忆被标注 / ❌ 漂移未感知 |
| **⚠️ 前提** | DiaryAgent 现有 2 个记忆需检查其是否引用项目文件；IDEO-Scrum 首次跑无记忆，SQ3 不适用 |

---

## 路径 P6：SQ4 保守边界（拿不准降级）

**目标**：验证模棱两可的情况下，编译器保守判定（Update 而非 Delete / Skip 而非 Update）。

| 维度 | 内容 |
|---|---|
| **对话特征** | 对已有记忆的模糊提及（如"我们当时讨论过 diary 方案"，但未给新信息，也未明确推翻） |
| **预期触发** | 格 5.4 判定阶段"拿不准 → 保守降级"原则（Delete 降为 Update；Create 降为 Skip） |
| **预期产出** | 不产生 Delete（即使有矛盾迹象，但不明确）；不产生重复 Create（即使接近已有概念，Skip 优先） |
| **主体** | DiaryAgent（有已有记忆，适合测边界） |
| **评分标准** | ✅ 无误删、无重复建 / ❌ 激进判定（拿不准仍 Delete 或 Create） |

---

## 覆盖性汇总

| 路径 | PB-Comp-1 对应 | IDEO-Scrum | DiaryAgent | 备注 |
|---|---|---|---|---|
| P1 Gate | - | ✅ | ✅ | 两者都可测，IDEO-Scrum transcript 更多 |
| P2 🆕 Create | - | ✅主力 | partial | IDEO-Scrum 冷启动最适合 |
| P3 ⚡ Update/superseded | ②冲突 | - | ✅主力 | DiaryAgent 已有记忆可更新 |
| P4 🗑️ Delete | ①删除 | - | ✅（待确认） | 需检查 transcript 是否有明确推翻语句 |
| P5 SQ3 漂移 | ③git漂移 | - | ✅（待确认） | 需检查已有记忆是否引用项目文件 |
| P6 SQ4 边界 | ④保守边界 | ✅ | ✅ | 两者都适用 |

**PB-Comp-1 的四条判定路径全覆盖**：P3 覆盖②，P4 覆盖①，P5 覆盖③，P6 覆盖④。

---

## W4 后续动作

基于本矩阵，W4（构造对话）需确认：

1. **P4 Delete 路径**：检查 DiaryAgent 现有 5 个 transcript 是否包含明确推翻语句。若无，需在 DiaryAgent 目录开展 1 次针对性对话（如"决定废弃 diary-freeform，统一用 JSON"），产生新 transcript。
   
2. **P5 SQ3 漂移路径**：检查 DiaryAgent 已有 2 个记忆文件内容，是否引用 `F:\DiaryAgent` 项目的具体文件。若引用，需确认该文件在 git log 中有更新（用于触发漂移感知）。若无引用，考虑预置一条引用项目文件的 baseline memory。

3. **其余路径**：现有 transcript 应已覆盖 P1/P2/P3/P6，无需额外对话。
