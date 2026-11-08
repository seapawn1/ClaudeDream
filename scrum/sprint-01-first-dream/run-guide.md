# 第 9、10 项操作说明（桌面端）

> Sprint 01 工作文件，Developer 写，2026-11-09。下面的命令照抄即可，参数之间用空格隔开。
> “stakeholder”指桌面端的 stakeholder 会话；“PO”指 SeaPawn 本人。
> 所有做梦和体检的命令都在 `C:\Users\seapawn\AppData\Local\Temp\claude\dream-probe` 目录里发起：插件只装在这个目录（local scope），这个目录也已登记为测试目录，在里面开的会话不会被当成做梦的原料。做梦读哪些会话、写哪个记忆目录，按的是每个会话自己的目录，和发起目录无关。

## 0. 准备（stakeholder，第 9 项之前做一次）

| 步 | 在哪 | 敲什么 | 看到什么才算对 |
| --- | --- | --- | --- |
| 0.1 | 终端，`cd` 到 dream-probe 目录 | `claude plugin marketplace update claude-dream` | 不报错 |
| 0.2 | 同上 | `claude plugin update dreaming@claude-dream --scope local` | 提示更新到 0.2.0（现在装的是 0.1.0，是第 2 项冒烟时的旧代码） |
| 0.3 | 同上 | `claude plugin list` | `dreaming@claude-dream` 一行显示 `Version: 0.2.0`；`C:\Users\seapawn\.claude\plugins\cache\claude-dream\dreaming\0.2.0` 存在 |
| 0.4 | 桌面端 | 在 dream-probe 目录**新开**一个会话（已开着的会话还是旧代码） | 输入 `/dreaming:check` 时，参数提示里有 `--memory-from` |

第 9、10 项进行期间，Developer 不再改 `plugins/dreaming/` 的代码，改了要重做 0.1～0.4。

## 1. 第 9 项：桌面端演练（PO，在 0.4 开的会话里，一条做完再敲下一条）

每条命令都会先跑脚本，再弹 workflow 的批准卡片（选 Once），最后再跑脚本，打出一段英文结果。会话要一直开着，直到这段结果出来。

| 步 | 敲什么 | 大约多久 | 看到什么才算对 |
| --- | --- | --- | --- |
| 9.1 | `/dreaming:check --memory-from check-20261109-035849 --against check-20261109-035849 --project S--ClaudeDream --project S--ClaudeDream--claude-worktrees-sprint-01-first-dream --project S--IDEO-Scrum` | 5 分钟 | 末尾有 `check check-…: complete`。查的是第 7 项那份 25 条记忆的快照，不是现在的记忆；顺带和第 7 项 CLI 上的结论比 |
| 9.2 | `/dreaming:check --memory-from check-20261109-035849 --project S--ClaudeDream --project S--ClaudeDream--claude-worktrees-sprint-01-first-dream --project S--IDEO-Scrum` | 5 分钟 | 同上，并多出 `compared with check-…` 一段（自动和 9.1 比） |
| 9.3 | 同 9.2，原样再敲一次 | 5 分钟 | 同上（自动和 9.2 比） |
| 9.4 | `/dreaming:dream --session 4b0764eb-f5e6-40c0-96b4-b9b92bc45cb5 --session 4f2a4d7f-5369-4491-b3aa-a55834dc5e8e --session e4c1071e-2296-4484-8666-bc9d602af995 --sandbox` | 15 分钟 | 末尾有 `run dream-…: all checks passed (sandbox: nothing written back)`。这是 IDEO-Scrum 的 3 个小会话，共 5 段；沙盒，不写回。记下 `run dream-…` 这个编号，下面用 |
| 9.5 | `/dreaming:check --memory-from <9.4 的编号>:base --project S--IDEO-Scrum --against none` | 5 分钟 | `complete`。查的是做梦前的 IDEO-Scrum 记忆 |
| 9.6 | `/dreaming:check --memory-from <9.4 的编号> --project S--IDEO-Scrum` | 5 分钟 | `complete`，并和 9.5 比：输出里有 `pass line B` 一行 |

做完把会话放着，告诉 Master 或 Developer。Developer 从记录里算出噪声表（第 3 节），交 PO 定门槛。

## 2. 第 10 项：正式跑（PO，在 dream-probe 目录新开一个会话）

**跑之前**：把别的 Claude 会话都关掉，或者至少确认它们都停着、不在干活（Master、Developer、stakeholder 也一样）。做梦写回时，如果某个记忆目录在做梦期间被别处改过，这个目录就整个不写回，只能重来。

| 步 | 敲什么 | 大约多久 | 看到什么才算对 |
| --- | --- | --- | --- |
| 10.1 | `/dreaming:check --skip-project ideo-s10- --skip-project -tmp-trig-` | 待第 8 项实测后填 | `complete`。这是做梦前的体检 |
| 10.2 | `/dreaming:dream --skip-project ideo-s10- --skip-project -tmp-trig-` | 待第 8 项实测后填 | `all checks passed`，每个目录一行 `written back: N files`；末尾提示 `to undo: /dreaming:restore dream-…` |
| 10.3 | `/dreaming:check --skip-project ideo-s10- --skip-project -tmp-trig-` | 同 10.1 | `complete`，并自动和 10.1 比：`pass line B` 一行就是“记忆新鲜”的结果 |

`--skip-project` 跳过名字里含这段文字的项目目录：`ideo-s10-` 是 IDEO-Scrum 第 10 冲刺体验测试的临时目录，`-tmp-trig-` 是同一批测试的后台任务目录（trig-work 和 trig-smoke-s10）。跳过以后约 310 段，写 7 个记忆目录。

**出问题时**：
- 10.2 打出 `SOME CHECKS FAILED`：没通过核对的目录一个文件都没写，原样留着；把输出发给 Developer。
- 写回后想撤销：敲 `/dreaming:restore`，恢复最近一次写回前的样子；写回后又被改过的文件，它会列出来，不会覆盖，除非加 `--force`。
- 报告在 `C:\Users\seapawn\.claude-dream\runs\<编号>\`：体检看 `check-report.md`，做梦看 `run-report.json`。

**之后**：
- 第二天 PO 开新会话，看 agent 是否用上了整理后的记忆（DoD“用得上”）。
- 工作目录：渲染的会话每条命令跑完就自动删了；回滚副本 `runs\dream-…\backup\` 等 PO 验收以后再删；报告和日志留着。

## 3. 及格线门槛（第 9 项后，PO 定）

2.2 PBI-004 第 4 条定了口径 B：只比做梦改过或移走的老条目，没改过的老条目当对照。`check.py` 每次比较都算出三个数：
- **下降比例**：改过的老条目里，“可能过时 + 错误”少了几条，除以改过的条数；
- **波动比例**：没改过的老条目里，结论在“可能过时、错误”和其他之间翻转的条数，除以没改过的条数；
- **差** = 下降比例 − 波动比例。及格条件：差 > 门槛（`check.py` 的 `B_MIN_DIFF`，PO 定了再填）。

第 9 项跑完，Developer 交一张表：9.1～9.3 两两比较的波动比例（只有噪声）、9.5→9.6 的三个数，加上第 8 项 CLI 上的同样数字，再附一个建议的门槛。
