# .IDEO

这里是 ClaudeDream 的设计冲刺工作区，保存挑战定义、长期目标、设计地图与方案收敛过程。这里以设计文档为主；唯一例外是原型施工物（可运行脚本、假数据 builder、真跑产物）——它们是设计迭代的道具，随所属 `Prototype-0X-*/` 子文件夹落户，与其 Sketches/Storyboard/TestPlan 同住一个迭代单元。

> **要一次看懂本次冲刺的结论，读 [DesignReview.md](DesignReview.md)** ——总入口，第一屏即结论与去向。

**不做的事**：重复方法定义（方法源文在 `ideo-scrum:design-kernel` 插件里）、存放会话逐字原文、替代 skill 目录。

## 当前阶段

**设计冲刺已结束（2026-08-02）**，结论：Target-1 带条件通过 → 转产物开发。

| 阶段 | 状态 |
|---|---|
| Monday Define（Challenge / 长期目标 / 冲刺问题 / Map v0） | ✅ 已拍板，2026-07-29 |
| Ask the Experts（四模块专家研究） | ✅ 已完成，2026-08-01 |
| POV + HMW（40 条 → 21 条 → 选定 8 条） | ✅ 已完成，2026-08-01 |
| Pick a Target（长期用户 + S6–S8 整合段） | ✅ 已完成，2026-08-01 |
| Ideate（Lightning Demos → Sketch → 评审收敛） | ✅ 已完成，2026-08-02——Decider 选定 wiki 主体杂交方案 |
| Prototype（TestPlan 判据 + acme-api 腐烂库 + 梦引擎） | ✅ 已完成，2026-08-02——三场真梦跑通，H1–H5 施工侧全过，三道安全阀经故障注入实测 |
| Test（真人十格 + 模拟用户三格） | ✅ 已完成，2026-08-02——四份记录，三人格独立交叉验证三处结构性缺陷 |
| **Review（三级）** | **✅ 已完成，2026-08-02——verdict（原型）/ TargetReview（靶）/ DesignReview（冲刺）** |

## 文件地图

| 入口 | 当前用途 |
|---|---|
| [DesignReview.md](DesignReview.md) | **总入口**：冲刺总结算——一分钟版、长期目标双侧结算、五条验收信号、四条冲刺问题的答案、走过的路、方法论收获、去向、档案地图 |
| [ChallengeBackground.md](ChallengeBackground.md) | 挑战宣言、势力范围与非目标；官方现状与两个社区事故、前人三条路径对比、原料层可行性、差异化定位 |
| [DesignMap.md](DesignMap.md) | 长期目标与验收信号、冲刺问题 4 条、角色与结果表、11 步数据流地图、HMW 8 条（含族标记）、Target 总表 |
| [Target-1-Consolidation/](Target-1-Consolidation/) | **主靶全部档案**（见其 [README](Target-1-Consolidation/README.md)）：靶定义 TargetMap、结算 [TargetReview](Target-1-Consolidation/TargetReview.md)、Ideate 弹药与四派草图、原型与测试 |
| [Target-1-Consolidation/Prototype-01-FirstDream/](Target-1-Consolidation/Prototype-01-FirstDream/) | 原型现场（见其 [README](Target-1-Consolidation/Prototype-01-FirstDream/README.md)）：定稿 Sketches、双侧 Storyboard、[宣判 verdict](Target-1-Consolidation/Prototype-01-FirstDream/verdict.md)、test/ testbed/ engine/ artifacts/ |

原料与参照物不在本目录，在 [../reference/](../reference/)——外部方案源码、官方机制提取文档及其取材口径。

## 文档效力

1. 本目录是 Ask the Experts 的**蒸馏层**；与 `reference/` 下原料冲突时，**以原料为准**。
2. 带"推测"标注的判断不得作为决策依据。
3. Ask the Experts 的部分原始材料（决策者访谈原话、社区调研过程、40 条 HMW 原始候选）**未落盘**，是 Decider 2026-08-01 的知情选择而非遗漏——详见 [ChallengeBackground.md](ChallengeBackground.md) §6。需复查时须重跑对应模块。
4. Target-1 的范围与通过标准以 [TargetMap.md](Target-1-Consolidation/TargetMap.md) 为准、结论以 [TargetReview.md](Target-1-Consolidation/TargetReview.md) 为准；DesignMap 的 Target 总表只定段落关系，不替代该档案。
5. DesignReview 是总入口与总结论，但具体结算以各层 Review 为准（冲刺层 > 靶层 > 原型层的引用关系，不是覆盖关系）。
6. 已被当前文档替代的旧状态只从 Git 历史追溯，不堆回文档。
