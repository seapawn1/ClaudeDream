# Sprint Backlog — Sprint 01（first-dream）

> 开始：2026-11-09 | 目标达成或 PO 叫停时收尾 | 分支：`sprint-01-first-dream`；Developer 在工作树分支 `worktree-sprint-01-first-dream` 上做，收尾时先合回冲刺分支 | Product Owner：SeaPawn | Scrum Master：Master 会话 | Developer：从 Master 会话 fork 出的 CLI 会话
> 写法见 scrum-kernel 的 `conventions/sprint-log.md`。
> 保留所有标题，不加新标题；备注写进 3.2。fork 之后，冲刺日志只改工作树里的这一份。

## 1. Why

### 1.1 Sprint Goal

手动对当前账号的会话记录目录跑通一次大梦，做梦前后各体检一次。（PO 2026-11-09 定）

### 1.2 Definition of Done

PO 定：产品日志 1.3 的七项全部适用，措辞不改（PO：“桌面端只是一种子集”）。

| 类 | 项 | 标准 |
| --- | --- | --- |
| Outcome | 记忆新鲜 | 做梦后再体检一次，过时、错误的记忆比做梦前少 |
| Outcome | 用得上 | PO 开新会话，agent 用上了整理后的记忆，PO 不用重讲 |
| Output | 能装能跑 | 从本仓库的 `claude-dream` 市场能装上，在 PO 的一个真实项目上跑通 |
| Output | 只改记忆 | 只写记忆目录；做梦的 agent 没有 shell，也没有网络 |
| Output | 可回滚 | 跑之前有回滚点 |
| Output | 索引不超限 | 项目层的 `MEMORY.md` 不超过 200 行、25KB（原生加载只读这么多） |
| Output | 注明出处 | 抄自 cookbook 的提示词保留 MIT 版权声明 |

## 2. What

### 2.1 Product Backlog Items

PO 选定（2026-11-09）。PBI-006 不选：cookbook 本身没有水位，只导出已结束、最近 14 天内的会话。

| # | 标题 | 用户故事 | 位置 | 规模 |
| --- | --- | --- | --- | --- |
| PBI-001 | 读会话记录 | 作为 PO，我想要插件读本机项目的会话记录（jsonl），转成 cookbook 的纯文本格式，以便 analyzer 看到 agent 实际做了什么 | Map ③ | M |
| PBI-002 | 做梦流水线 | 作为 PO，我想要用一个命令对一批会话跑 cookbook 的 lead + analyzer + organizer，结果直接写进项目的 auto-memory 目录，以便记忆得到核对、改正、补充和整理 | Map ⑤⑥⑧ | M |
| PBI-003 | 运行前提验证 | 作为 PO，我想要先确认 Claude Code 做得到 cookbook 依赖的几条前提，以便不在做不到的路上投入 | Map ②⑤⑥ | S～M |
| PBI-004 | 体检 | 作为 PO，我想要做梦时把每条记忆拿去对照项目现状，过时、错误的改正或标注，以便没人再提的旧记忆也不会烂在那里 | Map ⑦ | M |
| PBI-012 | 会话记录目录可设 | 作为 PO，我想要指定做梦去哪个目录读会话记录，不设就用默认值，以便换账号或换位置时不用改插件 | Map ③ | S |

### 2.2 Refinement

**整个冲刺**
- 不开设计，不做原型，直接做插件（PO）。
- Developer 用 CLI 开发和测试；正式的“体检 → 做梦 → 体检”由 PO 在桌面端跑。PO 的桌面端模型约为 Haiku 级（PO）。
- 记忆写到哪：每个会话写进原生 auto-memory 会用的那个记忆目录。项目设了 `autoMemoryDirectory` 就写那里，没设就写默认位置 `~/.claude/projects/<目录>/memory/`（Master，依据 PBI-012 备注）。
- 这次不写 GlobalMemory：管全局的 PBI-007 不在本冲刺（Master）。
- 敏感内容：cookbook 的提示词本来就禁止把密钥、令牌、密码写进记忆，只许写名字，照抄就带上；本账号没有 SGCC、MidTerm 的会话。PBI-008 不提前（Master，PO 同意）。
- 审阅由 Master 做，需要时派全新子代理（PO）。
- 正式跑的环境（PO 11-09 确认）：桌面端。PO 桌面端的网关把所有请求都交给 DeepSeek V4.1 Flash 来答，lead、analyzer、organizer、体检全由它跑，会话记录也都发给它，PO 知情、同意；CLI 实际回答的是 Claude。所以体检的噪声和及格线以桌面端为准。
- 名字（PO 11-09 定）：市场 `claude-dream`（原 `claude-dream-dev`），插件 `dreaming`，许可证 MIT。原定的插件名 `claude-dream` 过不了 `claude plugin validate`：以 `claude-` 开头的插件名会被当成冒充 Anthropic 自己的插件。
- 测试和正式跑怎么装插件：这个冲刺把市场改成从本地仓库目录注册，开发时指向工作树，合并后指向仓库根目录；DoD“能装能跑”在 Review 前用它验，不推送。现在的注册来自 GitHub（`seapawn1/ClaudeDream`），同名市场不能并存，要先移除；改注册由 PO 做或当面批准。从 GitHub 安装留到 PBI-009 或 PO 决定推送时再验（Master 定，PO 授权，11-09 经 Developer 会话转达）。
  PO 11-09 改：推送到远端之前，不移除从 GitHub 注册的 `claude-dream-dev`。市场改名以后两个名字不同，测试时从本地目录另加一个 `claude-dream`，两个并存；推送以后，PO 再移除旧的，改从 GitHub 添加 `claude-dream`。桌面端的安装和操作由桌面端的 stakeholder 会话代做；测试用的插件只装在 probe 目录（`--scope local`），因为 guard hook 每次调用工具都会触发，而且 probe 目录已经登记为测试目录。

**PBI-001 读会话记录**
- 定了：
  - 扫 PBI-012 定的目录下的全部会话，包括还没结束的会话、临时目录和后台任务目录里的会话、桌面端留下的老会话；只排除做梦自己产生的会话（PO）。11-09 后改（PO）：第 10 项正式跑跳过测试用的临时目录，即 IDEO-Scrum 第 10 冲刺体验测试的临时目录和后台任务目录，约 222 段，占全目录四成多，都是一次性测试会话，写出的记忆没人读；插件本身仍能扫全部。
  - 格式照 cookbook Step 1，工具调用和结果都保留，思考过程不导出（产品日志、cookbook）。
  - worktree 的会话归主项目（产品日志）。
  - fork 去重这次做：同一轮里每条消息按 uuid 只渲染一次，后面的副本换成 cookbook 的 `NOTE ABOUT THIS FILE` 一行说明，完全重复的文件跳过。实测会话正文里 51% 是 fork 复制的，不去重处理量翻倍（11-09 第 4 项更正：这个数不对，51% 里大头是 API 请求的镜像；真正 fork 复制的约占对话内容的 13%。去重照样做）。水位仍不做（Master 定，PO 授权，11-09 经 Developer 会话转达）。
- 交给 Developer 出方案：会话怎么分到项目、记忆目录怎么解析；长会话切段的大小，过长的工具输出怎么截；怎么认出做梦自己产生的会话；转换放在做梦的 agent 之外跑（DoD：做梦的 agent 没有 shell）。
- 验收标准：
  1. 目录下每个会话（做梦自己产生的除外）都被转换；有一份清单，能核对转换了多少、跳过了多少、为什么跳过。
  2. 每段都不超过 analyzer 的预算；每条要保留的消息恰好落在一段里。
  3. 每段都带上它之前最近的一次压缩摘要。
  4. 每个会话都对应到一个记忆目录，对应规则和原生 auto-memory 一致。
  5. 同一轮里每条消息（按 uuid）只渲染一次；清单里能看到每个 fork 省略了多少条、和哪个会话重复。

**PBI-002 做梦流水线**
- 定了：
  - 一个命令跑一次大梦：按项目分组，每段一个 analyzer，每个碰到的项目一个 organizer；lead 自己不读原料（PO 11-09）。
  - 照抄 cookbook 的四个提示词，只换路径和讲格式的段落；lead 用 Sonnet，analyzer 和 organizer 用 Haiku（产品日志）。
    11-09 第 5 项前改（Master 定，PO 事后告知）：analyzer、organizer 两个提示词照抄；lead_system、work_request 不再当提示词用，因为“每段都分析过”改由脚本保证，workflow 脚本由 prepare 生成，每段的路径直接写在里面。work_request 的分组节奏写进生成的脚本，lead_system 的规矩写进技能说明；两份原文逐句去了哪里、删了哪句、为什么删，列在 3.2。
  - 记忆文件和索引用原生 auto-memory 的格式：frontmatter 是 `name`、`description`、`metadata.type`，索引 `MEMORY.md` 每行 `- [Title](file.md) — hook`。cookbook 关于内容的规矩全部保留：标日期和出处、写过时说明、矛盾标 `CONFLICT`、不写密钥、不丢事实。理由：原生 auto-memory 每次会话都按自己的格式写，改成 cookbook 格式会两边来回改（Master 定，PO 授权，11-09 经 Developer 会话转达）。
  - “没有 shell、没有网络”管读会话原文的 agent，即 analyzer、organizer 和体检；lead 只跑插件自带的脚本；做梦期间所有 agent 都不用网络工具。一个只在做梦时生效的 PreToolUse hook 把写入限制在记忆目录和本轮工作目录，并留日志；不做梦的会话里它什么都不做。理由：lead 读 analyzer 交回的结果，注入的指令可能经此传进来，而正式跑时 lead 是 Haiku 级（Master 定，PO 授权，11-09 经 Developer 会话转达）。
  - DoD 的“可回滚”由本条负责（Master，PO 同意）。
- 交给 Developer 出方案：编排方式（看 PBI-003 ①）；回滚点怎么做；“每一段都分析过”的核对放在哪里（正式跑时 lead 是桌面端的 Haiku 级模型）。
- 验收标准：
  1. 一个命令跑完全程；每一段都被分析过，有核对记录。
  2. 跑之前，每个要写的记忆目录都有回滚点，一步能恢复到跑之前的样子；记忆仓库里别的会话没提交的改动，既不被一起提交，也不被冲掉。
  3. 只写记忆目录和本轮工作目录；analyzer、organizer 和体检的 agent 没有 shell，也没有网络；hook 日志显示 lead 只跑过插件自带的脚本、没有 agent 用过网络工具、记忆目录和本轮工作目录之外没有文件被改。
  4. 每个碰到的项目，`MEMORY.md` 不超过 200 行、25KB。
  5. 不写 GlobalMemory，不改 `SEAPAWN.md` 和仓库里的 CLAUDE.md。
  6. 抄来的提示词保留 MIT 版权声明。
  7. 做梦前就有的每条记忆，做梦后都找得到下落：原样保留、并进了哪个文件、改成了什么名字。找不到下落就是丢了事实，本条不通过。

**PBI-003 运行前提验证**
- 定了：原来三项照做，再加桌面端四项（PO 定正式跑在桌面端）：
  1. Workflow 工具起的 agent 能不能限制工具，不能就改用子代理；
  2. 插件命令在 `claude -p` 下能不能跑；
  3. fork 出来的会话记录（包括 fork 型子代理）带不带父会话的内容；
  4. 能不能从 `claude-dream` 市场把插件装进桌面端（桌面端没有 `/plugin` 命令，要用界面上的插件浏览器）；
  5. 做梦命令和它起的子代理在桌面端能不能跑；
  6. 桌面端的登录和模型设置与 CLI（走中转）不同，两边都要能跑；
  7. 没设 `autoMemoryDirectory` 的项目，记忆写到 `~/.claude/projects/<目录>/memory/` 会不会被 `.claude` 目录的保护拦住。
- 验收标准：每一项都在 3.2 记下结论和证据；做不到的项，和 PO 定替代做法。

**PBI-004 体检**
- 定了（Master 定，PO 11-09 授权，参照 cookbook）：
  - 这次只出报告，不改文件。
  - 每条记忆下一个结论：有效、可能过时、错误、CONFLICT、无法判断。照 cookbook 处理过时事实的规矩：有后来的更正才算错误，写明新值、日期和出处；分不清哪个对就两边都留，标 `CONFLICT`；搜不到证据不能算推翻，记“无法判断”。每个结论都附证据（文件路径或会话）。和仓库里的 CLAUDE.md 冲突时只报告。
  - 可疑的条目附一段 cookbook 式的过时说明草稿：什么时候、怎么核实的、为什么可能过时。下个冲刺看过两份报告，再决定写不写回。
  - 范围：这次做梦会写到的所有记忆目录。
- 交给 Developer 出方案：判定方法，命令形式。
- 测试方法与及格线（跑之前定，看到结果后不改）：
  1. 做梦前、做梦后各跑一次，用同一套方法、同一个模型。
  2. 及格线：只比做梦前就有的那批条目。做梦后这批条目里“可能过时”加“错误”的条数，比做梦前少（DoD“记忆新鲜”）；被合并或改名的条目按它的新位置算。
  3. 做梦新增的条目，过时率单独报告，不设及格线（Master 定，PO 授权，11-09 经 Developer 会话转达）。
  4. 11-09 PO 改及格线，选 B。原因：第 7 项实测，同一份记忆一字不改连跑两次，25 条里结论一致的只有 20 条，“可能过时”加“错误”从 13 变成 12，按第 2 条的写法就算通过了。改成：只比做梦改过或移走的老条目；没改过的老条目当对照，它们前后结论的差别就是这一轮体检的噪声。改过的那批，“可能过时”加“错误”下降的比例，要明显大于没改过那批的波动，第 2 条随之作废。“明显大于”具体是多少，等第 9 项在桌面端用同一份快照至少连跑三次量出噪声后，在第 10 项之前由 PO 定，写进这里；看到正式结果后不再改。没改过的条目单独报告。**11-09 15:01 PO 定（第 10 项之前）**：差 = 改过的老条目“可能过时＋错误”的下降比例 − 没改过的老条目越过这条边界翻转的比例；差 > 0 算通过；改过的老条目少于 30 条时不下结论，记“数据不足”。依据：第 9 项桌面端连查三次，波动比例 0.04～0.12，和 CLI 同一范围；Developer 用这些数做了模拟（`sim_threshold.py`，收尾时删了，见 `sprint-01-first-dream^`），见 3.2。`check.py` 的 `B_MIN_DIFF` 这次不改代码，由人照这条规则判。

**PBI-012 会话记录目录可设**
- 定了：照产品日志，一个可选参数，不设就用当前 Claude Code 配置目录下的 `projects`，只扫这一个位置。桌面端本地会话的配置目录也是 `~/.claude`（Master 核对文档和记忆）。
- 交给 Developer 出方案：参数怎么传。
- 验收标准：不设参数时读当前配置目录下的 `projects`；设了参数只读指定目录。

**“用得上”的验法**：PO 正式跑完以后开新会话，看 agent 是否用上了整理后的记忆、不用重讲，由 PO 判断。

**精化结束**：Developer 已复述，提出的五点已定（见上）；PO 2026-11-09 放行，精化随之结束。

## 3. How

### 3.1 How

| # | Work item | Output | Done when |
| --- | --- | --- | --- |
| 1 | PBI-003 的 CLI 部分（①②③⑦），外加两项编排要用的：workflow 里的 agent 能否指定插件子代理类型；插件 hook 能否看到调用来自哪个 agent、对 workflow 里的 agent 生不生效 | 每项的结论和证据记进 3.2；试验用的临时插件放在冲刺文件夹里，收尾时删掉 | 每项都有结论；编排方式定下来，见“关键选择”第 2 条 |
| 2 | 插件骨架：`plugins/dreaming/`（plugin.json、MIT 声明、`dream` 和 `check` 两个命令的空壳）、市场改为本地目录登记（PO 本人做或当面批准）、会话记录目录参数（PBI-012）。另做一个桌面端冒烟测试命令：最小的 workflow、一个限了工具的子代理、做梦 hook、一个 python 脚本，请 PO 在桌面端触发，完成 PBI-003 的④⑤⑥ | 能装的插件；冒烟测试命令；PO 在桌面端的结果记进 3.2 | CLI 能装能调；PBI-012 的验收标准通过；桌面端逐项有结论：能装、workflow 在 PO 的计划下能不能用、要不要批准、`model: sonnet`／`haiku` 解析成什么、python 在不在 PATH 上、hook 触不触发、子代理的工具限制是否生效 |
| 3 | 会话转换上（PBI-001）：扫描、认出做梦会话并排除、对应记忆目录、渲染成 cookbook 格式（含子线程） | `scripts/prepare.py` 的前半和测试 | PBI-001 的验收标准 1、4 在真实目录上通过；做梦和体检产生的会话（包括测试和沙盒运行、workflow 里 agent 的记录）全部认得出，清单里列为“做梦会话，跳过” |
| 4 | 会话转换下（PBI-001）：按 uuid 去重、按压缩点和大小切段并带前情摘要、清单与核对 | `scripts/prepare.py` 完整版 | PBI-001 的验收标准 1～5 在真实目录上全部通过，由脚本核对 |
| 5 | 做梦流水线一（PBI-002）：四个提示词（保留 MIT 声明，格式段落改成原生格式）、analyzer 和 organizer 子代理、workflow 编排、“每段都分析过”的核对 | `dream` 命令能跑完一轮 | 在沙盒（见“关键选择”第 4 条）里跑一小批会话：每段都有分析记录，`MEMORY.md` 不超限，organizer 记下合并和改名 |
| 6 | 做梦流水线二（PBI-002）：回滚点和一步恢复、只在做梦时生效的写入限制 hook 和日志、跑完的核对脚本 | 回滚、hook、核对三样 | 恢复后记忆目录和跑之前逐字节一致；恢复前先列出 hook 日志里没有记录的改动（别处写的），不静默覆盖；hook 拦得住越界写入和网络工具，不做梦的会话里什么都不做；核对脚本能对出 PBI-002 的验收标准 1～5 和 7（每条老记忆的下落） |
| 7 | 体检（PBI-004）：体检子代理、`check` 命令、报告；能追踪 organizer 合并或改名的条目 | `check` 命令和报告格式 | 沙盒里同一份记忆连跑两次，量出两次结论的一致程度（体检的噪声），记进 3.2；报告里能列出“找不到下落”的条目；据噪声判断及格线“做梦后比做梦前少”要不要留余量，要调就报 PO 定，在第 10 项之前写死进 2.2，看到正式结果后不再改 |
| 8 | CLI 全流程演练：在沙盒里对两个项目（ClaudeDream、IDEO-Scrum）跑“体检 → 做梦 → 体检” | 演练记录：耗时、token、失败项 | 全部验收标准在沙盒里通过；交 Master 审 |
| 9 | 桌面端沙盒演练：PO 在桌面端触发，用真实流水线对一小批会话跑“体检 → 做梦 → 体检”，目标是沙盒 | 桌面端演练记录 | 在桌面端跑完；和第 8 项比，差别都有解释；交 Master 审 |
| 10 | 正式跑：写一页运行说明，PO 在桌面端对整个会话记录目录跑“体检 → 做梦 → 体检”；Developer 逐项核对 DoD 和验收标准 | 运行说明、两份体检报告、核对记录 | 运行说明写明：跑之前关掉别的 Claude 会话；工作目录什么时候清。正式跑的清单里，测试和沙盒运行产生的会话一个都没被当成原料；DoD 七项逐项有证据（“用得上”由 PO 第二天判断）；交 Master 审，PO 验收 |

**Key choices**

1. **脚本用 Python 标准库**：本机有 Python 3.13，不引第三方包。新用户的环境留给 PBI-009。
2. **编排优先用插件自带的 workflow**：插件能带 `workflows/`，脚本逐段派 analyzer，“每段都分析过”由脚本保证，不靠 lead 记，正式跑时 lead 是 Haiku 级模型也不怕；用量到上限时 workflow 会暂停等重置。workflow 脚本本身不能碰文件和 shell，所以命令分三步：lead 跑 `prepare.py` → 调 workflow → lead 跑核对脚本。如果第 1 项查出 workflow 里的 agent 限不了工具，就改由 lead 用 Agent 工具分批派插件子代理（frontmatter `tools:` 限工具），核对仍由脚本对清单。
3. **lead 只跑插件自带的脚本**（Master 定）：其余 agent 没有 shell（Windows 上 shell 工具叫 PowerShell，也要拦）；做梦期间所有 agent 都不能用网络工具。由 hook 执行并记日志，hook 只在有本轮运行状态文件、且会话对得上时生效。
4. **agent 只改暂存副本，跑完由脚本写回**（第 1 项后改）：跑之前把每个目标记忆目录复制到本轮工作目录的暂存区，analyzer 和 organizer 只改暂存副本；核对通过后，lead 跑脚本把暂存副本写回真实记忆目录。理由：第 1 项实测，`~/.claude/projects/*/memory/` 对 agent 是“敏感文件”，默认和 acceptEdits 模式下 hook 放行也写不进去，只有 bypass 能写；暂存后 hook 的规则简化成“只许写本轮工作目录”；核对在碰真实记忆之前做完。测试和沙盒运行就是不写回。
5. **回滚点用文件副本，不用 git**：写回之前，把每个要写的真实记忆目录原样复制一份，恢复就是原样拷回。这样不会提交或冲掉记忆仓库里别的会话没提交的改动。
6. **本轮工作目录放在 `~/.claude-dream/runs/<run-id>/`**：渲染好的会话、清单、回滚副本、日志、体检报告都在这里，既不在记忆目录里，也不在 `~/.claude/` 下面（避开那里的写入保护）。渲染副本可能含密钥，每条命令跑完就删，体检要用就自己重新渲染；回滚副本留到 PO 验收后再删；日志和报告保留。
7. **认出做梦会话靠运行登记**：每次运行（包括测试和沙盒运行）都把发起它的会话 ID 记进 `~/.claude-dream/` 的登记表，转换时按登记排除这些会话和它们名下的子代理、workflow 记录；登记缺失时，再用命令留在会话开头的标记兜底。

**Risks and open points**

- **规模**：去重后约 1100 万 token、一两百个 analyzer；workflow 默认最多同时跑 16 个 agent。桌面端如果是订阅额度，可能要等额度重置，一次跑完要一两个小时甚至更久。第 8、9 项演练会给出实际数字。
- **会话记录是 Claude Code 的内部格式**，官方说随版本会变；转换脚本遇到不认识的记录类型要记进清单，不能悄悄丢掉。
- **SeaPawn 的 `MEMORY.md` 已有 22.5 KB**，做梦后可能超过 25 KB，要靠 organizer 收紧索引。
- **恢复会覆盖做梦期间别处对同一目录的改动**：正式跑时请 PO 关掉别的 Claude 会话；恢复前先列出 hook 日志里没有记录的改动，由 PO 决定。
- **桌面端环境未知**：workflow 只在付费计划、Anthropic API 和几家云平台上可用（Pro 要在 /config 里打开），PO 桌面端的配置在不在其中，第 2 项冒烟测试才知道；不在的话，退回 lead 用 Agent 工具派子代理。
- **第 3～6 项各自一个会话可能做不完**：做不完就再拆，在 3.2 记下。
- **体检的结论有噪声**（Haiku 级模型），前后两次的差别要和第 7 项量出的噪声对照着看。
- **待 PO**：市场改成从本地目录登记为 `claude-dream`（开发时指向工作树，合并后指向仓库根目录），要先移除现在 GitHub 上的 `claude-dream-dev`。这是改 PO 的 Claude Code 配置，由 PO 本人做或当面批准，放在第 2 项开头。
- PBI-003 里如果有做不到的项，和 PO 定替代做法。

Go-ahead: 2026-11-09 01:48，PO 在 Master 会话里放行，精化随之结束。范围：只在工作树分支 `worktree-sprint-01-first-dream` 上提交；合并、打 tag 到 Review 时再定；不推送。冲刺中 PO 本人要做三件事：第 2 项开头把 `claude-dream-dev` 改成本地目录注册并跑桌面端冒烟测试，第 9 项在桌面端触发沙盒演练，第 10 项在桌面端正式跑

### 3.2 Notes

完整逐行记录（约 65 行）在 tag 的上一个提交里：`git show sprint-01-first-dream^:scrum/sprint-01-first-dream/SprintBacklog.md`。本节只留关键决定、结果、更正、环境发现和范围变化。

| Date | What was done | Decision and reason | Evidence | Next |
| --- | --- | --- | --- | --- |
| 2026-11-09 Planning | 定 Sprint Goal、PBI、DoD、分支、Developer；设 `.claude/settings.local.json` 的 `worktree.baseRef: "head"`；Developer 建工作树 `worktree-sprint-01-first-dream` 并复述精化 | PO 定：选 PBI-001～004、012，PBI-006 不选（cookbook 没有水位）；DoD 七项全用、措辞不改；分支 `sprint-01-first-dream`；Developer 从 Master 会话 fork 到 CLI，不用桌面端（桌面端模型约 Haiku 级，本冲刺中等偏难）；不开设计、不做原型。`baseRef` 用 `head`，因为默认 `fresh` 从 `origin/main` 建树，那里没有未推送的 b04553f 和冲刺日志。Developer 提的五点由 PO 授权 Master 定（见 2.2）；第 5 点（测试用本地市场、收尾推送后再从 GitHub 装）没采纳，那样 DoD 要收尾后才能验 | Master 会话的对话；`.claude/settings.local.json`（不进 git）；e3cc641 | Developer 写 3.1 |
| 2026-11-09 | Developer 写 3.1 How（8 项）；Master 审（970124a）、核对（6aed640）后 PO 放行（“放行吧”） | 编排优先用插件自带 workflow（最多同时 16 个 agent，脚本本身不能碰文件和 shell）；测试只写沙盒，只有 PO 的正式跑写真实记忆。Master 要求改三处：A 桌面端提前验（第 2 项改成桌面端冒烟，新增第 9 项桌面端沙盒演练）；B 第 7 项量出噪声后判断及格线要不要留余量，正式跑前写死进 2.2；E 测试和沙盒运行产生的会话也算做梦会话，排除。另采纳 C、D、F，任务拆成共 10 项。实测原料：`~/.claude/projects` 下 451 个 jsonl、378 MB | 970124a、6aed640；workflows 文档“Behavior and limits” | Developer 从第 1 项开始 |
| 2026-11-09 | 第 1 项完成（PBI-003 的 CLI 部分）：探针插件 `probe-plugin/`（已删，见 `sprint-01-first-dream^`），`claude -p --plugin-dir` 跑，Claude Code 2.1.319 | 环境发现：①插件子代理的 `tools:` 白名单生效（只拿到 Read、Write、Glob、Grep），workflow 的 `agentType` 可指定插件子代理；②插件 workflow 在 `-p` 下要加 `--allowedTools Workflow`；③`--fork-session` 原样复制父会话消息，fork 型子代理和 workflow 里的 agent 不复制；④agent 写 `~/.claude/projects/*/memory/` 被当敏感文件拦下，hook 放行也没用，只有 bypass 能写；写工作目录之外的路径，插件 PreToolUse hook 返回 allow 即不弹提示；⑤插件 hook 对子代理和 workflow 里的 agent 都触发（输入带 `agent_id`、`agent_type`），deny 拦得住 shell 和越界写入。因此编排定为插件 workflow 加 `agentType`；关键选择第 4 条改为“agent 只改暂存副本、核对后由脚本写回” | `~/.claude-dream/probe/hooklog.jsonl`；探针会话 `~/.claude/projects/C--Users-seapawn-AppData-Local-Temp-claude-dream-probe/` | 第 2 项 |
| 2026-11-09 | 第 2 项完成：插件骨架（`dream`、`check`、`smoke` 技能，冒烟 workflow `smoke-run`，守卫 hook `scripts/guard.py`，`common.py`）；PBI-012 验收通过；PO 在桌面端跑 `/dreaming:smoke`（0.1.0，probe 目录，local scope 安装，批准卡片选 Once） | 用技能而不是旧式命令（能用 `!` 注入脚本、`${CLAUDE_SESSION_ID}`），技能设 `disable-model-invocation: true`；workflow 名不能与技能名相同（同名时 workflow 盖过技能），故叫 `smoke-run`；守卫只在 `~/.claude-dream/active/<会话>.json` 存在时生效。桌面端结果：能从本地市场装；`!` 注入、workflow、`agentType` 限工具都生效；桌面端 lead 的 shell 叫 Bash（CLI 子进程是 PowerShell），守卫两种都管，做梦期间也拦所有 `mcp__` 工具。PO 改了桌面端测试装法：推送前不动旧市场，本地另加并存，只装在 probe 目录，避免 guard 拖慢所有会话 | `~/.claude-dream/smoke/last-result.md`（`smoke-20261109-023453`）；单元测试 8/8 | 第 3 项 |
| 2026-11-09 | PO 定名字和许可证：市场 `claude-dream`，插件 `dreaming`，MIT；目录改 `plugins/dreaming/` | 原插件名 `claude-dream` 过不了 `claude plugin validate`（`claude-` 开头是保留名）。PO 原话“Claude-Dream”，按 kebab-case 统一成小写。工作目录仍叫 `~/.claude-dream/`（产品名，不随插件名改） | adc9f7f（`git mv`）；validate 通过 | 继续第 3 项 |
| 2026-11-09 | 环境发现并更正（Master 查桌面端冒烟会话 a0145dbb）：桌面端请求 `claude-sonnet-5`、`claude-haiku-5-5`，实际回答的全是 `deepseek-v4.1-flash`；CLI 请求和回答都是 `claude-opus-5-5` | 更正：第 2 项记的⑥“`sonnet` 解析为 claude-sonnet-5、`haiku` 为 claude-haiku-5-5”只是请求里写的模型，不是实际回答的模型；请求里的 `haiku` 和技能的 `model: sonnet` 在桌面端都不起作用。PO 确认正式跑照旧在桌面端（“桌面端就是用的这个模型”），会话记录发给 DeepSeek 他同意。第 8、9 项用来量各环境的噪声和差别，不再用来挑环境 | a0145dbb 的 `api-request.params.model` 和 `assistant.message.model` | 第 8、9 项分别量 CLI 和桌面端 |
| 2026-11-09 | 第 3 项完成：`prepare.py`、`transcripts.py`、`routing.py`（扫描、排除、渲染成 cookbook 格式、记忆目录路由）。真实目录：找到 288 个会话，转换 273 个，排除 15 个探针目录会话 | 渲染不导出思考过程、系统提醒、hook 输出。认做梦会话三层：登记表、用户自己打的 `<command-name>/dreaming:` 标记（不看工具结果，免得开发会话被误排）、子线程 `agentType` 以 `dreaming:` 开头。记忆目录照原生规则：项目 `.claude/settings.local.json`、`settings.json`，再用户设置，再默认（git 根，worktree 归主仓库） | `~/.claude-dream/runs/dev-prepare-1/manifest.json`；单元测试 14 个 | 第 4 项 |
| 2026-11-09 | 第 4 项完成：`segments.py`（去重、切段、截断）；`prepare.py` 改两遍；加核对和字符对账。288 个会话，切成 511 段，对账 69,095,376 = 69,095,376；后又补 `segments.check_carried`（压缩点后每段带最近摘要，从各段内容重算） | 去重：一个 uuid 只在归属会话里渲染。切段默认 12 万字符，压缩点另起一段；单条工具结果超 2 万字符留头 1.6 万、尾 3 千。预算依据：本机记录里 DeepSeek V4.1 Flash 平均 1.90 字符/token（Haiku 5.5 为 1.83，Sonnet 5.5 为 1.50），最大段按最坏每字 1 token 也只有 12 万 token，桌面端见过单次输入 572,038 token。Master 要求：会话里跑了 `/dreaming:` 命令，只排除命令及之后部分；加对账。**更正**：精化时说“51% 是 fork 复制的重复”不对，3410 万重复字符大头是 api-request-blob（与对话消息共用 uuid），真正的 fork 副本是 434 万字符，约占对话内容 13%。去重照做，省得少 | `~/.claude-dream/runs/dev-prepare-2/manifest.json`；单元测试 16 个 | 第 5 项 |
| 2026-11-09 | 第 5 项完成：`agents/analyzer.md`、`agents/organizer.md`（由 `tools/build_agents.py` 从 cookbook 原件生成）、`NOTICE`（MIT 原文和改动清单）、`dream_workflow.tmpl.js`、`dream.py` 的 `start`、`finish`、`memcheck.py`、`skills/dream` | 只用 cookbook 的 analyzer、organizer 两份提示词；lead_system、work_request 的内容改写进技能说明和生成的 workflow（Master 同意：这是 3.1 关键选择第 2 条“每段都分析过由脚本保证”的结果，条件是逐句列出去向）。逐句去向：分组、路径、agent 名、`GROUP = 20`、失败不中断、一次运行、只回报告，都进了生成脚本或技能说明；Managed Agents 专有的挂载、timeout、打印 workflow 三句删掉；lead 的 JSON 汇报改由 `finish` 从 journal 算。踩坑：`scriptPath` 只接受会话能读的目录，在 dream 技能 `allowed-tools` 加 `Read(~/.claude-dream/**)` 解决。沙盒试跑（Haiku 5.5）3 会话 9 段全过 memcheck | `tools/build_agents.py`；`skills/dream/SKILL.md`；单元测试 20 个 | 第 6 项 |
| 2026-11-09 | 第 6 项完成：`writeback.py`（base、stage、backup 三份副本；`compare`、`apply`、`restore`、`claims_vs_diff`）；`finish` 先核对再写回；`/dreaming:restore`；守卫 matcher 收窄为 shell、写入、网络、`mcp__` | 环境发现并修复：守卫用 Windows 默认 GBK 读 stdin，含中文的 Edit 输入解不出来，守卫悄悄不作决定，写入落到 Claude Code 自己的权限提示（桌面端会弹给 PO，点同意可能写出记忆目录）。改为按 UTF-8 读字节，做梦期间仍读不了就拦下并记录。**更正**：Master 审第 5 项时据 hooklog 判 organizer 的“被拒”是编的，实为这个 bug 让 hooklog 漏记，Master 已更正。Master 审（1eb68bc）后要求写回按目录整体处理：目录里任一要写的文件在做梦期间被别处改过，整个目录不写；写到一半冲突就撤回已写的。理由：若 `MEMORY.md` 冲突而其他文件照写，索引不含新记忆、旧索引行指向存根，目录半新半旧。永不删除文件。没做“守卫拦 lead 读原料”：Read 进 matcher 每次多启动一次 python（75 毫秒） | 端到端 `dream-20261109-033504`：恢复后的临时记忆副本与真实 ClaudeDream 记忆逐字节一致（13 个文件）；`tests/test_writeback.py` 新增两个冲突测试；单元测试 28 个 | 第 7 项 |
| 2026-11-09 | 第 7 项完成（f56509f）：体检 `/dreaming:check`，`agents/checker.md` 只有 Read、Glob、Grep；`scripts/check.py` 分 start、finish、compare | checker 的结论只当待核说法，脚本逐条核引文是否真在所引文件里，核不了记“无法判断”。顺手修四处：finish 只认本轮开始后启动的 workflow；还在进行的会话改为开始时定下文件清单和读到的位置；做梦的 finish 也删渲染的会话；脚本屏幕输出只用英文（PowerShell 按 GBK 解码中文会乱码）。噪声（CLI，Haiku 5.5，同一份 25 条连查两次）：一致 80%，“可能过时＋错误”13 → 12，也就是记忆没改，原及格线（比做梦前少）也会“通过”。PO 定及格线用 **B**（Master 审后）：只比做梦改过或移走的老条目，没改过的单独报告当噪声对照；A 是比全部老条目加余量 | `check-20261109-035849`、`check-20261109-041448`；`compare-check-20261109-035849.json`；单元测试 36 个 | 第 8 项；及格线数值等第 9 项 |
| 2026-11-09 | PO 定：正式跑跳过测试用的临时目录；05:04 更正段数 | 全目录约 520 段，两处测试目录占 222 段（ideo-s10 134、trig-work 88），跳过后约 300 段。**更正**：原写“Master 会话占 104 段、省四成多时间和额度”有误；104 段的是 stakeholder 会话 b1d91409，Master 会话 8～10 段；被跳过的多是小会话（约 200 万字符，全目录约 3300 万），所以省的主要是 agent 个数和三成多时间，token 只省一成左右。实现用 `--skip-project <文字>` 参数而非登记（登记是看不见的状态），跳过的会话仍进清单并对账 | `dev-prepare-2/manifest.json` 按目录统计；d9cf80a | 第 10 项照此跑 |
| 2026-11-09 04:37 | PO 去休息；Master 会话压缩 | PO 授权（原话：“能定的都帮 developer 去定好……端到端测试等我明天回来”）：第 9、10 项和及格线具体数字必须 PO 在场，其余由 Master 代定。夜里 Developer 做：跑第 8 项、插件升版本、操作说明 `run-guide.md`（长期部分收尾时摘进 `docs/run-notes.md`）、数字表 `noise_table.py`（已删，见 `sprint-01-first-dream^`）、跳过参数、估算正式跑耗时 | PO 在 Master 会话里的话 | 下一行 |
| 2026-11-09 05:44～05:55 | 夜间：版本 **0.2.0**（d9cf80a：`--skip-project`；dream、check 技能加 `model: sonnet`，原来 lead 走用户默认的 Opus）；`--memory-from` 和及格线 B 计算（cad43a1）；写入核对改按调用 id 对 hook 日志（6e072d1）；`--continue` 接着跑（a0c9a80；操作说明 faf81b7）；续跑重分析的目录再整理（70df156；操作说明 0845836）。Master 全部审过，05:55 代码冻结 | 环境发现：①`claude -p` 在 lead 最后一轮结束 10 分钟后停掉还在跑的后台任务，要设 `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0`；②第 8 项第二次做梦（`dream-20261109-044212`）跑到 140/193 段，05:34 因本机内存不足被 Claude Code 停掉（全机 16 GB，剩约 2.9 GB 空闲，21 个 claude 进程）；③hook 日志比会话记录少 69 次写入，原因是被 Claude Code 自己的输入检查拦下的调用（`<tool_use_error>`，如“读完后文件被改过”）到不了 PreToolUse hook，原核对会误判“hook 漏记”，正式跑就写不回——改为守卫记 `tool_use_id`，按 id 核对。Master 定 **B**：夜里不续跑，早上 PO 关掉多余程序后续跑（不选现在续跑：空闲内存仍只有 2.7 GB；不选只交部分结果：只有第 8 项测得出 organizer 能否把大索引压回 25 KB）。加 `--continue` 的理由：第 10 项有 310 段，原来只要一段没结果整个目录就写不回。续跑拒绝条件：原运行 5 分钟内还有写入。analyzer 任务消息加一句“出处写会话标题和起止日期，不写段号和当天日期”（注明是 ClaudeDream 加的，cookbook 提示词没动），因为暂存里 17 个文件共 73 处写了“p053”这类段号和当天日期。大文件 `dreaming-competitor-landscape.md` 204 KB（来自 b1d91409 的调研原始记录）是否跳过该会话留给 PO，`--skip-session` 默认不用。第 0 步后若再改代码，版本号要升一级，否则 `claude plugin update` 不会重新复制 | hooklog 871 次写入全在工作目录内放行；Master 自己复算 145 份 agent 会话记录：写入 940、被拒 76、出错 1，没有 hook 比记录少的对子；单元测试 43 个 | PO 早上放行 → 续跑第 8 项 |
| 2026-11-09 12:55 | 第 8 项完成并审过（CLI 沙盒，Haiku 5.5，ClaudeDream 和 IDEO-Scrum 两个项目，193 段；被停后用 `--continue` 在新会话 2111024c 续跑 53 段加 2 个整理）。做梦前后体检 `check-20261109-122501`、`check-20261109-122829`；organizer 试验 `dream-20261109-exp-reconcile`（体检 `check-20261109-125650`）；写回真跑加恢复 `dream-20261109-wbtest` | 结论：流程跑通，DoD“记忆新鲜”在这次演练没有达成。原因：分析器只在文件末尾追加“11-09 更新”、旧句子留着；越长的文件越容易有一句过时，一个文件按最差一句定结论；体检与做梦的证据隔了 8 小时；体检对整份记忆普遍标一半。organizer 试验（任务消息要求把被取代的旧句子改成现在的结论）改了 18 个文件 26 行，差 −0.01，在噪声里看不出效果也没坏处，按 Master 事先定的标准进代码（4b，注明是 ClaudeDream 加的）。写回和恢复在副本上逐字节一致。唯一问题：ClaudeDream 的 201 KB 竞品文件 organizer 没拆（自述 NOT DONE），该目录被判不写回 | `check.py compare check-20261109-122501 check-20261109-122829`；`run-report.json`；内存采样 `memwatch-item8.csv`（已删，见 `sprint-01-first-dream^`） | 下一行 |
| 2026-11-09 12:55～12:58 | PO 定：超限类问题不让整个目录不写回（原话：“超限了就报告，或者超限了，自动合并压缩，最后再报告”）。Master 选“只报告”，“自动再整理一轮”今天不做 | finish 的问题分两类。**安全类**照旧拦住整个目录：有段没结果、开始时就有的文件找不到或被删、hook 核对不过、写回冲突。**超限和格式类**不拦，整目录照样写回，报告逐条写文件名、大小和原因：`MEMORY.md` 超 200 行或 25 KB、单个文件超 100 KB、新增或改过文件格式不对、整理环节没出结果。理由：自动修要多花 1.5～2 小时（Developer 估），今天划不来；写回前有 base、backup，可 `/dreaming:restore`。因此不再加测 SeaPawn。finish 输出带文件名，技能原样贴出输出。Master 建议正式跑跳过 b1d91409，PO 不反对 | 96ed232、53544e8、16cbc7c；插件 **0.2.1**；单元测试 47 个 | Master 13:30 审过，0.2.1 冻结 |
| 2026-11-09 13:05 / 13:15 | PO 两个问题：①索引超限是不是学官方、提醒用户就行；②有 git 还要不要备份、放哪、能不能定期清 | ①确认“只报告”。官方文档（memory#how-it-works、errors#memory-index-is-over-its-read-limit）：200 行或 25 KB 的限制只管项目自动记忆的 `MEMORY.md`，全局层经 `@` 导入整份加载；v2.1.210 起 Claude 写完 `MEMORY.md` 后若超限，写照样成功但报错，要求 Claude 当场重写到 140 行内，这个提醒是给 Claude 的不是给用户的；方向底稿 §3 的“超出不加载也不报错”（10-24）已过时，Review 时改。做梦 agent 写的是暂存副本，官方提醒是否管到它们未核实，所以自己量自己报。②备份留着：正式跑的 7 个目录里 3 个是默认目录不在 git（C--Users-seapawn、S--Library-History-----、S--SeaPawn-Memory）；git 只能恢复提交过的内容；备份保留写回前一刻的原样。备份在 `~/.claude-dream/runs/<编号>/backup/`，现在没有自动清理，定期清掉记进 Review 清单，Master 收尾时清测试旧运行 | 官方文档两节；runs 文件夹合计 38 MB（13:15 量） | 照 12:58 安排 |
| 2026-11-09 | 第 9 项完成（桌面端，Claude Code 2.1.317，会话 40339aaf；stakeholder 先把插件从 0.1.0 更新到 0.2.1）：9.1–9.3 同一份 25 条快照连查三次（`check-20261109-133655`、`134508`、`135249`），9.4 沙盒做梦 `dream-20261109-140922`（IDEO-Scrum 3 会话 8 段），9.5、9.6 前后体检（`check-20261109-143654`、`144223`） | 环境发现（桌面端）：①lead、checker、analyzer、organizer 实际回答的全是 `deepseek-v4.1-flash`，与第 2 项一致；②桌面端读缓存里的插件（`~\.claude\plugins\cache\claude-dream\dreaming\0.2.1\…`），不读工作树；③工具限制在桌面端生效：agent 试 Bash 得到 `No such tool available`；④hook 对 workflow 里的 agent 生效，漏记 0。噪声：桌面端三次一致 76%、波动比例平均 0.08，CLI 平均 0.08，两环境同一范围；B 差 −0.091，改过的老条目才 2 条，不足下结论。新增条目被标：CLI 46%，桌面端 10/11。内存：系统两次停掉后台任务（可用约 2.7–2.9 GB 和 2.2 GB），可用 2.78 GB 时没被停；操作说明“开跑前可用内存”改为至少 5 GB。**更正**：9.4 实为 8 段（操作说明写的是 5 段），Developer 先解释成“会话还在用”，错了，真因是 `--session` 只选 3 个会话、父会话 547dd439 不在候选里，共有的 1171 条消息归了 4b0764eb，渲染成 4 段（397,136 字符）；另先报 9.4 写入 90/被拒 10 是脚本没按 id 去重，Master 复算为 84/8/76 | `tools/run_numbers.py`；`noise_table.py`、`memwatch-item9.csv`（已删，见 `sprint-01-first-dream^`）；桌面端会话 `40339aaf-e945-4b50-b77e-dd80b4c110cf` | 下面 14:52 一行 |
| 2026-11-09 | 及格线门槛建议（Developer，留下次真实跑定）：差 > 0 算过；改过的老条目少于 30 条记“数据不足” | 模拟（`sim_threshold.py`、`sim_threshold2.py`，每格 4000 次；脚本收尾时删了，见 `sprint-01-first-dream^`）：做梦无改善时，差 > 0 的误过概率，60/60 条约 1%–4%，30/30 约 4%–8%，14/12 约 12%–14%，所以要 30 条下限；门槛 0 还是 0.05 对结果几乎无影响，决定结果的是做梦有没有把旧句子改过来 | 两个模拟脚本；第 8、9 项的差 −0.297、−0.176、−0.091 | PO 定，见 14:58 一行 |
| 2026-11-09 14:52 / 14:58 | Master 14:52 定“不做第 10 项”，PO 14:58 纠正 | 14:52 的决定（作废）：第 8、9 项已答本冲刺的问题，正式跑会往 SeaPawn 加上百条大多被判过时的条目，再跑两小时改变不了结论。PO 原话：“review 是不能打折扣的……可以削减，比如 2 小时缩减到 10 分钟，缩小范围，但应该也还是要检查”。**撤回**，第 10 项缩小版：IDEO-Scrum 记忆目录（在 git 里），只取 9.4 那 3 个会话，真的写回。顺序：10.1 做梦前体检（`--project S--IDEO-Scrum --against none`）→ 10.2 做梦，不加 `--sandbox` → 10.3 做梦后体检 → PO 决定留下或恢复，恢复则核对逐字节一致。及格线采 Developer 的规则：差 > 0 通过，改过的老条目少于 30 条记“数据不足”（PO 在 2.2 PBI-004 第 4 条定） | PO 在 Master 会话里的话 | 10.1 |
| 2026-11-09 15:16 / 15:18 | PO 问：配置目录不在 `~/.claude` 能不能扫。Master 发现 PBI-012 验收缺口 | 能：用那个配置目录启动（`CLAUDE_CONFIG_DIR`），或加 `--projects-dir`。缺口：加 `--projects-dir` 时 `prepare.py:177` 调 `routing.memory_dir(cwd)` 没传配置目录，靠默认位置的项目会写到当前配置目录。Master 同意修：不给 `--config-dir` 时取 `--projects-dir` 上一级（末级叫 projects），显式 `--config-dir` 优先，并在输出里写明路由来源。代码冻结到第 10 项做完，之后单独升 0.2.3 | Master 读 `common.py`、`routing.py`、`prepare.py`；Developer 核实 | 0.2.3 |
| 2026-11-09 15:25 | 10.1 第一次（`check-20261109-151358`，桌面端会话 69b5e1cc）判 INCOMPLETE | 原因：桌面端 lead 多跑了一条 `ls` 被守卫拦下，但 hook 核对要求 lead 全部放行，把被拦也算失败，提示还写着“没拦住”，是误导。Master 定 B：现在改这一处，升 **0.2.2**（e198a01），理由：这处在默认路径上，第 10 项应验证最后交付的代码。被守卫拦下的 lead 命令单独列出、不算失败；放行的 lead 命令仍须全是插件脚本，新函数 `is_plugin_script` 从命令本身再核。PBI-012 路由修复不一起放。10.1 第二次 `check-20261109-152119`（0.2.1 跑的，complete）留作做梦前基线，与 0.2.2 只差 hook 核对对 lead 的判法 | e198a01；重放第一次 10.1 的 hook 日志，改前 `ok=False`、改后 `ok=True`；runs 下 28 条 lead 命令（27 放行、1 被拦）判断一致；56 个单元测试 | stakeholder 更新到 0.2.2 → 10.2 |
| 2026-11-09 | 环境发现：守卫对 lead 的规则比“只许跑插件脚本”松 | Developer 写 `is_plugin_script` 时发现：`guard.decide` 只看“以 python 开头、含插件 scripts 路径、不含 `; & \| 反引号 $(`”，`python -c "…" <插件目录>/scripts/` 能过守卫，lead 可跑任意 Python；事后核对会判失败不写回，但命令已执行。另：逐字符拦，“(”“$”单独出现也拒，安装路径含括号（如 “Program Files (x86)”）会误判（Master 查出），本机无括号。Master 定：守卫规则放进 0.2.3 与路由修复一起做；第 10 项照 0.2.2 跑，真出现时 Review 如实说明；带括号路径误判记 Review 清单 | `guard.py` 的 `decide`；`test_the_evidence_check_accepts_script_runs_and_rejects_everything_else` | 0.2.3 |
| 2026-11-09 16:00 | 10.2 真实写回完成：`dream-20261109-154125`（桌面端会话 766e1aea，0.2.2，IDEO-Scrum 3 会话 8 段，全由 DeepSeek 完成）。`all safety checks passed`，0 个超限或格式问题，写回 20 个文件（13 新增、7 改过），0 冲突 | Master 独立复核通过：逐文件算哈希，真实目录 == 暂存结果，回滚副本 == 起始副本；hook 84 条 = 83 次写入加 1 条 lead 的 finish，漏记 0，目录外写入 0。PO 问为何分三次跑（体检、做梦、体检），能否合成一次，PO 同意新增候选：“一条命令做梦并自带体检”，Review 时写进产品日志（一个 workflow 里依次跑 analyzer、organizer、两轮 checker，只一份报告、只弹一次批准卡片，写回前就知道变好还是变坏；PBI-005 每晚自动跑正需要）。现在分三次是因为体检是量效果的独立工具，开发阶段坏了只重跑一段 | `dream-20261109-154125` 的 run-report；`git status`：13 个 ??、7 个 M | 10.3 |
| 2026-11-09 16:22 | 10.3 做完（`check-20261109-160249`），Master 定恢复，PO 在桌面端敲 `/dreaming:restore --run dream-20261109-154125`（约 16:24） | 及格线结果：改过的老条目 6 条，“可能过时＋错误”3 → 3；没改过的 7 条 5 → 5，翻转 0；差 0.0，少于 30 条，记“数据不足”，不下结论（这一轮验证真实写回、前后体检和回滚）。新增 11 条里 7 条被标。Master 定恢复的理由：新增条目大多被判过时（多为历史快照），留着用处不大；本冲刺还没在真实记忆上验证过恢复；运行目录里随时可看。发现 bug：finish 打印的撤销提示是 `/dreaming:restore dream-…`（位置参数），而 `dream.py` 只认 `--run`，照敲会报错且什么也不恢复，放进 0.2.3 修。写回内容：organizer 把两个新文件并入 sprint-08-first-planning，留下两个 38 字节 `MOVED TO` 存根；改写过时的“Sprint 08 目标”（4b 起了作用）；删四个文件的第一人称叙述 | 恢复输出 `identical to before the run=True`；`tools/verify_real_run.py`（当时叫 `item10_verify.py`）：真实目录 == 15:02 快照，14 文件，0 新增、0 改过；Master 复核 `git status -- memory/IDEO-Scrum` 无输出，与运行开始时副本逐个哈希一致。回滚在真实记忆上用过一次，四处核对（restore 输出、快照、起始副本、git）一致 | 下一行 |
| 2026-11-09 | 第 10 项（缩小版）完成，用量：agent 耗时 15.5 分钟，读缓存 12.17M token | 10.1 `check-20261109-152119`：13 条（有效 5、可能过时 6、错误 2）；10.3：24 条（有效 9、可能过时 11、错误 4），证据 52/52。写入调用 96 次（按 id 去重），被输入检查拒 13，过了检查 83，hook 84 条全放行。老条目 13 条：原样 7、改过 6、移走 0、找不到 0；索引 17 行 → 28 行（13 → 24 条）。10.1 用 0.2.1，10.2、10.3 用 0.2.2 | `dream-20261109-154125`；`check-20261109-152119`、`160249` | 0.2.3 |
| 2026-11-09 | **0.2.3** 做完（6a1edd8，14 个文件），Master 审过五项，及格线一项单列审，PO 定的规则一个字没改 | 五样：①记忆路由跟 `--projects-dir` 走（PBI-012）：`--config-dir` 优先，否则 `--projects-dir` 末级叫 projects 取上一级，否则当前配置目录，来源写进输出和报告；②守卫和证据核对共用一条 lead 命令规则 `common.lead_script_command`（python 加插件 scripts 目录里的脚本，不许 `-c`、`-m`、串联、重定向、替换，括号只许在引号里）；③hook 日志读不了的行（并发追加写断的）不再让 finish 崩，算证据不全、该目录不写回；④及格线 B 写进 `check.py`：`B_MIN_DIFF = 0.0`、`B_MIN_CHANGED = 30`，`compare` 多一个 `verdict`；⑤撤销提示改印 `--run <编号>`，`restore` 也认光写的编号。Master 要求记 Review 清单：输出里“rule set by the PO on 11-09, see 2.2 in the sprint log”是项目内部说法，做 PBI-009 时改成产品自己的说法 | 85 个单元测试全过（新增 29 个，新撤销测试放到旧代码上 6 个失败）；CLI 端到端 `dream-20261109-162952`（夹具“另一个账号”，写回 2 个文件、`~/.claude/projects` 没多东西、照原样敲撤销命令成功）；`tools/replay_lead_commands.py`（当时叫 `replay_all_lead.py`）重放 32 条 lead 命令 0 不一致；`check.py compare check-20261109-152119 check-20261109-160249` 输出 `not enough data (6 changed old entries, 30 needed)` | 桌面端用 0.2.3 跑体检 |
| 2026-11-09 16:48 | Review 前在桌面端用 0.2.3 跑体检（会话 3b69b67c）：`check-20261109-164807`，IDEO-Scrum，`--against none` | 通过：新守卫没误拦 lead 的正常命令，0.2.2 的“被拦命令不判失败”在桌面端也确认。lead 又多跑一条 `ls`（两段 `ls -la` 加 `2>&1`），被拦并单独列出，整次 complete。第 4 章“能装能跑”去掉保留项，噪声行补第三次。stakeholder 转述有两处与记录不符（报告路径；IDEO-Scrum 早已恢复），以运行记录为准 | `~/.claude-dream/runs/check-20261109-164807`：13 条有效 6、可能过时 6、错误 1，证据 37/38，hook 日志 2 条；`check.py compare check-20261109-152119 check-20261109-164807` 一致 11/13（0.846） | Review |
| 2026-11-09 17:00 | Sprint Review 和 Retro | Review：PO 授权 Master 照建议定（“你决定就可以，依你”），结论见第 4 章十一；产品日志里 PBI-001～004、012 移进 3.2，新增 PBI-013～015。Retro：PO 认可 Master 列的卡点（第 8 项夜里停了等 PO、第 9、10 项每步要 PO 在桌面端手敲、插件更新三次都要 PO 点头、Master 错判“跳过第 10 项”），DoD 不加东西；教训由 Developer 写进项目记忆 | PO 在 Master 会话里的话 | 收尾 |

版本一览：

| 版本 | 内容 |
| --- | --- |
| 0.1.0 | 第 2 项的冒烟版（桌面端冒烟用的就是它） |
| 0.2.0 | 相对 0.1.0 新增第 3–7 项的全部（会话转换、做梦流水线、写回与恢复、体检；这些提交时版本号没改，仍写 0.1.0）；d9cf80a：`--skip-project`；dream、check 技能 lead 用 `model: sonnet`；同夜加 `--memory-from`、及格线 B 计算、按 id 核对写入、`--continue`、`--skip-session`、续跑重分析的目录再整理、analyzer 任务消息的出处那句（70df156） |
| 0.2.1 | 96ed232、53544e8：超限和格式类问题只报告不拦；finish 输出带文件名；organizer 任务消息加“旧句子改成现在的结论”一句（4b） |
| 0.2.2 | e198a01：hook 核对里被守卫拦下的 lead 命令不算失败 |
| 0.2.3 | 6a1edd8：路由跟 `--projects-dir` 走；守卫与证据核对共用 lead 命令规则；日志断行从严；及格线 B 写进代码；撤销提示改对 |

## 4. Review

> Developer 先写的 Review 材料（2026-11-09）。Review 会上由 PO 和 Master 补：审出的问题、stakeholder 的看法、产品日志和 Product Goal 的变动。数字的出处在 3.2 里对应的行；取数脚本在 `tools/`（`run_numbers.py`、`verify_real_run.py`）；一次性的（`noise_table.py`、`sim_threshold.py`）收尾时删了，见 `sprint-01-first-dream^`。

**一、增量**

插件 `dreaming` 0.2.3，在 `plugins/dreaming/`，市场 `claude-dream`（`.claude-plugin/marketplace.json`，现在从本地目录登记）。MIT 许可；抄来的提示词附 cookbook 的 MIT 声明。第 8、9、10 项实际跑的版本：第 8 项做梦前半段是 0.1.0 的代码（04:42 开跑时最新提交是 cad43a1），续跑和前后体检是 0.2.0，organizer 试验和 12:56 的体检是 0.2.1；第 9 项和 10.1 是 0.2.1；10.2、10.3 是 0.2.2；Review 前桌面端那次体检（`check-20261109-164807`）是 0.2.3。0.2.3 在第 10 项之后、Review 之前加了五样（见 3.2）：记忆写到哪跟着 `--projects-dir` 走（PBI-012 的缺口）、守卫和证据共用一条 lead 命令规则、hook 日志里读不了的行从严处理、及格线 B 写进代码、撤销提示改成照着敲能用。

| 组件 | 做什么 |
| --- | --- |
| `/dreaming:dream` | 一个命令跑一次大梦：读会话记录，转成 cookbook 的文本格式，按记忆目录分组，每段一个 analyzer，每个目录一个 organizer；agent 只改暂存副本；跑完核对，通过的目录整个写回。参数：`--projects-dir`、`--config-dir`、`--project`、`--skip-project`、`--skip-session`、`--session`、`--sandbox`（不写回）、`--continue <运行编号>`（接着跑没跑完的运行，同一会话或新会话） |
| `/dreaming:check` | 体检：每条记忆一个结论（有效、可能过时、错误、CONFLICT、无法判断），附证据，引文由脚本核对；只出报告，不改文件。`--memory-from` 查指定的一份副本，`--against` 和之前的体检比，比出来直接给及格线 B 的结论（通过、未通过；改过的老条目不到 30 条记“数据不足”） |
| `/dreaming:restore` | 一步恢复写回前的样子；写回后又被别处改过的文件先列出来，不覆盖。`--run <运行编号>`（只写编号也行）指定哪一次，不写就恢复最近一次写回的运行；dream 输出最后一行的 `to undo:` 照敲能用 |
| `/dreaming:smoke` | 环境冒烟测试 |
| 子代理 | `analyzer`、`organizer`（改编自 cookbook）、`checker`（新写，只有 Read、Glob、Grep）；工具白名单限定，没有 shell 和网络 |
| 守卫 hook | 只在做梦期间生效：拦下 agent 的 shell、网络和 `mcp__` 工具，写入限制在本轮工作目录，记日志；lead 只许跑插件的脚本（python、脚本文件在插件 scripts 目录里，不许 `-c`、`-m`，不许串联、重定向、替换的 shell 语法）；读不了输入就拦下 |
| 转换 | 扫会话记录（含子线程、临时目录、后台任务目录），认出做梦自己的会话并排除，按 uuid 去重，按压缩点和大小切段并带前情摘要；整个目录的字符数对账到一个不差；记忆写到哪，按 `--projects-dir`、`--config-dir` 或当前配置目录的规则定，开头、finish 的输出和报告里都写明 |
| 核对（finish） | 每段都分析过；开始时就有的每个文件都找得到下落；hook 日志核对（lead 被守卫拦下的命令单独列出、不算失败；放行的 lead 命令必须是插件脚本；日志有读不了的行算证据不全）；问题分两类：安全类拦住整个目录，超限和格式类只报告、目录照样写回；写回前留回滚副本；写回按目录整体做，一个文件冲突整个目录不写 |
| 测试 | 85 个单元测试全过；`claude plugin validate` 通过（只剩缺图标一条警告） |

**二、Sprint Goal：部分达成**

“手动对当前账号的会话记录目录跑通一次大梦，做梦前后各体检一次。”

- 做到了：①**在真实记忆上写回过一次**：桌面端（PO 的真实环境），IDEO-Scrum 记忆目录（在 git 里），3 个会话 8 段，前后各体检一次；写回的内容与暂存结果一致，回滚副本与写回前逐字节一致。②沙盒里跑过更大的两次：CLI 对 ClaudeDream 和 IDEO-Scrum 两个项目的 193 段，桌面端 8 段，各带做梦前后体检。③整个目录的转换（300 个会话、523 段）通过全部核对。
- 没做到：对“整个会话记录目录”跑大梦（310 段，约 2 小时 10 分）。PO 和 Master 11-09 14:58 定缩小范围，只做 IDEO-Scrum 一个记忆目录，所以 Sprint Goal 里“会话记录目录”只做了一个记忆目录。

**三、Definition of Done 逐条**

| 类 | 项 | 判定 | 证据 | 没做到的部分 |
| --- | --- | --- | --- | --- |
| Outcome | 记忆新鲜 | **未达成** | 按 PO 定的口径 B（只比做梦改过的老条目，没改过的当对照）：CLI 沙盒改过 14 条，“可能过时＋错误”6 → 9，没改过 12 条 7 → 8，差 −0.297；桌面端沙盒改过 2 条 1 → 1，差 −0.091（才 2 条）；**真实写回**改过 6 条 3 → 3，没改过 7 条 5 → 5（翻转 0），差 0.0，改过的少于 30 条，按规则记“数据不足”。organizer 试验（任务消息里重申“被后文取代的句子改成现在的结论”）：CLI 副本上改了 18 个文件的 26 行，没丢内容，效果在噪声里（差 −0.01）；真实写回里 organizer 改写了过时的“Sprint 08 目标”等几处。新增条目被判过时或错误：CLI 46%（40/86），桌面端 10/11 和 7/11。原因：analyzer 只在文件里追加一两行更新，旧句子留着；一个文件按最差的一句定结论；改得多的文件被标的机会也多 | 没有证据表明做梦让记忆更新鲜；也没变坏。样本小（老条目 13 条的目录只有 6 条被改） |
| Outcome | 用得上 | **没验** | 真实写回做了（IDEO-Scrum，13 条老记忆加 11 条新记忆）。新增条目 7/11 被判过时或错误，多半是历史快照，Master 定恢复（PO 授权），所以没有“第二天开新会话，看 agent 是否用上、PO 是否不用重讲”这一步 | 整项没有证据：没留下，没人用过。下个冲刺选一个目录真跑并留下，第二天判断 |
| Output | 能装能跑 | **达成**（有保留） | 从本仓库的 `claude-dream` 市场装上并更新：CLI（`claude plugin list` 显示 `dreaming@claude-dream`），桌面端（stakeholder 把 0.1.0 更新到 0.2.1，再到 0.2.2、0.2.3，会话读的是缓存里的版本）；`dreaming:dream`、`dreaming:check` 在 CLI 和桌面端都跑完了，对象是 PO 的真实项目（ClaudeDream、IDEO-Scrum）的真实会话和记忆；桌面端对 IDEO-Scrum 做了真实写回；0.2.3 也在桌面端验了：PO 新开会话跑了一次体检 `check-20261109-164807`（会话 3b69b67c，读的是缓存里的 0.2.3，13 条，`--against none`），complete，有效 6、可能过时 6、错误 1，证据 37/38；lead 又多跑了一条 `ls`（两段 `ls -la` 用分号连着，带 `2>&1`），被新守卫拦下、单独列出，整次体检照样 complete；放行的只有 finish 一条，新规则没有误拦 lead 的正常命令 | 市场是从本地目录登记的，从 GitHub 安装没验（留给 PBI-009 或 PO 决定推送时） |
| Output | 只改记忆 | **达成** | ①agent 没有 shell 和网络：工具白名单只有 Read、Write、Edit、Glob、Grep（checker 只有 Read、Glob、Grep）；桌面端两次有 agent 试 Bash，平台回 `No such tool available: Bash`；②agent 只改暂存副本，真实记忆只由 finish 在核对后写回；hook 日志：CLI 第 8 项 1269 次调用、桌面端 9.4 的 77 次、真实写回 10.2 的 84 次，全部在工作目录内放行，工作目录外写入 0，agent 的 shell 和网络 0，lead 只跑了插件脚本；③GlobalMemory 受保护，没碰 `SEAPAWN.md` 和 CLAUDE.md；④写入核对按调用 id 对 hook 日志：CLI 1261 次、桌面端 76 次、真实写回 83 次，漏记 0 | 守卫对 lead 的规则原先偏松（`python -c` 加脚本目录路径能过），0.2.3 收紧；证据一直是严的（拒绝 `-c`），lead 实际跑过的命令全是 finish；10.1 第一次有一条 lead 多跑的 `ls`，被守卫拦下 |
| Output | 可回滚 | **达成** | 写回前复制整个目录作回滚副本；真实写回时，回滚副本与我开跑前拍的快照逐字节一致（独立核对）；`/dreaming:restore` 一步恢复，写回后被别处改过的文件不覆盖，在真实 ClaudeDream 记忆的副本上和第 8 项运行的副本上写回再恢复，逐字节一致；写回按目录整体做，一个文件冲突整个目录不写，单元测试覆盖。**真实目录上恢复过一次**：PO 在桌面端敲 `/dreaming:restore --run dream-20261109-154125`，输出 `identical to before the run=True`；Developer 用开跑前 15:02 的快照核对，14 个文件逐字节一致；Master 复核 `git status` 无输出、14 个哈希一致 | 备份没有自动清理（PO 问过，记入清单）。撤销提示原来印的是 `/dreaming:restore dream-…`，脚本只认 `--run`，照着敲会报错：Master 在 PO 敲命令前读代码发现，0.2.3 改正，并补了“照提示原样敲”的测试 |
| Output | 索引不超限 | **达成**（跑过的目录） | finish 量每个目录的 `MEMORY.md`（200 行、25 KB）：真实写回后 IDEO-Scrum 28 行 5.4 KB（24 条）；沙盒里 ClaudeDream 65 行 16.2 KB；organizer 靠缩短 hook 压下来，没删行 | 最紧的 SeaPawn（开始时 103 行、22.5 KB）没有跑；按 PO 定的，超限只报告、不拦写回 |
| Output | 注明出处 | **达成** | `LICENSE`（MIT）；`NOTICE` 含 claude-cookbooks 的 MIT 原文（Copyright (c) 2023 Anthropic），列明改编的文件和改动；`agents/analyzer.md`、`organizer.md`、`checker.md` 的文件头注明出处；`tools/build_agents.py` 列出每处改动；`claude plugin validate` 通过 | — |

**四、PBI 验收标准**

| PBI | 判定 | 证据 |
| --- | --- | --- |
| PBI-001 读会话记录 | 完成，验收 1～5 通过（Master 审过第 3、4 项） | 真实目录 300 个会话、523 段，对账逐字符相符；清单列出转换、跳过、排除及原因；按 uuid 去重并在清单里写明每个 fork 省略了多少；每段带前一次压缩摘要，由 `check_carried` 重算核对；会话分到记忆目录的规则与原生 auto-memory 一致 |
| PBI-002 做梦流水线 | 完成，验收 1～7 通过；真实目录上跑过 | 1 一个命令跑完，journal 逐段核对；2 回滚点和一步恢复；3 hook 日志；4 索引逐目录量；5 GlobalMemory、`SEAPAWN.md`、CLAUDE.md 没碰；6 MIT 声明；7 老文件下落：第 8 项和真实写回都是 0 丢失（“老文件被移走”只在单元测试里验证过，真实数据里 organizer 没对老文件做这种合并） |
| PBI-003 运行前提验证 | 完成，7 项加 2 项编排前提都有结论 | 第 1、2、9 项记录；新发现：`claude -p` 在 lead 最后一轮结束 10 分钟后停掉后台 workflow；桌面端的模型是 DeepSeek，读缓存里的插件；桌面端 agent 的工具表里没有 Bash |
| PBI-004 体检 | 命令和报告完成；“记忆新鲜”的及格线没达成 | 噪声量过两次：同一份 25 条快照连查三次，结论完全相同的 CLI 80%–92%、桌面端 76%；10.1 两次对同一份真实记忆，9/13 相同；及格线口径 B 和门槛（差 > 0；改过的老条目少于 30 条记数据不足）由 PO 15:01 定，写进 2.2，0.2.3 写进代码；引文核对只证明引文真在文件里，不证明推理对 |
| PBI-012 会话记录目录可设 | 完成（验收标准通过；15:16 PO 问出一个缺口，0.2.3 补上） | 不设参数读 `<配置目录>/projects`，设了只读指定目录；缺口：给了 `--projects-dir` 时，记忆写到哪仍按当前配置目录定。0.2.3：`--config-dir` 优先，否则 `--projects-dir` 的最后一级叫 projects 就取上一级，否则用当前配置目录；开头、finish 输出和 run-report 都写明；单元测试 13 个；CLI 端到端（0.2.3 五样都进了工作树之后，不加 `--sandbox`）：另一个“账号”的配置目录（夹具，一个会话），`dream-20261109-162952` 的开头和 finish 输出都写着 `memory routing: config dir …\e2e-other (from parent of --projects-dir)`，记忆写回到那边的默认位置（2 个文件），没有写到 `~/.claude` 下；finish 末尾印出 `to undo: /dreaming:restore --run dream-20261109-162952`，照原样敲（`claude -p "/dreaming:restore --run dream-20261109-162952"`）恢复成功，`identical to before the run=True`；hook 日志 4 条，lead 只跑了插件脚本，漏记 0 |

**五、第 8、9、10 项的关键数字**

| | CLI 沙盒（第 8 项；Claude Haiku 5.5） | 桌面端沙盒（第 9 项；DeepSeek V4.1 Flash） | 桌面端真实写回（第 10 项；DeepSeek） |
| --- | --- | --- | --- |
| 做梦的批次 | 193 段，ClaudeDream＋IDEO-Scrum；79 分钟（被系统内存不足停过一次，用 `--continue` 在新会话续跑） | 8 段，IDEO-Scrum；10.8 分钟 | 同样 8 段；15.5 分钟 |
| token | 195 个 agent：读缓存 1.89 亿、写缓存 2620 万、输出 410 万；平均每个读缓存约 97 万 | 不缓存输入 0.76M、读缓存 9.70M、输出 0.21M；平均每个读缓存约 108 万 | 不缓存输入 0.79M、读缓存 12.17M、输出 0.23M；平均每个读缓存约 135 万 |
| 写入调用 | 1389 次，被输入检查拒掉 128 次，1261 次到 hook，漏记 0 | 84 次，拒掉 8 次，76 次到 hook，漏记 0 | 96 次，拒掉 13 次，83 次到 hook，漏记 0 |
| 噪声（同一份记忆连查） | 25 条三次：相同 20、22、23/25，翻转 0.12、0.04、0.08 | 25 条三次：相同 19、19、19/25，翻转 0.08、0.12、0.04；CLI 对桌面端 9 对：相同 15–18/25 | 真实记忆 13 条：10.1 两次相同 9/13，翻转 1 条（0.077）；0.2.3 在桌面端又查一次，对 10.1：相同 11/13，翻转 1 条（0.077） |
| 记忆新鲜（B） | 改过 14 条 6 → 9，没改过 12 条 7 → 8，差 −0.297 | 改过 2 条 1 → 1，没改过 11 条 6 → 7，差 −0.091 | 改过 6 条 3 → 3，没改过 7 条 5 → 5，差 0.0；数据不足 |
| 新增条目被标过时或错误 | 46%（40/86） | 10/11 | 7/11（64%） |
| 索引 | IDEO-Scrum 53 行 9.5 KB；ClaudeDream 65 行 16.2 KB | IDEO-Scrum 28 行 5.2 KB | IDEO-Scrum 28 行 5.4 KB（24 条） |
| 老条目下落 | 全部原样或改过，0 丢失 | 13 条里原样 11、改过 2，0 丢失 | 13 条里原样 7、改过 6，0 丢失；改过的每个文件只动 1–3 行 |
| 体检耗时 | 做梦前 26 条 4 个 checker 2.6 分钟；做梦后 112 条 15 个 checker 8 分钟 | 每次 2–4 个 checker，4.2–6.3 分钟 | 10.1 两次，13 条 2 个 checker 各约 5 分钟；10.3 24 条 3 个 checker 6.1 分钟 |
| 内存（16 GB 的机器） | 开跑可用 4.4 GB，最低 3.6 GB；`claude -p` 进程峰值 757 MB | 可用最低 3.09 GB（新开会话那一刻），9.2 起 ≥ 3.7 GB；占内存的是常驻程序，不是 agent | 没有采样（采样脚本在 9.5 被系统停掉，没再重启）；开跑时可用约 2.4 GB |
| 后台任务被系统停掉 | 05:34，可用约 2.7–2.9 GB | 14:36，可用约 2.2 GB | — |

**六、给 Review 的清单**（按重要程度）

1. **“记忆新鲜”没达成，主因在做梦的写法**：analyzer 只追加更新行、旧句子留着；一个文件按最差的一句定结论。下一步的方向：让 analyzer 直接改写旧句子；体检按句子而不是按文件下结论（已标注的算已处理）；自动修一轮（设计见 3.2：第一次 finish 发现问题时不写回、守卫不关，起一个只跑 organizer 的修复 workflow，修完再 `finish --final`；修之前留快照，修出新的安全类问题就退回；journal 里有修复记录就不再修；约 1.5–2 小时）。动 cookbook 的提示词要 PO 同意。
2. **新条目被判过时的比例很高，大多是历史快照**（Master 记）：桌面端 9.6 被判过时的新条目，大多是逐个冲刺的历史快照（`sprint-0X-…`），按现在的项目状态判为过时。要分清：是体检口径的问题（历史记录不该按现状判），还是 analyzer 不该把历史写进记忆，还是两者都有。另外 DeepSeek 比 Haiku 更爱标（64%–91% 对 46%），样本只有 11 条，原因判断不了。
3. **“用得上”没验**：真实写回做了，又恢复了（Master 定，PO 授权），没有留下的记忆，也就没有第二天的判断。下个冲刺的第一件事：再选一个不同的目录真跑一次并留下，比如 SeaPawn 之外较小的那些，或者全量版。
4. **写进记忆的内容太杂**：原始调研记录（gh api 回来的原文）被写进记忆，ClaudeDream 目录从 25 KB 长到约 800 KB，其中一个文件 201 KB；analyzer 的任务消息里加了“出处写会话标题和起止日期，不写段号和当天日期”，效果只有一半（写会话标题的 analyzer 4/144 → 33/53，写段号的 28% → 34%），Haiku 不听这一句，根治要让 agent 看不到段号。
5. **索引超限**：官方从 v2.1.210 起会在 Claude 写完 `MEMORY.md` 后量一下，超了让 Claude 压回去（Master 查文档）；但做梦的 agent 改的是暂存副本，这个提醒管不管得到它们没核实，所以做梦这边自己量、自己报告。方向底稿 §3 里“超出不加载也不报错”（10-24）已过时，Review 时改。
6. **旧运行的副本**：`~/.claude-dream/runs/` 现有 36 个运行、约 15 MB（17:00 量），没有自动清理（PO 提过）；下个冲刺加：每次做梦开始时删超过一定天数的旧运行的副本，报告留着；本冲刺收尾时 Master 清掉测试跑出来的旧运行。
7. **体检的噪声和局限**：同一份记忆连查三次，“可能过时＋错误”的总数在 10–13 之间摆动，结论完全相同的只占 76%–92%；引文核对只证明引文真在那个文件里，不证明推理对（一次有个 checker 说根目录下没有 `references/`，其实有）；体检的证据截止在做梦开始，体检在几小时后，期间项目又变了（时间错位）；正式跑时会话都关着，演练里没有。及格线门槛（差 > 0，改过的老条目至少 30 条才下结论）PO 15:01 定，写进 2.2，0.2.3 写进代码（`check.py compare` 自己给出结论），模拟见 `sim_threshold.py`（已删，见 `sprint-01-first-dream^`）。
8. **环境**：①`claude -p` 在 lead 最后一轮结束 10 分钟后停掉后台 workflow；②16 GB 机器上后台任务被系统停掉两次，操作说明改为开跑前可用内存至少 5 GB；③桌面端 lead 和 agent 都是 DeepSeek，技能里的 `model` 不起作用；④桌面端读缓存里的插件，改代码后要升版本号才会更新；⑤16 个 analyzer 同时改同一批文件，9% 的写入被输入检查当场拒掉（读完后文件被改过、字符串没找到），重试后都成功，没造成失败。
9. **桌面端的 lead 不总照技能走**：10.1 第一次，lead 在等 workflow 时多跑了一条 `ls`；技能写着“只做这几步”，对 DeepSeek 只是建议，真正的约束是守卫。守卫拦下了，但核对把被拦的命令算成失败，10.1 判了 INCOMPLETE；0.2.2 改成被拦的单独列出、不算失败。0.2.3 在桌面端的体检里它又多跑了一条 `ls`，守卫拦下，整次体检仍 complete，0.2.2 的修法在桌面端确认有效。
10. **守卫对 lead 的规则偏松**：原先只看“以 python 开头、含脚本目录路径、不含 `; & | ` $(`”，`python -c "…" <脚本目录>/` 能过；新写的证据核对拒绝这类命令，是写测试时对出来的。0.2.3：守卫和证据用同一条规则。另外原来的逐字符拦会误判带括号的安装路径（Program Files (x86)）；0.2.3 括号只许在引号里。
11. **hook 日志会被并发写坏**：Windows 上追加是“先 seek 再写”，同一瞬间的 hook 会互相覆盖；最早的一份日志里有一行只剩半截（`ull}`），当时 finish 会崩，而且守卫已经关了，运行不能再 finish。0.2.3：读不了的行不再让 finish 崩，算证据不全、这个目录不写回；根治（每条记录一个文件，或加文件锁）下个冲刺定。
12. **`--session` 加去重的副作用**：只选部分会话时，被选中的 fork 的父会话不在去重范围里，共有的消息就归 fork，渲染多一截。9.4 和 10.2 的批次因此是 8 段，不是 5 段（4b0764eb 从 1 段变成 4 段）；内容没错。可选的改法：`--session` 时把父会话也放进去重范围，但不渲染它。
13. **整理环节没有删除工具**：本轮新建的文件被合并时，会留下 `MOVED TO` 存根（真实写回里 2 个，38 字节，没有索引条目）；这是不得已的杂物，PO 可以自己删。
14. **小问题**：`claims_vs_diff` 对 organizer 自述里 `PARTIAL RUN`、`NOT DONE` 字样误报“说写失败但会话记录里没有”，只影响报告里的警告行；“老文件被移走”只在单元测试里验证过；`--continue` 的跨会话续跑在 CLI 上测过，桌面端没测。
15. **收尾要办的**：市场改回从仓库根目录登记（现在指向工作树）；插件缺图标、README 没写安装行；GitHub 安装没验（PBI-009）；PBI-008（敏感内容过滤）没做，写回前先看一眼 diff；`~/.claude-dream/runs/` 里测试跑出来的旧运行清掉。
16. **输出里有项目内部的说法**（Master 记）：及格线那几行写着“rule set by the PO on 11-09, see 2.2 in the sprint log”（英文）和“PO 11-09 定，见冲刺日志 2.2”（中文报告），是项目内部的说法，插件公开发布后新用户看不懂。做 PBI-009 时改成产品自己的说法，比如直接写规则本身（差 > 0，改过的老条目至少 30 条）。

**七、给 Retro 的输入**（现象、原因、规矩）

1. 守卫用 Windows 默认的 GBK 读输入，含中文的 Edit 解不出，守卫悄悄不作决定，写入落到权限提示。规矩：做梦期间读不了输入就拦下并记日志；Master 据此审过一次“agent 编造”的误判，后来更正。
2. 我报错过数和原因：fork 复制占 51%（实为 API 镜像，真正的约 13%）；“organizer 没改名”（它在后一轮改过）；9.4 写入 90 次、拒 10 次（实为 84、8）；9.4 是 8 段，我先解释成“会话还在用”（实为去重范围）。原因：取数脚本没按 id 去重、没用产品自己的核对函数；没去查清单就解释原因。规矩：数字用产品自己的函数算，按 id 去重，写明口径；说原因之前先查记录（清单、日志、会话记录）；agent 的自述以它自己的会话记录为准，hook 日志只是辅证（hook 够不着输入检查当场拒掉的调用）。
3. 先定标准、后测：原定及格线“做梦后比做梦前少”，同一份记忆一字没改连查两次就“通过”了（13 → 12）。规矩：先量噪声再定及格线；及格线用同一轮里没改过的条目当对照。
4. 环境要实测：桌面端回答的是 DeepSeek；读缓存里的插件；`claude -p` 会停后台任务；系统内存不足会停后台任务；agent 写 `~/.claude/projects/*/memory/` 被当成敏感文件。规矩：每个环境前提用一次最小的真实运行验证，别靠文档推断。
5. 规模估错：写 How 时估“一两百个 analyzer”，实际 523 段（跳过测试目录后 310）。规矩：先用转换脚本量真实规模，再估时间和额度。
6. 共用工作树：Master 按路径提交，同一文件里我没提交的两行跟着进了他的提交。规矩：改共用文件前先 `git status`，写完马上提交自己的部分；Master 已说以后先问。
7. 每项做完交 Master 审的节奏有效：审出的写回整目录、organizer 试验的验收标准、写入核对按 id、续跑的组织者规则、hook 核对对 lead 的判法，都实质改进了设计。
8. 核对不能惩罚防守：lead 的命令被守卫拦下，核对却判失败，等于拦得越对、运行越失败。规矩：证据要分清“试过并被拦”和“跑了”；被拦的单独列出，放行的才要求合规。
9. 同一条规则写了两份会各走各的：守卫和证据对“lead 只许跑插件脚本”各写了一份，写测试时拿一份对另一份，对出了守卫的缺口。规矩：一条规则只写在一处，两边都调它。
10. 改核对之前，先拿真实数据重放：把所有 hook 日志里的 lead 命令逐条过新规则（27 条放行的、1 条被拦的，0 条不一致），再提交。
11. PO 说“验收不能打折扣”：嫌太长，就缩小范围、真跑一次，不是跳过。第 10 项缩小到一个目录、3 个会话，约 25 分钟，真实写回、前后体检、回滚都验到了。
12. 印给人敲的命令要有测试，照着原样敲一遍：撤销提示印的是 `/dreaming:restore dream-…`，脚本只认 `--run`；单元测试测的是函数，没人照着敲；Master 在 PO 要敲之前读代码发现，PO 没吃亏。规矩：脚本输出里印给人敲的命令，写测试时当用户输入原样喂回去。
13. PO 等 AI 或 AI 等 PO 的地方：第 2 项桌面端冒烟、第 8 项续跑前要 PO 关程序、第 9 项 PO 在桌面端手敲 6 条命令、第 10 项 PO 嫌太长、PBI-012 的缺口由 PO 的一个问题引出。夜里先备好“断了怎么办”“跳过哪些”，让 PO 回来时不被卡住。

**八、Developer 对产品日志的建议**（PO 和 Master 定）

- PBI-001、003、012 标完成；PBI-002 标完成（核对在副本和一个真实目录上做过）；PBI-004 标“命令完成，‘记忆新鲜’未达成”。
- 新 PBI 候选：①再选一个目录真实写回并第二天判断“用得上”（SeaPawn 的索引压缩是最紧的情形）；②做梦后记忆更新鲜（改写旧句子、体检按句子下结论、历史快照型记忆的处理）；③限制原始记录写进记忆、让 agent 看不到段号；④超限自动修一轮；⑤旧运行副本自动清理；⑥hook 日志并发追加的根治；⑦`--session` 的去重范围；⑧桌面端 `--continue` 实测；⑨（已有）PBI-008 敏感内容过滤、PBI-009 从 GitHub 安装；⑩一条命令做梦并自带体检（PO 11-09 16:00 同意加，设计见 3.2）。
- 下个冲刺的试验用 8 段的小批量（桌面端 11–16 分钟），不用整目录。

**九、Review 时怎么看**（可演示的东西）

1. `python -I -m unittest discover -s plugins/dreaming/tests`：85 个 OK。
2. `claude plugin validate plugins/dreaming`：通过。
3. 真实写回：`~/.claude-dream/runs/dream-20261109-154125/run-report.json`（核对记录）；对开跑前快照的独立核对（`tools/verify_real_run.py`；当时的快照在 Developer 的临时目录，已不在）：恢复后“真实目录 == 快照”为 True，14 个文件；`python -I plugins/dreaming/scripts/check.py compare check-20261109-152119 check-20261109-160249`（及格线 B 的结论：数据不足）；做梦前后体检 `check-20261109-152119`、`check-20261109-160249` 的 `check-report.md`（逐条结论、证据、过时说明草稿）。
4. 沙盒：桌面端 `check-20261109-144223`、`dream-20261109-140922`；CLI `dream-20261109-044212`（193 段）、`check-20261109-122501` 和 `check-20261109-122829`。
5. 0.2.3：CLI 端到端 `~/.claude-dream/runs/dream-20261109-162952/run-report.json`（夹具“另一个账号”，写回再照 `to undo:` 恢复）；`python -I tools/replay_lead_commands.py plugins/dreaming`（所有 hook 日志里的 lead 命令过新规则，0 不一致）。

**十、Stakeholder 的看法**（Master 在 Review 前召了一个子代理，身份取自产品日志 2.1 的“新用户”；只读，看了插件目录、市场文件、README 和本章一、三、六节）

结论：恢复这一环信得过，安装和第一次运行会卡住，或者不敢用。

1. **没有安装说明和前置条件**：README 是开发仓库的说明，没有 `/plugin marketplace add` 这一步；本机要有 `python`、要能用 Workflow 工具、开跑前可用内存至少 5 GB，这些用户都看不到。第一步就卡住。
2. **默认直接改真实记忆**：没有“先用 `--sandbox` 试一次”的引导，也不预告时间和额度（整目录约 2 小时；8 段也要 11–16 分钟、约 1000 万读缓存 token）。第一次跑就是长时间运行加真实写回。
3. **写进记忆的东西不可信**：原始调研记录写进了记忆，目录从 25 KB 长到约 800 KB；新增条目 46%–64% 被判过时。
4. **敏感内容过滤（PBI-008）没做，对新用户是真风险**：会话里的密钥和私人内容会被读进记忆；“写回前先看一眼 diff”这条建议，普通用户不会知道。
5. **价值没证明**：“记忆新鲜”未达成，“用得上”没验，用户找不到值得冒这些风险的理由。

信得过的地方：恢复在真实目录上验证过，照着 `to undo:` 原样敲能用；agent 没有 shell 和网络，写入限制在工作目录；先写暂存副本，核对通过才整个目录写回；出处交代清楚；没做到的地方都照实写了“未达成”“没验”。

Master 的看法：第 1、2、4 条都归 PBI-009（新用户上手）和 PBI-008，公开发布前要做；第 2 条可以考虑做成“第一次默认沙盒，开跑前打印规模和预计耗时”。第 3、5 条是本冲刺“记忆新鲜”没达成的另一面。排序由 PO 定。

**十一、Review 结论**（2026-11-09，PO 授权 Master 照建议定：“你决定就可以，依你”）

- **Sprint Goal**：部分达成。真实写回、做梦前后体检、恢复，都在 IDEO-Scrum 的真实记忆上做到了；整个会话记录目录没跑，是 PO 同意的缩小范围。
- **DoD**：“记忆新鲜”未达成；“用得上”没验；能装能跑、只改记忆、可回滚、索引不超限（只限跑过的目录）、注明出处，达成。能装能跑还差一项：从 GitHub 安装没验。
- **PBI**：001、002、003、004（只出报告的一版）、012 完成，移进产品日志 3.2；PBI-004 的“改正或标注”并入新的 PBI-013。
- **新 PBI**：013 记忆真正更新鲜（下个冲刺先做）、014 一条命令做梦并自带体检、015 运行更稳；PBI-005、008、009 的备注补上本冲刺的发现（第六节、第十节）。
- **Product Goal**：不改。目标还成立，只是还没做到。
- **下个冲刺**：先做 PBI-013；同一冲刺挑一个目录真实写回并留下，第二天判断“用得上”。
