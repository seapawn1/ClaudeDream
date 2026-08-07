---
name: connection-rate-limit-burns-redis-quota
description: 限流计数本身会消耗免费 Redis 的命令与内存额度，额度耗尽时限流会静默失效
metadata:
  type: connection
---

这条线连接 [[rate-limit-store]] 与 [[rate-limiting-rules]]（旁及 [[redis-eviction-policy]]）。

两端原文：
- rate-limit-store：「rate-limit 插件用 ioredis 做 store，配额键前缀 `rl:quota`。注意线上 Redis 用的是免费额度，容量和命令数都有限。」
- rate-limiting-rules：「按用户计数，窗口 1 分钟，每个用户最多 100 个请求；超限返回 429」。

合起来的结论（不在任何单条记忆里）：限流是逐请求路径——每个 API 请求都会对 Redis 发命令，也就是说**限流机制本身在高流量时会最先吃掉免费实例的命令数额度**；而当免费实例内存打满触发淘汰时（见 [[redis-eviction-policy]]，`rl:quota` 这类短 TTL 键正是 volatile-ttl 的优先淘汰对象），计数键被清掉等于配额重置，限流会静默放行超额流量。换言之：这套限流的可靠性上限由免费 Redis 额度决定，流量越大越接近失效，而失效方式是无声的。扩容或告警应以 Redis 额度为观测点。
