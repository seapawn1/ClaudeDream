# DesignMapping — ClaudeDream

## 一、Goal + Questions

### Long-term Goal（~6 个月）

Agent 永不腐烂——每个 agent 都拥有一套活的、随项目持续生长的记忆。

### Sprint Questions

1. 记忆系统真的能从一段对话中区分「值得记住的信息」和「噪音」？
2. 记忆系统真的能自我更新——对冲突覆盖、对过时淘汰、对冗余降级，而不只是追加？
3. 记忆累积多了以后，检索质量和每次提炼的成本真的不会崩？
4. 记忆系统真的能感知项目的变化并与项目保持同步，而不是渐渐变成一个与项目脱节的独立信息库？

## 二、Map

```mermaid
flowchart TB
    subgraph LEFT["👤 角色"]
        DEV["开发者\\nClaude Code 用户"]
        AGENT["Claude Code Agent\\n执行对话"]
        CD["ClaudeDream 插件\\n记忆系统 · 批处理"]
    end

    subgraph RIGHT["🎯 终点"]
        GOAL["Agent 永不腐烂\\n每个 agent 拥有一套活的、\\n随项目持续生长的记忆"]
    end

    subgraph ACCUM["📥 积累阶段"]
        A1["1. 开发者多次发起对话"] --> A2["2. 每次对话产生信息\\n决策 · 偏好 · 事实 · 约束 · 变更"]
        A2 --> A3["3. 对话记录累积\\n暂存于 Claude Code 历史中"]
    end

    subgraph TRIGGER["⏰ 触发点"]
        T1["定时触发（如每日）\\n或 · 用户手动触发"] --> T2["ClaudeDream 启动批处理\\n读取自上次处理后的新对话"]
    end

    subgraph REFINE["🔄 提炼与更新"]
        R1["4. 解析新对话\\n提取信息片段为候选记忆"] --> R2["5. 候选记忆入库\\n与已有记忆逐条比对"]
        R2 --> R3{"6. 对比判定"}
        R3 -->|"🆕 新信息"| R4a["创建记忆"]
        R3 -->|"⚡ 与已有冲突"| R4b["冲突解决\\n覆盖 / 合并 / 保留两说"]
        R3 -->|"🗑️ 已有记忆过时"| R4c["标记淘汰\\n降级归档或删除"]
        R3 -->|"🔁 与已有重复"| R4d["去重合并\\n不新增"]
        R4a --> R5["7. 记忆库写入更新"]
        R4b --> R5
        R4c --> R5
        R4d --> R5
    end

    subgraph INJECT["📤 记忆注入"]
        I1["8. 下次对话初始化"] --> I2["9. ClaudeDream 检索相关记忆"]
        I2 --> I3["10. 记忆注入 Claude Code 上下文"]
        I3 --> I4["11. Agent 带着准确记忆工作"]
    end

    subgraph SYNC["📁 项目同步流（同为批处理）"]
        P1["监听项目变更\\ngit · 文件 · README · 配置"] --> P2["与记忆库交叉比对"]
        P2 --> P3{"项目已变，记忆还旧？"}
        P3 -->|"是"| P4["标记记忆为需复核\\n触发更新/淘汰"]
        P3 -->|"否"| P5["确认记忆有效\\n不动作"]
        P4 --> R5
    end

    ACCUM --> TRIGGER
    TRIGGER --> REFINE
    REFINE --> INJECT
    INJECT --> ACCUM
    SYNC --> R5
    INJECT --> RIGHT
```

