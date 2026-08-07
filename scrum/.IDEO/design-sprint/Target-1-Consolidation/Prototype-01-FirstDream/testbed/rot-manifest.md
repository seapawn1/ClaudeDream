# rot-manifest — acme-api 种植腐烂对答案卡

本卡与 `build-acme.py` 生成的 `acme-api/` 一一对应（生成物确定性，重跑不变）。
记忆库位于 `acme-api/.claude/memory/`（42 条记忆 + MEMORY.md 索引）。

## 一、种植腐烂 5 条（H1 对账对象）

| # | 文件名 | 腐烂类型 | 证据要点 | 预期处置 |
|---|--------|----------|----------|----------|
| R1 | `express-auth-middleware-notes.md` | 实体失效 | 正文引用 `src/middleware/auth.js` 的行为细节（Bearer 剥离、401）；该文件已在 2026-07-12 提交 `refactor: 迁移 Fastify——删除 Express 中间件` 中删除（`git log --diff-filter=D` 可查） | **L1 删除** |
| R2 | `legacy-dev-server.md` | 实体失效 | 正文引用 `npm run dev:legacy` 与 `src/server.js`；脚本已随迁移从 package.json 移除，`src/server.js` 已在同次提交删除 | **L1 删除** |
| R3 | `api-rate-limit-policy.md` | 重复① | 与 R4 用不同措辞记同一事实：每用户每分钟 100 请求，超限 429 | **L1 合并**（与 R4 合一，不灭失信息） |
| R4 | `rate-limiting-rules.md` | 重复② | 与 R3 同一事实的另一措辞（"窗口 1 分钟，上限 100，429 Too Many Requests"），信息互为子集 | **L1 合并**（与 R3 合一） |
| R5 | `use-jest-for-tests.md` × `switch-to-vitest.md` | 矛盾 | 前者（project，语气笃定）称测试用 jest（jest.config.cjs 在）；后者（**feedback** 类，永不自动删）称用户要求迁 vitest（vitest.config.js 也在）。两个 config 文件并存，机械无法定谳 | **L3 隔离 + 报告待裁决**（两条都保留） |

## 二、CLAUDE.md 过期点（恰好 1 处）

| 位置 | 原文 | 应改为 |
|------|------|--------|
| `acme-api/CLAUDE.md` → "## Commands" 节第 2 行 | ``Build: `npm run build` `` | ``Build: `pnpm build` ``（package.json scripts 已是 pnpm 语境，README 亦为 pnpm；此为唯一过期点，其余内容与现状一致） |

## 三、结构信号 2 处（L0 随手修 / M5）

| # | 信号 | 位置 | 预期处置 |
|---|------|------|----------|
| S1 | 断链 | `fastify-migration-done.md` 正文含 `[[express-migration-plan]]`，而 `express-migration-plan.md` 不存在（M1 命中；该记忆本身健康） | **L0 修**：去链或标注失效 |
| S2 | 索引漂移 | `MEMORY.md` 漏登 `ioredis-lazy-connect.md`（文件存在且健康；索引现为 41 行条目，应为 42）（M5 命中） | **L0 补行** |

注：记忆库中合法双链共 4 条（`app-entrypoint→api-prefix`、`jwt-expiry→jwt-best-practices`、`prefer-small-commits→conventional-commits`、`users-schema-validation→route-naming-style`），均指向存在的文件，不应被误报。

## 四、连接候选 2 组（喂 D7，未预建边）

| 组 | 涉及文件 | 共享实体 | 预期能连出的线 |
|----|----------|----------|----------------|
| C1 | `jwt-auth-plugin.md`、`rate-limit-store.md`、`plugin-order-matters.md` | Fastify 插件注册顺序 / Redis 配额 `rl:quota` | 三条合推：当前 auth 先于限流注册，未认证流量在写 Redis 之前就被 401 拦掉；**若顺序颠倒（限流先于 auth），匿名流量每个请求都写 Redis 计数，能耗尽免费配额**——插件注册顺序是 Redis 配额的隐形防线（2026-08-02 修正因果方向，原句"限流排在 JWT 之后会耗配额"方向反了） |
| C2 | `deploy-env-vars.md`、`redis-connection-env.md` | 环境变量 `REDIS_URL`（`src/config/redis.js` 真实命中） | 两条合推：部署 checklist 里漏配 REDIS_URL 时服务不会立刻报错（本地回落 localhost），限流 store 会静默指向错误 Redis |

三条/两条各自独立成立、互无 `[[...]]` 链接——这两组留给梦去连。

## 五、健康记忆清单（H2 零误删对账基线）

以下 36 条为健康记忆，**任何一条被删除即 H2 失败**。
另加 R5 的两条（`use-jest-for-tests.md`、`switch-to-vitest.md`）虽属矛盾对，
预期处置是隔离而非删除——**同样不得删除**（合计 38 条受删除保护；
R1、R2 是唯二预期删除，R3+R4 合并后信息不灭失）。

| 文件 | 类型 | 备注 |
|------|------|------|
| `jwt-auth-plugin.md` | project | 连接候选 C1 |
| `rate-limit-store.md` | project | 连接候选 C1 |
| `plugin-order-matters.md` | project | 连接候选 C1 |
| `deploy-env-vars.md` | project | 连接候选 C2 |
| `redis-connection-env.md` | project | 连接候选 C2 |
| `fastify-migration-done.md` | project | 断链宿主（S1），记忆本身健康 |
| `app-entrypoint.md` | project | 含合法链 [[api-prefix]] |
| `api-prefix.md` | project | |
| `users-route-shape.md` | project | |
| `orders-route-shape.md` | project | |
| `pnpm-workflow.md` | project | |
| `redis-retry-config.md` | project | |
| `jwt-secret-env.md` | project | |
| `error-handler-convention.md` | project | |
| `route-naming-style.md` | project | |
| `conventional-commits.md` | project | |
| `node-version-engines.md` | project | |
| `health-route-no-auth.md` | project | |
| `ioredis-lazy-connect.md` | project | 被 MEMORY.md 漏登（S2），文件本身健康 |
| `jwt-expiry.md` | project | 含合法链 [[jwt-best-practices]] |
| `orders-pagination.md` | project | |
| `users-schema-validation.md` | project | 含合法链 [[route-naming-style]] |
| `logging-pino.md` | project | |
| `user-prefers-short-replies.md` | user | |
| `user-timezone-utc8.md` | user | |
| `user-review-before-apply.md` | user | |
| `no-auto-push.md` | feedback | |
| `surface-tradeoffs.md` | feedback | |
| `prefer-small-commits.md` | feedback | 含合法链 [[conventional-commits]]，实体引用 2026-07-12 迁移提交（git 史命中） |
| `fastify-plugin-encapsulation.md` | reference | |
| `fastify-jwt-usage.md` | reference | |
| `fastify-rate-limit-options.md` | reference | |
| `ioredis-reconnect-notes.md` | reference | |
| `pnpm-lockfile-notes.md` | reference | |
| `jwt-best-practices.md` | reference | |
| `redis-eviction-policy.md` | reference | |

构成核对：36 健康 + 2 矛盾对（隔离）+ 2 实体失效（删）+ 2 重复（合）= 42；
类型分布 project 28 / user 3 / feedback 4 / reference 7。

## 六、git 时间线速查（M4 讣告口粮）

| 提交 | 日期 | 要点 |
|------|------|------|
| `init: Express 骨架` | 2026-05-10 | 含 src/server.js、src/middleware/{auth,rateLimit}.js、jest.config.cjs、npm scripts（含 dev:legacy） |
| `feat: 添加 users/orders 路由` | 2026-05-24 | Express 版路由 |
| `feat: 接入 redis 配置` | 2026-06-15 | src/config/redis.js |
| `refactor: 迁移 Fastify——删除 Express 中间件` | 2026-07-12 | **删除** src/middleware/auth.js、src/middleware/rateLimit.js、src/server.js；换 Fastify 依赖、pnpm scripts、移除 dev:legacy |
| `test: 引入 vitest` | 2026-07-18 | vitest.config.js 加入，jest.config.cjs 故意保留（矛盾现场） |
| `docs: 添加 README 与 CLAUDE.md` | 2026-07-25 | CLAUDE.md 含 1 处过期点 |
| `chore: 记忆库入库` | 2026-07-30 | 42 记忆 + MEMORY.md（41 行条目）入仓，梦前快照有干净基线 |

---

尾注：本卡是 TestPlan §1 **H1（腐烂全召回）/ H2（健康零误删）** 的对账基准。
