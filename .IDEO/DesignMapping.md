# DesignMapping — ClaudeDream

## 一、Goal

### Long-term Goal（~6 个月）

记忆永不腐烂——每个 agent 都拥有一套活的、随项目持续生长的记忆。

### Sprint Questions

1. 记忆系统真的能从一段对话中区分「值得记住的信息」和「噪音」？
2. 记忆系统真的能自我更新——对冲突覆盖、对过时淘汰、对冗余降级，而不只是追加？
3. 记忆系统真的能感知到旧记忆已被后续对话修正或推翻——而不是在新对话面前无动于衷？
4. 记忆系统真的能感知项目的变化并与项目保持同步，而不是渐渐变成一个与项目脱节的独立信息库？

## 二、Map

```mermaid
flowchart TB
    subgraph LEFT["👤 角色"]
        DEV["开发者\nClaude Code 用户"]
        AGENT["Claude Code Agent\n执行对话"]
        CD["ClaudeDream 插件\n记忆系统 · 批处理"]
    end

    subgraph RIGHT["🎯 终点"]
        GOAL["记忆永不腐烂\n每个 agent 拥有一套活的、\n随项目持续生长的记忆"]
    end

    subgraph ACCUM["📥 积累"]
        A1["开发者多次发起对话"] --> A2["每次对话产生信息\n决策 · 偏好 · 事实 · 约束 · 变更"]
        A2 --> A3["对话记录累积于 Claude Code 历史"]
    end

    subgraph TRIGGER["⏰ 触发"]
        T1["定时触发（如每日）\n或用户手动触发"]
        T2{{"⭐ ClaudeDream 启动\n读取：新对话 + 项目状态 + 现有记忆"}}
        T1 --> T2
    end

    subgraph REFINE["🔄 提炼与更新 · 核心"]
        R0(["三路输入并行处理"])
        R0 --> R0a["🅐 对话路径\n解析新对话 → 提取候选记忆"]
        R0 --> R0b["🅑 项目路径\n检测项目漂移 → 标记需复核记忆"]
        R0 --> R0c["🅒 现有记忆路径\n读取 MEMORY.md 作为比对基线"]
        R0a --> R2["候选记忆汇入"]
        R0b --> R2
        R0c --> R2
        R2 --> R3{{"⭐ 对比判定"}}
        R3 -->|"🆕 新信息"| R4a["创建记忆"]
        R3 -->|"⚡ 与已有冲突\n含项目漂移"| R4b["冲突解决\n覆盖 / 合并 / 保留两说"]
        R3 -->|"🗑️ 已有过时"| R4c["标记淘汰\n降级归档或删除"]
        R3 -->|"🔁 与已有重复"| R4d["去重合并\n不新增"]
        R4a --> R5(["写入 MEMORY.md\n及引用文件"])
        R4b --> R5
        R4c --> R5
        R4d --> R5
    end

    subgraph INJECT["📤 记忆注入"]
        I1["下次对话初始化"] --> I2["Claude Code 原生读取\nMEMORY.md 及引用文件"]
        I2 --> I3["Agent 带着准确记忆工作"]
    end

    ACCUM --> TRIGGER
    TRIGGER --> REFINE
    REFINE --> INJECT
    INJECT --> ACCUM
    INJECT --> RIGHT
```
