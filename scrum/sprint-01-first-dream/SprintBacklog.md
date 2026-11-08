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
| Output | 能装能跑 | 从本仓库的 `claude-dream-dev` 市场能装上，在 PO 的一个真实项目上跑通 |
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
- 测试和正式跑怎么装插件：这个冲刺把 `claude-dream-dev` 改成从本地仓库目录注册，开发时指向工作树，合并后指向仓库根目录；DoD“能装能跑”在 Review 前用它验，不推送。现在的注册来自 GitHub（`seapawn1/ClaudeDream`），同名市场不能并存，要先移除；改注册由 PO 做或当面批准。从 GitHub 安装留到 PBI-009 或 PO 决定推送时再验（Master 定，PO 授权，11-09 经 Developer 会话转达）。

**PBI-001 读会话记录**
- 定了：
  - 扫 PBI-012 定的目录下的全部会话，包括还没结束的会话、临时目录和后台任务目录里的会话、桌面端留下的老会话；只排除做梦自己产生的会话（PO）。
  - 格式照 cookbook Step 1，工具调用和结果都保留，思考过程不导出（产品日志、cookbook）。
  - worktree 的会话归主项目（产品日志）。
  - fork 去重这次做：同一轮里每条消息按 uuid 只渲染一次，后面的副本换成 cookbook 的 `NOTE ABOUT THIS FILE` 一行说明，完全重复的文件跳过。实测会话正文里 51% 是 fork 复制的，不去重处理量翻倍。水位仍不做（Master 定，PO 授权，11-09 经 Developer 会话转达）。
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
  4. 能不能从 `claude-dream-dev` 市场把插件装进桌面端（桌面端没有 `/plugin` 命令，要用界面上的插件浏览器）；
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
| 2 | 插件骨架：`plugins/claude-dream/`（plugin.json、MIT 声明、`dream` 和 `check` 两个命令的空壳）、市场改为本地目录登记（PO 本人做或当面批准）、会话记录目录参数（PBI-012）。另做一个桌面端冒烟测试命令：最小的 workflow、一个限了工具的子代理、做梦 hook、一个 python 脚本，请 PO 在桌面端触发，完成 PBI-003 的④⑤⑥ | 能装的插件；冒烟测试命令；PO 在桌面端的结果记进 3.2 | CLI 能装能调；PBI-012 的验收标准通过；桌面端逐项有结论：能装、workflow 在 PO 的计划下能不能用、要不要批准、`model: sonnet`／`haiku` 解析成什么、python 在不在 PATH 上、hook 触不触发、子代理的工具限制是否生效 |
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
3. **lead 只跑插件自带的脚本**（Master 定）：其余 agent 没有 shell；做梦期间所有 agent 都不能用网络工具。由 hook 执行并记日志，hook 只在有本轮运行状态文件、且会话对得上时生效。
4. **测试一律不碰真实记忆**：测试时用一个开关把所有目标记忆目录映射到沙盒里的副本。只有 PO 的正式跑写真实记忆。
5. **回滚点用文件副本，不用 git**：跑之前把每个要写的记忆目录复制到本轮工作目录，恢复就是原样拷回。这样不会提交或冲掉记忆仓库里别的会话没提交的改动。
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
- **待 PO**：`claude-dream-dev` 改成从本地目录登记（开发时指向工作树，合并后指向仓库根目录），要先移除现在的 GitHub 登记。这是改 PO 的 Claude Code 配置，由 PO 本人做或当面批准，放在第 2 项开头。
- PBI-003 里如果有做不到的项，和 PO 定替代做法。

Go-ahead: 2026-11-09 01:48，PO 在 Master 会话里放行，精化随之结束。范围：只在工作树分支 `worktree-sprint-01-first-dream` 上提交；合并、打 tag 到 Review 时再定；不推送。冲刺中 PO 本人要做三件事：第 2 项开头把 `claude-dream-dev` 改成本地目录注册并跑桌面端冒烟测试，第 9 项在桌面端触发沙盒演练，第 10 项在桌面端正式跑

### 3.2 Notes

| Date | What was done | Decision and reason | Evidence | Next |
| --- | --- | --- | --- | --- |
| 2026-11-09 | Planning 第一阶段：定 Sprint Goal、PBI、DoD、分支、Developer | PO 定：目标见 1.1；选 PBI-001～004、012，PBI-006 不选（cookbook 没有水位）；DoD 七项全用、措辞不改；分支 `sprint-01-first-dream`；Developer 从 Master 会话 fork 到 CLI，不用桌面端，因为桌面端模型约为 Haiku 级、本冲刺中等偏难；不开设计，不做原型 | Master 会话的对话 | Developer 复述精化，写 How |
| 2026-11-09 | `.claude/settings.local.json` 设 `worktree.baseRef: "head"`（不进 git） | 默认的 `fresh` 从 `origin/main` 建工作树，那里没有未推送的 b04553f，也没有冲刺日志 | `.claude/settings.local.json` | Developer 用 EnterWorktree 建 `sprint-01-first-dream` |
| 2026-11-09 | Developer 建好工作树（`worktree-sprint-01-first-dream`，含 e3cc641），复述精化，提出五点：fork 去重、记忆格式、体检及格线、“没有 shell”管到谁、怎么装插件 | PO 授权 Master 定；结论见 2.2 各处的“Master 定，PO 授权”。第 5 点没照 Developer 的方案（测试用本地市场、收尾推送后再从 GitHub 装）：那样 DoD 要等收尾以后才能验 | Developer 会话的消息；`~/.claude/plugins/known_marketplaces.json` 里 `claude-dream-dev` 的来源是 GitHub | Developer 写 3.1；PO 说精化结束 |
| 2026-11-09 | Developer 写 3.1 How（8 项） | 编排优先用插件自带的 workflow（插件能带 `workflows/`；最多同时 16 个 agent，每轮最多 1000 个，到用量上限会暂停等重置；脚本本身不能碰文件和 shell）；测试只写沙盒，只有 PO 的正式跑写真实记忆 | 实测：`~/.claude/projects` 下 451 个 jsonl、378 MB，消息正文 6640 万字符，其中 3410 万是 fork 重复；本机有 Python 3.13、Node 26。文档：workflows 页“Behavior and limits”“Distribute a workflow in a plugin”；memory 页“Storage location”（默认记忆目录按 git 仓库算，worktree 和子目录共用一个） | Master 审 How，PO 放行 |
| 2026-11-09 | 发现 `.worktreeinclude` 还写着旧路径 `reference/`（现为 `references/`） | 收尾时一并改；不影响本冲刺，工作树里 `references/` 是 git 跟踪的 | `.worktreeinclude` | 收尾时改 |
| 2026-11-09 | Master 审 How（970124a），Developer 按意见改 3.1 | 照改三处：A 桌面端提前验——第 2 项改成桌面端冒烟测试（最小 workflow、限工具子代理、hook、python 脚本），新增第 9 项桌面端沙盒演练；B 第 7 项量出噪声后判断及格线要不要留余量，要调报 PO，在正式跑前写死进 2.2；E 测试和沙盒运行产生的会话也算做梦会话，写进第 3、10 项的 Done when。建议三处也采纳：C 运行说明请 PO 关掉别的会话，恢复前列出别处的改动；D 渲染副本每条命令跑完就删，回滚副本等 PO 验收后删；F 第 3、4 项各拆成两项，共 10 项 | Master 会话的消息；workflows 页的可用范围（付费计划、API 和几家云平台） | Master 核对，PO 确认精化结束并放行 |
| 2026-11-09 | Master 核对 6aed640，How 审核通过；PO 放行 | 放行范围见 3.1 最后一行 | PO 在 Master 会话里说“放行吧” | Developer 从第 1 项开始 |

## 4. Review
