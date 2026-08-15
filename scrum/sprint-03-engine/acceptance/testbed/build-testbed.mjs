#!/usr/bin/env node
/**
 * build-testbed.mjs — 确定性生成 Sprint-3 验收考场（五份夹具）与扩展对答案卡。
 *
 * 运行后在本脚本同级目录 out/ 下生成：
 * - acme-api/          主库：7 个固定提交（2026-05-10 ~ 2026-07-30），45 条记忆 +
 *                      MEMORY.md（44 行，含 1 幽灵行），种植 R1/R2 实体失效、
 *                      R3/R4 重复、R5 矛盾对、S1 断链+相对日期、S2 索引漏登，
 *                      另补种：M2 孤儿、M3 悬空溯源、M4 候选（查无讣告）、
 *                      M5 幽灵索引行、feedback 断链（switch-to-vitest）；
 * - breaker-yard/      熔断专用超阈值库：3 个提交，11 条记忆，5 个确凿死实体
 *                      （净消失 5 > 默认阈值 3）+ 1 隔离候选 + 1 索引漏登；
 * - healthy-garden/    零腐烂健康库：10 条记忆，全健康、索引完整、2 条合法链；
 * - small-pond/        小库：6 条记忆（<15，M2 禁用状态用例），全健康；
 * - g9-note-template.md  G9 留话页模板（只产模板不落位——时点约束见 TestPlan 站 5）。
 *
 * 同时生成：
 * - testbed/answer-key.md   扩展对答案卡（入库——判分基线一律以本卡为准，TestPlan §0）
 * - out/answer-key.json     同内容机器版，verify.mjs 判分消费
 *
 * 全部文件内容硬编码、提交日期固定 → 重跑结果一致（含 commit SHA）；
 * 重跑后 answer-key.md 若出现 git diff，即素材与卡不一致——当场算事故。
 * 素材方案层复用自设计冲刺 build-acme.py / rot-manifest.md，按 TestPlan 定案修正
 * （PO 定案：旧冲刺 Python 代码不直接搬用，builder 以 Node 重写）。
 */

import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync, existsSync, chmodSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, 'out')
const ANSWER_MD = join(HERE, 'answer-key.md')
const ANSWER_JSON = join(OUT, 'answer-key.json')

/** 清空目录内容但保留目录本身（Windows 只读位规避，抄 Sprint-2 build-testbed.mjs）。 */
function clearDirectory(target) {
  if (!existsSync(target)) {
    mkdirSync(target, { recursive: true })
    return
  }
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    const p = join(target, entry.name)
    if (entry.isDirectory()) {
      clearDirectory(p)
      rmSync(p, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    } else {
      try { chmodSync(p, 0o666) } catch { /* 尽力而为，真删不掉时下面会报错 */ }
      rmSync(p, { force: true, maxRetries: 5, retryDelay: 100 })
    }
  }
}

const GIT_BASE = [
  '-c', 'user.name=exam-dev',
  '-c', 'user.email=dev@exam.test',
  '-c', 'commit.gpgsign=false',
  '-c', 'core.autocrlf=false',
]

function git(repoDir, args, date) {
  const env = { ...process.env }
  if (date) {
    env.GIT_AUTHOR_DATE = date
    env.GIT_COMMITTER_DATE = date
  }
  return execFileSync('git', [...GIT_BASE, ...args], {
    cwd: repoDir, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function renderMemory(filename, mtype, description, body, extra = '') {
  const slug = filename.slice(0, -3) // 去掉 .md
  return `---
name: ${slug}
description: ${description}
metadata:
  type: ${mtype}
${extra}---

${body}
`
}

/** 考场阀门配置：只落不覆盖的两键——四键有意缺省（接口口径：环境变量只填补文件缺的键，
 *  填了才有「本次由环境变量覆盖」标注），verify.mjs 按场景用 env 填入并观察 H-A1 标注。 */
const VALVE_CONFIG = `---
enabled: true
claude_md_edits: true
---

考场阀门配置：只含不覆盖的两键。llm_checks/delete_policy/max_deletes/cooldown_minutes
四键有意缺省——由 verify.mjs 按场景用环境变量填入（连跑场冷却 0、站 4 对照场
max_deletes 999、H-D4 场 report-only、全场 llm_checks off）。
`

const GITIGNORE = `node_modules/
`

// ================================================================ 主库 acme-api
// 45 条记忆 = 42 条原型（3 条按定案修正）+ 3 条补种。判分基线见 answer-key.md。

const ACME_MEMORIES = [
  // ---- 腐烂 R1：实体失效①（src/middleware/auth.js 已于 C4 删除）→ M4 确凿 → 删除
  ['express-auth-middleware-notes.md', 'project',
    'src/middleware/auth.js 的 Bearer 剥离与 401 行为',
    'src/middleware/auth.js 会剥掉 Authorization 头的 `Bearer ` 前缀再做 jwt.verify，'
    + '校验失败统一返回 401 `{ error: \'unauthorized\' }`。调试认证问题先看这个文件。'],
  // ---- 腐烂 R2：实体失效②（npm run dev:legacy 与 src/server.js 均已删除）→ M4 确凿 → 删除
  ['legacy-dev-server.md', 'project',
    'npm run dev:legacy 起旧版开发服务器',
    '本地起开发服务器用 `npm run dev:legacy`（nodemon 监听 src/server.js），'
    + '比普通 `npm run dev` 多了自动重启。'],
  // ---- 腐烂 R3：重复①（PBI-07 本轮零动作）
  ['api-rate-limit-policy.md', 'project',
    'API 限流：每用户每分钟 100 请求',
    'API 限流策略：每个用户每分钟最多 100 个请求，超限返回 429。'],
  // ---- 腐烂 R4：重复②（PBI-07 本轮零动作）
  ['rate-limiting-rules.md', 'project',
    '限流规则：窗口 1 分钟，上限 100，超限 429',
    '限流规则：按用户计数，窗口 1 分钟，上限 100 请求；'
    + '触发后返回 429 Too Many Requests。'],
  // ---- 腐烂 R5a：矛盾甲方（PBI-07 本轮零动作）
  ['use-jest-for-tests.md', 'project',
    '本项目测试用 jest',
    '本项目测试框架用 jest，配置在 jest.config.cjs，测试文件放 test/ 下。'],
  // ---- 腐烂 R5b：矛盾乙方（feedback 类——补种断链后只进报告待裁决，连隔离都不许）
  ['switch-to-vitest.md', 'feedback',
    '用户要求测试迁到 vitest',
    '用户说过：测试要迁到 vitest，以后新测试一律写 vitest，不要再用 jest。'
    + '（2026-07 口头反馈）迁移清单见 [[vitest-migration-plan]]。'],
  // ---- 连接候选组 1（三条互不链接，合推：限流顺序 × Redis 配额；connection 属 PBI-07）
  ['jwt-auth-plugin.md', 'project',
    'auth 插件注册在最前，路由默认要求 JWT',
    'auth 插件（src/plugins/auth.js，@fastify/jwt）注册在最前面，'
    + '所有路由默认要求 JWT，只有 /health 例外。'],
  ['rate-limit-store.md', 'project',
    'rate-limit 用 ioredis 做 store，配额键 rl:quota',
    'rate-limit 插件用 ioredis 做 store，配额键前缀 `rl:quota`。'
    + '注意线上 Redis 用的是免费额度，容量和命令数都有限。'],
  ['plugin-order-matters.md', 'project',
    'Fastify 插件注册顺序决定 hook 执行顺序',
    'Fastify 插件注册顺序决定 hook 的执行顺序：先注册的插件其 onRequest hook 先跑。'
    + '改 src/app.js 里的 register 顺序要格外小心。'],
  // ---- 连接候选组 2（两条共享 REDIS_URL 实体，互不链接）
  ['deploy-env-vars.md', 'project',
    '线上必配 REDIS_URL 与 JWT_SECRET',
    '线上部署必须配置 REDIS_URL 和 JWT_SECRET 两个环境变量，缺任何一个服务都起不来；'
    + '部署 checklist 里这两项放最前。'],
  ['redis-connection-env.md', 'project',
    'redis 连接串从 REDIS_URL 读',
    'src/config/redis.js 从 REDIS_URL 读连接串，本地不配置时回落 redis://localhost:6379。'],
  // ---- 断链宿主（健康记忆；正文按定案修正：不提已删路径；补相对日期→连坐素材）
  ['fastify-migration-done.md', 'project',
    '2026-07-12 完成 Express→Fastify 迁移',
    'Express→Fastify 迁移已经完成（见当时的 refactor 提交）。迁移是上周的事，细节不再复述；'
    + '当时的迁移方案见 [[express-migration-plan]]。'],
  // ---- 其余健康 project 记忆
  ['app-entrypoint.md', 'project',
    '入口 src/app.js 的 buildApp：先插件后路由',
    '服务入口是 src/app.js 的 buildApp()：先注册插件再挂路由，'
    + '业务路由统一挂在 [[api-prefix]] 说的 /api/v1 下。'],
  ['api-prefix.md', 'project',
    '业务路由挂 /api/v1 前缀',
    '所有业务路由挂在 /api/v1 前缀下（src/app.js 里 register 路由时传 prefix）。'],
  ['users-route-shape.md', 'project',
    'users 路由的两个端点形状',
    'src/routes/users.js：GET / 返回 `{ users: [] }`，GET /:id 按 id 取单个用户。'],
  ['orders-route-shape.md', 'project',
    'orders 列表返回 orders/page/limit',
    'src/routes/orders.js：GET / 返回 `{ orders, page, limit }`。'],
  ['pnpm-workflow.md', 'project',
    '包管理统一走 pnpm',
    '包管理用 pnpm：`pnpm install` / `pnpm build` / `pnpm test`，不要混用 npm。'],
  ['redis-retry-config.md', 'project',
    'ioredis 设 maxRetriesPerRequest: 2',
    'ioredis 连接设了 maxRetriesPerRequest: 2（src/config/redis.js），'
    + '避免 Redis 挂掉时请求无限堆积。'],
  ['jwt-secret-env.md', 'project',
    'JWT 密钥从 JWT_SECRET 环境变量读',
    'JWT 密钥从环境变量 JWT_SECRET 读，src/plugins/auth.js 注册 @fastify/jwt 时传入。'],
  ['error-handler-convention.md', 'project',
    '统一错误处理在 setErrorHandler',
    '统一错误处理在 src/app.js 的 setErrorHandler：记日志后返回 `{ error: message }`，'
    + '状态码优先用 err.statusCode。'],
  ['route-naming-style.md', 'project',
    '一个资源一个路由文件',
    '路由文件一个资源一个文件，放 src/routes/ 下，导出默认的 async 插件函数。'],
  ['conventional-commits.md', 'project',
    '提交信息用 type: 前缀',
    '提交信息用 type: 前缀（init: / feat: / refactor: / test: / docs: / chore:），'
    + '与现有 git log 保持一致。'],
  ['node-version-engines.md', 'project',
    'Node >= 20，ESM',
    '项目要求 Node >= 20（package.json 的 engines 字段），type: module，全部 ESM。'],
  ['health-route-no-auth.md', 'project',
    '/health 公开，auth hook 放行',
    'GET /health 是公开探活端点，auth 插件的 onRequest hook 对它放行。'],
  // ---- 索引漏登（健康记忆；按定案修正：补一条合法出链，合法双链 4→5）
  ['ioredis-lazy-connect.md', 'project',
    'redis 连接开了 lazyConnect',
    'redis 连接开了 lazyConnect: true（src/config/redis.js），'
    + '进程启动不立刻连 Redis，第一次用到才连。连接串来源见 [[redis-connection-env]]。'],
  ['jwt-expiry.md', 'project',
    'JWT 有效期 15 分钟',
    'JWT 有效期 15 分钟（auth 插件 sign.expiresIn），过期要走刷新流程，'
    + '参考 [[jwt-best-practices]]。'],
  ['orders-pagination.md', 'project',
    'orders 分页参数 page/limit',
    'orders 列表接口用 ?page 和 ?limit 分页，默认 page=1、limit=20。'],
  ['users-schema-validation.md', 'project',
    'users 响应走 Fastify schema 校验',
    'users 路由的响应用 Fastify schema 校验（response 200 定义了 users 数组），'
    + '新路由照 [[route-naming-style]] 和这个模式写。'],
  ['logging-pino.md', 'project',
    '日志用 Fastify 自带 pino',
    '日志用 Fastify 自带的 pino（src/app.js 里 logger: true），'
    + '错误日志走 request.log.error。'],
  // ---- user 记忆（3 条）
  ['user-prefers-short-replies.md', 'user',
    '用户偏好简短回复',
    '用户偏好简短回复：先给结论和代码，解释放后面。'],
  ['user-timezone-utc8.md', 'user',
    '用户在 UTC+8，日期用 ISO',
    '用户在 UTC+8 时区工作，日期一律用 ISO 格式（YYYY-MM-DD）。'],
  ['user-review-before-apply.md', 'user',
    '先看 diff 再落盘',
    '用户习惯先看 diff 再让改动落盘，大改动要先口头确认。'],
  // ---- feedback 记忆（除 switch-to-vitest 外 3 条）
  ['no-auto-push.md', 'feedback',
    '永远不要主动 git push',
    '用户纠正过：永远不要主动 git push，推送前必须先问。'],
  ['surface-tradeoffs.md', 'feedback',
    '引入新依赖前先摆取舍',
    '用户反馈：引入新依赖时要先摆出取舍（体积、维护状态、替代方案），不要直接装。'],
  ['prefer-small-commits.md', 'feedback',
    '提交要小、要拆',
    '用户批评过 2026-07-12 那次迁移提交太大（删中间件 + 换依赖 + 改路由混在一起），'
    + '以后拆成小提交，格式照 [[conventional-commits]]。'],
  // ---- reference 记忆（7 条）
  ['fastify-plugin-encapsulation.md', 'reference',
    'Fastify 插件默认封装作用域',
    'Fastify 插件默认封装作用域：插件里注册的装饰器和 hook 不外泄，'
    + '除非用 fastify-plugin 包一层。'],
  ['fastify-jwt-usage.md', 'reference',
    '@fastify/jwt 的 jwtVerify / jwtSign',
    '@fastify/jwt 注册后提供 request.jwtVerify() 和 reply.jwtSign()，'
    + '密钥经 secret 选项传入。'],
  ['fastify-rate-limit-options.md', 'reference',
    '@fastify/rate-limit 常用选项',
    '@fastify/rate-limit 支持传 redis 实例做分布式 store，'
    + 'keyGenerator 自定义计数键，errorResponseBuilder 自定义 429 响应体。'],
  ['ioredis-reconnect-notes.md', 'reference',
    'ioredis 重连与 maxRetriesPerRequest 语义',
    'ioredis 断线会自动重连；maxRetriesPerRequest 控制单条命令的重试次数，'
    + '设小可以快速失败。'],
  ['pnpm-lockfile-notes.md', 'reference',
    'pnpm 存储结构与 CI 安装',
    'pnpm 用内容寻址存储，node_modules 是符号链接结构；'
    + 'CI 里用 `pnpm install --frozen-lockfile`。'],
  ['jwt-best-practices.md', 'reference',
    'JWT 最佳实践速记',
    'JWT 最佳实践：短有效期 + 刷新令牌；不要把敏感数据放 payload；'
    + 'HS256 密钥至少 32 字节。'],
  ['redis-eviction-policy.md', 'reference',
    'Redis maxmemory-policy 参考',
    'Redis 内存满时的行为由 maxmemory-policy 决定；'
    + '限流计数这类短 TTL 键适合 volatile-ttl。'],
  // ==================== 补种三文件（原型未种，超出原卡范围）====================
  // ---- M2 孤儿：无出链无入链 + 不入索引（有意不登 MEMORY.md）
  ['legacy-cron-jobs.md', 'project',
    '旧版 cron 任务清单',
    '旧版 cron 任务：每周一清理过期 token、每周五导库存报表。'
    + '现由外部调度平台接管，本仓库不再维护。'],
  // ---- M3 悬空溯源：frontmatter sources 指向 C3 入、C4 删的 docs/migration-notes.log
  ['migration-timeline-notes.md', 'project',
    '迁移时间线笔记（溯源见 frontmatter sources）',
    'Express→Fastify 迁移的时间线记录在 sources 指明的日志里，此处不重复。',
    'sources: docs/migration-notes.log\n'],
  // ---- M4 候选：引用查无讣告的路径（src/utils/cache-helper.js 从未入过 git）
  ['cache-helper-notes.md', 'project',
    '缓存工具 helper 的 TTL 默认值',
    '缓存工具封装在 src/utils/cache-helper.js，TTL 默认 300 秒；改默认值要同步改调用方。'],
]

// MEMORY.md 索引：41 行原型条目（漏登 ioredis-lazy-connect）+ 2 行补种文件 +
// 1 行幽灵索引（rollback-playbook.md 不存在）＝44 行。
// 有意不登 legacy-cron-jobs（孤儿 fixture 的一半特征）。
const ACME_MEMORY_INDEX = `# Memory Index

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
- [Fastify 迁移已完成](fastify-migration-done.md) — 2026-07-12 完成迁移
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
- [迁移时间线笔记](migration-timeline-notes.md) — 溯源见 frontmatter sources
- [缓存工具 helper](cache-helper-notes.md) — src/utils/cache-helper.js 的 TTL 默认值
- [部署回滚手册](rollback-playbook.md) — 线上事故回滚步骤
`

// ---- acme-api 代码文件（原样搬原型方案层）----------------------------------

const ACME_PKG_V1 = `{
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
`

const ACME_JEST_CONFIG = `module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.js'],
};
`

const ACME_SERVER_V1 = `const express = require('express');
const auth = require('./middleware/auth');
const rateLimit = require('./middleware/rateLimit');

const app = express();
app.use(express.json());
app.use(auth);
app.use(rateLimit);

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(process.env.PORT || 3000);
`

const ACME_SERVER_V2 = `const express = require('express');
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
`

const ACME_AUTH = `// Express JWT auth middleware (legacy)
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
`

const ACME_RATELIMIT = `// Express rate limit middleware (legacy)
const rateLimit = require('express-rate-limit');

module.exports = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  message: { error: 'rate limit exceeded' },
});
`

const ACME_USERS_EXPRESS = `const { Router } = require('express');
const router = Router();

router.get('/', (req, res) => {
  res.json({ users: [] });
});

router.get('/:id', (req, res) => {
  res.json({ id: req.params.id });
});

module.exports = router;
`

const ACME_ORDERS_EXPRESS = `const { Router } = require('express');
const router = Router();

router.get('/', (req, res) => {
  res.json({ orders: [] });
});

module.exports = router;
`

const ACME_REDIS_V1 = `// shared redis connection (used by rate limiting)
const Redis = require('ioredis');

module.exports = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 2,
});
`

const ACME_PKG_V2 = `{
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
`

const ACME_APP_JS = `import Fastify from 'fastify';
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
`

const ACME_PLUGIN_AUTH = `import jwt from '@fastify/jwt';

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
`

const ACME_PLUGIN_RATE_LIMIT = `import rateLimit from '@fastify/rate-limit';
import { redis } from '../config/redis.js';

// Distributed rate limit backed by ioredis. Quota keys live under
// rl:quota:<userId>. Policy: 100 requests per user per minute, 429 on excess.
export default async function rateLimitPlugin(app) {
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    redis,
    keyGenerator: (request) => \`rl:quota:\${request.user?.sub ?? request.ip}\`,
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too Many Requests',
    }),
  });
}
`

const ACME_REDIS_V2 = `import Redis from 'ioredis';

// REDIS_URL comes from the environment; local dev falls back to localhost.
export const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: 2,
  lazyConnect: true,
  enableAutoPipelining: true,
});
`

const ACME_USERS_FASTIFY = `// Users resource. One file per resource under src/routes/.
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
`

const ACME_ORDERS_FASTIFY = `// Orders resource. List endpoint supports ?page and ?limit pagination.
export default async function ordersRoutes(app) {
  app.get('/', async (request) => {
    const page = Number(request.query.page ?? 1);
    const limit = Number(request.query.limit ?? 20);
    return { orders: [], page, limit };
  });
}
`

const ACME_PKG_V3 = `{
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
`

const ACME_VITEST_CONFIG = `import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.js'],
  },
});
`

const ACME_README = `# acme-api

Fastify backend for the Acme storefront.

## Setup

\`\`\`bash
pnpm install
\`\`\`

## Scripts

- \`pnpm build\` — syntax check
- \`pnpm test\` — run the vitest suite
- \`pnpm dev\` — dev server in watch mode

## Notes

Migrated from Express to Fastify on 2026-07-12. The old Express middleware
(\`src/middleware/\`) and entrypoint (\`src/server.js\`) were removed in that
migration; see git history.
`

// 注意：CLAUDE.md 恰好 1 处过期——"npm run build"（现实已是 pnpm）。PBI-07 零动作。
const ACME_CLAUDE_MD = `# acme-api

Fastify backend service for the Acme storefront. Node 20+, ESM only.

## Layout

- \`src/app.js\` — Fastify instance; registers auth plugin, then rate-limit, then routes
- \`src/plugins/\` — auth (@fastify/jwt), rate-limit (@fastify/rate-limit, ioredis store)
- \`src/config/redis.js\` — shared ioredis connection (REDIS_URL)
- \`src/routes/\` — one file per resource (users, orders), mounted under /api/v1

## Commands

- Install deps: \`pnpm install\`
- Build: \`npm run build\`
- Test: \`pnpm test\`

## Conventions

- Plugin registration order matters: auth before rate-limit.
- Commit messages use \`type:\` prefixes (feat:, refactor:, docs:, ...).
`

// C3 入、C4 删——M3 悬空溯源的「已消失日志」。
const ACME_MIGRATION_LOG = `2026-06-15 migration assessment notes
- express dependencies inventory (see package.json v0.1.0)
- redis quota budget review
- candidate: fastify + @fastify/jwt + @fastify/rate-limit
`

// ================================================================ 熔断库 breaker-yard
// 11 条记忆：5 确凿死实体（C2 删除，净消失 5 > 阈值 3）+ 1 候选 + 1 漏登 + 4 健康。

const BREAKER_MEMORIES = [
  ['email-worker-notes.md', 'project',
    'src/workers/email-worker.js 的 SMTP 重试逻辑',
    '邮件任务在 src/workers/email-worker.js：SMTP 发送失败重试 3 次，退避 5 分钟。'],
  ['pdf-worker-notes.md', 'project',
    'src/workers/pdf-worker.js 的 PDF 渲染逻辑',
    'PDF 生成在 src/workers/pdf-worker.js：用 chromium headless 渲染，超时 30 秒。'],
  ['nightly-report-job.md', 'project',
    'src/jobs/nightly-report.js 的夜间报表任务',
    '夜间报表任务在 src/jobs/nightly-report.js：每天 02:00 跑，出昨日订单报表。'],
  ['legacy-format-utils.md', 'project',
    'src/utils/legacy-format.js 的旧格式工具',
    '旧格式转换工具在 src/utils/legacy-format.js：日期与金额的字符串格式化。'],
  ['session-middleware-notes.md', 'project',
    'src/middleware/session.js 的会话中间件',
    '会话中间件在 src/middleware/session.js：从 cookie 解析 session，过期 2 小时。'],
  ['cache-warmer-notes.md', 'project',
    'src/utils/cache-warmer.js 的预热任务',
    '缓存预热在 src/utils/cache-warmer.js：启动时预加载热数据，超时 10 秒。'],
  ['staging-env-vars.md', 'project',
    'staging 环境变量清单',
    'staging 部署需要 STAGING_REDIS_URL 与 STAGING_API_KEY 两个环境变量。'],
  ['app-structure.md', 'project',
    '仓库入口与脚本概览',
    '仓库以 package.json scripts 为入口；任务与中间件已移交外部调度。'],
  ['logging-notes.md', 'project',
    '日志规范',
    '日志统一走结构化输出，错误日志带 trace id。'],
  ['healthcheck-notes.md', 'project',
    '健康检查约定',
    '健康检查端点返回 { ok: true }。'],
  ['deploy-checklist.md', 'project',
    '部署 checklist',
    '部署前核对：环境变量齐全、外部调度任务正常、回滚预案就位。'],
]

// 10 行——故意漏登 staging-env-vars.md（H-G2 的「索引修复项不计入熔断」素材）。
const BREAKER_MEMORY_INDEX = `# Memory Index

- [邮件任务](email-worker-notes.md) — SMTP 重试逻辑
- [PDF 生成](pdf-worker-notes.md) — headless 渲染
- [夜间报表](nightly-report-job.md) — 每日 02:00
- [旧格式工具](legacy-format-utils.md) — 日期金额格式化
- [会话中间件](session-middleware-notes.md) — cookie session
- [缓存预热](cache-warmer-notes.md) — 启动预加载
- [仓库入口概览](app-structure.md) — scripts 为入口
- [日志规范](logging-notes.md) — 结构化输出
- [健康检查](healthcheck-notes.md) — ok:true
- [部署 checklist](deploy-checklist.md) — 上线前核对
`

const BREAKER_PKG = `{
  "name": "breaker-yard",
  "private": true,
  "version": "0.0.0"
}
`

const BREAKER_EMAIL = `// SMTP email worker (removed in C2)
export function sendMail() { /* smtp retry x3, backoff 5min */ }
`

const BREAKER_PDF = `// PDF render worker (removed in C2)
export function renderPdf() { /* chromium headless, timeout 30s */ }
`

const BREAKER_NIGHTLY = `// nightly report job (removed in C2)
export function nightlyReport() { /* runs 02:00 daily */ }
`

const BREAKER_LEGACY_FMT = `// legacy format utils (removed in C2)
export function fmtDate() {}
export function fmtMoney() {}
`

const BREAKER_SESSION = `// session middleware (removed in C2)
export function session() { /* cookie session, 2h expiry */ }
`

// ================================================================ 健康库 healthy-garden
// 10 条全健康记忆，索引完整，2 条合法链，零腐烂。

const GARDEN_MEMORIES = [
  ['app-structure.md', 'project',
    '入口 src/app.js 先插件后路由',
    '服务入口 src/app.js：先注册插件再挂路由。Redis 连接见 [[redis-config]]。'],
  ['redis-config.md', 'project',
    'src/config/redis.js 从 REDIS_URL 读连接串',
    'src/config/redis.js 从 REDIS_URL 读连接串，本地不配置时回落 redis://localhost:6379。'],
  ['users-route.md', 'project',
    'src/routes/users.js 的形状',
    'src/routes/users.js：GET / 返回 { users: [] }。路由挂载方式见 [[app-structure]]。'],
  ['pnpm-workflow.md', 'project',
    '包管理统一 pnpm',
    '包管理用 pnpm：pnpm install / pnpm build / pnpm test。'],
  ['node-version.md', 'project',
    'Node >= 20',
    '项目要求 Node >= 20，package.json 的 engines 字段已声明。'],
  ['logging-style.md', 'project',
    '日志用 pino',
    '日志用 pino（src/app.js 里 logger: true）。'],
  ['health-endpoint.md', 'project',
    'GET /health 公开',
    'GET /health 是公开探活端点。'],
  ['user-prefers-concise.md', 'user',
    '用户偏好先结论后解释',
    '用户偏好先给结论和代码，解释放后面。'],
  ['no-auto-push.md', 'feedback',
    '推送前必须先问',
    '用户纠正过：永远不要主动 git push，推送前必须先问。'],
  ['fastify-quick-ref.md', 'reference',
    'Fastify 常用形态速记',
    'Fastify 速记：app.register 插件、app.get 路由、schema 校验响应。'],
]

const GARDEN_MEMORY_INDEX = `# Memory Index

- [服务入口](app-structure.md) — 先插件后路由
- [Redis 连接](redis-config.md) — REDIS_URL
- [users 路由](users-route.md) — GET / 形状
- [pnpm 工作流](pnpm-workflow.md) — install/build/test
- [Node 版本](node-version.md) — >= 20
- [日志风格](logging-style.md) — pino
- [健康端点](health-endpoint.md) — /health 公开
- [回复要简洁](user-prefers-concise.md) — 先结论后解释
- [不要主动 push](no-auto-push.md) — 推送前先问
- [Fastify 速记](fastify-quick-ref.md) — register/get/schema
`

const GARDEN_PKG = `{
  "name": "healthy-garden",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "dev": "node --watch src/app.js",
    "build": "node --check src/app.js",
    "test": "node --test"
  }
}
`

const GARDEN_APP = `// entry: plugins first, then routes
import Fastify from 'fastify';

const app = Fastify({ logger: true });

app.get('/health', async () => ({ ok: true }));

app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' });
`

const GARDEN_REDIS = `// REDIS_URL from env; local dev falls back to localhost.
export const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
`

const GARDEN_USERS = `// users resource
export default async function usersRoutes(app) {
  app.get('/', async () => ({ users: [] }));
}
`

// ================================================================ 小库 small-pond
// 6 条全健康记忆（<15 → M2 禁用状态用例），索引完整，零腐烂。

const POND_MEMORIES = [
  ['app-notes.md', 'project',
    '入口 src/app.js',
    '服务入口是 src/app.js。'],
  ['build-notes.md', 'project',
    '构建走 pnpm build',
    '构建走 pnpm build。'],
  ['deploy-notes.md', 'project',
    '部署读 PORT',
    '部署时用 PORT 环境变量指定监听端口。'],
  ['user-timezone.md', 'user',
    '用户 UTC+8',
    '用户在 UTC+8 时区。'],
  ['no-auto-push.md', 'feedback',
    '推送前先问',
    '用户纠正过：永远不要主动 git push。'],
  ['fastify-quick-ref.md', 'reference',
    'Fastify 速记',
    'Fastify 速记：app.register 插件、app.get 路由。'],
]

const POND_MEMORY_INDEX = `# Memory Index

- [服务入口](app-notes.md) — src/app.js
- [构建命令](build-notes.md) — pnpm build
- [部署端口](deploy-notes.md) — PORT 环境变量
- [用户时区](user-timezone.md) — UTC+8
- [不要主动 push](no-auto-push.md) — 推送前先问
- [Fastify 速记](fastify-quick-ref.md) — register/get
`

const POND_PKG = `{
  "name": "small-pond",
  "private": true,
  "version": "0.0.0",
  "scripts": {
    "dev": "node src/app.js",
    "build": "node --check src/app.js"
  }
}
`

const POND_APP = `const port = process.env.PORT || 3000;
console.log('small-pond listening on ' + port);
`

// ================================================================ G9 留话页模板
// 只产模板不落位：上游梦跑完后由 verify.mjs（自动线）或 PO（手工线）放置——
// 早放会被正确实现漏检（02.6-AC1 检索窗口是「上次梦 runId 之后」）。
// slug 指向主库梦一场的隔离对象 cache-helper-notes。
const G9_NOTE_TEMPLATE = `### User

我复查了上一场梦隔离区的 [[cache-helper-notes]]：它提到的 src/utils/cache-helper.js
我印象里确实存在过，请机械层再核一遍 git 史，别误删。
`

// ================================================================ 夹具构建计划
// 每个 commit：{ message, date, add: {relpath: content}, rm: [relpath] }

const FIXTURES = {
  'acme-api': [
    {
      message: 'init: Express 骨架', date: '2026-05-10T10:00:00+08:00',
      add: {
        '.gitignore': GITIGNORE,
        'package.json': ACME_PKG_V1,
        'jest.config.cjs': ACME_JEST_CONFIG,
        'src/server.js': ACME_SERVER_V1,
        'src/middleware/auth.js': ACME_AUTH,
        'src/middleware/rateLimit.js': ACME_RATELIMIT,
      },
    },
    {
      message: 'feat: 添加 users/orders 路由', date: '2026-05-24T14:30:00+08:00',
      add: {
        'src/routes/users.js': ACME_USERS_EXPRESS,
        'src/routes/orders.js': ACME_ORDERS_EXPRESS,
        'src/server.js': ACME_SERVER_V2,
      },
    },
    {
      message: 'feat: 接入 redis 配置', date: '2026-06-15T09:15:00+08:00',
      add: {
        'src/config/redis.js': ACME_REDIS_V1,
        'docs/migration-notes.log': ACME_MIGRATION_LOG,
      },
    },
    {
      message: 'refactor: 迁移 Fastify——删除 Express 中间件', date: '2026-07-12T16:00:00+08:00',
      rm: ['src/middleware/auth.js', 'src/middleware/rateLimit.js', 'src/server.js', 'docs/migration-notes.log'],
      add: {
        'package.json': ACME_PKG_V2,
        'src/app.js': ACME_APP_JS,
        'src/plugins/auth.js': ACME_PLUGIN_AUTH,
        'src/plugins/rate-limit.js': ACME_PLUGIN_RATE_LIMIT,
        'src/config/redis.js': ACME_REDIS_V2,
        'src/routes/users.js': ACME_USERS_FASTIFY,
        'src/routes/orders.js': ACME_ORDERS_FASTIFY,
      },
    },
    {
      message: 'test: 引入 vitest', date: '2026-07-18T11:00:00+08:00',
      add: {
        'vitest.config.js': ACME_VITEST_CONFIG,
        'package.json': ACME_PKG_V3,
      },
    },
    {
      message: 'docs: 添加 README 与 CLAUDE.md', date: '2026-07-25T15:45:00+08:00',
      add: {
        'README.md': ACME_README,
        'CLAUDE.md': ACME_CLAUDE_MD,
      },
    },
    {
      message: 'chore: 记忆库入库', date: '2026-07-30T10:30:00+08:00',
      add: {
        '.claude/claude-dream.local.md': VALVE_CONFIG,
        '.claude/memory/MEMORY.md': ACME_MEMORY_INDEX,
        ...Object.fromEntries(ACME_MEMORIES.map(([f, t, d, b, x]) =>
          [`.claude/memory/${f}`, renderMemory(f, t, d, b, x)])),
      },
    },
  ],

  'breaker-yard': [
    {
      message: 'init: 任务骨架', date: '2026-08-01T09:00:00+08:00',
      add: {
        '.gitignore': GITIGNORE,
        'package.json': BREAKER_PKG,
        'src/workers/email-worker.js': BREAKER_EMAIL,
        'src/workers/pdf-worker.js': BREAKER_PDF,
        'src/jobs/nightly-report.js': BREAKER_NIGHTLY,
        'src/utils/legacy-format.js': BREAKER_LEGACY_FMT,
        'src/middleware/session.js': BREAKER_SESSION,
      },
    },
    {
      message: 'refactor: 移除旧任务与中间件——换外部调度', date: '2026-08-06T15:00:00+08:00',
      rm: ['src/workers/email-worker.js', 'src/workers/pdf-worker.js',
        'src/jobs/nightly-report.js', 'src/utils/legacy-format.js', 'src/middleware/session.js'],
    },
    {
      message: 'chore: 记忆库入库', date: '2026-08-10T11:00:00+08:00',
      add: {
        '.claude/claude-dream.local.md': VALVE_CONFIG,
        '.claude/memory/MEMORY.md': BREAKER_MEMORY_INDEX,
        ...Object.fromEntries(BREAKER_MEMORIES.map(([f, t, d, b]) =>
          [`.claude/memory/${f}`, renderMemory(f, t, d, b)])),
      },
    },
  ],

  'healthy-garden': [
    {
      message: 'init: 服务骨架', date: '2026-07-15T10:00:00+08:00',
      add: {
        '.gitignore': GITIGNORE,
        'package.json': GARDEN_PKG,
        'src/app.js': GARDEN_APP,
        'src/config/redis.js': GARDEN_REDIS,
        'src/routes/users.js': GARDEN_USERS,
      },
    },
    {
      message: 'chore: 记忆库入库', date: '2026-07-20T10:00:00+08:00',
      add: {
        '.claude/claude-dream.local.md': VALVE_CONFIG,
        '.claude/memory/MEMORY.md': GARDEN_MEMORY_INDEX,
        ...Object.fromEntries(GARDEN_MEMORIES.map(([f, t, d, b]) =>
          [`.claude/memory/${f}`, renderMemory(f, t, d, b)])),
      },
    },
  ],

  'small-pond': [
    {
      message: 'init: 最小服务', date: '2026-07-21T10:00:00+08:00',
      add: {
        '.gitignore': GITIGNORE,
        'package.json': POND_PKG,
        'src/app.js': POND_APP,
      },
    },
    {
      message: 'chore: 记忆库入库', date: '2026-07-22T10:00:00+08:00',
      add: {
        '.claude/claude-dream.local.md': VALVE_CONFIG,
        '.claude/memory/MEMORY.md': POND_MEMORY_INDEX,
        ...Object.fromEntries(POND_MEMORIES.map(([f, t, d, b]) =>
          [`.claude/memory/${f}`, renderMemory(f, t, d, b)])),
      },
    },
  ],
}

// ================================================================ 对答案卡数据（单一事实源）
// 判分基线：verify.mjs 读 out/answer-key.json，人工看 testbed/answer-key.md。

const ANSWER_KEY_DATA = {
  generatedBy: 'build-testbed.mjs（重跑确定性——素材改动的唯一入口是本脚本）',
  fixtures: {
    'acme-api': {
      memoryFileCount: ACME_MEMORIES.length,
      indexLineCount: ACME_MEMORY_INDEX.trim().split('\n').length - 1,
      m1BrokenLinks: [
        { file: 'fastify-migration-done.md', target: 'express-migration-plan', disposition: 'L0 去链修复（去链或标注失效，实现自定），四要素入报告' },
        { file: 'switch-to-vitest.md', target: 'vitest-migration-plan', disposition: 'feedback 保护：不修复、不隔离、不删除——只进报告「待你裁决」节（H-E1/E2）' },
      ],
      m2Orphans: [
        { file: 'legacy-cron-jobs.md', disposition: '检出（H-B2）；不入索引+零链接；不得删除；预期隔离（reason M2-orphan，接口枚举已声明）' },
      ],
      m3DanglingSources: [
        { file: 'migration-timeline-notes.md', sources: 'docs/migration-notes.log', disposition: '检出（H-B3）；C3 入 C4 删有讣告；不得删除；预期隔离（reason M3-dangling-source）' },
      ],
      m4Confirmed: [
        { file: 'express-auth-middleware-notes.md', refs: ['src/middleware/auth.js'], obituary: 'C4 2026-07-12', disposition: '确凿删除 + 报告内联死者遗言（H-D2/H-H5）' },
        { file: 'legacy-dev-server.md', refs: ['npm run dev:legacy', 'src/server.js'], obituary: 'C4 2026-07-12', disposition: '确凿删除 + 报告内联死者遗言（H-D2/H-H5）' },
      ],
      m4Candidates: [
        { file: 'cache-helper-notes.md', refs: ['src/utils/cache-helper.js'], disposition: '候选不删（H-D3）；quarantine-first 下隔离标记 status: quarantined + 原因 + 起始信息，去标记即还原（H-F1）；G9 模板 slug 目标' },
      ],
      m5MissingFromIndex: [
        { file: 'ioredis-lazy-connect.md', disposition: 'L0 补索引行（H-D1）；含合法出链，健康记忆' },
        { file: 'legacy-cron-jobs.md', disposition: '亦在差集内（有意不入索引）——是否补行由实现自定，两种都不判错；不得删除' },
      ],
      m5GhostLines: [
        { line: 'rollback-playbook.md', disposition: 'L0 删幽灵行（H-D1）' },
      ],
      legalLinks: [
        { from: 'app-entrypoint.md', to: 'api-prefix.md' },
        { from: 'jwt-expiry.md', to: 'jwt-best-practices.md' },
        { from: 'prefer-small-commits.md', to: 'conventional-commits.md' },
        { from: 'users-schema-validation.md', to: 'route-naming-style.md' },
        { from: 'ioredis-lazy-connect.md', to: 'redis-connection-env.md' },
      ],
      l0RelativeDate: {
        file: 'fastify-migration-done.md',
        phrase: '迁移是上周的事',
        disposition: 'L0 相对日期转绝对（H-D1）；转换锚点由实现自定，本卷判「动作发生 + 四要素 + 连坐标注」，不判转换结果的具体日期',
      },
      l0SameFileCoalesce: {
        file: 'fastify-migration-done.md',
        actions: ['去链（M1 修复）', '相对日期转绝对（L0）'],
        disposition: '两笔同文件连坐——回滚提示须显式标注「影响其他 N 笔」（H-H2）',
      },
      zeroFalsePositiveBaseline: [
        // 36 条健康 + R3/R4 + R5 对 = 40 条：不得删除、不得隔离；
        // 其中 fastify-migration-done 允许 L0 两笔、switch-to-vitest 允许待裁决报告行（见上方各表）。
        'api-rate-limit-policy.md', 'rate-limiting-rules.md', 'use-jest-for-tests.md', 'switch-to-vitest.md',
        'jwt-auth-plugin.md', 'rate-limit-store.md', 'plugin-order-matters.md',
        'deploy-env-vars.md', 'redis-connection-env.md', 'fastify-migration-done.md',
        'app-entrypoint.md', 'api-prefix.md', 'users-route-shape.md', 'orders-route-shape.md',
        'pnpm-workflow.md', 'redis-retry-config.md', 'jwt-secret-env.md', 'error-handler-convention.md',
        'route-naming-style.md', 'conventional-commits.md', 'node-version-engines.md', 'health-route-no-auth.md',
        'ioredis-lazy-connect.md', 'jwt-expiry.md', 'orders-pagination.md', 'users-schema-validation.md',
        'logging-pino.md', 'user-prefers-short-replies.md', 'user-timezone-utc8.md', 'user-review-before-apply.md',
        'no-auto-push.md', 'surface-tradeoffs.md', 'prefer-small-commits.md',
        'fastify-plugin-encapsulation.md', 'fastify-jwt-usage.md', 'fastify-rate-limit-options.md',
        'ioredis-reconnect-notes.md', 'pnpm-lockfile-notes.md', 'jwt-best-practices.md', 'redis-eviction-policy.md',
      ],
      breakerArithmetic: {
        inventory: 45, pct10: 4.5, pct10Floor: 4, threshold: 4,
        note: '确凿删除 2 ≤ 4 不触发熔断（接口口径 threshold = max(max_deletes, floor(库存×10%))；TestPlan H-D2 括注以本卡为准）',
      },
      claudeMdStale: {
        file: 'CLAUDE.md',
        stale: ['npm run build（现实已是 pnpm）'],
        disposition: 'PBI-07 零动作；本轮 dream 提交不得含 CLAUDE.md 变更（H-H7 被证实的空真）',
      },
      pbi07NoAction: {
        files: ['api-rate-limit-policy.md', 'rate-limiting-rules.md', 'use-jest-for-tests.md', 'switch-to-vitest.md'],
        disposition: 'R3/R4 重复、R5 矛盾对——PBI-07 本轮零动作：不得删除、不得隔离、不得合并（switch-to-vitest 的断链走待裁决，见 m1BrokenLinks）',
      },
      configDefaults: {
        file: '.claude/claude-dream.local.md',
        keys: { enabled: true, claude_md_edits: true },
        note: 'llm_checks/delete_policy/max_deletes/cooldown_minutes 四键有意缺省——环境变量只填补文件缺的键，env 填入即「本次由环境变量覆盖」标注（H-A1）；考场连跑 env 冷却 0、全场 env llm_checks off、站 4 对照场 env max_deletes 999、H-D4 场 env delete_policy report-only',
      },
    },

    'breaker-yard': {
      memoryFileCount: BREAKER_MEMORIES.length,
      indexLineCount: BREAKER_MEMORY_INDEX.trim().split('\n').length - 1,
      m4Confirmed: [
        { file: 'email-worker-notes.md', refs: ['src/workers/email-worker.js'], obituary: 'C2 2026-08-06' },
        { file: 'pdf-worker-notes.md', refs: ['src/workers/pdf-worker.js'], obituary: 'C2 2026-08-06' },
        { file: 'nightly-report-job.md', refs: ['src/jobs/nightly-report.js'], obituary: 'C2 2026-08-06' },
        { file: 'legacy-format-utils.md', refs: ['src/utils/legacy-format.js'], obituary: 'C2 2026-08-06' },
        { file: 'session-middleware-notes.md', refs: ['src/middleware/session.js'], obituary: 'C2 2026-08-06' },
      ],
      m4Candidates: [
        { file: 'cache-warmer-notes.md', refs: ['src/utils/cache-warmer.js'], disposition: '候选不删，隔离（不计入熔断计数——隔离标记不计入）' },
      ],
      m5MissingFromIndex: [
        { file: 'staging-env-vars.md', disposition: 'L0 补索引行——纯索引行修复不计入熔断计数（H-G2 口径）' },
      ],
      breakerArithmetic: {
        inventory: 11, pct10: 1.1, threshold: 3,
        netLoss: 5,
        controlRun: '对照场 max_deletes: 999：5 个确凿实体真实被删（净消失 5 > 3）——证明夹具杀伤力（H-G3）；候选隔离、漏登补行照常',
        formalRun: '正式场默认阈值：在线熔断于首个超阈值点中止——明细删除 4 笔（第 4 笔触发 4 > 3，第 5 笔未及执行）；判法：报告净消失数 == 明细删除笔数（预期 4），隔离/索引修复不计入；报告写明原因/真实净消失数/回滚清单（H-G1/G2）；冷却照常起算在 CLI 直跑路径不可观察（H-G4 附发现，PO 裁）',
      },
    },

    'healthy-garden': {
      memoryFileCount: GARDEN_MEMORIES.length,
      indexLineCount: GARDEN_MEMORY_INDEX.trim().split('\n').length - 1,
      expected: '体检零检出（或仅报告项）——H-C1；2 条合法链（app-structure→redis-config、users-route→app-structure）不得报断链',
    },

    'small-pond': {
      memoryFileCount: POND_MEMORIES.length,
      indexLineCount: POND_MEMORY_INDEX.trim().split('\n').length - 1,
      expected: '库存 6 < 15 → 报告可见 M2 禁用标注（H-C2）；库本身零腐烂',
    },
  },

  g9Template: {
    file: 'out/g9-note-template.md',
    marker: '### User',
    slug: 'cache-helper-notes',
    placement: '上游梦跑完后由 verify.mjs（自动线）或 PO（手工线）放置到底片目录，并同步 ledger.json（file 字段为文件名，按 sessionId 分组）——早放会被正确实现漏检（02.6-AC1 检索窗口 = 上次梦 runId 之后）；页文件名须带 --<runId 段>（接口：页时间戳取文件名 -- 后段）',
    expected: '下一场梦报告收录原话 + 出处页指针（H-I1）；台账 basename + 原话保留 + ### User 标记三点契约成立即检索成功（H-I2）',
  },
}

// ================================================================ 主流程

/** 建一个夹具仓库：清空 → init → 按提交计划写文件/删文件/提交，返回时间线 SHA。 */
function buildFixture(name, plan) {
  const dir = join(OUT, name)
  clearDirectory(dir)
  mkdirSync(dir, { recursive: true })
  git(dir, ['init', '-q', '-b', 'main'])

  const timeline = []
  for (const step of plan) {
    for (const [relpath, content] of Object.entries(step.add ?? {})) {
      const p = join(dir, relpath)
      mkdirSync(dirname(p), { recursive: true })
      writeFileSync(p, content.replace(/\r\n/g, '\n'), 'utf8')
    }
    for (const relpath of step.rm ?? []) {
      rmSync(join(dir, relpath), { force: true, maxRetries: 5, retryDelay: 100 })
    }
    git(dir, ['add', '-A'], step.date)
    git(dir, ['commit', '-q', '-m', step.message], step.date)
    timeline.push({ sha: git(dir, ['rev-parse', 'HEAD']), short: git(dir, ['rev-parse', '--short', 'HEAD']), message: step.message, date: step.date })
  }
  return timeline
}

function renderAnswerMd(timelines) {
  const t = (fixture) => {
    const rows = timelines[fixture].map((c) =>
      `| \`${c.short}\` | ${c.message} | ${c.date} |`)
    return `| SHA | 提交 | 日期 |\n|---|---|---|\n${rows.join('\n')}`
  }
  const d = ANSWER_KEY_DATA
  const main = d.fixtures['acme-api']
  const breaker = d.fixtures['breaker-yard']

  const table = (headers, rows) => `| ${headers.join(' | ')} |\n|${headers.map(() => '---').join('|')}|\n${rows.map((r) => `| ${r.join(' | ')} |`).join('\n')}`

  const m1Rows = main.m1BrokenLinks.map((x) => [x.file, `[[${x.target}]]`, x.disposition])
  const m2Rows = main.m2Orphans.map((x) => [x.file, x.disposition])
  const m3Rows = main.m3DanglingSources.map((x) => [x.file, x.sources, x.disposition])
  const m4cRows = main.m4Confirmed.map((x) => [x.file, x.refs.join('、'), x.obituary, x.disposition])
  const m4pRows = main.m4Candidates.map((x) => [x.file, x.refs.join('、'), x.disposition])
  const m5Rows = [
    ...main.m5MissingFromIndex.map((x) => [`缺索引行（方向一）`, x.file, x.disposition]),
    ...main.m5GhostLines.map((x) => [`幽灵索引行（方向二）`, x.line, x.disposition]),
  ]
  const linkRows = main.legalLinks.map((x, i) => [i + 1, `${x.from} → ${x.to}`])
  const breakerConfirmedRows = breaker.m4Confirmed.map((x, i) => [i + 1, x.file, x.refs.join('、'), x.obituary])
  const breakerCandRows = breaker.m4Candidates.map((x) => [x.file, x.refs.join('、'), x.disposition])
  const breakerM5Rows = breaker.m5MissingFromIndex.map((x) => [x.file, x.disposition])

  return `# answer-key · Sprint-3 验收考场扩展对答案卡

> **判分基线一律以本卡为准**（TestPlan §0 喂料策略定案）。本卡由 \`build-testbed.mjs\`
> 确定性生成——重跑内容不变（含 commit SHA）；若 git 里出现本卡 diff，即素材与卡不一致，
> 当场算事故。改素材的唯一入口是 \`build-testbed.mjs\`，改完重跑重生成。
> 机器版同内容见 \`out/answer-key.json\`（verify.mjs 判分消费）。

## 口径注（判分与实现分歧时的裁决基线）

1. **M2 口径注**：主库 40 条健康记忆中绝大多数不含 \`[[链接]]\`（链接在真实记忆库中本就稀疏）。
   若实现按「纯链接图无出链无入链」判孤儿，会大面积命中健康记忆，与 AC7 零误报直接冲突——
   那属于实现口径错误（H-B7 打回）。本卷只认 \`legacy-cron-jobs.md\`（不入索引 + 零链接）为孤儿 fixture。
2. **双命中注**：\`legacy-cron-jobs.md\` 同时落在 M5 差集（方向一）里——M2 孤儿命中与 M5 漏登命中
   都属实、都不算误报；其索引行是否被 L0 补上由实现自定（补与不补都不判错）。
   **唯一铁律：该文件不得被删除**（无讣告无删除权）。
3. **相对日期注**：\`fastify-migration-done.md\` 的「迁移是上周的事」——转换锚点由实现自定
   （不预设项），本卷判「动作发生 + 报告四要素 + 连坐标注」，不判转换结果的具体日期。
4. **PBI-07 零动作**：R3/R4 重复对、R5 矛盾对、CLAUDE.md 过期点（\`npm run build\`）——本轮
   机械管线不得删除、不得隔离、不得合并、不得改 CLAUDE.md；H-H7 的空真前提由 dream 提交差集核实。
5. **主库熔断算术**：记忆文件 45 条 → floor(10%) = 4 → 阈值 max(3, 4) = 4；确凿删除 2 ≤ 4 不触发。
   （接口口径 threshold = max(max_deletes, floor(库存×10%))；TestPlan H-D2 括注以本卡为准。）
6. **处置口径**：M2 孤儿与 M3 悬空溯源按接口枚举隔离（reason M2-orphan / M3-dangling-source）；
   唯一铁律仍是「不得删除」。
7. **CLI 直跑路径注**（实测落盘）：CLI 跑 run-dream.mjs 不落 last-dream.json、不设冷却——
   G4「冷却照常起算」与 I1「上次梦 runId 之后」检索窗口在 CLI 路径不可观察 / 退化为全收；
   AC3 在 CLI 路径的适用性由 PO 裁（session-end 链路有 trigger-check 冷却，见 H-G4 附发现）。

## 一、主库 acme-api

### 1.1 git 时间线（7 个固定提交）

${t('acme-api')}

### 1.2 种植与预期处置

**M1 断链（2 条）**：

${table(['文件', '断链目标', '预期处置'], m1Rows)}

**M2 孤儿（1 条）**：

${table(['文件', '预期处置'], m2Rows)}

**M3 悬空溯源（1 条）**：

${table(['文件', 'sources 指向', '预期处置'], m3Rows)}

**M4 确凿（2 条 → 删除）**：

${table(['文件', '引用实体', '讣告', '预期处置'], m4cRows)}

**M4 候选（1 条 → 隔离）**：

${table(['文件', '引用实体', '预期处置'], m4pRows)}

**M5 索引漂移（双向）**：

${table(['方向', '对象', '预期处置'], m5Rows)}

**L0 相对日期（连坐素材）**：\`${main.l0RelativeDate.file}\` 正文「${main.l0RelativeDate.phrase}」——
${main.l0RelativeDate.disposition}。同文件两笔（去链 + 相对日期）连坐，回滚提示须显式标注
「影响其他 N 笔」（H-H2）。

### 1.3 零误报基线（40 条，H-B7）

以下 40 条记忆**不得被删除、不得被隔离、不得被任何判据判为腐烂**——唯二例外：
\`fastify-migration-done.md\` 的 L0 两笔、\`switch-to-vitest.md\` 的待裁决报告行（见 1.2 各表）。

${main.zeroFalsePositiveBaseline.map((f, i) => `${i + 1}. \`${f}\``).join('\n')}

**合法双链 5 条（不得报断链）**：

${table(['#', '链接'], linkRows)}

### 1.4 结构信号与档位

- **CLAUDE.md 过期点**：恰 1 处（\`npm run build\`）——PBI-07 零动作，本轮 dream 提交不得含 CLAUDE.md 变更。
- **阀门配置**：\`.claude/claude-dream.local.md\` 六键齐全，\`llm_checks: off\`（考场档位）；
  考试连跑以 env 覆盖 \`cooldown_minutes=0\`——覆盖标注是 H-A1 的可观察证据。
- **G9 slug 目标**：\`cache-helper-notes\`（梦一场的隔离对象）。

## 二、熔断库 breaker-yard

### 2.1 git 时间线（3 个固定提交）

${t('breaker-yard')}

### 2.2 种植与算术

- 记忆文件 11 条 → 库存 10% = 1.1 → 阈值 = max(3, 1.1) = **3**；确凿死实体 5 条 → 净消失 5 > 3。
- **对照场**（env 覆盖 \`max_deletes: 999\` + 冷却 0）：${breaker.breakerArithmetic.controlRun}。
- **正式场**（默认阈值、默认冷却）：${breaker.breakerArithmetic.formalRun}。

**M4 确凿（5 条）**：

${table(['#', '文件', '引用实体', '讣告'], breakerConfirmedRows)}

**M4 候选（1 条）**：

${table(['文件', '引用实体', '预期处置'], breakerCandRows)}

**M5 漏登（1 条）**：

${table(['文件', '预期处置'], breakerM5Rows)}

## 三、健康库 healthy-garden

- git 时间线见 3.1 节表；记忆文件 10 条，索引完整。
- ${d.fixtures['healthy-garden'].expected}。

### 3.1 git 时间线（2 个固定提交）

${t('healthy-garden')}

## 四、小库 small-pond

- git 时间线见 4.1 节表；记忆文件 6 条，索引完整。
- ${d.fixtures['small-pond'].expected}。

### 4.1 git 时间线（2 个固定提交）

${t('small-pond')}

## 五、G9 留话页模板

- **文件**：\`out/g9-note-template.md\`（builder 只产模板**不落位**）。
- **内容**：段落标记 \`### User\` + 隔离 slug \`cache-helper-notes\` + 用户原话。
- **放置**：${d.g9Template.placement}。
- **预期**：${d.g9Template.expected}。
`
}

function sanityCheck() {
  const names = ACME_MEMORIES.map((m) => m[0])
  if (new Set(names).size !== names.length) throw new Error('acme-api 记忆文件名重复——素材规格错误')
  const indexFiles = [...ACME_MEMORY_INDEX.matchAll(/\]\(([^)]+\.md)\)/g)].map((m) => m[1])
  const missing = names.filter((n) => !indexFiles.includes(n))
  const ghost = indexFiles.filter((n) => !names.includes(n))
  const expectedMissing = ['ioredis-lazy-connect.md', 'legacy-cron-jobs.md']
  const expectedGhost = ['rollback-playbook.md']
  if (JSON.stringify(missing.sort()) !== JSON.stringify([...expectedMissing].sort()))
    throw new Error(`acme-api 索引漏登集合不符：${missing}`)
  if (JSON.stringify(ghost.sort()) !== JSON.stringify([...expectedGhost].sort()))
    throw new Error(`acme-api 幽灵行集合不符：${ghost}`)
}

// ================================================================ run

sanityCheck()
mkdirSync(OUT, { recursive: true })

const timelines = {}
for (const [name, plan] of Object.entries(FIXTURES)) {
  timelines[name] = buildFixture(name, plan)
}

// G9 模板（生成物，不落位）
writeFileSync(join(OUT, 'g9-note-template.md'), G9_NOTE_TEMPLATE.replace(/\r\n/g, '\n'), 'utf8')

// 对答案卡（md 入库 + json 机器版）
ANSWER_KEY_DATA.timelines = timelines
writeFileSync(ANSWER_MD, renderAnswerMd(timelines).replace(/\r\n/g, '\n'), 'utf8')
writeFileSync(ANSWER_JSON, JSON.stringify(ANSWER_KEY_DATA, null, 2).replace(/\r\n/g, '\n'), 'utf8')

// ---- 汇报 ---------------------------------------------------------------
for (const [name, timeline] of Object.entries(timelines)) {
  const dir = join(OUT, name)
  const dirty = git(dir, ['status', '--porcelain'])
  const memCount = readdirSync(join(dir, '.claude', 'memory')).length
  console.log(`${name}：提交 ${timeline.length}，HEAD ${timeline.at(-1).short}，记忆目录 ${memCount} 文件（含 MEMORY.md），考场仓库工作树${dirty ? '有未跟踪改动——不正常' : '干净'}`)
}
console.log(`G9 模板：out/g9-note-template.md（不落位）`)
console.log(`对答案卡：${ANSWER_MD}（入库基线）＋ out/answer-key.json（机器版）`)
