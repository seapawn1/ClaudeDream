# Sprint-01-skeleton · SprintBacklog

## 第一节 · Sprint Goal

> **插件骨架立起，回环走通**——以 Claude Code 插件形态，无人值守完成一次「触发 → 梦前快照 → （占位）体检整合 → 梦报告 → git 提交 → 下次会话一行提示」的完整回环。引擎判得准不准本轮不管，环必须真转一圈。

## 第二节 · 选取条目与精化

### 选中条目（摘自 [ProductBacklog.md](../ProductBacklog.md) 第二部分）

| 编号 | 标题 | 产品意图 | 架构定位 | 当前状态 | size | 备注（依据） |
|---|---|---|---|---|---|---|
| PBI-03 | Agent SDK canUseTool 结构缴械 | 梦在结构上碰不到它不该碰的东西 | 横切 S5–S7 | Sprint-1 选定，已精化 | M | `.claude` 是受保护路径、headless 下 hook 不加载——从「推荐」升为「必选」；PBI-02 的前提（DesignReview §7、原型实测） |
| PBI-04 | 插件骨架与回环 | 插件形态立起来：无人值守转完一圈「触发→快照→占位整合→报告→提交→提示」，后续引擎内容有处可装 | S5 + P0 + S8 + S9（S6/S7 占位） | Sprint-1 选定，已精化 | L | 吸收 PBI-03（拉起梦必经 Agent SDK，canUseTool 围栏随壳就地装）；OC：环真转一圈，dream commit 可 revert |

### 精化（PBI-04 拆三条，04.2 吸收 PBI-03）

**PBI-04.1 触发链——梦该醒时醒**（含插件外壳）· size M
- AC1 插件本地安装后加载无报错
- AC2 会话正常结束后触发标记落盘（SessionEnd hook，零 API、零判断）
- AC3 冷却期内（默认 30 分钟，可配置）再结束会话，不重复触发
- AC4 梦进程自身结束不再触发（CLAUDE_INVOKED_BY 防递归，随 04.2·AC0 一并实测该环境变量在 Agent SDK 启动路径下确实可读）

**PBI-04.2 梦进程壳与围栏——梦只碰该碰的**（吸收 PBI-03）· size L（含前提验证，不确定性最高）
- AC0 **前提实测（spike，本条最先做）**：Agent SDK 起一次空跑，实测 canUseTool 在写入 `.claude/memory/` 时被调用且放行成功；若放行失败，退路为 `bypassPermissions` + git 快照审计（同原型做法），退路须记录在案，不允许静默降级
- AC1 分离进程判定条件满足后，经 Agent SDK 拉起梦进程
- AC2 canUseTool 白名单：仅 `.claude/memory/`、`.claude/dream/`、CLAUDE.md 可写；白名单内写入放行且全程零人工权限提示；越界写入被拒，且拒绝记录写入 `.claude/dream/<时间>-canUseTool.log`
- AC3 梦启动前完成 git 梦前快照（P0，pathspec 仅限上述三处）

**PBI-04.3 留证回环——梦留得下证**· size M
- AC1 占位引擎走完体检→整合过场（本轮不要求判得准）
- AC2 梦报告落 `.claude/dream/`，六节骨架在位（内容可为占位）
- AC3 记忆与 CLAUDE.md 改动收为单笔 `dream:` 前缀 commit，`git revert` 实测可退；报告文件是否同笔提交留待 C7 决定，本轮不预设、不写死
- AC4 下次会话开场出现一行提示
- AC5 **无人干预全程跑通**：从触发到提交一次运行完成，过程中不出现任何人工介入或权限提示——这是 Sprint Goal 本身的验证点

*size 已在本次 Sprint Planning 内由 Product Developer 自估（符合 ProductBacklog「Sprint Planning 时由 Product Developers 重估」的规则）；三条装不下时按行序退回，退回不伤 Sprint Goal 的最小成立（04.1+04.2 跑通即环有骨，04.3 是环合拢）。DoD 的 D1（一键重跑验证）与 D3（独立 review）不是单独工作项，是每条 AC 交付时随附的质量门——验证脚本随 04.1–04.3 各自产出，D3 在 Sprint 收尾时统一过审（见第三节 DoD 门节点）。*

### 交付接口约定（2026-08-12 由 PO 补入）

本 Sprint 的验收 test 由独立于开发的一方出卷，**卷面不对开发方公开**——防的是对着判据表写出一个专门讨好脚本的空壳，不是不信任。规矩是：**凡属"要求"一律在此写明，只有"怎么打分"留在卷里**。若验收时出现本节未写明、却决定过不过的要求，那是出卷方的错，按打回处理并修卷。

开发方据 AC 自建开发沙箱自证跑通（DoD·D1 仍然照常兑现），不必也拿不到验收考场。除本节三项外，AC 之外无额外加码。

**① 故障注入入口（唯一一项额外要求）**

实现须提供一个**蓄意越界的作恶模式**入口——命令、环境变量或启动参数均可——令梦进程尝试写一个白名单外的文件。理由：合作型 agent 永远不会主动越界，围栏有效性靠正常跑一场梦证明不了，只能靠故障注入（设计冲刺 Prototype-01 已实测，做法见原型 `engine/rogue-dream.py`）。没有它，04.2·AC2 的"越界被拒"无法验证。

**② 验收适配声明 `adapter.json`**

完工时在 `scrum/sprint-01-skeleton/acceptance/adapter.json` 交一份适配声明，让验收方接得上实现的入口与产物落点。命令以考场项目根为工作目录、以非交互方式（stdin 关闭）执行；`source` 段的路径相对本仓库根。

| 键 | 填什么 |
|---|---|
| `commands.install` | 在目标项目里安装/启用插件的命令（无需则留空） |
| `commands.sessionEnd` | 模拟一次会话正常结束、触发 hook 链 |
| `commands.runDream` | 无人值守拉起一次梦 |
| `commands.runDreamRogue` | 上述①的作恶模式入口 |
| `paths.triggerMarker` | 触发标记落点 |
| `paths.reportGlob` | 梦报告落点（可带 `*`） |
| `paths.canUseToolLogGlob` | 越界拒绝日志落点 |
| `paths.promptCarrier` | 下次会话提示行的载体 |
| `source.sessionEndHook` / `dreamEntry` / `pluginManifest` | 三个源码文件位置 |
| `sdkModule` | 所用 Agent SDK 包名（默认 `@anthropic-ai/claude-agent-sdk`） |
| `cooldown.file` / `cooldown.key` | 冷却期配置的落点与键名 |
| `recursionGuardEnv.name` / `value` | 防递归所依据的环境变量 |
| `report.sections` | 报告六节的实际标题写法（六节内容见 ProductBacklog 架构 S8） |
| `report.commitPolicy` | 报告是否与记忆改动同笔提交，见③ |
| `offWhitelistTarget` | 作恶模式尝试写的那个白名单外文件 |
| `spikeRecord` | AC0 spike 记录的落盘位置 |
| `timeoutMs` | 单条命令的超时上限 |

**③ 两处本轮不预设，怎么选都不扣分**

- **报告文件是否与记忆改动同笔提交**：04.3·AC3 明写留待 C7 决定。验收只判"记忆与 CLAUDE.md 的改动收为单笔 `dream:` 提交"，报告在哪笔不判；选了哪种在 `report.commitPolicy` 声明即可。
- **canUseTool 放行还是走退路**：04.2·AC0 的 spike 结果决定。放行成立、或走 `bypassPermissions` + git 审计退路，两条路都算过；验收判的是"结论在案、退路有交代"，不是"必须放行"——**但不允许静默降级**。

## 第三节 · 计划

```mermaid
flowchart TD
    A[插件外壳<br/>plugin.json + 目录骨架] --> B[hook 触发链<br/>PBI-04.1]
    B --> C0[AC0 前提实测 spike<br/>canUseTool 能否放行写 .claude/memory/]
    C0 --> C[SDK 壳与 canUseTool 围栏<br/>PBI-04.2，吸收 PBI-03]
    C --> D0[梦前快照<br/>P0]
    D0 --> E[占位引擎与梦报告<br/>PBI-04.3]
    E --> D9[dream commit<br/>S9]
    D9 --> F[回环实测<br/>revert 验证 + 无人干预全程 + 下次会话提示行]
    F --> G[DoD 门<br/>D1 一键重跑验证 + D3 独立 review]
    G --> Goal([Sprint Goal：回环真转一圈])
```

插件目录起在仓库内，位置开发时定，不复用已作废的旧 `claude-dream/`。

## 第四节 · Sprint-1 收口（2026-08-13 Sprint Review 记录）

> **增量判定：收。** 16 条验收判据 15 过 1 遗留，Sprint Goal「插件骨架立起，回环走通」达成——三场真梦（正常回环 / 蓄意越界 / 冷却重触发）全程无人值守留证，`dream:` 提交 revert 一步可退。

**验收概况**：考卷与考场在 `sprint-01-acceptance` 分支 [acceptance/](acceptance/)（TestPlan + verify.mjs + 确定性考场生成器），PO 已批卷定版。首考挂 7 条，经查全属出卷侧对实现想当然（命令路径基准、提交角色锚定、冷却声明机制、越界目标形态），developers 零改动；修卷三轮（`b3ad44d`）后 13 条自动判据全绿。人工三项：H0 插件加载无报错 ✔、H-C3 spike 记录 PO 亲读认可 ✔、H-A8 提示行未出现在用户眼前——**遗留**。

**遗留处置**：H-A8 现场未见提示行。机制查证：session-start 钩子以纯 stdout 送信，代码注释自认走「stdout 进上下文」契约——信送进了 AI 的上下文，用户可见性未证实（现场观察与此相符；PO 注记当次操作亦可能有干扰，未深究）。PO 裁定不打回，立为 PBI-05 带入后续冲刺。

**DoD 对账**：D1 ✔ 自证脚本全绿 + 验收一键重跑，三场真梦在登录态环境实跑；D2 ✔ 占位整合实测一记一文件 + MEMORY.md 纯指针索引契约完好；D3 ✔ 独立 review 三轮 + 复审闭环（`ae8fd2b`）。

**移交 developers 观察三条（不扣分）**：① 冷却配置 `Number(env) || 默认` 会把 0 吞成 30 分钟，「0=关掉冷却」语义未裁；② 生产仓一次意外做梦残留的 `.claude/dream/` 运行态文件待清理；③ PBI-05 的修复通道调研（hook JSON `systemMessage` 等用户可见输出方式）。

**Backlog 适应**：PBI-01（底片层）与 PBI-02（真引擎）的先后本 Review 不裁，留待 Sprint-2 Planning 开场定；PBI-05 新立（见 ProductBacklog）。开发版插件已从用户级全局配置关闭（`claude-dream@claude-dream-dev: false`），后续验收/演示时临时启用。

### developers 半场（2026-08-13 补入）

**Sprint 自述（第一手事实，增量收否由 PO 判定，此处不评分）**

D3 独立 review 三轮 + 复审，各轮改了什么、为什么：

- **一轮**：只读 git 命令白名单有参数漏洞（`git log --output=<path>` 能写任意文件），补「禁止 `-` 开头 token」——事后证明方向错。
- **二轮**：实测三类绕过（引号让 `--output=` 不再以 `-` 开头；bash 进程替换 `<(...)`、PowerShell 数组 `@(...)` 真跑会执行）→ 收敛为 Bash/PowerShell 一律拒绝，不再判断命令内容；另修半成品锁残留。
- **三轮**：`git commit` 未限定 pathspec 会吞人类手动暂存 → 改 `stagedFiles` 算实际 staged 文件限定提交。
- **复审**：又抓出 `git commit -- <目录>` 的 `--only` 语义（空目录报 "pathspec did not match" 炸掉全新项目首梦）+ 锁非原子写 TOCTOU → 改具体文件列表喂 commit、`writeFileSync(flag:'wx')` + 重读。

**最想让团队知道的一件事**：`git commit -- <目录>` 走 `--only`，某个目录匹配不到 git 已知文件时整笔提交报错退出、不是静默跳过——这坑是我改 pathspec 时亲手引入、靠审阅 agent 实测才抓出的。git pathspec 这类语义陷阱开发方自查容易漏，独立 review 的价值正在此。

**Sprint-2 排序技术意见（意见归意见，决定权在 PO）**

倾向**先 PBI-01（底片层）**：① 依赖方向——S6 悬空溯源、S7 连接候选（OD1「越用越懂」的复利点）吃 S4 底片层原料，先 PBI-02 只能装半套判据；② 风险前置——底片层是 README 明写「最大工程量、最不确定的原料层」，该最早啃；③ ProductBacklog 备注本写「动工排 backlog 首位」，无新证据推翻。代价诚实标注：底片层本身无用户可见价值（延迟满足）；若 PO 想尽快看到引擎真跑出体检结论，先 PBI-02 也成立（半套判据先兑现）。两条路的技术账如上，排序由 PO 定，不动 ProductBacklog 行序。

**Retro 素材（待合桌，不预写结论）**

- 最顺：D3 review 循环——三轮 + 复审每轮都抓出真实问题并闭环。
- 最卡：环境登录态缺失，D1 全量自测跑不了真梦，端到端被迫甩给 PO 手工 test。
- 想改：写测试先问「这个分支有没有被跑到」——`--only` 回归漏掉的根因是 `preDreamSnapshot` 的 commit 分支从未被测试跑到。

**移交三条处置（接收）**

1. **冷却 0 值**：裁「支持 0=关掉冷却」。原 `Number(env) || 默认` 是 falsy 陷阱，0 被吞成 30 分钟。已改 `trigger-check.mjs` 显式判断（未设置/非法/负数回退默认，其余含 0 照用）。
2. **残留清理（含根因）**：生产仓失败梦的根因是 `.gitignore` 里 `.claude/dream/` 整目录 ignore，令 `git add -- .claude/dream` 报 "ignored" 致梦失败——这行随 `ae8fd2b` 入库（提交时未核实来源即一并带上，是疏忽）。已改 `.gitignore` 为精确 ignore 四个运行态文件（`last-dream.json`/`session-end-marker.json`/`dream.lock`/`next-session-prompt.txt`），报告与日志仍可入库；残留两个运行态文件已物理清理。
3. **PBI-05 通道调研（官方文档为准）**：`systemMessage` 是官方「shown to the user」字段，SessionStart 纯 stdout 只进 Claude 上下文——正是 H-A8 根因。修复方向 = session-start 改输出 `{"systemMessage": "..."}`。**待实测 caveat**：文档明说 systemMessage 的 surface "depends on the event"，SessionStart section 未明确承诺它渲染给用户，PBI-05 精化须实测；备选 `terminalSequence`（OSC 桌面通知/窗口标题/BEL）。
