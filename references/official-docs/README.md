# Anthropic 官方文档快照（记忆相关）

2026-11-07 抓取的官方文档页 markdown 版本，原样保存，不改写。四份都是产品/API 契约，不是教程；它们定义 ClaudeDream 要写入或对接的存储与接口。

| 文件 | 上游 | 页面日期 | 定义了什么 |
|---|---|---|---|
| `claude-code-memory.md` | https://code.claude.com/docs/en/memory | 2026-11-04 | Claude Code 的两套记忆：人写的 CLAUDE.md / AGENTS.md / `.claude/rules/` / `@path` imports，和 Claude 写的 auto memory（`~/.claude/projects/<project>/memory/`）。`MEMORY.md` 每会话只加载前 200 行或 25 KB，按主题的文件按需读；frontmatter 类型 user / feedback / project / reference，客户端加 ISO 8601 `modified` 时间戳；记忆文件不受 transcript 保留期清理影响。另有 CLAUDE.md 拼接顺序、4 MiB 跳过、4 跳 import 深度、外部 import 审批、按需加载文件的字符上限。 |
| `managed-agents-dreams.md` | https://platform.claude.com/docs/en/managed-agents/dreams | 未标注（research preview，2026-11-07 抓取） | Managed Agents 的 Dreams API：异步 job，输入一个现有 memory store + 1–100 个 session transcript，输出一个**新的** memory store；输入 store 永不修改，输出可审阅、可丢弃。状态 pending / running / completed / failed / canceled；支持 cancel、archive、list；错误分类；按标准 token 计费，约随输入 session 数线性增长；beta headers `dreaming-2026-04-21` + `managed-agents-2026-04-01`，版本 2026-10-21。`instructions` 只影响综合方向，不做逐行编辑。 |
| `managed-agents-memory.md` | https://platform.claude.com/docs/en/managed-agents/memory | 未标注（beta header `agent-memory-2026-07-22`，API 版本 2026-10-21） | Managed Agents 的 memory store：workspace 作用域的路径寻址文本文档，挂载在 session 沙箱的 `/mnt/memory/<slug>/`，可用普通文件工具读；只读或读写挂载；挂载说明注入 system prompt。硬限制：每个 memory 100 kB、每个 store 10,000 个 memory、每个 session 8 个 store；只在创建时挂载；每次修改产生不可变版本，保留 30 天；`content_sha256` 乐观并发；redaction、archiving；读写 store 有 prompt-injection 持久化风险。 |
| `memory-tool.md` | https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool | 未标注（2026-11-07 抓取） | API memory tool（`memory_20250818`）：客户端执行的文件操作工具，Claude 对 `/memories` 前缀发 view / create / str_replace / insert / delete / rename，应用自己映射到存储。目录列表两层深（排除隐藏项和 node_modules），文本 view 截 16,000 字符，单文件上限 999,999 行，六字符右对齐行号。系统提示注入 “ALWAYS VIEW YOUR MEMORY DIRECTORY BEFORE DOING ANYTHING ELSE” 和 “ASSUME INTERRUPTION”。实现方要处理路径穿越、敏感数据剥离、文件大小上限、记忆过期。 |

## 和 cookbook 的分工

- cookbook 演示**生产**：transcript → analyzer → organizer → memory store。
- 这四份文档定义**消费与底座**：agent 运行时怎么读回记忆（memory tool）、store 的硬限制与版本（managed-agents-memory）、dream 作为异步 job 的输入输出语义（managed-agents-dreams）、以及 Claude Code 原生记忆目录的加载契约（claude-code-memory）。
- ClaudeDream 最终写的是 Claude Code 原生 store，不是 API memory store；`claude-code-memory.md` 是唯一一份官方定义该 store 加载契约的文档，优先级最高。
