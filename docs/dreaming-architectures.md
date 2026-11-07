# 做梦的三种架构

看不懂长文档时先看这里。两张架构图分别对应 Anthropic 官方 cookbook《Dreaming with a dynamic workflow》和 Claude Code 内置的 auto-dream（提取自 `references/auto-dream/auto-dream.md`），最后一张表把两者和我们的 v3 方向摆在一起。

## 一、cookbook：把 dream 做成一条流水线

```mermaid
flowchart TD
    C["夜间 cron（dreaming_nightly.py）<br/>首晚取过去 24 小时，之后从上一次运行起算<br/>手动跑 notebook 时默认取 14 天"] --> S["导出已结束的 agent 会话<br/>只取 idle / terminated<br/>每个会话一个 transcript 文件"]
    S --> U["上传 Files API<br/>最多保留 24 小时"]
    U --> L["Lead agent（Sonnet）<br/>自己不读 transcript<br/>只写一份动态 workflow 并启动"]
    L --> G["Analyze：每约 20 个一组<br/>并行起 transcript-analyzer（Haiku）"]
    G --> M[("共享 memory store<br/>小型 md + frontmatter<br/>[[slug]] 交叉链接 + _index.md")]
    M --> O["Organize：全部完成后跑一次<br/>memory-organizer（Haiku）<br/>去重、修链接、重建索引"]
    O --> R["Lead 回报一行 JSON<br/>处理数 / 失败数 / 索引条目 / 变更"]
    M --> Use["平时的 agent 会话<br/>只读挂载 store<br/>从 _index.md 开始读"]
```

读这张图只要记住三件事：

| 谁 | 干什么 | 不干什么 |
|---|---|---|
| Lead（Sonnet） | 写 workflow、分组、汇总 | 不读 transcript、不碰记忆文件（提示词约定；工具只有 read、glob） |
| Analyzer（Haiku，N 个并行） | 每个读一份 transcript，提炼、修正、补进 store | 不互相覆盖；不整文件合并、改名、移动（会改内容、修矛盾、压掉低价值段落） |
| Organizer（Haiku，跑一次） | 去重、修 frontmatter 和链接、维护 `_index.md` | 不丢事实；合并掉的文件留 `MOVED TO [[slug]]` 占位，占位由 notebook 删 |

安全边界：analyzer 和 organizer 是预定义的，工具只有 read / write / edit / glob / grep 五个；lead 是顶层 agent，只拿 read 和 glob。都没有 shell 和网络（空 allowlist）。transcript 当不可信输入；无人值守时任何要审批的调用直接拒绝。

## 二、官方 auto-dream：把 dream 写成一段提示词

```mermaid
flowchart TD
    T["触发条件，全部满足才跑<br/>距上次 ≥ 24 小时<br/>新会话 ≥ 阈值（代码默认 5，本机缓存快照里 gate 给 3）<br/>auto-memory 开着<br/>距上次扫描 ≥ 10 分钟<br/>服务端闸门放行 tengu_onyx_plover"] --> D["后台任务 DreamTask<br/>显示为 dreaming"]
    D --> P["一个 agent 按提示词走四章<br/>Orient：看现有记忆和索引，有 sessions/ 子目录再看最近条目<br/>Gather：看漂移的既有记忆，按需 grep transcript（v2.1.319 已去掉 logs/ 活动流）<br/>Consolidate：合并、改、删矛盾事实<br/>Prune：删过期指针、重建 MEMORY.md"]
    P --> W[("直接原地改记忆目录<br/>没有备份、没有 diff、没有确认")]
    W --> N["下一次会话照旧加载<br/>错误这次看不出来"]
```

和 cookbook 比，它的特点是「一个 agent、一段提示词、原地改」：聪明全在提示词里，代码只负责门控、加锁、拉起任务。官方目前把服务端闸门关着：用户可以设 `autoDreamEnabled: false` 永久关闭，但设 `true` 开不起来。

## 三、三种做法对照

| | 官方 auto-dream | cookbook 做梦服务 | 我们的 v3 方向 |
|---|---|---|---|
| 跑在哪 | Claude Code 进程内，后台任务 | 独立服务，夜间 cron | Claude Code 插件 |
| 谁干活 | 一个 agent，一段提示词 | lead + N 个 analyzer + organizer | 照 cookbook：lead + analyzer + organizer，用 Workflow 或子代理 |
| 写哪 | 原地改现有记忆 | 原地改 memory store（保留 memory version，跑前留副本） | 原地改本地记忆目录，git 提交 |
| 谁来审 | 没人 | 默认没人（可改成先写新 store 再切换） | 照 cookbook 默认不审，git 回滚兜底（删减要不要单独审待议） |
| 已知事故 | #47959：一天删掉 23 个记忆文件，用户无感知 | 未大规模运行 | — |
| 现在的状态 | 闸门关着，不放行 | 官方 cookbook，可自建 | 以 cookbook 为基线，移植设计中 |

一句话：官方 auto-dream 栽在「无人审的原地写」，cookbook 把它拆成流水线，加了全量读、逐条核对、防注入和完整性核对，并且不丢事实——它会删合并后的占位文件、第一人称叙述和走不通的假设，但每条事实行都保留——但仍然默认无人审。我们 v3 照 cookbook 来（PO 11-07 定），运行底座换成 Claude Code，靠 git 回滚兜底；旧版「只出提案、审 diff」已改。

详细原料：cookbook 原件在 `references/dreaming-cookbook/`，auto-dream 提取在 `references/auto-dream/auto-dream.md`。
