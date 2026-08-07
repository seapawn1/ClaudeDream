# 梦报告 2026-08-02 · 清扫 Express 时代残留

42 条记忆 -> 40 条 ｜ 新边 +1 ｜ 隔离 1 ｜ CLAUDE.md 1 处

（42 − 2 条 M4 删除 − 1 条合并 + 1 条新建 connection = 40）

## 30 秒版
- **CLAUDE.md 改 1 处**：`Build: npm run build` → `Build: pnpm build`（README 与 pnpm-workflow 记忆均为 pnpm，"不要混用 npm"）
- **删 2 条**（机械确凿 M4）：`express-auth-middleware-notes.md`、`legacy-dev-server.md`——实体均死于 d6fba0b（2026-07-12 Fastify 迁移）
- **合 1 条**：`rate-limiting-rules.md` 并入 `api-rate-limit-policy.md`（同一事实：每用户每分钟 100 请求超限 429）
- **隔离 1 条**：`use-jest-for-tests.md`（test 脚本已是 vitest，但 jest.config.cjs 仍在盘上，未达确凿）
- 整梦撤销：`git revert <本次 dream 提交>`（提交号见 git log 最新 dream: 提交）

## 明细（每笔四要素）
| 动作 | 判据 | 证据 | 单条回滚 |
|---|---|---|---|
| 删除 express-auth-middleware-notes.md（经处置清单） | M4 | `test -e src/middleware/auth.js` 不存在；`git grep -c src/middleware/auth.js -- :!.claude` 0 命中；`git log --diff-filter=D -- src/middleware/auth.js` → d6fba0b 2026-07-12 讣告 | `git checkout d995b0200784281f4397bbdc211537c9ad7dd8f0 -- .claude/memory/express-auth-middleware-notes.md`（并回补索引行） |
| 删除 legacy-dev-server.md（经处置清单） | M4 | `grep dev:legacy package.json` 0 命中；`git log -S dev:legacy -- package.json` → d6fba0b 移除记录；README 现行为 `pnpm dev` | `git checkout d995b0200784281f4397bbdc211537c9ad7dd8f0 -- .claude/memory/legacy-dev-server.md`（并回补索引行） |
| 合并 rate-limiting-rules.md → api-rate-limit-policy.md | S1-重复 | 两文原文分别为"每个用户每分钟最多 100 个请求，超限返回 429"与"按用户计数，窗口 1 分钟，上限 100 请求；触发后返回 429 Too Many Requests"——同一事实；幸存文件登记 `merged_from: [rate-limiting-rules]`，全部信息（按用户/窗口 1 分钟/上限 100/429 Too Many Requests）保全 | `git checkout d995b0200784281f4397bbdc211537c9ad7dd8f0 -- .claude/memory/rate-limiting-rules.md .claude/memory/api-rate-limit-policy.md`（并回补索引行） |
| 隔离 use-jest-for-tests.md（`status: quarantined`） | S1 | 记忆原文"本项目测试框架用 jest，配置在 jest.config.cjs"；现状：package.json test 脚本 = `pnpm exec vitest run`、依赖无 jest（f54ceff 2026-07-18 引入 vitest 晚于 d43a6be 带入的 jest 配置）；但 `Test-Path jest.config.cjs` = True，两配置并存 → 隔离不删 | `git checkout d995b0200784281f4397bbdc211537c9ad7dd8f0 -- .claude/memory/use-jest-for-tests.md` |
| 修断链 fastify-migration-done.md：移除 `[[express-migration-plan]]` | M1 | `test -e .claude/memory/express-migration-plan.md` 不存在；`git log --all -- .claude/memory/express-migration-plan.md` 全历史 0 记录（从未入库） | `git checkout d995b0200784281f4397bbdc211537c9ad7dd8f0 -- .claude/memory/fastify-migration-done.md` |
| 补索引行 ioredis-lazy-connect | M5 | 机械体检 missing_in_index；文件存在而 MEMORY.md 无行 | `git checkout d995b0200784281f4397bbdc211537c9ad7dd8f0 -- .claude/memory/MEMORY.md` |
| 新建 [connection-ratelimit-redis-fragility.md](../memory/connection-ratelimit-redis-fragility.md)，两端反链 rate-limit-store / redis-eviction-policy / redis-retry-config | D7 | 三条记忆共享"限流依赖 Redis"实体互无链接；合并结论（免费额度打满 + 淘汰策略不当 → 限流放水；maxRetriesPerRequest: 2 → Redis 挂时 fail-open/closed 未知）不在任何单条记忆里 | `git rm .claude/memory/connection-ratelimit-redis-fragility.md`；`git checkout d995b0200784281f4397bbdc211537c9ad7dd8f0 -- .claude/memory/rate-limit-store.md .claude/memory/redis-eviction-policy.md .claude/memory/redis-retry-config.md .claude/memory/api-rate-limit-policy.md`（并从索引删行） |
| 改 CLAUDE.md：`npm run build` → `pnpm build` | S2 | 记忆 pnpm-workflow 原文"包管理用 pnpm……不要混用 npm"；README 原文"`pnpm build` — syntax check"；CLAUDE.md 原文"Build: `npm run build`"为孤例 | `git checkout d995b0200784281f4397bbdc211537c9ad7dd8f0 -- CLAUDE.md` |

## 隔离观察区
- 本梦新隔离：`use-jest-for-tests.md` —— 与 vitest 现状矛盾，但 jest.config.cjs 残留在盘（d43a6be 带入、迁移未删），两配置并存未达确凿；连续两梦无翻案证据可升级删除候选
- 上梦遗留复审结果：无遗留（本次是第一梦）

## 待你裁决
1. **jest vs vitest 的残尾**：feedback 记忆 `switch-to-vitest` 原文"测试要迁到 vitest，以后新测试一律写 vitest，不要再用 jest"（2026-07 口头），现状已兑现（f54ceff）；被隔离的 `use-jest-for-tests` 原文"本项目测试框架用 jest，配置在 jest.config.cjs"。**建议**：下一梦若无翻案证据则删 `use-jest-for-tests.md`；另外 `jest.config.cjs` 本身是仓库残留文件，超出梦进程势力范围（只读），建议你手动删掉它，顺带让矛盾彻底定谳。
2. **switch-to-vitest 的时态**：这条 feedback 记的是"要迁"（意图），迁移已完成，正文略显过时。feedback 永不删改是铁律，是否由你亲自把它改写成"新测试一律写 vitest"的现在时，由你定。

## 抽查点
- 合并未灭失信息：`git show d995b0200784281f4397bbdc211537c9ad7dd8f0:.claude/memory/rate-limiting-rules.md` 对照现 `cat .claude/memory/api-rate-limit-policy.md`
- CLAUDE.md 改动依据：`grep -n "build" package.json README.md CLAUDE.md`（应只见 pnpm，无 npm run build）
- 断链判定（express-migration-plan 从未存在）：`git log --all --oneline -- .claude/memory/express-migration-plan.md`（应无输出）

---
阀门状态：enabled=true · claude_md_edits=true · delete_policy=quarantine-first · max_deletes=3 · max_new_connections=2
