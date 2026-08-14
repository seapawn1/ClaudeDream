# 底片留/剔规则表（PBI-01.1·AC3①）

对应 [SprintBacklog AC3](../../../scrum/sprint-02-negatives/SprintBacklog.md)：机械去渣、语义不判断，以本表为锚——验收判「实现行为与本表一致」，不判验收方自拟口径。实现见 [compress.mjs](compress.mjs)（`RULES` 表与本文件逐条对应，改一处务必同改两处）。

## 证据来源

本表不是照抄 `reference/claude-code-log/` 的文档猜的——2026-08-14 直接读了这个项目自己的真实逐字稿（`~/.claude/projects/D--ClaudeDream/13f474f9-*.jsonl`，604 行，Claude Code v2.1.228）核对过一遍，取样脚本与输出已弃（临时诊断，不入库）。发现：claude-code-log 的 `models.py`（clone 于更早版本）**没有**覆盖这台机器实际吐出来的 `custom-title`/`mode`/`permission-mode`/`last-prompt`/`agent-name` 五种顶层 type，以及至少 15 种 `attachment.type` 子类——这就是 SprintBacklog 注意点3「格式漂移」在本机的实测证据，也是本表按**顶层类型 + 极少数结构性子规则**设计（而不是穷举每个子类型名字）的原因：新版本再冒出几个新 attachment 子类型，本表的默认规则照样接得住，不需要跟着每次发版改代码。

## 判定优先级

1. 先查 `type` 字段命中下表第几行；
2. 命中 `attachment`/`user`/`assistant` 的，再查各自的子规则；
3. 都不命中 → **未知类型**，走 AC3③ 保守保留＋留痕（原样带 `unknown: true` 标记整条收进底片，不摘要、不丢弃）。

## 顶层类型表

| `type` | 处置 | 理由 |
|---|---|---|
| `user`（非 `tool_result`） | **保留**，抽取其中的人类可读文本 | OC 的核心资产——「用户在会话里说过的话不再蒸发」。两种 JSON 结构都命中（见下）：`message.content` 是裸字符串，或是 `[{type:"text",...}]` 数组；`isMeta` 真假都保留，不做「是不是真人打字」的语义分类（那需要模式匹配 `<local-command-caveat>`/compact 续写前缀等文本特征，属语义判断，本表不做） |
| `user`（含 `tool_result`） | **摘要化**：留 `tool_use_id` + 成败 + 字节数，正文丢弃 | 「以 user 角色记录的工具返回」——AC3②明写的类目。正文常是文件全文/命令输出，体积大、且与对应的 `tool_use` 摘要重复了「做了什么」这层信息。**`content` 数组逐项独立处理，不是查到一个 `tool_result` 就整条早退**——D3 review 指出早退写法会吞掉理论上可能共存于同一条目的文本/图片，即便这种共存目前未在真实数据里观测到，也不该假设它不会发生 |
| `assistant`：`text` 内容项 | **保留**全文 | 模型说给用户听的话，下一场梦要读到「上次做了什么」离不开这个 |
| `assistant`：`thinking` 内容项 | **摘要化**：留一行「thinking block，N 字，已丢弃」的桩 | 内部推理草稿，体积常是全场最大头之一（实测单条 5356 字符），且内容基本是 text 内容项的前置草稿、信息冗余度高。丢弃正文但留桩——不是静默消失，留痕可审计 |
| `assistant`：`tool_use` 内容项 | **摘要化**：留工具名 + 关键参数（`file_path`/`command`/`pattern`/`prompt` 视工具而定，只取一两个最能定位「做了什么」的标量字段） | AC3④「动过的文件、跑过的命令」的落地点。完整参数体（如 Write 的全文 content、Edit 的 old/new_string）丢弃——那是"改成了什么"，不是"改过什么"，机械压缩不留 |
| `system` | **保留**：`subtype` + `level` + `content`（若短）；`compact_boundary` 额外留 `trigger`/`preTokens` | 多数是短警告/信息；`compact_boundary` 是结构性地标（本场发生过 `/compact`），注意点1 要求「跨 compact 底片完整性亲验一次」，这个地标就是验的锚点 |
| `attachment` | **摘要化**：留 `attachment.type` + 一组「安全标量字段」（若存在：`hookName`/`hookEvent`/`exitCode`/`command`/`filename`/`displayPath`/`style`/`mode`/`planFilePath`/`itemCount`），批量字段（`content`/`stdout`/`stderr`/`planContent`/`addedBlocks`/`addedLines`/技能正文等）一律丢弃 | 实测本机 15 种子类型（`hook_success`/`compact_file_reference`/`file`/`plan_file_reference`/`invoked_skills`/`deferred_tools_delta`/`agent_listing_delta`/`mcp_instructions_delta`/`skill_listing`/`output_style`/`todo_reminder`/`plan_mode_exit`/`plan_mode_reentry`/`plan_mode`/`queued_command`），无一例外是「harness 侧机制性记录」而非用户或模型的话——claude-code-log 自己的注释也把它定性为「not part of the user/assistant conversation」。用统一规则应对全体子类型，而不是为每个子类型单独写分支：新版本再冒出新子类型，默认规则照样安全 |
| `file-history-snapshot` | **摘要化**：留「N 个被跟踪文件」的计数桩 | AC3⑤明写的类目。纯 Claude Code 自己的文件备份簿记（`trackedFileBackups` 里是备份文件名/版本号/时间戳），不是任何人说的话 |
| `summary` | **保留**全文 | 官方 `/compact` 自己产出的浓缩摘要，本身已经是「压缩过的干货」，机械压缩不该在浓缩品上再动刀 |
| `queue-operation`：`operation:"remove"` | **保留**（steering 文本，用户在模型工作时插的话） | claude-code-log 原话：「out-of-band user inputs made visible to the agent for steering purposes」——是用户的话 |
| `queue-operation`：`operation` 为 `enqueue`/`dequeue`/`popAll` | **丢弃**（不留桩） | claude-code-log 原话：「内部记账操作，内容与真实用户消息重复」——丢了不损失信息，真内容已经在对应的 `user` 条目里。**只有这三个核实过的值走丢弃**，`operation` 出现任何其它值（含未来新增）走下一行的未知留痕，不是无差别丢弃所有非 `remove` 的值 |
| `ai-title` / `custom-title` / `agent-name` / `last-prompt` / `mode` / `permission-mode` | **保留**（原样，体积极小） | 会话级元数据，体积可忽略不计（实测均 <200 字节），没必要为了省这点体积去分类判断，直接留最安全 |
| 其它未列出的 `type`（未来新出现的顶层类型） | **未知类型：保守保留＋留痕**（AC3③），原样收整条 JSON，标 `unknown: true` | 逐字稿格式随官方发版漂移是既定事实（注意点3），静默丢弃等于在没人知道的情况下悄悄减少信任 |

## 内容项/子结构规则

- `ImageContent`（`type:"image"`，base64 图片数据）：出现在 `user`/`assistant` 的 content 数组里时，**摘要化**为 `[image, N bytes]`，二进制正文一律丢弃——体积单条常以 KB~MB 计，且当前梦引擎不具备读图能力，留着没有下游消费者。
- **`user`/`assistant` content 数组里未列举的子类型**（比如 Anthropic Messages API 真实存在的 `redacted_thinking`）：**未知子类型：保守保留＋留痕**，逻辑同顶层未知类型（原样带 `unknown: true` 的 JSON 块，同样受单条硬上限约束），但不改变该 entry 整体的 retain/stub/discard 分类——`compress.mjs` 的 `stats.subitemUnknownCount` 单独计数「至少混了一个未知子类型的 entry 数」，不会被"entry 整体算 retain"盖住看不见（D3 review 抓到的坑：改之前这类子项直接静默消失，且不进任何统计）。
- 子 agent 独立稿（`subagents/agent-*.jsonl`）：**本轮不处理**，已知盲区，随主稿一起在 SprintBacklog 注意点8 声明，不在本表覆盖范围内、不静默假装覆盖了。
- Bash 间接改动的文件：**本轮不处理**，同上已知盲区——AC3④明写「限指工具调用声明的」，不追踪 shell 内部实际发生的文件改动。

## 未知类型留痕格式

```json
{"unknown": true, "type": "<原始 type 值>", "raw": <整条原始 JSON 对象>}
```

不摘要、不截断，**除非超过单条硬上限 100KB**（`compress.mjs` 的 `UNKNOWN_RAW_CAP_BYTES`）——超限按字节截断，标注原始字节数与截断阈值，`unknown: true` 标记不受影响。未知的东西优先保真，比压缩率更重要，但保真不等于没有边界：AC4 的体积预算不该被单条离群的未知类型条目吃掉。
