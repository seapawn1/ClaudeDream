---
name: target-a-decision
description: Target A (Loop 触发) 当前阶段退化为手动触发，自动 loop 延后
metadata: 
  node_type: memory
  type: project
  originSessionId: 455b3371-724a-4c88-826c-3691c3e76a64
  modified: 2026-07-18T08:22:24.885Z
---

Target A 原计划做 Loop 自动定时触发，经方案评审后决定延后。

**当前状态（2026-07-18）**：
- A 退化为纯手动触发：用户说 "run claudedream" 即可启动
- 自动定时（CronCreate / 锁文件 / Hook）留到正式落地再做
- **核心是 Target C（综合判定）**——A 和 B 都是为 C 铺路

**Why:** 自动 loop 的价值取决于流程本身的正确性。如果 C（综合判定）跑不通，A 做得再好也没用。所以先用手动触发走通核心流程。

**How to apply:** 任何时候涉及 Target A 的实现，优先保证手动入口通畅，不花时间在自动定时器上。
