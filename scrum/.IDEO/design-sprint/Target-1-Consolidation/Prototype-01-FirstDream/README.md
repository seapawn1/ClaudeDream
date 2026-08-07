# Prototype-01 · 第一场梦

Target-1 的原型施工与测试现场——设计冲刺 Thursday（施工）与 Friday（测试）的全部产物。原型的本质是让"梦"在一个真实腐烂的记忆库上**真跑第一次**，不是画假界面。

**结论：带条件通过 → [verdict.md](verdict.md)（先读这个）**

## 文件地图

| 入口 | 内容 |
|---|---|
| [verdict.md](verdict.md) | **宣判书**——H/O 判据对账、C1–C7 改造清单、待裁三项、方法论收获 |
| [Sketches.md](Sketches.md) | 定稿方案：判据 M1–M5/S1–S3、L0–L3 权限模型、三道安全阀、报告六节、阀门配置 |
| [Storyboard.md](Storyboard.md) | 双侧故事板：用户侧十格（Test 剧本）+ 梦侧九镜（施工剧本） |
| [test/](test/) | [TestPlan.md](test/TestPlan.md) 判据与剧本；四份测试记录（真人 seapawn + 模拟用户 P1/P2/P3） |
| [testbed/](testbed/) | `build-acme.py` 腐烂记忆库 builder（42 条记忆，5 条种植腐烂）+ `rot-manifest.md` 对答案卡 |
| [engine/](engine/) | 梦引擎：`m-checks.py` 机械体检、`dream-prompt.md` 梦提示词、`run-dream.py` 工程外壳、`valve-template.md` 阀门、`rogue-dream.py` 故障注入、`scope-guard.py` 守门人 |
| [artifacts/](artifacts/) | 三场真梦产物（run-01 阀开 / run-02 关阀 / run-03）+ [audit-notes.md](artifacts/audit-notes.md) 施工验收审计 |

## 怎么复现

```bash
python testbed/build-acme.py                 # 生成腐烂记忆库（确定性，重跑一致）
python engine/run-dream.py testbed/acme-api  # 真跑一场梦（需 claude CLI）
```

`testbed/acme-api/` 是生成物，经 `.gitignore` 不入库——builder 是唯一真相。故障注入实测：`ROGUE_MODE=fuse python engine/run-dream.py testbed/acme-api --inject-rogue engine/rogue-dream.py --fuse-override 1`。

## 状态

设计冲刺已结束（2026-08-02），**本文件夹冻结为档案**。改造清单见 [verdict.md](verdict.md) 第三节，转入产物开发 backlog。原型的已知简化（触发用手动、缴械靠 git 审计兜底）在 `engine/run-dream.py` 文件头的"原型简化声明"中列明。
