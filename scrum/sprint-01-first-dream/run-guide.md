# 第 9、10 项操作说明（桌面端）

> Sprint 01 工作文件，Developer 写，2026-11-09。下面的命令照抄即可，参数之间用空格隔开。
> “stakeholder”指桌面端的 stakeholder 会话；“PO”指 SeaPawn 本人。
> 所有做梦和体检的命令都在 `C:\Users\seapawn\AppData\Local\Temp\claude\dream-probe` 目录里发起：插件只装在这个目录（local scope），这个目录也已登记为测试目录，在里面开的会话不会被当成做梦的原料。做梦读哪些会话、写哪个记忆目录，按的是每个会话自己的目录，和发起目录无关。

## 0. 准备（stakeholder，第 9 项之前做一次）

| 步 | 在哪 | 敲什么 | 看到什么才算对 |
| --- | --- | --- | --- |
| 0.1 | 终端，`cd` 到 dream-probe 目录 | `claude plugin marketplace update claude-dream` | 不报错 |
| 0.2 | 同上 | `claude plugin update dreaming@claude-dream --scope local` | 提示更新到 0.2.1（现在装的是 0.1.0，是第 2 项冒烟时的旧代码） |
| 0.3 | 同上 | `claude plugin list` | `dreaming@claude-dream` 一行显示 `Version: 0.2.1`；`C:\Users\seapawn\.claude\plugins\cache\claude-dream\dreaming\0.2.1` 存在 |
| 0.4 | 桌面端 | 在 dream-probe 目录**新开**一个会话（已开着的会话还是旧代码） | 输入 `/dreaming:check` 时，参数提示里有 `--memory-from` |

第 9、10 项进行期间，Developer 不再改 `plugins/dreaming/` 的代码。万一改了，先把 `plugins/dreaming/.claude-plugin/plugin.json` 的版本号升一级（比如 0.2.2），再重做 0.1～0.4：版本号不变，`claude plugin update` 会认为已是最新，不会重新复制到缓存，桌面端跑的还是旧代码。

## 1. 第 9 项：桌面端演练（PO，在 0.4 开的会话里，一条做完再敲下一条）

每条命令都会先跑脚本，再弹 workflow 的批准卡片（选 Once），最后再跑脚本，打出一段英文结果。会话要一直开着，直到这段结果出来。

| 步 | 敲什么 | 大约多久 | 看到什么才算对 |
| --- | --- | --- | --- |
| 9.1 | `/dreaming:check --memory-from check-20261109-035849 --against check-20261109-035849 --project S--ClaudeDream --project S--ClaudeDream--claude-worktrees-sprint-01-first-dream --project S--IDEO-Scrum` | 5 分钟 | 末尾有 `check check-…: complete`。查的是第 7 项那份 25 条记忆的快照，不是现在的记忆；顺带和第 7 项 CLI 上的结论比 |
| 9.2 | `/dreaming:check --memory-from check-20261109-035849 --project S--ClaudeDream --project S--ClaudeDream--claude-worktrees-sprint-01-first-dream --project S--IDEO-Scrum` | 5 分钟 | 同上，并多出 `compared with check-…` 一段（自动和 9.1 比） |
| 9.3 | 同 9.2，原样再敲一次 | 5 分钟 | 同上（自动和 9.2 比） |
| 9.4 | `/dreaming:dream --session 4b0764eb-f5e6-40c0-96b4-b9b92bc45cb5 --session 4f2a4d7f-5369-4491-b3aa-a55834dc5e8e --session e4c1071e-2296-4484-8666-bc9d602af995 --sandbox` | 15 分钟 | 末尾有 `run dream-…: all safety checks passed`（后面可能跟一句 `N size or format problems reported below`，再跟 `(sandbox: nothing written back)`）。这是 IDEO-Scrum 的 3 个小会话，共 5 段；沙盒，不写回。记下 `run dream-…` 这个编号，下面用 |
| 9.5 | `/dreaming:check --memory-from <9.4 的编号>:base --project S--IDEO-Scrum --against none` | 5 分钟 | `complete`。查的是做梦前的 IDEO-Scrum 记忆 |
| 9.6 | `/dreaming:check --memory-from <9.4 的编号> --project S--IDEO-Scrum` | 5 分钟 | `complete`，并和 9.5 比：输出里有 `pass line B` 一行 |

做完把会话放着，告诉 Master 或 Developer。Developer 从记录里算出噪声表（第 3 节），交 PO 定门槛。

## 2. 第 10 项：正式跑（PO，在 dream-probe 目录新开一个会话）

**跑之前**：把别的 Claude 会话都关掉（Master、Developer、stakeholder 也一样），理由有两个。一是写回：某个记忆目录在做梦期间被别处改过，这个目录就整个不写回，只能重来。二是内存：做梦同时跑 16 个 agent，第 8 项在 CLI 上跑到一半，本机 16 GB 内存只剩约 3 GB 空闲（当时开着 21 个 claude 进程），后台任务被系统停掉了。

| 步 | 敲什么 | 大约多久 | 看到什么才算对 |
| --- | --- | --- | --- |
| 10.1 | `/dreaming:check --skip-project ideo-s10- --skip-project -tmp-trig-` | 约 15 分钟（约 130 条记忆、17 个 checker） | `complete`。这是做梦前的体检 |
| 10.2 | `/dreaming:dream --skip-project ideo-s10- --skip-project -tmp-trig-` | 约 2 小时 10 分（310 个 analyzer、7 个 organizer；按第 8 项 CLI 实测 193 段用了 79 分钟，即每分钟 2.4 段推算；跳过 b1d91409 则只有约 206 段，约 1 小时 25 分；桌面端的速度以第 9 项为准） | `all safety checks passed`（后面可能跟 `N size or format problems reported below`），每个目录一行 `written back: N files`；末尾提示 `to undo: /dreaming:restore dream-…` |
| 10.3 | `/dreaming:check --skip-project ideo-s10- --skip-project -tmp-trig-` | 约 20 分钟（做梦后条目会变多） | `complete`，并自动和 10.1 比：`pass line B` 一行就是“记忆新鲜”的结果 |

`--skip-project` 跳过名字里含这段文字的项目目录：`ideo-s10-` 是 IDEO-Scrum 第 10 冲刺体验测试的临时目录，`-tmp-trig-` 是同一批测试的后台任务目录（trig-work 和 trig-smoke-s10）。跳过以后约 310 段，写 7 个记忆目录。
另有 `--skip-session <会话编号开头几位>`，跳过单个会话，默认不用。stakeholder 会话 b1d91409（竞品调研，104 段，约占正式跑字符的 38%）要不要跳过，PO 看过第 8 项 organizer 怎么处理那份 204 KB 的竞品清单以后再定；要跳过，就在 10.1～10.3 三条命令后面都加 `--skip-session b1d91409`。

**开跑前的内存**：任务管理器“性能 → 内存”里的“可用”至少要有 4 GB。依据是第 8 项在 CLI 上的实测：续跑开始时可用 4.4 GB，27 分钟里最低降到 3.6 GB，跑做梦的那个 claude 进程自己最多占 0.76 GB；上一次是在可用只剩约 2.9 GB 时被系统停掉的。桌面端的进程另算，第 9 项由 Developer 在后台用 `scrum\sprint-01-first-dream\memwatch.py` 采样（PO 不用管），第 10 项前再核一次这个数。不够就关掉 VS Code、Chrome 和 Sprint 01 用不到的会话，关完再看一次。

**中途断了怎么办**（10.2 要跑两个多小时）：
- 额度用完：workflow 会自己暂停，等额度恢复后接着跑。会话别关，什么都不用敲。
- 会话或桌面端被关掉、电脑重启、后台任务被系统停掉：先确认原来那次已经停了（原会话已关，或者会话里看不到 workflow 还在跑）；脚本也会挡一下，原运行 5 分钟内还有写入就拒绝续跑。然后在 dream-probe 目录新开一个会话，敲 `/dreaming:dream --continue <运行编号>`。运行编号是 10.2 开头打出的 `run: dream-…`，也可以在 `C:\Users\seapawn\.claude-dream\runs\` 里按时间找最新的 `dream-…`。已经做完的段不重做，只跑剩下的段；有段重跑的目录会再整理一次；最后照常核对、写回。
- 电脑睡眠：做梦会停在那里，醒来后看会话里还在不在跑；不在跑就照上一条接着跑。所以开跑前把睡眠关掉，或者把“接通电源后睡眠”设成“从不”。
- 体检（10.1、10.3）断了：重新敲同一条命令即可，十几分钟。

**出问题时**：10.2 的输出把问题分成两类。
- 安全类：这个目录一个文件都不写，原样留着，暂存结果留在 `runs\dream-…\stage\`。输出里是 `PROBLEM (this directory is not written back)` 开头的行，开头一行是 `SOME CHECKS FAILED`。这类问题有：有段没分析出结果；开跑前就有的记忆文件找不到了或被删；hook 核对不过（agent 用了 shell 或网络，或写到了工作目录外）；写回时发现文件被别处改过。把输出发给 Developer。
- 超限和格式类：不拦，目录照样写回。输出里是 `REPORTED, written back anyway` 开头的行，逐条写文件名、实际大小或行数、原因：`MEMORY.md` 超过 200 行或 25 KB（超出的部分，新会话开头看不到）；单个文件超过 100 KB；这一轮新增或改过的文件格式不对；整理环节没出结果。这一轮不自动修，留到下个冲刺。你看过觉得不行，敲 `/dreaming:restore` 整体撤销。
- 写回后想撤销：敲 `/dreaming:restore`，恢复最近一次写回前的样子；写回后又被改过的文件，它会列出来，不会覆盖，除非加 `--force`。
- 报告在 `C:\Users\seapawn\.claude-dream\runs\<编号>\`：体检看 `check-report.md`，做梦看 `run-report.json`。

**之后**：
- 第二天 PO 开新会话，看 agent 是否用上了整理后的记忆（DoD“用得上”）。
- 工作目录：渲染的会话每条命令跑完就自动删了；回滚副本 `runs\dream-…\backup\` 等 PO 验收以后再删；报告和日志留着。
- 写回只改文件，不提交 git。记忆仓库什么时候提交、推送，照旧由 PO 定。敏感内容过滤（PBI-008）不在本冲刺，推送前先看一眼 diff。

## 3. 及格线门槛（第 9 项后，PO 定）

2.2 PBI-004 第 4 条定了口径 B：只比做梦改过或移走的老条目，没改过的老条目当对照。`check.py` 每次比较都算出三个数：
- **下降比例**：改过的老条目里，“可能过时 + 错误”少了几条，除以改过的条数；
- **波动比例**：没改过的老条目里，结论在“可能过时、错误”和其他之间翻转的条数，除以没改过的条数；
- **差** = 下降比例 − 波动比例。及格条件：差 > 门槛（`check.py` 的 `B_MIN_DIFF`，PO 定了再填）。

第 9 项跑完，Developer 交一张表：9.1～9.3 两两比较的波动比例（只有噪声）、9.5→9.6 的三个数，加上第 8 项 CLI 上的同样数字，再附一个建议的门槛。表用 `python -I scrum/sprint-01-first-dream/noise_table.py --repeat <9.1> <9.2> <9.3> --dream <9.5> <9.6>` 生成。

CLI 上已有的数（Haiku 5.5，同一份 25 条记忆连查三次）：两两比较，结论完全相同的占 80%、88%、92%，波动比例 0.12、0.04、0.08。

门槛怎么想（Developer 的初步建议，等桌面端的数）：如果做梦其实没让记忆变新，改过那批的下降比例只是噪声，平均在 0 附近，上下浮动大约是“波动比例 ÷ 改过的条数”再开平方。门槛定为 0，就是要求下降比例超过整个波动比例；按波动 0.08 算，改过的条目有 30 条时，噪声冒充“通过”的机会约 6%，60 条时约 1%。正式跑改过的老条目预计有几十条，所以建议门槛 0；如果桌面端的波动明显更大，或者改过的条目少于 30 条，再往上加。
