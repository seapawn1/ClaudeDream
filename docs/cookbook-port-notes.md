# Cookbook 移植笔记

精读 Anthropic 官方 cookbook《Dreaming with a dynamic workflow》时的笔记，目标是把它移植成 Claude Code 插件（PO 11-07 定，见方向底稿 §2）。原件在 `reference/agent-memory/dreaming-cookbook/`；架构图见 `docs/dreaming-architectures.md`；待议问题统一记在方向底稿 §5。

进度：第 1、2 段已读（2026-11-07）。

| # | 段落 | 状态 |
|---|---|---|
| 1 | 开头 + How it works + 成本 | 已读 |
| 2 | Step 1 导出会话 | 已读 |
| 3 | Step 2 三个 agent + 安全 | 未读 |
| 4 | analyzer 提示词 | 未读（全文已过一遍） |
| 5 | organizer 提示词 + 运行结果 | 未读（全文已过一遍） |
| 6 | Step 3 使用 + 每晚运行 | 未读 |
| 7 | 局限 + Make it yours | 未读 |

## 一、它是什么

- Anthropic 有三个叫 dream 的东西：Claude Code 内置的 auto-dream（开关关着）、Managed Agents 的 Dreams（research preview，托管成品，写进新 store）、这份 cookbook（同一思路的自建版，原地更新）。cookbook 不是 Dreams 的源码，原话是 “build the same idea yourself”。
- cookbook 是给 API 开发者的教学示例，同时演示 memory store、dynamic workflow、限工具的 predefined agents 三样新组件。
- 许可 MIT（`anthropics/claude-cookbooks`），照抄提示词要保留版权声明、注明出处。

## 二、第 1 段要点

- **做梦的定义**：用事后视角（with hindsight）回看 transcript，纠错、重组成更好搜的表示、把重要的放手边。auto-memory 是会话里当场记，不知道结果；做梦晚一步，知道哪个办法最后管用、哪条事实被推翻。
- **记忆里存什么**：管用的命令和参数、做过的决定和时间、踩坑得来的教训，每条带日期。全是项目知识，没有关于用户的部分。
- **评测办法**：固定事实清单，看记忆库命中多少（只量召回）。可照搬，再加精确率。
- **省钱设置**：分组、少走轮次、纯文本 transcript、Haiku 当 organizer，$10 降到 $8。成本大头是每走一轮都要重发已读内容。
- **它没有的**：跨会话综合。每个 analyzer 只看一份 transcript，organizer 明确禁止再分析、禁止发明事实。愿景后半句「连起线索」在它的架构里没有位置（方向底稿 §5 第 17 条）。

## 三、第 2 段要点

- **工具结果最重要**：“Tool results matter most”。transcript 里是 agent 实际跑了什么、看到了什么。渲染 jsonl 时工具结果要保留，不能像 claude-code-log `--detail low` 那样压掉。
- **原料不只 transcript**：示例 11 份里有一份 `00-maintainer-notes.md`，是人从群里手抄的带日期决定，analyzer 当事实收。
- **示例数据是一套评测题**，埋了三个难点：事实会过期（`make test` 先要设 `TIDEWICK_DATA_DIR`，0.4.0 后不用）、细节埋在工具输出里、话题重叠（并行 analyzer 碰到彼此的文件）。
- **渲染格式**：`SESSION` 行、`NOTE ABOUT THIS FILE:` 行、`=== primary thread … ===` / `=== sub-thread … ===`，事件块标签为 `USER:`、`AGENT:`、`TOOL CALL <tool>:`、`TOOL RESULT (<tool>):`、`THREAD MESSAGE SENT/RECEIVED`、`EVENT <type>:`。思考过程不导出。
- **规则**：只导出已结束的会话；默认最近 14 天；文件名只能用 ASCII；文件夹、扩展名不对、空文件跳过；一次最多 500 个文件。

## 四、移植清单

| 类别 | 内容 |
|---|---|
| 能照抄 | 四个提示词（换路径占位符）；渲染格式与 `NOTE ABOUT THIS FILE` 行；人写的笔记也能当原料；跳过规则；完整性核对的思路（核对每份 transcript 都被分析过） |
| 要换底座 | 导出：Managed Agents API → 读本地 `~/.claude/projects/*.jsonl`，过滤 `snapshot`、`trackedFileBackups`、`permissionMode` 等杂项记录；`subagents/` 下的子代理 transcript 对应 sub-thread。store：云端 → `S:\SeaPawn-Memory` 加 git 提交（备份和版本都有）。编排：workflow run → Claude Code 的 Workflow 工具或子代理。限工具：平台策略 → 子代理 frontmatter `tools:`（Workflow 能否限未核实）。定时：cron → 见下节。预算上限：自己做 |
| 我们要改 | **做梦会话自己的 transcript 不作原料**：lead 是普通 Claude Code 会话，jsonl 和别的会话在同一目录，里面装满 analyzer 的总结，不排除就会把上次做梦的结果当新事实再记一遍。收尾会话本身留到下一轮处理。`_index.md` 改用 `MEMORY.md`，沿用原生加载。两层记忆的路由（方向底稿 §5 第 12–14 条） |

## 五、谁来当 lead、怎么触发

- **lead 可以是每天收尾的会话**：用 `/dream` 命令启动 Workflow（由命令调用 Workflow 算用户明确同意），lead 自己不读原料，只收结果。好处是 PO 在场，跑完当场看 git diff。长会话当 lead 要付上下文的钱；也可以收尾时专开一个短会话。

| 触发方式 | 要不要 PO 开 Claude | 条件 |
|---|---|---|
| Windows 任务计划程序 + `claude -p` | 不要 | 电脑开着、醒着；插件命令在 headless 下能否用未核实 |
| 桌面端定时任务 | 要开着桌面应用 | 应用开着、电脑醒着 |
| 开会话时顺带检查（照 auto-dream：满 24 小时且新会话数够） | 要 | 只在用 Claude 时跑 |
| Claude Code 云端定时任务 `/schedule` | 不要 | 用不了：读不到本机 jsonl |

API 版在定时上不占优势：transcript 在本机，API 版也要本机开着去导出、上传。它的好处是云端算、平台自带预算上限和版本审计；代价是 transcript 出本机。

## 六、从 auto-dream 借的三样

cookbook 在准确和安全上更好（全量读、逐条核对、不删事实、矛盾标 `CONFLICT`、防注入），auto-dream 在省钱和收得紧上更好。借：

1. **索引长度控制**：`MEMORY.md` ≤200 行且 ≤25KB，每行一句短钩子，长内容搬到正文。对着「记忆太多」的痛点。
2. **对照 CLAUDE.md**：和人写的规则冲突时只标注、只报告，不改人写的层。
3. **触发机制**：满 24 小时且有 N 个新会话才跑；锁文件的修改时间兼作上次运行时间。

## 七、候选 PBI（第一个增量不做，顺手可做）

- **按消息 uuid 记水位，只读新增部分**：一套机制同时解决两件事。① fork 去重：每条消息只在第一次出现的文件里渲染，后面的 fork 开头加一行 `NOTE ABOUT THIS FILE: 前 N 条与会话 X 相同，已省略`，完全重复的文件跳过。② 收尾会话当天处理（PO：原则上当天处理更好）：现在处理，下次只读新增部分；也补上 cookbook 自认的短板（导出后又接着聊的部分不会被处理）。
- 未查：fork 型子代理的 transcript 会不会也带着父会话的上下文。
