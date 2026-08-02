# ClaudeDream

ClaudeDream 是一个 Claude Code 插件，目标是升级 Claude Code 的记忆系统，使 agent 系统免于腐烂，与用户和项目保持同步。

## 这里是什么

一个 Claude Code 插件，聚焦 Claude Code 记忆机制的改进——让 agent 在长期对话和跨会话中保持上下文一致性，避免漂移与信息丢失。不做对话前端、不做模型推理、不碰 CLI 核心流程。

**当前处于设计与产物开发之间**：设计冲刺已完成（2026-08-02），方案定稿并在真实腐烂记忆库上跑通验证；产物代码尚未开工。要一次看懂设计结论，读 [.IDEO/DesignReview.md](.IDEO/DesignReview.md)。

## 文件地图

| 文件/目录 | 内容 |
|---|---|
| `README.md` | 本文件——项目地图与当前状态 |
| `CLAUDE.md` | 项目指令（每次新会话自动加载）：定位、历史分支、入口指引 |
| `.gitignore` | Git 忽略规则 |
| `.env` | 本地环境变量，不可阅读 |
| `seapawn.md` | 本地私人笔记，不可阅读 |
| `.claude/` | 本项目的 auto-memory 记忆库（`memory/` + `MEMORY.md` 索引）——本项目自身用，不是产物 |
| `.claude-plugin/` | `marketplace.json` — 插件分发骨架，指向 `./claude-dream`（产物代码待开工，目录暂不存在） |
| `.IDEO/` | 设计冲刺工作区，**已完成（2026-08-02）**——总入口 [DesignReview](.IDEO/DesignReview.md)，目录导航见 [README](.IDEO/README.md)。含定稿方案、可运行原型（`Prototype-01-FirstDream/engine/` `testbed/`）与三场真梦产物 |
| `reference/` | 方案类比参考资料 — auto-dream · auto-memory · claude-memory-compiler · claude-code-log · claude-mem · **claude-dream/**（AI 转化产物：claude-memory-compiler 改写为插件形态，无独立上游，只读不可信）— 详见 [reference/README](reference/README.md) |

## 当前状态

**2026-08-02：设计冲刺完成，Target-1（整合段）带条件通过，下一步产物开发。**

结论摘要：定稿方案的主干成立——体检判据（M1–M5 机械 + S1–S3 语义）、四级处置权限、三道安全阀、git 回滚层，在一个 42 条记忆的腐烂库上真跑通并经故障注入验证；兑现层三处待改——报告的证据形态、回滚的隔离性、机器推论的身份标识。完整结算见 [DesignReview](.IDEO/DesignReview.md)。

**产物开发的入场条件**：七条改造清单（[verdict.md](.IDEO/Target-1-Consolidation/Prototype-01-FirstDream/verdict.md) §3）+ S4 机械压缩底片层 + Agent SDK `canUseTool` 结构缴械。

### 里程碑

| 日期 | 事件 |
|---|---|
| 2026-07-29 | 项目重启——旧 Design Sprint 与 Scrum Sprint 1-6 产出作废（历史仍在 `sprint-01`~`sprint-05-eval-test-set--06`、`DesignSprint--跑通全流程` 等分支）；新一轮冲刺启动，Monday Define 拍板 |
| 2026-08-01 | Ask the Experts 四模块完成；HMW 40→21→8 条；Pick a Target 圈定 **长期用户 + S6–S8 整合段** |
| 2026-08-02 | Ideate（三场闪电演示 → 四派竞争草图 → wiki 主体杂交定稿）；Prototype 施工（腐烂库 builder + 梦引擎，三场真梦跑通）；Friday Test（真人十格 + 三个模拟用户人格）；三级 Review 落盘 |

*过程细节与每一次拍板的理由由 git 历史承载，不堆回本文件。*

