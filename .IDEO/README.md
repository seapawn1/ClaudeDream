# .IDEO

这里是 ClaudeDream 的设计冲刺工作区，保存挑战定义、长期目标、设计地图与方案收敛过程。这里以设计文档为主；唯一例外是原型施工物（可运行脚本、假数据 builder、真跑产物）——它们是设计迭代的道具，随所属 `Prototype-0X-*/` 子文件夹落户，与其 Sketches/Storyboard/TestPlan 同住一个迭代单元。

**不做的事**：重复方法定义（方法源文在 `ideo-scrum:design-kernel` 插件里）、存放会话逐字原文、替代 skill 目录。

## 当前阶段

| 阶段 | 状态 |
|---|---|
| Monday Define（Challenge / 长期目标 / 冲刺问题 / Map v0） | ✅ 已拍板，2026-07-29 |
| Ask the Experts（四模块专家研究） | ✅ 已完成，2026-08-01 |
| POV + HMW（40 条 → 21 条 → 选定 8 条） | ✅ 已完成，2026-08-01 |
| Pick a Target（长期用户 + S6–S8 整合段） | ✅ 已完成，2026-08-01 |
| Ideate（Lightning Demos → Sketch → 评审收敛） | ✅ 已完成，2026-08-02——Decider 选定 wiki 主体杂交方案，定稿 Sketches.md |
| **Prototype** | **⬅ 当前——Storyboard ✅ 2026-08-02（双侧：用户十格 + 梦九镜），下一步原型施工** |
| Test | 未启动 |

## 文件地图

| 入口 | 当前用途 |
|---|---|
| [ChallengeBackground.md](ChallengeBackground.md) | 挑战宣言、势力范围与非目标；官方现状与两个社区事故、前人三条路径对比、原料层可行性、差异化定位 |
| [DesignMap.md](DesignMap.md) | 长期目标与验收信号、冲刺问题 4 条、角色与结果表、11 步数据流地图、HMW 8 条（含族标记）、Target 总表 |
| [Target-1-Consolidation/TargetMap.md](Target-1-Consolidation/TargetMap.md) | **当前主靶**：整合段（S6–S8）的目标、通过标准、靶内 6 条 HMW；靶外事项与未决问题的备注 |
| [Target-1-Consolidation/Ideate/IdeaPool.md](Target-1-Consolidation/Ideate/IdeaPool.md) | Lightning Demos 蒸馏产物：14 条 big idea + 6 条反面清单 + S4 证据对摆——Sketch 的弹药库 |
| [Target-1-Consolidation/Ideate/SketchPool.md](Target-1-Consolidation/Ideate/SketchPool.md) | 四份竞争草图（A 官方改良 / B 审计·主 agent / C 机械 / D wiki）——评审已收敛，胜者见 Prototype-01 的 Sketches.md |
| [Target-1-Consolidation/Prototype-01-FirstDream/Sketches.md](Target-1-Consolidation/Prototype-01-FirstDream/Sketches.md) | **定稿方案**（拍板 2026-08-02）：wiki 主体 + 三派嫁接——判据 M1–M5/S1–S3、L0–L3 权限模型、三道安全阀、报告六节、阀门配置、风险表 |
| [Target-1-Consolidation/Prototype-01-FirstDream/Storyboard.md](Target-1-Consolidation/Prototype-01-FirstDream/Storyboard.md) | 双侧故事板：用户侧十格（Test 剧本）+ 梦侧九镜（施工剧本）+ 道具与施工清单 |
| [Target-1-Consolidation/Prototype-01-FirstDream/test/TestPlan.md](Target-1-Consolidation/Prototype-01-FirstDream/test/TestPlan.md) | Friday Test 施工图：硬判据 H1–H5（五条验收信号操作化）、行为观察 O1–O4、用户剧本（seapawn 全程 + 模拟用户 P1–P3）、宣判规则三档出口 |

原料与参照物不在本目录，在 [../reference/](../reference/)——外部方案源码、官方机制提取文档及其取材口径。

## 文档效力

1. 本目录是 Ask the Experts 的**蒸馏层**；与 `reference/` 下原料冲突时，**以原料为准**。
2. 带"推测"标注的判断不得作为决策依据。
3. Ask the Experts 的部分原始材料（决策者访谈原话、社区调研过程、40 条 HMW 原始候选）**未落盘**，是 Decider 2026-08-01 的知情选择而非遗漏——详见 [ChallengeBackground.md](ChallengeBackground.md) §6。需复查时须重跑对应模块。
4. Target-1 的范围与通过标准以 [Target-1-Consolidation/TargetMap.md](Target-1-Consolidation/TargetMap.md) 为准；DesignMap 的 Target 总表只定段落关系，不替代该档案。
5. 已被当前文档替代的旧状态只从 Git 历史追溯，不堆回文档。
