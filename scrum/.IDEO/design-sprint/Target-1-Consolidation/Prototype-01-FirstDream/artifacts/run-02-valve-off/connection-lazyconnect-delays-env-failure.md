---
name: connection-lazyconnect-delays-env-failure
description: lazyConnect + REDIS_URL 回落使 Redis 配置错误不在启动时暴露，与部署清单"缺配起不来"的假设相悖
metadata:
  type: connection
---

这条线连接 [[deploy-env-vars]] 与 [[ioredis-lazy-connect]]（旁及 [[redis-connection-env]]）。

两端原文：
- deploy-env-vars：「线上部署必须配置 REDIS_URL 和 JWT_SECRET 两个环境变量，缺任何一个服务都起不来」。
- ioredis-lazy-connect：「redis 连接开了 lazyConnect: true（src/config/redis.js），进程启动不立刻连 Redis，第一次用到才连」。

合起来的结论（不在任何单条记忆里）：对 REDIS_URL 来说"缺了起不来"并不成立——src/config/redis.js 缺 REDIS_URL 时回落 `redis://localhost:6379`（见 [[redis-connection-env]]），加上 lazyConnect，进程会正常启动、健康检查照样通过，直到**第一个走限流的真实请求**才暴露 Redis 不可达。也就是说部署清单依赖的"fail-fast"假设只对 JWT_SECRET 成立（@fastify/jwt 注册时缺 secret 会抛），对 REDIS_URL 是 fail-late：一次看似成功的上线可能带着坏的 Redis 配置运行到首个请求才炸。部署验证不能只看进程起没起来，要打一个真实请求。
