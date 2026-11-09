# 第 9、10 项操作说明（桌面端）

> Sprint 01 工作文件，Developer 写，2026-11-09。下面的命令照抄即可，参数之间用空格隔开。
> “stakeholder”指桌面端的 stakeholder 会话；“PO”指 SeaPawn 本人。
> 所有做梦和体检的命令都在 `C:\Users\seapawn\AppData\Local\Temp\claude\dream-probe` 目录里发起：插件只装在这个目录（local scope），这个目录也已登记为测试目录，在里面开的会话不会被当成做梦的原料。做梦读哪些会话、写哪个记忆目录，按的是每个会话自己的目录，和发起目录无关。

## 0. 准备（stakeholder，第 9 项之前做一次）

| 步 | 在哪 | 敲什么 | 看到什么才算对 |
| --- | --- | --- | --- |
| 0.1 | 终端，`cd` 到 dream-probe 目录 | `claude plugin marketplace update claude-dream` | 不报错 |
| 0.2 | 同上 | `claude plugin update dreaming@claude-dream --scope local` | 提示更新到 0.2.2（桌面端现在装的是 0.2.1：第 9 项和 10.1 用的是它；0.2.2 只改了 hook 核对对 lead 的判法，见下面的说明） |
| 0.3 | 同上 | `claude plugin list` | `dreaming@claude-dream` 一行显示 `Version: 0.2.2`；`C:\Users\seapawn\.claude\plugins\cache\claude-dream\dreaming\0.2.2` 存在 |
| 0.4 | 桌面端 | 在 dream-probe 目录**新开**一个会话（已开着的会话还是旧代码） | 输入 `/dreaming:check` 时，参数提示里有 `--memory-from` |

**为什么要再更新一次（0.2.1 → 0.2.2）**：10.1 第一次判了 INCOMPLETE，因为桌面端的 lead 在等 workflow 时多跑了一条 `ls`，被守卫拦下了，但核对把被拦的命令也算成失败；对 10.2（真实写回）这会让整个目录不写回。0.2.2 把被守卫拦下的 lead 命令单独列出、不算失败；放行的 lead 命令仍须全部是插件脚本。更新完以后，10.2 在**新开的会话**里敲，已开着的会话还是旧代码。10.1 不用重跑（第二次 `check-20261109-152119` 是 complete，做梦前的基线）。

第 9、10 项进行期间，Developer 不再改 `plugins/dreaming/` 的代码。万一改了，先把 `plugins/dreaming/.claude-plugin/plugin.json` 的版本号升一级（比如 0.2.3），再重做 0.1～0.4：版本号不变，`claude plugin update` 会认为已是最新，不会重新复制到缓存，桌面端跑的还是旧代码。

## 1. 第 9 项：桌面端演练（PO，在 0.4 开的会话里，一条做完再敲下一条）

每条命令都会先跑脚本，再弹 workflow 的批准卡片（选 Once），最后再跑脚本，打出一段英文结果。会话要一直开着，直到这段结果出来。

| 步 | 敲什么 | 大约多久 | 看到什么才算对 |
| --- | --- | --- | --- |
| 9.1 | `/dreaming:check --memory-from check-20261109-035849 --against check-20261109-035849 --project S--ClaudeDream --project S--ClaudeDream--claude-worktrees-sprint-01-first-dream --project S--IDEO-Scrum` | 5 分钟 | 末尾有 `check check-…: complete`。查的是第 7 项那份 25 条记忆的快照，不是现在的记忆；顺带和第 7 项 CLI 上的结论比 |
| 9.2 | `/dreaming:check --memory-from check-20261109-035849 --project S--ClaudeDream --project S--ClaudeDream--claude-worktrees-sprint-01-first-dream --project S--IDEO-Scrum` | 5 分钟 | 同上，并多出 `compared with check-…` 一段（自动和 9.1 比） |
| 9.3 | 同 9.2，原样再敲一次 | 5 分钟 | 同上（自动和 9.2 比） |
| 9.4 | `/dreaming:dream --session 4b0764eb-f5e6-40c0-96b4-b9b92bc45cb5 --session 4f2a4d7f-5369-4491-b3aa-a55834dc5e8e --session e4c1071e-2296-4484-8666-bc9d602af995 --sandbox` | 15 分钟 | 末尾有 `run dream-…: all safety checks passed`（后面可能跟一句 `N size or format problems reported below`，再跟 `(sandbox: nothing written back)`）。这是 IDEO-Scrum 的 3 个小会话，第 9 项实际跑时共 8 段（只选这 3 个会话时，4b0764eb 的父会话 547dd439 不在范围里，它们共有的消息归 4b0764eb，所以从 1 段变成 4 段）；沙盒，不写回。记下 `run dream-…` 这个编号，下面用 |
| 9.5 | `/dreaming:check --memory-from <9.4 的编号>:base --project S--IDEO-Scrum --against none` | 5 分钟 | `complete`。查的是做梦前的 IDEO-Scrum 记忆 |
| 9.6 | `/dreaming:check --memory-from <9.4 的编号> --project S--IDEO-Scrum` | 5 分钟 | `complete`，并和 9.5 比：输出里有 `pass line B` 一行 |

做完把会话放着，告诉 Master 或 Developer。Developer 从记录里算出噪声表（第 3 节），交 PO 定门槛。

## 2. 第 10 项：缩小版，真实写回（PO，在 dream-probe 目录的桌面端会话里）

Master 定（PO 纠正：验收不打折扣，时间长就缩小范围，但要真的检查一次）。范围：**IDEO-Scrum 记忆目录**（`S:\SeaPawn-Memory\memory\IDEO-Scrum`，在 git 里，13 条记忆），只取 9.4 的那 3 个会话 4b0764eb、4f2a4d7f、e4c1071e，共 8 段。全量版（310 段、7 个记忆目录，约 2 小时 10 分）留到下次。

**开跑前（PO）**
1. 关掉所有 IDEO-Scrum 的会话（起始目录在 `S:\IDEO-Scrum` 的），也关掉用不到的程序。原因：做梦期间有会话写这个目录，这个目录就整个不写回；还有内存，见下面。
2. 看这个目录在 git 里干不干净：`git -C S:\SeaPawn-Memory status --short -- memory/IDEO-Scrum`。没有输出就是干净（Master 15:0x 查过，是干净的，目录里 14 个文件）。有输出，先告诉 Developer 或 Master，不然最后的 diff 里会混着别的改动。
3. 及格线 PO 已定，写进了 2.2（PBI-004 第 4 条，提交 de31880）：差 > 0 算过；改过的老条目少于 30 条记“数据不足”。这个目录只有 13 条老记忆，结论必然是“数据不足”；这一轮验证的是真实写回、前后两次体检和回滚，不是“记忆新鲜”。
4. Developer 已经给真实目录拍了快照（14 个文件的哈希加副本），用来在写回后和恢复后做独立核对。

| 步 | 敲什么 | 大约多久 | 看到什么才算对 |
| --- | --- | --- | --- |
| 10.1 | `/dreaming:check --project S--IDEO-Scrum --against none` | 5 分钟 | `complete`。这是做梦前的体检，查的是真实记忆 |
| 10.2 | `/dreaming:dream --session 4b0764eb-f5e6-40c0-96b4-b9b92bc45cb5 --session 4f2a4d7f-5369-4491-b3aa-a55834dc5e8e --session e4c1071e-2296-4484-8666-bc9d602af995` | 11 分钟 | `all safety checks passed`，一行 `written back: N files`，末尾提示 `to undo: /dreaming:restore --run dream-…`（0.2.2 及以前打印的是不带 `--run` 的，照着敲会报错；0.2.3 改了，不带 `--run` 单写运行编号也认）。**不加 `--sandbox`，这次真的写** |
| 10.3 | `/dreaming:check --project S--IDEO-Scrum` | 6 分钟 | `complete`，自动和 10.1 比，有 `pass line B` 一行 |

每条都先跑脚本，再弹 workflow 的批准卡片（选 Once），最后再跑脚本，打出一段英文结果。

**10.3 之后（PO）**
- 看写了什么：`git -C S:\SeaPawn-Memory status --short -- memory/IDEO-Scrum`，`??` 开头的是新增的文件（9.4 沙盒新增了 12 个），`M` 开头的是改过的文件。改过的文件用 `git -C S:\SeaPawn-Memory diff -- memory/IDEO-Scrum` 看；新增的文件 `git diff` 看不到（没跟踪），直接打开看，或者看 `run-report.json` 里列出的新增清单。不用 `git add -N`，免得动 PO 的 git 索引。
- 留下，还是撤销：留下就什么都不用敲，提交由 PO 定（写回不提交 git）。撤销照 dream 输出最后一行 `to undo:` 之后的那条敲（`/dreaming:restore --run dream-…`；什么参数都不带，就撤销最近一次写回的运行），输出里应有 `identical to before the run=True`；再看一次 `git status --short -- memory/IDEO-Scrum`，应该和 10.1 之前一样（没有输出）。撤销以后告诉 Developer，我用开跑前拍的快照逐字节核对。

**批次是 8 段，不是 5 段**：只选这 3 个会话时，4b0764eb 的父会话 547dd439 不在范围里，它们共有的 1171 条消息就归 4b0764eb，所以从 1 段变成 4 段（397,136 字符）。内容没错，只是多渲染了父会话的那一截。这个副作用记进了 Review 清单。

**开跑前的内存**：任务管理器“性能 → 内存”里的“可用”至少要有 5 GB（全量版的要求；这一轮只有 8 个 agent，需要的少一些，但还是先看一眼）。依据是实测：
- 后台任务被系统停掉过两次，被停时可用内存约 2.7–2.9 GB（第 8 项，CLI 跑 16 个 agent）和约 2.2 GB（第 9 项 9.5 开始时）；可用 2.78 GB 时没被停。线大约在 3 GB。
- 从开跑到最低点，可用内存会掉约 1 GB（CLI 第 8 项 4.4 → 3.6 GB；桌面端 9.1 新开会话那一刻约 −1 GB）。
- 做梦跑的 agent 本身占得不多：9.4 里 8 个 agent 同时干活，claude 进程合计 4.51–4.62 GB，没有超出空闲时的范围（4.49–4.98 GB）。占内存的是常驻程序：桌面端 2.3 GB 加它的引擎 1.0 GB、命令行会话（Master、Developer、stakeholder）1.8 GB、VS Code 2.2 GB、系统服务 2.0 GB、Chrome（开着的话）1.1 GB。
- 所以：3 GB（被停的线）加 1 GB（下降）再留 1 GB 余量，取 5 GB。不够就关掉 VS Code、Chrome 和用不到的会话，关完再看一次。

**中途断了怎么办**
- 额度用完：workflow 会自己暂停，等额度恢复后接着跑。会话别关，什么都不用敲。
- 会话或桌面端被关掉、电脑重启、后台任务被系统停掉：先确认原来那次已经停了（原会话已关，或者会话里看不到 workflow 还在跑）；脚本也会挡一下，原运行 5 分钟内还有写入就拒绝续跑。然后在 dream-probe 目录新开一个会话，敲 `/dreaming:dream --continue <运行编号>`。运行编号是 10.2 开头打出的 `run: dream-…`，也可以在 `C:\Users\seapawn\.claude-dream\runs\` 里按时间找最新的 `dream-…`。已经做完的段不重做，只跑剩下的段；有段重跑的目录会再整理一次；最后照常核对、写回。
- 电脑睡眠：做梦会停在那里，醒来后看会话里还在不在跑；不在跑就照上一条接着跑。
- 体检（10.1、10.3）断了：重新敲同一条命令即可。

**出问题时**：10.2 的输出把问题分成两类。
- 安全类：这个目录一个文件都不写，原样留着，暂存结果留在 `runs\dream-…\stage\`。输出里是 `PROBLEM (this directory is not written back)` 开头的行，开头一行是 `SOME CHECKS FAILED`。这类问题有：有段没分析出结果；开跑前就有的记忆文件找不到了或被删；hook 核对不过（agent 用了 shell 或网络，或写到了工作目录外）；写回时发现文件被别处改过。把输出发给 Developer。
- 超限和格式类：不拦，目录照样写回。输出里是 `REPORTED, written back anyway` 开头的行，逐条写文件名、实际大小或行数、原因：`MEMORY.md` 超过 200 行或 25 KB（超出的部分，新会话开头看不到）；单个文件超过 100 KB；这一轮新增或改过的文件格式不对；整理环节没出结果。这一轮不自动修，留到下个冲刺。
- 报告在 `C:\Users\seapawn\.claude-dream\runs\<编号>\`：体检看 `check-report.md`，做梦看 `run-report.json`。

**之后**
- 第二天 PO 开新会话，看 agent 是否用上了整理后的记忆（DoD“用得上”）。
- 工作目录：渲染的会话每条命令跑完就自动删了；回滚副本 `runs\dream-…\backup\` 等 PO 验收以后再删；报告和日志留着。
- 写回只改文件，不提交 git。记忆仓库什么时候提交、推送，照旧由 PO 定。敏感内容过滤（PBI-008）不在本冲刺，推送前先看一眼 diff。

## 3. 及格线门槛（PO 已定，见 2.2；下面是依据）

2.2 PBI-004 第 4 条定了口径 B：只比做梦改过或移走的老条目，没改过的老条目当对照。`check.py` 每次比较都算出三个数：
- **下降比例**：改过的老条目里，“可能过时 + 错误”少了几条，除以改过的条数；
- **波动比例**：没改过的老条目里，结论在“可能过时、错误”和其他之间翻转的条数，除以没改过的条数；
- **差** = 下降比例 − 波动比例。

实测的波动（同一份 25 条记忆连查三次，两两比较）：CLI（Haiku）结论完全相同 20、22、23/25，波动比例 0.12、0.04、0.08；桌面端（DeepSeek）相同 19、19、19/25，波动比例 0.08、0.12、0.04。

**Developer 的建议：差 > 0 算过；改过的老条目少于 30 条时不下结论，记“数据不足”。** 依据（用实测的波动比例做的模拟，脚本 `scrum/sprint-01-first-dream/sim_threshold.py`）：
- 做梦什么都没改善时，差 > 0 的概率：改过 60 条、没改过 60 条约 1%–4%；30/30 约 4%–8%；14/12 约 12%–14%。所以要有 30 条的下限。
- 做梦真的把改过的条目里 30% 的过时条目修好时，60/60 通过的概率约 43%–78%；修好 20% 约 21%–52%。
- 门槛提到 0.05，误过几乎为零，但真修好 30% 也只有约 20%–49% 能过。

这一轮的 IDEO-Scrum 只有 13 条老记忆，改过的到不了 30 条，结论必然是“数据不足”。第 8 项（CLI）的差是 −0.297，桌面端 9.5→9.6 是 −0.091（改过只有 2 条），都离 0 很远；门槛定 0 还是 0.05 对能不能过几乎没有影响，决定结果的是做梦有没有把旧句子改过来。
