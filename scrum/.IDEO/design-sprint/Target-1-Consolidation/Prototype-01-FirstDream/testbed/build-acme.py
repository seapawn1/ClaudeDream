#!/usr/bin/env python3
"""build-acme.py — 确定性生成 acme-api 虚构测试仓库。

运行后在本脚本同级目录下生成 acme-api/（若已存在先整体删除重建）：
- 一个独立 git 仓库（与外层仓库无关），7 个提交，时间线 2026-05-10 ~ 2026-07-30；
- Fastify 后端骨架（2026-07-12 完成 Express→Fastify 迁移，删除三个 Express 文件）；
- .claude/memory/ 记忆库：42 条记忆 + MEMORY.md 索引（故意漏登 1 条）；
- 种植 5 条腐烂记忆、1 处断链、1 处索引漂移、1 处 CLAUDE.md 过期点，
  对答案见同级 rot-manifest.md。

所有文件内容硬编码、所有提交日期固定 → 重跑结果一致（含 commit SHA）。
"""

import os
import shutil
import stat
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT / "acme-api"

GIT_BASE = [
    "git",
    "-c", "user.name=acme-dev",
    "-c", "user.email=dev@acme.test",
    "-c", "commit.gpgsign=false",
]


# ---------------------------------------------------------------- utilities

def run_git(args, date=None):
    """在 REPO 内运行 git，可选固定 author/committer 日期。"""
    env = os.environ.copy()
    if date is not None:
        env["GIT_AUTHOR_DATE"] = date
        env["GIT_COMMITTER_DATE"] = date
    result = subprocess.run(
        GIT_BASE + args,
        cwd=REPO,
        env=env,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        sys.stderr.write(f"git {' '.join(args)} failed:\n{result.stderr}\n")
        raise SystemExit(1)
    return result.stdout


def write(relpath, content):
    p = REPO / relpath
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8", newline="\n")


def remove(relpath):
    (REPO / relpath).unlink()


def _chmod_and_retry(func, path):
    Path(path).chmod(stat.S_IWRITE)
    func(path)


def rmtree_force(path):
    """Windows 兼容删除：.git 下的只读对象文件需要先去只读位。"""
    try:
        shutil.rmtree(path, onexc=lambda f, p, e: _chmod_and_retry(f, p))
    except TypeError:  # Python < 3.12 没有 onexc
        shutil.rmtree(path, onerror=lambda f, p, e: _chmod_and_retry(f, p))


def commit(message, date):
    run_git(["add", "-A"])
    run_git(["commit", "-q", "-m", message], date=date)


# ---------------------------------------------------------------- 文件模板
# ===== Express 时代（2026-05 ~ 2026-07-12 之前）=====

GITIGNORE = "node_modules/\n"

PKG_V1_EXPRESS = """{
  "name": "acme-api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "node src/server.js",
    "dev:legacy": "nodemon src/server.js",
    "build": "node --check src/server.js",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.19.2",
    "express-rate-limit": "^7.2.0",
    "ioredis": "^5.4.1",
    "jsonwebtoken": "^9.0.2"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "nodemon": "^3.1.0"
  }
}
"""

JEST_CONFIG = """module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.js'],
};
"""

SERVER_V1 = """const express = require('express');
const auth = require('./middleware/auth');
const rateLimit = require('./middleware/rateLimit');

const app = express();
app.use(express.json());
app.use(auth);
app.use(rateLimit);

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(process.env.PORT || 3000);
"""

SERVER_V2 = """const express = require('express');
const auth = require('./middleware/auth');
const rateLimit = require('./middleware/rateLimit');
const usersRouter = require('./routes/users');
const ordersRouter = require('./routes/orders');

const app = express();
app.use(express.json());
app.use(auth);
app.use(rateLimit);

app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/orders', ordersRouter);

app.listen(process.env.PORT || 3000);
"""

MIDDLEWARE_AUTH = """// Express JWT auth middleware (legacy)
const jwt = require('jsonwebtoken');

module.exports = function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.replace(/^Bearer /, '');
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: 'unauthorized' });
  }
};
"""

MIDDLEWARE_RATELIMIT = """// Express rate limit middleware (legacy)
const rateLimit = require('express-rate-limit');

module.exports = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  message: { error: 'rate limit exceeded' },
});
"""

USERS_ROUTE_EXPRESS = """const { Router } = require('express');
const router = Router();

router.get('/', (req, res) => {
  res.json({ users: [] });
});

router.get('/:id', (req, res) => {
  res.json({ id: req.params.id });
});

module.exports = router;
"""

ORDERS_ROUTE_EXPRESS = """const { Router } = require('express');
const router = Router();

router.get('/', (req, res) => {
  res.json({ orders: [] });
});

module.exports = router;
"""

REDIS_CONFIG_V1 = """// shared redis connection (used by rate limiting)
const Redis = require('ioredis');

module.exports = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 2,
});
"""

# ===== Fastify 时代（2026-07-12 迁移之后）=====

PKG_V2_FASTIFY = """{
  "name": "acme-api",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "dev": "pnpm exec node --watch src/app.js",
    "build": "pnpm exec node --check src/app.js",
    "test": "pnpm exec vitest run"
  },
  "dependencies": {
    "fastify": "^4.28.0",
    "@fastify/jwt": "^8.0.1",
    "@fastify/rate-limit": "^9.1.0",
    "ioredis": "^5.4.1"
  }
}
"""

PKG_V3_FINAL = """{
  "name": "acme-api",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "dev": "pnpm exec node --watch src/app.js",
    "build": "pnpm exec node --check src/app.js",
    "test": "pnpm exec vitest run"
  },
  "dependencies": {
    "fastify": "^4.28.0",
    "@fastify/jwt": "^8.0.1",
    "@fastify/rate-limit": "^9.1.0",
    "ioredis": "^5.4.1"
  },
  "devDependencies": {
    "vitest": "^1.6.0"
  }
}
"""

APP_JS = """import Fastify from 'fastify';
import authPlugin from './plugins/auth.js';
import rateLimitPlugin from './plugins/rate-limit.js';
import usersRoutes from './routes/users.js';
import ordersRoutes from './routes/orders.js';

export function buildApp() {
  const app = Fastify({ logger: true });

  // Plugin order matters: auth (JWT) registers BEFORE rate-limit,
  // so unauthenticated traffic is rejected before touching the redis quota.
  app.register(authPlugin);
  app.register(rateLimitPlugin);

  app.setErrorHandler((err, request, reply) => {
    request.log.error(err);
    reply.status(err.statusCode ?? 500).send({ error: err.message });
  });

  // /health is public: the auth hook skips it.
  app.get('/health', async () => ({ ok: true }));

  app.register(usersRoutes, { prefix: '/api/v1/users' });
  app.register(ordersRoutes, { prefix: '/api/v1/orders' });

  return app;
}

const app = buildApp();
app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' });
"""

PLUGIN_AUTH = """import jwt from '@fastify/jwt';

// JWT auth plugin. Registered FIRST in src/app.js so its onRequest hook
// runs before everything else. Tokens are short-lived (15 minutes).
export default async function authPlugin(app) {
  app.register(jwt, {
    secret: process.env.JWT_SECRET,
    sign: { expiresIn: '15m' },
  });

  app.addHook('onRequest', async (request, reply) => {
    if (request.routeOptions?.url === '/health') return; // public probe
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ error: 'unauthorized' });
    }
  });
}
"""

PLUGIN_RATE_LIMIT = """import rateLimit from '@fastify/rate-limit';
import { redis } from '../config/redis.js';

// Distributed rate limit backed by ioredis. Quota keys live under
// rl:quota:<userId>. Policy: 100 requests per user per minute, 429 on excess.
export default async function rateLimitPlugin(app) {
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    redis,
    keyGenerator: (request) => `rl:quota:${request.user?.sub ?? request.ip}`,
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too Many Requests',
    }),
  });
}
"""

REDIS_CONFIG_V2 = """import Redis from 'ioredis';

// REDIS_URL comes from the environment; local dev falls back to localhost.
export const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: 2,
  lazyConnect: true,
  enableAutoPipelining: true,
});
"""

USERS_ROUTE_FASTIFY = """// Users resource. One file per resource under src/routes/.
export default async function usersRoutes(app) {
  app.get(
    '/',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: { users: { type: 'array' } },
          },
        },
      },
    },
    async () => ({ users: [] })
  );

  app.get('/:id', async (request) => ({ id: request.params.id }));
}
"""

ORDERS_ROUTE_FASTIFY = """// Orders resource. List endpoint supports ?page and ?limit pagination.
export default async function ordersRoutes(app) {
  app.get('/', async (request) => {
    const page = Number(request.query.page ?? 1);
    const limit = Number(request.query.limit ?? 20);
    return { orders: [], page, limit };
  });
}
"""

VITEST_CONFIG = """import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.js'],
  },
});
"""

README = """# acme-api

Fastify backend for the Acme storefront.

## Setup

```bash
pnpm install
```

## Scripts

- `pnpm build` — syntax check
- `pnpm test` — run the vitest suite
- `pnpm dev` — dev server in watch mode

## Notes

Migrated from Express to Fastify on 2026-07-12. The old Express middleware
(`src/middleware/`) and entrypoint (`src/server.js`) were removed in that
migration; see git history.
"""

# 注意：CLAUDE.md 恰好 1 处过期——"npm run build"（现实已是 pnpm）。
CLAUDE_MD = """# acme-api

Fastify backend service for the Acme storefront. Node 20+, ESM only.

## Layout

- `src/app.js` — Fastify instance; registers auth plugin, then rate-limit, then routes
- `src/plugins/` — auth (@fastify/jwt), rate-limit (@fastify/rate-limit, ioredis store)
- `src/config/redis.js` — shared ioredis connection (REDIS_URL)
- `src/routes/` — one file per resource (users, orders), mounted under /api/v1

## Commands

- Install deps: `pnpm install`
- Build: `npm run build`
- Test: `pnpm test`

## Conventions

- Plugin registration order matters: auth before rate-limit.
- Commit messages use `type:` prefixes (feat:, refactor:, docs:, ...).
"""

# ---------------------------------------------------------------- 记忆库
# 42 条记忆，(文件名, type, description, 正文)。
# 种植：R1/R2 实体失效、R3/R4 重复、R5 矛盾对（use-jest × switch-to-vitest）、
# 断链宿主 fastify-migration-done、索引漏登 ioredis-lazy-connect。

MEMORIES = [
    # ---- 腐烂 R1：实体失效①（src/middleware/auth.js 已于 2026-07-12 删除）
    ("express-auth-middleware-notes.md", "project",
     "src/middleware/auth.js 的 Bearer 剥离与 401 行为",
     "src/middleware/auth.js 会剥掉 Authorization 头的 `Bearer ` 前缀再做 jwt.verify，"
     "校验失败统一返回 401 `{ error: 'unauthorized' }`。调试认证问题先看这个文件。"),
    # ---- 腐烂 R2：实体失效②（npm run dev:legacy 与 src/server.js 均已删除）
    ("legacy-dev-server.md", "project",
     "npm run dev:legacy 起旧版开发服务器",
     "本地起开发服务器用 `npm run dev:legacy`（nodemon 监听 src/server.js），"
     "比普通 `npm run dev` 多了自动重启。"),
    # ---- 腐烂 R3：重复①（与 rate-limiting-rules 记同一事实）
    ("api-rate-limit-policy.md", "project",
     "API 限流：每用户每分钟 100 请求",
     "API 限流策略：每个用户每分钟最多 100 个请求，超限返回 429。"),
    # ---- 腐烂 R4：重复②（与 api-rate-limit-policy 记同一事实，措辞不同）
    ("rate-limiting-rules.md", "project",
     "限流规则：窗口 1 分钟，上限 100，超限 429",
     "限流规则：按用户计数，窗口 1 分钟，上限 100 请求；"
     "触发后返回 429 Too Many Requests。"),
    # ---- 腐烂 R5a：矛盾（与 switch-to-vitest 冲突；两个 config 都在，机械无法定谳）
    ("use-jest-for-tests.md", "project",
     "本项目测试用 jest",
     "本项目测试框架用 jest，配置在 jest.config.cjs，测试文件放 test/ 下。"),
    # ---- 腐烂 R5b：矛盾另一方（feedback 类，永不自动删）
    ("switch-to-vitest.md", "feedback",
     "用户要求测试迁到 vitest",
     "用户说过：测试要迁到 vitest，以后新测试一律写 vitest，不要再用 jest。"
     "（2026-07 口头反馈）"),
    # ---- 连接候选组 1（三条互不链接，合推：限流顺序 × Redis 配额）
    ("jwt-auth-plugin.md", "project",
     "auth 插件注册在最前，路由默认要求 JWT",
     "auth 插件（src/plugins/auth.js，@fastify/jwt）注册在最前面，"
     "所有路由默认要求 JWT，只有 /health 例外。"),
    ("rate-limit-store.md", "project",
     "rate-limit 用 ioredis 做 store，配额键 rl:quota",
     "rate-limit 插件用 ioredis 做 store，配额键前缀 `rl:quota`。"
     "注意线上 Redis 用的是免费额度，容量和命令数都有限。"),
    ("plugin-order-matters.md", "project",
     "Fastify 插件注册顺序决定 hook 执行顺序",
     "Fastify 插件注册顺序决定 hook 的执行顺序：先注册的插件其 onRequest hook 先跑。"
     "改 src/app.js 里的 register 顺序要格外小心。"),
    # ---- 连接候选组 2（两条共享 REDIS_URL 实体，互不链接）
    ("deploy-env-vars.md", "project",
     "线上必配 REDIS_URL 与 JWT_SECRET",
     "线上部署必须配置 REDIS_URL 和 JWT_SECRET 两个环境变量，缺任何一个服务都起不来；"
     "部署 checklist 里这两项放最前。"),
    ("redis-connection-env.md", "project",
     "redis 连接串从 REDIS_URL 读",
     "src/config/redis.js 从 REDIS_URL 读连接串，本地不配置时回落 redis://localhost:6379。"),
    # ---- 断链宿主（健康记忆，但 [[express-migration-plan]] 不存在 → M1 命中）
    ("fastify-migration-done.md", "project",
     "2026-07-12 完成 Express→Fastify 迁移",
     "2026-07-12 完成 Express→Fastify 迁移，旧的 src/middleware/ 与 src/server.js 已删除"
     "（见当天 refactor 提交）。当时的迁移方案见 [[express-migration-plan]]。"),
    # ---- 其余健康 project 记忆
    ("app-entrypoint.md", "project",
     "入口 src/app.js 的 buildApp：先插件后路由",
     "服务入口是 src/app.js 的 buildApp()：先注册插件再挂路由，"
     "业务路由统一挂在 [[api-prefix]] 说的 /api/v1 下。"),
    ("api-prefix.md", "project",
     "业务路由挂 /api/v1 前缀",
     "所有业务路由挂在 /api/v1 前缀下（src/app.js 里 register 路由时传 prefix）。"),
    ("users-route-shape.md", "project",
     "users 路由的两个端点形状",
     "src/routes/users.js：GET / 返回 `{ users: [] }`，GET /:id 按 id 取单个用户。"),
    ("orders-route-shape.md", "project",
     "orders 列表返回 orders/page/limit",
     "src/routes/orders.js：GET / 返回 `{ orders, page, limit }`。"),
    ("pnpm-workflow.md", "project",
     "包管理统一走 pnpm",
     "包管理用 pnpm：`pnpm install` / `pnpm build` / `pnpm test`，不要混用 npm。"),
    ("redis-retry-config.md", "project",
     "ioredis 设 maxRetriesPerRequest: 2",
     "ioredis 连接设了 maxRetriesPerRequest: 2（src/config/redis.js），"
     "避免 Redis 挂掉时请求无限堆积。"),
    ("jwt-secret-env.md", "project",
     "JWT 密钥从 JWT_SECRET 环境变量读",
     "JWT 密钥从环境变量 JWT_SECRET 读，src/plugins/auth.js 注册 @fastify/jwt 时传入。"),
    ("error-handler-convention.md", "project",
     "统一错误处理在 setErrorHandler",
     "统一错误处理在 src/app.js 的 setErrorHandler：记日志后返回 `{ error: message }`，"
     "状态码优先用 err.statusCode。"),
    ("route-naming-style.md", "project",
     "一个资源一个路由文件",
     "路由文件一个资源一个文件，放 src/routes/ 下，导出默认的 async 插件函数。"),
    ("conventional-commits.md", "project",
     "提交信息用 type: 前缀",
     "提交信息用 type: 前缀（init: / feat: / refactor: / test: / docs: / chore:），"
     "与现有 git log 保持一致。"),
    ("node-version-engines.md", "project",
     "Node >= 20，ESM",
     "项目要求 Node >= 20（package.json 的 engines 字段），type: module，全部 ESM。"),
    ("health-route-no-auth.md", "project",
     "/health 公开，auth hook 放行",
     "GET /health 是公开探活端点，auth 插件的 onRequest hook 对它放行。"),
    # ---- 索引漂移：这条健康记忆在 MEMORY.md 里被漏登（M5 命中）
    ("ioredis-lazy-connect.md", "project",
     "redis 连接开了 lazyConnect",
     "redis 连接开了 lazyConnect: true（src/config/redis.js），"
     "进程启动不立刻连 Redis，第一次用到才连。"),
    ("jwt-expiry.md", "project",
     "JWT 有效期 15 分钟",
     "JWT 有效期 15 分钟（auth 插件 sign.expiresIn），过期要走刷新流程，"
     "参考 [[jwt-best-practices]]。"),
    ("orders-pagination.md", "project",
     "orders 分页参数 page/limit",
     "orders 列表接口用 ?page 和 ?limit 分页，默认 page=1、limit=20。"),
    ("users-schema-validation.md", "project",
     "users 响应走 Fastify schema 校验",
     "users 路由的响应用 Fastify schema 校验（response 200 定义了 users 数组），"
     "新路由照 [[route-naming-style]] 和这个模式写。"),
    ("logging-pino.md", "project",
     "日志用 Fastify 自带 pino",
     "日志用 Fastify 自带的 pino（src/app.js 里 logger: true），"
     "错误日志走 request.log.error。"),
    # ---- user 记忆（3 条）
    ("user-prefers-short-replies.md", "user",
     "用户偏好简短回复",
     "用户偏好简短回复：先给结论和代码，解释放后面。"),
    ("user-timezone-utc8.md", "user",
     "用户在 UTC+8，日期用 ISO",
     "用户在 UTC+8 时区工作，日期一律用 ISO 格式（YYYY-MM-DD）。"),
    ("user-review-before-apply.md", "user",
     "先看 diff 再落盘",
     "用户习惯先看 diff 再让改动落盘，大改动要先口头确认。"),
    # ---- feedback 记忆（除 switch-to-vitest 外 3 条）
    ("no-auto-push.md", "feedback",
     "永远不要主动 git push",
     "用户纠正过：永远不要主动 git push，推送前必须先问。"),
    ("surface-tradeoffs.md", "feedback",
     "引入新依赖前先摆取舍",
     "用户反馈：引入新依赖时要先摆出取舍（体积、维护状态、替代方案），不要直接装。"),
    ("prefer-small-commits.md", "feedback",
     "提交要小、要拆",
     "用户批评过 2026-07-12 那次迁移提交太大（删中间件 + 换依赖 + 改路由混在一起），"
     "以后拆成小提交，格式照 [[conventional-commits]]。"),
    # ---- reference 记忆（7 条）
    ("fastify-plugin-encapsulation.md", "reference",
     "Fastify 插件默认封装作用域",
     "Fastify 插件默认封装作用域：插件里注册的装饰器和 hook 不外泄，"
     "除非用 fastify-plugin 包一层。"),
    ("fastify-jwt-usage.md", "reference",
     "@fastify/jwt 的 jwtVerify / jwtSign",
     "@fastify/jwt 注册后提供 request.jwtVerify() 和 reply.jwtSign()，"
     "密钥经 secret 选项传入。"),
    ("fastify-rate-limit-options.md", "reference",
     "@fastify/rate-limit 常用选项",
     "@fastify/rate-limit 支持传 redis 实例做分布式 store，"
     "keyGenerator 自定义计数键，errorResponseBuilder 自定义 429 响应体。"),
    ("ioredis-reconnect-notes.md", "reference",
     "ioredis 重连与 maxRetriesPerRequest 语义",
     "ioredis 断线会自动重连；maxRetriesPerRequest 控制单条命令的重试次数，"
     "设小可以快速失败。"),
    ("pnpm-lockfile-notes.md", "reference",
     "pnpm 存储结构与 CI 安装",
     "pnpm 用内容寻址存储，node_modules 是符号链接结构；"
     "CI 里用 `pnpm install --frozen-lockfile`。"),
    ("jwt-best-practices.md", "reference",
     "JWT 最佳实践速记",
     "JWT 最佳实践：短有效期 + 刷新令牌；不要把敏感数据放 payload；"
     "HS256 密钥至少 32 字节。"),
    ("redis-eviction-policy.md", "reference",
     "Redis maxmemory-policy 参考",
     "Redis 内存满时的行为由 maxmemory-policy 决定；"
     "限流计数这类短 TTL 键适合 volatile-ttl。"),
]

# MEMORY.md 索引：41 行条目——故意漏登 ioredis-lazy-connect.md（M5 索引漂移）。
MEMORY_INDEX = """# Memory Index

- [Express auth 中间件笔记](express-auth-middleware-notes.md) — Bearer 剥离与 401 行为
- [旧版开发服务器](legacy-dev-server.md) — npm run dev:legacy 的用法
- [API 限流策略](api-rate-limit-policy.md) — 每用户每分钟 100 请求
- [限流规则](rate-limiting-rules.md) — 窗口 1 分钟，超限 429
- [测试用 jest](use-jest-for-tests.md) — 配置在 jest.config.cjs
- [测试迁 vitest](switch-to-vitest.md) — 用户要求新测试写 vitest
- [JWT auth 插件](jwt-auth-plugin.md) — 注册最前，路由默认要 JWT
- [rate-limit 的 Redis store](rate-limit-store.md) — 配额键 rl:quota，免费额度有限
- [插件顺序敏感](plugin-order-matters.md) — 注册顺序决定 hook 执行顺序
- [部署环境变量](deploy-env-vars.md) — REDIS_URL 与 JWT_SECRET 必配
- [Redis 连接串来源](redis-connection-env.md) — REDIS_URL，本地回落 localhost
- [Fastify 迁移已完成](fastify-migration-done.md) — 2026-07-12 删除 Express 中间件
- [服务入口](app-entrypoint.md) — buildApp 先插件后路由
- [API 前缀](api-prefix.md) — 业务路由挂 /api/v1
- [users 路由形状](users-route-shape.md) — GET / 与 GET /:id
- [orders 路由形状](orders-route-shape.md) — 返回 orders/page/limit
- [pnpm 工作流](pnpm-workflow.md) — install/build/test 都走 pnpm
- [Redis 重试配置](redis-retry-config.md) — maxRetriesPerRequest: 2
- [JWT 密钥来源](jwt-secret-env.md) — 环境变量 JWT_SECRET
- [统一错误处理](error-handler-convention.md) — setErrorHandler 返回 { error }
- [路由文件风格](route-naming-style.md) — 一个资源一个文件
- [提交信息风格](conventional-commits.md) — type: 前缀
- [Node 版本要求](node-version-engines.md) — Node >= 20，ESM
- [健康检查免认证](health-route-no-auth.md) — /health 公开放行
- [JWT 有效期](jwt-expiry.md) — 15 分钟过期
- [orders 分页](orders-pagination.md) — page/limit 默认 1/20
- [users 响应校验](users-schema-validation.md) — Fastify schema
- [pino 日志](logging-pino.md) — logger: true 与 request.log
- [回复要简短](user-prefers-short-replies.md) — 结论和代码优先
- [用户时区 UTC+8](user-timezone-utc8.md) — 日期用 ISO 格式
- [先看 diff 再落盘](user-review-before-apply.md) — 大改动先确认
- [不要主动 push](no-auto-push.md) — 推送前必须先问
- [新依赖先摆取舍](surface-tradeoffs.md) — 不要直接装
- [提交要小](prefer-small-commits.md) — 迁移大提交被批评过
- [Fastify 插件封装](fastify-plugin-encapsulation.md) — 默认作用域不外泄
- [@fastify/jwt 用法](fastify-jwt-usage.md) — jwtVerify 与 jwtSign
- [@fastify/rate-limit 选项](fastify-rate-limit-options.md) — redis store 与 keyGenerator
- [ioredis 重连笔记](ioredis-reconnect-notes.md) — maxRetriesPerRequest 语义
- [pnpm lockfile 笔记](pnpm-lockfile-notes.md) — frozen-lockfile 用于 CI
- [JWT 最佳实践](jwt-best-practices.md) — 短有效期加刷新
- [Redis 淘汰策略](redis-eviction-policy.md) — maxmemory-policy 参考
"""


def render_memory(filename, mtype, description, body):
    slug = filename[:-3]  # 去掉 .md
    return (
        "---\n"
        f"name: {slug}\n"
        f"description: {description}\n"
        "metadata:\n"
        f"  type: {mtype}\n"
        "---\n"
        "\n"
        f"{body}\n"
    )


# ---------------------------------------------------------------- 主流程

def main():
    if REPO.exists():
        rmtree_force(REPO)
    REPO.mkdir(parents=True)

    run_git(["init", "-q", "-b", "main"])
    run_git(["config", "core.autocrlf", "false"])

    # ---- C1  2026-05-10  init: Express 骨架 ------------------------------
    write(".gitignore", GITIGNORE)
    write("package.json", PKG_V1_EXPRESS)
    write("jest.config.cjs", JEST_CONFIG)
    write("src/server.js", SERVER_V1)
    write("src/middleware/auth.js", MIDDLEWARE_AUTH)
    write("src/middleware/rateLimit.js", MIDDLEWARE_RATELIMIT)
    commit("init: Express 骨架", "2026-05-10T10:00:00+08:00")

    # ---- C2  2026-05-24  feat: users/orders 路由 --------------------------
    write("src/routes/users.js", USERS_ROUTE_EXPRESS)
    write("src/routes/orders.js", ORDERS_ROUTE_EXPRESS)
    write("src/server.js", SERVER_V2)
    commit("feat: 添加 users/orders 路由", "2026-05-24T14:30:00+08:00")

    # ---- C3  2026-06-15  feat: redis 配置 ---------------------------------
    write("src/config/redis.js", REDIS_CONFIG_V1)
    commit("feat: 接入 redis 配置", "2026-06-15T09:15:00+08:00")

    # ---- C4  2026-07-12  refactor: 迁移 Fastify（删除 Express 中间件）------
    remove("src/middleware/auth.js")
    remove("src/middleware/rateLimit.js")
    remove("src/server.js")
    (REPO / "src" / "middleware").rmdir()
    write("package.json", PKG_V2_FASTIFY)
    write("src/app.js", APP_JS)
    write("src/plugins/auth.js", PLUGIN_AUTH)
    write("src/plugins/rate-limit.js", PLUGIN_RATE_LIMIT)
    write("src/config/redis.js", REDIS_CONFIG_V2)
    write("src/routes/users.js", USERS_ROUTE_FASTIFY)
    write("src/routes/orders.js", ORDERS_ROUTE_FASTIFY)
    commit("refactor: 迁移 Fastify——删除 Express 中间件",
           "2026-07-12T16:00:00+08:00")

    # ---- C5  2026-07-18  test: 引入 vitest --------------------------------
    write("vitest.config.js", VITEST_CONFIG)
    write("package.json", PKG_V3_FINAL)
    commit("test: 引入 vitest", "2026-07-18T11:00:00+08:00")

    # ---- C6  2026-07-25  docs: README 与 CLAUDE.md ------------------------
    write("README.md", README)
    write("CLAUDE.md", CLAUDE_MD)
    commit("docs: 添加 README 与 CLAUDE.md", "2026-07-25T15:45:00+08:00")

    # ---- C7  2026-07-30  chore: 记忆库入库 --------------------------------
    for filename, mtype, description, body in MEMORIES:
        write(f".claude/memory/{filename}",
              render_memory(filename, mtype, description, body))
    write(".claude/memory/MEMORY.md", MEMORY_INDEX)
    commit("chore: 记忆库入库", "2026-07-30T10:30:00+08:00")

    # ---- 汇报 --------------------------------------------------------------
    head = run_git(["rev-parse", "HEAD"]).strip()
    count = len(list((REPO / ".claude" / "memory").glob("*.md")))
    print(f"acme-api built at {REPO}")
    print(f"HEAD = {head}")
    print(f".claude/memory/ files (incl. MEMORY.md) = {count}")


if __name__ == "__main__":
    main()
