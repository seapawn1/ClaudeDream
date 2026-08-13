# claude-dream（插件产物代码）

Sprint-1「骨架回环」的产物代码。目标不是判得准，是环真转一圈：会话结束 → 落触发标记 → 冷却期判定 → Agent SDK 拉起梦进程 → 梦前快照 → 占位体检整合 → 梦报告 → `dream:` 提交 → 下次会话一行提示。完整背景见 [scrum/sprint-01-skeleton/SprintBacklog.md](../scrum/sprint-01-skeleton/SprintBacklog.md)。

## 现状（Sprint-1 阶段性边界）

- **体检/整合判断是占位的**：不含真实 M1–M5/S1–S3 判据，只新建一条占位记忆、回补一行索引，证明结构走得通。真判断留后续 Sprint（PBI-02）。
- **围栏是真的**：`canUseTool` 进程内回调实测能拦住白名单外的写入（含故障注入自测），不是占位。见 [src/lib/scope-guard.mjs](src/lib/scope-guard.mjs) 与 [AC0 spike 记录](../scrum/sprint-01-skeleton/spike-ac0/SPIKE-RECORD.md)。

## 目录

| 路径 | 内容 |
|---|---|
| `.claude-plugin/plugin.json` | 插件清单 |
| `hooks/hooks.json` | SessionEnd（落触发标记）、SessionStart（读下次会话提示行） |
| `src/session-end.mjs` | SessionEnd hook 入口：零 API 落标记 + detached 拉起 `trigger-check.mjs` |
| `src/trigger-check.mjs` | 分离进程：判冷却期、防递归，条件满足才跑梦 |
| `src/run-dream.mjs` | 梦进程主体：P0 快照 → SDK 占位引擎 → 报告 → commit 拆分；可直接 CLI 跑（`--rogue` 走故障注入） |
| `src/session-start.mjs` | 读并消费下次会话提示行 |
| `src/lib/scope-guard.mjs` | `canUseTool` 白名单判断，移植自设计冲刺原型 `engine/scope-guard.py` |
| `src/lib/paths.mjs` | 共享路径/常量 |
| `test/self-test.mjs` | DoD·D1 一键重跑验证——自建沙箱，不碰真实 `.claude/` |

## 跑自证

```bash
npm install
node test/self-test.mjs
```

沙箱建在系统临时目录，全绿自动清理；有失败项会保留沙箱路径供排查。
