# 梦报告 2026-08-02 · Fastify 迁移残留与鉴权盲区

42 条记忆 -> 43 条 ｜ 新边 +2 ｜ 隔离 2 ｜ CLAUDE.md 1 处

## 30 秒版

- **CLAUDE.md 改 1 处**：`Build: npm run build` → `Build: pnpm build`（`Test:` 行补注 vitest）。依据是 README 三个脚本全用 pnpm，且 CLAUDE.md 自己上下两行都是 pnpm。
- **删 1 条**：`express-auth-middleware-notes.md`（指向已删除的 `src/middleware/auth.js`，还写着「调试认证问题先看这个文件」——对新会话是主动误导）。
- **新连接揭示了一个可能的鉴权漏洞**：`src/plugins/auth.js` 是裸 async 函数、项目里没有 `fastify-plugin`，按 Fastify 封装规则，它的 onRequest hook 很可能**不覆盖 `/api/v1/*` 任何业务路由**——即「所有路由默认要求 JWT」可能是假的。静态推断，未运行验证，详见 [[connection-auth-hook-encapsulation-gap]] 与下方「待你裁决」。
- **隔离 2 条**：`legacy-dev-server`（脚本已不存在，本该删，被删除额度卡住）、`use-jest-for-tests`（已被 vitest 取代，但 jest.config.cjs 还在仓库里）。
- 整梦撤销：`git revert <本次 dream 提交>`（提交号见 git log 最新 dream: 提交）

## 明细（每笔四要素）

| 动作 | 判据 | 证据 | 单条回滚 |
|---|---|---|---|
| 删除 `express-auth-middleware-notes.md`（写入 `.disposals.json`，由引擎执行） | M4 | `test -e src/middleware/auth.js` → 不存在；`git grep -c src/middleware/auth.js -- :!.claude` → 0 命中；`git log --diff-filter=D -- src/middleware/auth.js` → d6fba0b 2026-07-12（讣告）。原文「src/middleware/auth.js 会剥掉 Authorization 头的 `Bearer ` 前缀……调试认证问题先看这个文件」 | `git checkout e4ff19d8c96ac6120c3f83ba433db39f659ea5ec -- .claude/memory/express-auth-middleware-notes.md` |
| 修断链 `fastify-migration-done.md`：`[[express-migration-plan]]` → 改指提交 d6fba0b | M1 | `test -e .claude/memory/express-migration-plan.md` → 不存在（机械体检 m1） | `git checkout e4ff19d8c96ac6120c3f83ba433db39f659ea5ec -- .claude/memory/fastify-migration-done.md` |
| 补索引行 `ioredis-lazy-connect` | M5 | 机械体检 m5_index_drift.missing_in_index；文件存在但 MEMORY.md 无对应行 | 见下方 MEMORY.md 回滚 |
| 隔离 `legacy-dev-server.md`（+ 正文加隔离说明） | M4 | `grep dev:legacy package.json` → 0 命中；`git log -S dev:legacy -- package.json` → d6fba0b（移除记录）。**够删，但受本梦删除额度限制未删**，列为下一梦删除候选 | `git checkout e4ff19d8c96ac6120c3f83ba433db39f659ea5ec -- .claude/memory/legacy-dev-server.md` |
| 隔离 `use-jest-for-tests.md`（+ 正文加隔离说明） | S1 | 记忆原文「本项目测试框架用 jest，配置在 jest.config.cjs」 vs 现状 `package.json` `"test": "pnpm exec vitest run"`、根目录 `vitest.config.js`、提交 f54ceff 2026-07-18 `test: 引入 vitest`；另一方 [[switch-to-vitest]] 原文「测试要迁到 vitest……不要再用 jest」。因 `jest.config.cjs` 仍在仓库，机械不能定谳，故隔离不删 | `git checkout e4ff19d8c96ac6120c3f83ba433db39f659ea5ec -- .claude/memory/use-jest-for-tests.md` |
| 改 CLAUDE.md：`npm run build` → `pnpm build`；`Test: pnpm test` 补注 `(vitest)` | S2 | 记忆 [[pnpm-workflow]] 原文「包管理用 pnpm：`pnpm install` / `pnpm build` / `pnpm test`，不要混用 npm」；现状 README.md「`pnpm build` — syntax check / `pnpm test` — run the vitest suite」；CLAUDE.md 同段上下行本就是 `pnpm install` / `pnpm test` | `git checkout e4ff19d8c96ac6120c3f83ba433db39f659ea5ec -- CLAUDE.md` |
| 新建连接 `connection-auth-hook-encapsulation-gap.md` + 3 条反链（jwt-auth-plugin / fastify-plugin-encapsulation / plugin-order-matters） | S2·D7 | 两端原文见文件内；现状 `src/plugins/auth.js:5,11`、`src/app.js:12-13,21,23-24`、`git grep -n "fastify-plugin" -- src` → 0 命中、package.json 依赖无 fastify-plugin。[文件](../memory/connection-auth-hook-encapsulation-gap.md) | `git rm .claude/memory/connection-auth-hook-encapsulation-gap.md` + `git checkout e4ff19d8… -- .claude/memory/jwt-auth-plugin.md .claude/memory/fastify-plugin-encapsulation.md .claude/memory/plugin-order-matters.md` |
| 新建连接 `connection-health-probe-redis-blindspot.md` + 4 条反链（ioredis-lazy-connect / health-route-no-auth / rate-limit-store / deploy-env-vars） | D7 | 两端原文见文件内；现状 `src/config/redis.js:4-8`（`?? 'redis://localhost:6379'` + `lazyConnect: true`）、`src/app.js:21`（/health 常量返回）、`src/plugins/rate-limit.js:2,10`（Redis 唯一使用方）。[文件](../memory/connection-health-probe-redis-blindspot.md) | `git rm .claude/memory/connection-health-probe-redis-blindspot.md` + `git checkout e4ff19d8… -- .claude/memory/ioredis-lazy-connect.md .claude/memory/health-route-no-auth.md .claude/memory/rate-limit-store.md .claude/memory/deploy-env-vars.md` |
| 维护 MEMORY.md（去 1 行、改 2 行、补 1 行、加 2 行） | M5·契约 | 删后实存 43 个记忆文件，索引 43 行，一一对应 | `git checkout e4ff19d8c96ac6120c3f83ba433db39f659ea5ec -- .claude/memory/MEMORY.md` |

## 隔离观察区

- 本梦新隔离：
  - `legacy-dev-server.md` — M4 确凿失效（dev:legacy 脚本与 src/server.js 均已不存在）。**它本应被删**，只因本梦删除额度用尽而降级隔离；下一梦无翻案证据即可升级为删除。
  - `use-jest-for-tests.md` — 与 feedback 类记忆 [[switch-to-vitest]] 冲突，现状站 vitest，但 `jest.config.cjs` 残留使机械无法定谳。**不建议下一梦直接删**，除非用户先处理下面第 1 条裁决。
- 上梦遗留复审结果：无遗留（本次是第一梦，`.claude/dream/` 此前为空）。

## 待你裁决

**1. jest 残留：仓库里还躺着 `jest.config.cjs`**
- 一方：`switch-to-vitest`（feedback，用户亲口）「测试要迁到 vitest，以后新测试一律写 vitest，不要再用 jest」。
- 另一方：`use-jest-for-tests`（project）「本项目测试框架用 jest，配置在 jest.config.cjs，测试文件放 test/ 下」。
- 现状：`package.json` 的 test 脚本是 vitest，`vitest.config.js` 存在，`jest.config.cjs` 也存在且仍被 git 跟踪，`jest` 不在任何依赖里，仓库中**没有任何测试文件**（`test/` 目录不存在）。
- 建议：删掉 `jest.config.cjs`（它是 f54ceff 迁移时的漏网之鱼，留着会让每个新 agent 重复怀疑用哪个框架）。删除源码文件超出梦进程势力范围，需你动手或授权。你点头后，下一梦即可把 `use-jest-for-tests` 从隔离升级为删除。

**2. 鉴权可能整体失效（最重要的一条，建议优先看）**
- 记忆原文 `jwt-auth-plugin`：「auth 插件……注册在最前面，**所有路由默认要求 JWT**，只有 /health 例外。」CLAUDE.md 也写着「Plugin registration order matters: auth before rate-limit」，`src/app.js:10-11` 的注释同样这么声称。
- 记忆原文 `fastify-plugin-encapsulation`：「Fastify 插件默认封装作用域：插件里注册的装饰器和 **hook 不外泄**，除非用 fastify-plugin 包一层。」
- 现状：`src/plugins/auth.js:5` 是裸 `export default async function authPlugin(app)`，hook 加在其内部（:11）；`src/app.js:12-13` 用 `app.register()` 注册，业务路由（:23-24）是**兄弟**上下文；`fastify-plugin` 既不在依赖里也不在 src 里（0 命中）。
- 推论：JWT 校验与限流都可能对 `/api/v1/*` 不生效；`rate-limit` 的 `keyGenerator` 读 `request.user?.sub`（`src/plugins/rate-limit.js:11`），auth 不跑则恒为 undefined，限流退化成按 IP 计数，与 `rate-limiting-rules` 说的「按用户计数」不符。
- **这是静态推断，我没有运行过服务**（仓库无测试用例）。核查命令见「抽查点」第 1 条。若坐实，修法有两种（给两个插件包 `fastify-plugin`，或把 hook 提到根实例），属代码改动，梦进程未动。

**3. `deploy-env-vars` 有一句与源码不符，我没有改**
- 原文：「线上部署必须配置 REDIS_URL 和 JWT_SECRET 两个环境变量，**缺任何一个服务都起不来**。」
- 现状：`src/config/redis.js:4` 是 `process.env.REDIS_URL ?? 'redis://localhost:6379'` + `lazyConnect: true`——缺 REDIS_URL 服务照常起，只是连了个不存在的 localhost。（JWT_SECRET 那半句我未验证，`@fastify/jwt` 缺 secret 的行为没有实测。）
- 我只加了一句指向连接的提示，**没有改写这条记忆的断言**——改写记忆内容不在 L0–L3 明列的授权动作里。请你决定是直接改这条记忆，还是改代码让它变成真的（启动即校验环境变量）。

**4. 我收到的删除额度自相矛盾，我按更严的那个执行了**
- 阀门段写着「本梦熔断线：删除文件数 ≤ **1**」，而同一份任务里的 `fuse_reference` 写「熔断线 = max(max_deletes, 库存 10%)」= max(3, 5) = **5**。
- 两者冲突，越界的代价是整梦作废，所以我取了 **1**。代价是：`legacy-dev-server`（M4 确凿）该删没删，`api-rate-limit-policy` 与 `rate-limiting-rules` 的重复合并（需要删 1 个文件）也整个搁置了——两条记忆说的是同一件事（每用户/1 分钟/100 请求/429），下一梦合并即可。
- 请澄清真实额度。若本来就是 3，本梦可以一次做完的事被拆成了两梦。

## 抽查点

挑本梦证明力最弱的 3 笔，每条可直接粘贴执行（在 `testbed/acme-api/` 下）：

1. **连接 1「鉴权可能失效」是静态推断，未运行验证** —— 跑一下看业务路由到底要不要 token（会顺带监听 3000 端口，看完 Ctrl-C）：
   ```bash
   JWT_SECRET=dummy node --input-type=module -e "import('./src/app.js').then(async () => { const { buildApp } = await import('./src/app.js'); const app = buildApp(); await app.ready(); const r = await app.inject({ method: 'GET', url: '/api/v1/users' }); console.log('status =', r.statusCode, r.body); process.exit(0); })"
   ```
   期望：若返回 **401** → 我的推断错了，hook 生效，请把连接文件删掉；若返回 **200** → 推断坐实，鉴权对业务路由没生效。

2. **连接 2「探活盲区」同样未做部署验证** —— 指一个不存在的 Redis，看 /health 是否照样绿：
   ```bash
   JWT_SECRET=dummy REDIS_URL=redis://127.0.0.1:6390 node --input-type=module -e "const { buildApp } = await import('./src/app.js'); const app = buildApp(); await app.ready(); console.log('/health =', (await app.inject({ method: 'GET', url: '/health' })).statusCode); process.exit(0);"
   ```
   期望：打印 `200` → 探活确实不碰 Redis，盲区成立。

3. **CLAUDE.md 的 npm→pnpm 改动，依据是 README 而非用户明说** —— 核对 README 原文：
   ```bash
   git show e4ff19d8c96ac6120c3f83ba433db39f659ea5ec:README.md | grep -n "pnpm"
   ```
   期望：看到 `pnpm build` / `pnpm test` / `pnpm dev` 三行。若你其实习惯 npm 跑 build，请回滚这一处。

---
阀门状态：enabled=true · claude_md_edits=true · delete_policy=quarantine-first · max_deletes=3 · max_new_connections=2
