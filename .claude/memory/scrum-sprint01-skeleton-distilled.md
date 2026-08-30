---
name: scrum-sprint01-skeleton-distilled
description: Sprint-1（骨架回环，2026-08-13 收口）Review 蒸馏——Goal、增量、canUseTool spike 深坑、D3 四轮 review 战果、「空转冒充覆盖」病根与 DoD·D4 由来
metadata:
  type: project
---

Sprint-1 档案（`scrum/sprint-01-skeleton/`，待重构收尾删除，本记忆为知识载体）按 Sprint Review 原则蒸馏，2026-08-30。验收考卷内容依 standing 约定未读未引。上游 [[design-sprint-target1-distilled]]，下游 [[scrum-sprint02-negatives-distilled]]。

## Sprint Goal 与达成

> 插件骨架立起，回环走通——无人值守转完「触发→梦前快照→（占位）体检整合→梦报告→git 提交→下次会话一行提示」，引擎判得准不准本轮不管，环必须真转一圈。

**达成（PO Review 2026-08-13，增量收下）**：16 条验收判据 15 过 1 遗留；三场真梦（正常回环/蓄意越界/冷却重触发）全程无人值守留证，`dream:` 提交 revert 一步可退。

## Increment（PBI-04 拆三 + PBI-03 吸收）

- **04.1 触发链**：SessionEnd hook 零 API 写标记、冷却期（默认 30 分钟，0=关）、`CLAUDE_INVOKED_BY` 防递归实测可读。
- **04.2 梦进程壳与围栏**（吸收 PBI-03 缴械）：AC0 spike 先行实测 → `canUseTool` 放行路线成立、不需要退路；白名单仅 `.claude/memory/`、`.claude/dream/`、CLAUDE.md，越界拒绝记日志；梦前快照 pathspec 限三路径。
- **04.3 留证回环**：占位引擎过场、报告六节骨架、`dream:` 单提交可 revert、下次会话一行提示、无人干预全程跑通（Goal 验证点）。
- **交付接口约定**（D5 前身）：「凡属要求一律写明，只有怎么打分留在卷里」；额外要求唯一一项=故障注入入口（作恶模式）；两处不预设（报告提交归属留 C7、canUseTool 或退路——判「结论在案」，禁静默降级）。

## spike-ac0 的深坑（对生产实现长期有效）

1. **`permissionMode` 必须 `"default"`**：`.claude/` 是官方保护路径，`dontAsk` 下写入直接 Denied、**canUseTool 根本不会被调用**——claude-mem 的 hardened-options 用 dontAsk 是反着用（要永远拒绝）。选错 mode 会误诊为「canUseTool 没用」。
2. **`settingSources` 不能给空数组**：本机鉴权走 `~/.claude/settings.json` env 块的 `CLAUDE_CODE_OAUTH_TOKEN`（第三方中转路由坐实：代理变量同样被 Bash 子进程环境清空）——空 settingSources 连鉴权链路一起隔离掉，报 Not logged in；`['user']` 让子进程自读注入，全程不经手令牌明文。
3. **Windows 上 SDK 的 shell 工具叫 "PowerShell" 不叫 "Bash"**：围栏必须同时认得两个工具名，否则 Windows 上梦进程无法执行任何 shell 动作（落进未识别全拒分支）。
4. 绝对路径越权（写到用户全局 `~/.claude`）也被「能否 relative 到 cwd 内」判据正确拦截——攻击面不止 `../` 逃逸。

## D3 独立 review 四轮战果（git 语义陷阱系列）

白名单参数漏洞（`git log --output=`）→「禁 `-` 开头」方向错误 → 实测引号/进程替换绕过 → **收敛为 Bash/PowerShell 一律拒绝不判内容**；`git commit -- <目录>` 的 `--only` 语义：目录匹配不到已知文件整笔报错炸掉全新项目首梦（开发者亲手引入、审阅 agent 抓出）；锁文件 TOCTOU → `flag:'wx'` + 重读；stagedFiles 限定提交防吞人类暂存。**方法结论：git pathspec 类语义陷阱自查易漏，独立 review 的价值正在此；审阅轮次带停机条件——无新发现即停，剩余预算换角度（负向对照/人眼实看），不加同质轮次。**

## Learnings 与病根

- **「空转冒充覆盖」**（Retro 最大发现，两条独立证据共振）：快照提交分支从未被测试踩到（`--only` 回归漏掉）+ H-A4 判据因考场太干净空转白绿。病名：绿灯亮着，只因它守的那条路没人走过 → **DoD·D4「绿灯点过烟」由此入册**（守卫类检查上岗前亲眼看它红一次）。
- 首考挂 7 条全属出卷侧对实现想当然（命令路径基准/提交角色锚定/冷却声明/越界目标形态），developers 零改动，修卷三轮（`b3ad44d`）——出卷/答卷分离经实战成立。
- 环境 impediment：登录态缺失致 D1 真梦自测不可跑，端到端被迫 PO 手工 → Retro 改进项 2：真梦冒烟检查固定化（Sprint-2 E0 兑现为 smoke-check.mjs）。
- 移交三条处置完毕：冷却 0 值 falsy 陷阱（`Number(env)||默认` 吞 0）已修、生产仓残留根因是 `.claude/dream/` 整目录 ignore 致 `git add` 报 "ignored"（改精确到文件）、PBI-05 修复方向调研（`systemMessage` 官方标注 shown to user 但 SessionStart 下渲染待实测，备选 terminalSequence）。

## 回 backlog（不展示项）

H-A8 提示行只进 AI 上下文、用户看不见 → **新立 PBI-05**；PBI-01/PBI-02 排序留 Sprint-2 Planning；开发版插件从全局配置关闭。
