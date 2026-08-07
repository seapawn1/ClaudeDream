# 梦报告 2026-08-02 · Express 残影清扫与 Redis 风险连线

42 条记忆 -> 41 条 ｜ 新边 +2 ｜ 隔离 1 ｜ CLAUDE.md 0 处

## 30 秒版
- 删：`express-auth-middleware-notes.md`（M4 确凿——src/middleware/auth.js 已随 d6fba0b 消亡）
- 删：`legacy-dev-server.md`（M4 确凿——dev:legacy 脚本已随 d6fba0b 移除）
- 删（合并）：`api-rate-limit-policy.md` 并入 `rate-limiting-rules.md`（同一事实：每用户每分钟 100 请求、超限 429；幸存者已登记 merged_from，信息无灭失）
- 隔离：`use-jest-for-tests.md`（现状与用户反馈均为 vitest）
- 改述：`deploy-env-vars.md`（"缺 REDIS_URL 起不来"与代码不符，已按 src/config/redis.js 证据修正措辞，原信息保留）
- CLAUDE.md 一字未动（阀门 claude_md_edits=false），但发现其 Build 命令与记忆/README/package.json 冲突，见"待你裁决"
- 整梦撤销：`git revert <本次 dream 提交>`（提交号见 git log 最新 dream: 提交）

## 明细（每笔四要素）
| 动作 | 判据 | 证据 | 单条回滚 |
|---|---|---|---|
| 修断链：fastify-migration-done.md 中 `[[express-migration-plan]]` 改为文字说明 | M1 | `test -e .claude/memory/express-migration-plan.md` -> 不存在；`git log --all --oneline -- .claude/memory/express-migration-plan.md` -> 空（该文件从未入库） | `git checkout 61756f7906a486512200d60103ddd7873b6e7362 -- .claude/memory/fastify-migration-done.md` |
| 补索引行：ioredis-lazy-connect 加入 MEMORY.md | M5 | 机械体检 missing_in_index: ["ioredis-lazy-connect"]；文件存在而索引无行 | `git checkout 61756f7906a486512200d60103ddd7873b6e7362 -- .claude/memory/MEMORY.md` |
| 删除票：express-auth-middleware-notes.md（写入 .disposals.json，引擎代执行） | M4 | `test -e src/middleware/auth.js` -> 不存在；`git grep -c src/middleware/auth.js -- :!.claude` -> 0；`git log --diff-filter=D -- src/middleware/auth.js` -> d6fba0b 2026-07-12（讣告提交） | `git checkout 61756f7906a486512200d60103ddd7873b6e7362 -- .claude/memory/express-auth-middleware-notes.md` |
| 删除票：legacy-dev-server.md（写入 .disposals.json，引擎代执行） | M4 | `grep "dev:legacy" package.json` -> 0 命中；`git log -S dev:legacy -- package.json` -> d6fba0b 2026-07-12（移除记录） | `git checkout 61756f7906a486512200d60103ddd7873b6e7362 -- .claude/memory/legacy-dev-server.md` |
| 合并：api-rate-limit-policy.md 并入 rate-limiting-rules.md，幸存者登记 `merged_from: [api-rate-limit-policy]`，被并方入 .disposals.json | 重复检测（D5） | 两方原文：「每个用户每分钟最多 100 个请求，超限返回 429」vs「按用户计数，窗口 1 分钟，上限 100 请求；触发后返回 429 Too Many Requests」——同一事实；现状印证 src/plugins/rate-limit.js:8-15（max: 100 / '1 minute' / 429） | `git checkout 61756f7906a486512200d60103ddd7873b6e7362 -- .claude/memory/rate-limiting-rules.md .claude/memory/api-rate-limit-policy.md` |
| 隔离：use-jest-for-tests.md 加 `status: quarantined` | S1 | 记忆原文「测试框架用 jest，配置在 jest.config.cjs」vs feedback 记忆 switch-to-vitest「以后新测试一律写 vitest，不要再用 jest」；现状定谳：package.json `"test": "pnpm exec vitest run"`，devDependencies 仅 vitest 无 jest（f54ceff test: 引入 vitest）。不在 M4 确凿清单，无删除权，隔离待复审 | `git checkout 61756f7906a486512200d60103ddd7873b6e7362 -- .claude/memory/use-jest-for-tests.md` |
| 标注：pnpm-workflow.md 加 `contradicts: CLAUDE.md#Commands` | S2 | 记忆原文「`pnpm install` / `pnpm build` / `pnpm test`，不要混用 npm」vs CLAUDE.md#Commands「Build: `npm run build`」；claude_md_edits=false，降级为标注+建议 | `git checkout 61756f7906a486512200d60103ddd7873b6e7362 -- .claude/memory/pnpm-workflow.md` |
| 改述：deploy-env-vars.md「缺任何一个服务都起不来」限定为仅 JWT_SECRET 成立 | S1（记忆 vs 现状） | 记忆原断言 vs src/config/redis.js:4-8：`REDIS_URL ?? 'redis://localhost:6379'` 回落 + `lazyConnect: true`——缺 REDIS_URL 进程照常启动；JWT_SECRET 侧 @fastify/jwt 注册缺 secret 会抛，成立 | `git checkout 61756f7906a486512200d60103ddd7873b6e7362 -- .claude/memory/deploy-env-vars.md` |
| 新建连接：[connection-rate-limit-burns-redis-quota](../memory/connection-rate-limit-burns-redis-quota.md)，反链补入 rate-limit-store.md、rate-limiting-rules.md | D7 | 两端共享实体 Redis 免费额度 × 逐请求限流计数，互无链接；连接结论（额度耗尽限流静默失效）不在任一单条记忆里 | `git rm .claude/memory/connection-rate-limit-burns-redis-quota.md`；`git checkout 61756f7906a486512200d60103ddd7873b6e7362 -- .claude/memory/rate-limit-store.md`；索引删行 |
| 新建连接：[connection-lazyconnect-delays-env-failure](../memory/connection-lazyconnect-delays-env-failure.md)，反链补入 ioredis-lazy-connect.md、deploy-env-vars.md | D7 | 两端共享实体 REDIS_URL/启动时序，互无链接；连接结论（REDIS_URL 配置错误 fail-late 而非 fail-fast）不在任一单条记忆里 | `git rm .claude/memory/connection-lazyconnect-delays-env-failure.md`；`git checkout 61756f7906a486512200d60103ddd7873b6e7362 -- .claude/memory/ioredis-lazy-connect.md`；索引删行 |

## 隔离观察区
- 本梦新隔离：`use-jest-for-tests.md` —— 与现状（package.json test 脚本为 vitest、依赖无 jest）及 feedback 记忆 switch-to-vitest 冲突；因不在 M4 确凿清单且磁盘残留 jest.config.cjs，隔离不删。连续两梦无翻案证据后可升级为删除候选。
- 上梦遗留复审结果：无遗留（本次为第一梦）。

## 待你裁决
1. **jest.config.cjs 残留在仓库根**（代码文件，梦进程无权触碰）。你说过「测试要迁到 vitest……不要再用 jest」（switch-to-vitest），现状 test 脚本已是 vitest，但 jest.config.cjs 还躺在磁盘上。建议：由你在会话里删除该文件；届时隔离中的 use-jest-for-tests.md 即可在下一梦顺理成章升级为删除候选。
2. **建议（未动）——CLAUDE.md#Commands 写 `Build: npm run build`**。三方证据都指向 pnpm：pnpm-workflow 记忆「不要混用 npm」、README「`pnpm build`」、package.json 的 scripts 内部一律 `pnpm exec`。阀门 claude_md_edits=false，本梦只在 pnpm-workflow.md 标了 `contradicts: CLAUDE.md#Commands`。建议你把 CLAUDE.md 该行改为 `pnpm build`，或明确告知 npm 写法是有意为之。

## 抽查点
1. 合并是否灭失信息：`git show 61756f7906a486512200d60103ddd7873b6e7362:.claude/memory/api-rate-limit-policy.md` 与现 `.claude/memory/rate-limiting-rules.md` 对读。
2. deploy-env-vars 改述依据是否属实：`Get-Content src/config/redis.js`（看第 4-8 行的 `?? 'redis://localhost:6379'` 与 `lazyConnect: true`）。
3. use-jest-for-tests 隔离依据是否属实：`Select-String -Pattern 'test|vitest|jest' package.json; Test-Path jest.config.cjs`（预期：test 脚本 vitest、无 jest 依赖、但 jest.config.cjs 为 True）。

---
阀门状态：enabled=true · claude_md_edits=false · delete_policy=quarantine-first · max_deletes=3 · max_new_connections=2
