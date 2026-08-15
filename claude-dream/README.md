# claude-dream（插件产物代码）

Sprint-3「引擎主干·纯机械梦」的产物代码：Sprint-1 骨架回环（触发链/围栏/git 留痕）+ Sprint-2 底片层 + Sprint-3 机械引擎（真体检/真处置/熔断/证据改造/G9 回程）。完整背景见 [scrum/sprint-03-engine/SprintBacklog.md](../scrum/sprint-03-engine/SprintBacklog.md)。

## 现状（Sprint-3 施工完成边界）

- **纯机械梦已上岗**：`run-dream.mjs` 默认路径零 SDK、零网络、无登录态可跑整场——G9 翻底片 → M1–M5 机械体检 → L0 修复/确凿删除/L3 隔离（feedback 铁律）→ 熔断在线 → 六节报告（C2/C3 证据形态）→ `dream:`/`dream-evidence:` 双提交。
- **SDK 唯一落点**：`run-dream-rogue.mjs`（rogue 故障演练路径，动态 import）——canUseTool 围栏回归测试继续走它，继续需要登录态。
- **LLM 层（S1–S3 判据/L1 合并连接/L2 阀门管辖）归 PBI-07**，本轮不偷跑；`llm_checks: on` 档位行为同 off，报告如实标注。
- 自证 `node test/self-test.mjs` 319/319（含 D4 点烟：熔断压线触发、enabled 闸门、零登录态运行证明）。

## 目录

| 路径 | 内容 |
|---|---|
| `.claude-plugin/plugin.json` | 插件清单 |
| `hooks/hooks.json` | SessionEnd（落触发标记）、SessionStart（读下次会话提示行） |
| `src/session-end.mjs` | SessionEnd hook 入口：零 API 落标记 + detached 拉起 `trigger-check.mjs` |
| `src/trigger-check.mjs` | 分离进程：底片压缩 → 补捞 → 阀门配置闸门（enabled）→ 冷却期 → 锁 → 拉梦 |
| `src/run-dream.mjs` | 梦进程编排（机械管线）：P0 快照 → G9 翻底片 → 体检 → 处置+熔断 → 双提交 → 报告；`--rogue` 走 SDK 故障演练路径 |
| `src/run-dream-rogue.mjs` | SDK 占位引擎 + canUseTool 围栏（故障演练专用，全仓唯一 SDK 落点） |
| `src/session-start.mjs` | 读并消费下次会话提示行 |
| `src/lib/` | paths（路径/常量）、proc-lock（锁）、scope-guard（canUseTool 围栏）、exec-log（受信任执行+执行日志）、dream-git（P0 快照/双提交拆分） |
| `src/engine/` | **机械引擎**：config（阀门配置）、check（M1–M5 判据）、act（处置层）、fuse（熔断器）、report（六节报告）、g9（定向翻底片） |
| `src/negatives/` | 底片产线（Sprint-2）：压缩/台账/补捞 + RETAIN-RULES 规则表 |
| `test/self-test.mjs` | DoD·D1 一键重跑验证——自建沙箱，不碰真实 `.claude/`；`test/smoke-check.mjs` 冒烟（登录态检查，仅 SDK 路径需要） |

## 跑自证

```bash
npm install
node test/self-test.mjs
```

沙箱建在系统临时目录，全绿自动清理；有失败项会保留沙箱路径供排查。

## 交付接口约定

公开接口（命令形状、adapter 键名、阀门配置、报告结构、底片消费契约、熔断口径）见 [scrum/sprint-03-engine/acceptance/adapter.json](../scrum/sprint-03-engine/acceptance/adapter.json) 与 SprintBacklog 2.4 节——验收与后续消费者只依声明接线。
