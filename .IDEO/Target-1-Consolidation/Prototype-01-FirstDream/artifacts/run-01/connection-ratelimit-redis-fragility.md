---
name: connection-ratelimit-redis-fragility
description: 限流的正确性与可用性都押在一个免费额度的 Redis 单点上——各单条记忆都没说出这个合并结论
metadata:
  type: connection
---

三条记忆共享"限流依赖 Redis"这一实体，但互相没有链接，合起来揭示一个不在任何单条记忆里的风险结论：

1. [[rate-limit-store]] 原文："rate-limit 插件用 ioredis 做 store，配额键前缀 `rl:quota`。注意线上 Redis 用的是免费额度，容量和命令数都有限。"
2. [[redis-eviction-policy]] 原文："Redis 内存满时的行为由 maxmemory-policy 决定；限流计数这类短 TTL 键适合 volatile-ttl。"
3. [[redis-retry-config]] 原文："ioredis 连接设了 maxRetriesPerRequest: 2（src/config/redis.js），避免 Redis 挂掉时请求无限堆积。"

**合并结论（风险）**：
- **正确性风险**：免费额度 Redis 容量有限（记忆 1），一旦内存打满，若实例的 maxmemory-policy 不是 volatile-ttl 一类（记忆 2），`rl:quota` 计数键可能被提前淘汰——限流静默放水，[[api-rate-limit-policy]] 承诺的"每用户每分钟 100"就不再成立。
- **可用性风险**：maxRetriesPerRequest: 2 意味着 Redis 不可用时限流 store 会快速失败（记忆 3），此时请求是放行（fail-open）还是拒绝（fail-closed）？没有任何记忆记载这个行为，值得在 @fastify/rate-limit 配置里核实。
