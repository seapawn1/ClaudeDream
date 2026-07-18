# ClaudeDream

一个 Claude Code 插件，升级 Claude Code 的记忆系统，使 agent 免于腐烂，与用户和项目保持同步。


# DiaryAgent

一个研究如何"自动写日记"的智能体项目，目的是让 Agent 每晚自动生成当天日记，方便日后回顾。

# 项目方法论：Scrum Sprint / IDEO design thinking

## 核心声明

- `.IDEO` 是项目**关键难点**的上游研究区，`ScrumSprint` 是**研究结论**的下游实现区。
- `Scrum` 阶段**遭遇难点**积极查阅 `.IDEO`，`IDEO` 阶段了解**产品背景**积极查阅 `ScrumSprint`。

## The Scrum Guide

> **The Definitive Guide to Scrum: The Rules of the Methodology**

### Scrum Definition

Scrum is a lightweight framework that helps people, teams and organizations generate value through adaptive solutions for complex problems.

In a nutshell, Scrum requires a Scrum Master to foster an environment where:

1. A Product Owner orders the work for a complex problem into a Product Backlog.
2. The Scrum Team turns a selection of the work into an Increment of value during a Sprint.
3. The Scrum Team and its stakeholders inspect the results and adjust for the next Sprint.
4. Repeat.

Scrum is simple. Try it as is and determine if its philosophy, theory, and structure help to achieve goals and create value. The Scrum framework is purposefully incomplete, only defining the parts required to implement Scrum theory. Scrum is built upon by the collective intelligence of the people using it. Rather than provide people with detailed instructions, the rules of Scrum guide their relationships and interactions.

Various processes, techniques and methods can be employed within the framework. Scrum wraps around existing practices or renders them unnecessary. Scrum makes visible the relative efficacy of current management, environment, and work techniques, so that improvements can be made.

## IDEO Guide

IDEO Design Thinking is an iterative, human-centered process for understanding users, challenging assumptions, reframing problems, and creating solutions through prototyping and testing.

# 项目资产索引

## 目录结构

| 目录 | 内容 |
|---|---|
| `.IDEO/DesignSprint/` | 设计 Sprint 完整闭环（Define → Prototype → Test → Review），含三 Target 方案、Map、Memory Compiler 原型 |
| `ScrumSprint/` | 当前开发 Sprint 工作空间 |
| `reference/agent-memory/` | 方案类比参考：auto-dream · auto-memory · claude-memory-compiler |

## 架构决策

**核心方案：Memory Compiler。** 以 claude-memory-compiler 的 compile → index → log 模型为主基座，融合 auto-dream 信任边界、auto-memory 排除清单、ClaudeDream 原创 git 漂移感知。

**三 Target：**
- **A（Loop 触发）** — 手动触发 `run claudedream`，自动定时延后
- **B（输入读取）** — 四路输入（项目状态感知 + 记忆基线 + 对话内容）→ 汇总给 C
- **C（综合判定）** — Memory Compiler：Gate → Extract → Cross-Reference → Classify → Output

**关键边界：** B 只取数据不判定，C 负责全部语义判断。确定性层（hash gate、lint）与语义层（Compile prompt）分离。

## 起点指引

新会话启动后：
1. 读 `ScrumSprint/README.md` 了解当前正在做什么
2. 读 `.IDEO/DesignSprint/DesignReview.md` 了解完整设计决策
3. 读 `README.md` 了解文件地图和当前状态

