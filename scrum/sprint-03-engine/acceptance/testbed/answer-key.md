# answer-key · Sprint-3 验收考场扩展对答案卡

> **判分基线一律以本卡为准**（TestPlan §0 喂料策略定案）。本卡由 `build-testbed.mjs`
> 确定性生成——重跑内容不变（含 commit SHA）；若 git 里出现本卡 diff，即素材与卡不一致，
> 当场算事故。改素材的唯一入口是 `build-testbed.mjs`，改完重跑重生成。
> 机器版同内容见 `out/answer-key.json`（verify.mjs 判分消费）。

## 口径注（判分与实现分歧时的裁决基线）

1. **M2 口径注**：主库 40 条健康记忆中绝大多数不含 `[[链接]]`（链接在真实记忆库中本就稀疏）。
   若实现按「纯链接图无出链无入链」判孤儿，会大面积命中健康记忆，与 AC7 零误报直接冲突——
   那属于实现口径错误（H-B7 打回）。本卷只认 `legacy-cron-jobs.md`（不入索引 + 零链接）为孤儿 fixture。
2. **双命中注**：`legacy-cron-jobs.md` 同时落在 M5 差集（方向一）里——M2 孤儿命中与 M5 漏登命中
   都属实、都不算误报；其索引行是否被 L0 补上由实现自定（补与不补都不判错）。
   **唯一铁律：该文件不得被删除**（无讣告无删除权）。
3. **相对日期注**：`fastify-migration-done.md` 的「迁移是上周的事」——转换锚点由实现自定
   （不预设项），本卷判「动作发生 + 报告四要素 + 连坐标注」，不判转换结果的具体日期。
4. **PBI-07 零动作**：R3/R4 重复对、R5 矛盾对、CLAUDE.md 过期点（`npm run build`）——本轮
   机械管线不得删除、不得隔离、不得合并、不得改 CLAUDE.md；H-H7 的空真前提由 dream 提交差集核实。
5. **主库熔断算术**：记忆文件 45 条 → 10% = 4.5 → 阈值 max(3, 4.5) = 4.5；确凿删除 2 ≤ 4.5 不触发。
   （TestPlan H-D2 括注「4.2」为补种前的估算值，以本卡为准。）
6. **处置口径**：M2 孤儿与 M3 悬空溯源的处置（隔离或仅报告）AC 未点名——实现自定，本卷只判检出
   与「不得删除」。

## 一、主库 acme-api

### 1.1 git 时间线（7 个固定提交）

| SHA | 提交 | 日期 |
|---|---|---|
| `2fc8ef9` | init: Express 骨架 | 2026-05-10T10:00:00+08:00 |
| `b9d8a44` | feat: 添加 users/orders 路由 | 2026-05-24T14:30:00+08:00 |
| `dc28099` | feat: 接入 redis 配置 | 2026-06-15T09:15:00+08:00 |
| `1c7a4ef` | refactor: 迁移 Fastify——删除 Express 中间件 | 2026-07-12T16:00:00+08:00 |
| `c3d3d70` | test: 引入 vitest | 2026-07-18T11:00:00+08:00 |
| `bbb26bb` | docs: 添加 README 与 CLAUDE.md | 2026-07-25T15:45:00+08:00 |
| `56650aa` | chore: 记忆库入库 | 2026-07-30T10:30:00+08:00 |

### 1.2 种植与预期处置

**M1 断链（2 条）**：

| 文件 | 断链目标 | 预期处置 |
|---|---|---|
| fastify-migration-done.md | [[express-migration-plan]] | L0 去链修复（去链或标注失效，实现自定），四要素入报告 |
| switch-to-vitest.md | [[vitest-migration-plan]] | feedback 保护：不修复、不隔离、不删除——只进报告「待你裁决」节（H-E1/E2） |

**M2 孤儿（1 条）**：

| 文件 | 预期处置 |
|---|---|
| legacy-cron-jobs.md | 检出（H-B2）；不入索引+零链接；不得删除；隔离或仅报告由实现自定 |

**M3 悬空溯源（1 条）**：

| 文件 | sources 指向 | 预期处置 |
|---|---|---|
| migration-timeline-notes.md | docs/migration-notes.log | 检出（H-B3）；C3 入 C4 删有讣告；不得删除；隔离或仅报告由实现自定 |

**M4 确凿（2 条 → 删除）**：

| 文件 | 引用实体 | 讣告 | 预期处置 |
|---|---|---|---|
| express-auth-middleware-notes.md | src/middleware/auth.js | C4 2026-07-12 | 确凿删除 + 报告内联死者遗言（H-D2/H-H5） |
| legacy-dev-server.md | npm run dev:legacy、src/server.js | C4 2026-07-12 | 确凿删除 + 报告内联死者遗言（H-D2/H-H5） |

**M4 候选（1 条 → 隔离）**：

| 文件 | 引用实体 | 预期处置 |
|---|---|---|
| cache-helper-notes.md | src/utils/cache-helper.js | 候选不删（H-D3）；quarantine-first 下隔离标记 status: quarantined + 原因 + 起始信息，去标记即还原（H-F1）；G9 模板 slug 目标 |

**M5 索引漂移（双向）**：

| 方向 | 对象 | 预期处置 |
|---|---|---|
| 缺索引行（方向一） | ioredis-lazy-connect.md | L0 补索引行（H-D1）；含合法出链，健康记忆 |
| 缺索引行（方向一） | legacy-cron-jobs.md | 亦在差集内（有意不入索引）——是否补行由实现自定，两种都不判错；不得删除 |
| 幽灵索引行（方向二） | rollback-playbook.md | L0 删幽灵行（H-D1） |

**L0 相对日期（连坐素材）**：`fastify-migration-done.md` 正文「迁移是上周的事」——
L0 相对日期转绝对（H-D1）；转换锚点由实现自定，本卷判「动作发生 + 四要素 + 连坐标注」，不判转换结果的具体日期。同文件两笔（去链 + 相对日期）连坐，回滚提示须显式标注
「影响其他 N 笔」（H-H2）。

### 1.3 零误报基线（40 条，H-B7）

以下 40 条记忆**不得被删除、不得被隔离、不得被任何判据判为腐烂**——唯二例外：
`fastify-migration-done.md` 的 L0 两笔、`switch-to-vitest.md` 的待裁决报告行（见 1.2 各表）。

1. `api-rate-limit-policy.md`
2. `rate-limiting-rules.md`
3. `use-jest-for-tests.md`
4. `switch-to-vitest.md`
5. `jwt-auth-plugin.md`
6. `rate-limit-store.md`
7. `plugin-order-matters.md`
8. `deploy-env-vars.md`
9. `redis-connection-env.md`
10. `fastify-migration-done.md`
11. `app-entrypoint.md`
12. `api-prefix.md`
13. `users-route-shape.md`
14. `orders-route-shape.md`
15. `pnpm-workflow.md`
16. `redis-retry-config.md`
17. `jwt-secret-env.md`
18. `error-handler-convention.md`
19. `route-naming-style.md`
20. `conventional-commits.md`
21. `node-version-engines.md`
22. `health-route-no-auth.md`
23. `ioredis-lazy-connect.md`
24. `jwt-expiry.md`
25. `orders-pagination.md`
26. `users-schema-validation.md`
27. `logging-pino.md`
28. `user-prefers-short-replies.md`
29. `user-timezone-utc8.md`
30. `user-review-before-apply.md`
31. `no-auto-push.md`
32. `surface-tradeoffs.md`
33. `prefer-small-commits.md`
34. `fastify-plugin-encapsulation.md`
35. `fastify-jwt-usage.md`
36. `fastify-rate-limit-options.md`
37. `ioredis-reconnect-notes.md`
38. `pnpm-lockfile-notes.md`
39. `jwt-best-practices.md`
40. `redis-eviction-policy.md`

**合法双链 5 条（不得报断链）**：

| # | 链接 |
|---|---|
| 1 | app-entrypoint.md → api-prefix.md |
| 2 | jwt-expiry.md → jwt-best-practices.md |
| 3 | prefer-small-commits.md → conventional-commits.md |
| 4 | users-schema-validation.md → route-naming-style.md |
| 5 | ioredis-lazy-connect.md → redis-connection-env.md |

### 1.4 结构信号与档位

- **CLAUDE.md 过期点**：恰 1 处（`npm run build`）——PBI-07 零动作，本轮 dream 提交不得含 CLAUDE.md 变更。
- **阀门配置**：`.claude/claude-dream.local.md` 六键齐全，`llm_checks: off`（考场档位）；
  考试连跑以 env 覆盖 `cooldown_minutes=0`——覆盖标注是 H-A1 的可观察证据。
- **G9 slug 目标**：`cache-helper-notes`（梦一场的隔离对象）。

## 二、熔断库 breaker-yard

### 2.1 git 时间线（3 个固定提交）

| SHA | 提交 | 日期 |
|---|---|---|
| `b0efbc5` | init: 任务骨架 | 2026-08-01T09:00:00+08:00 |
| `97e9707` | refactor: 移除旧任务与中间件——换外部调度 | 2026-08-06T15:00:00+08:00 |
| `eddaa17` | chore: 记忆库入库 | 2026-08-10T11:00:00+08:00 |

### 2.2 种植与算术

- 记忆文件 11 条 → 库存 10% = 1.1 → 阈值 = max(3, 1.1) = **3**；确凿死实体 5 条 → 净消失 5 > 3。
- **对照场**（env 覆盖 `max_deletes: 999` + 冷却 0）：对照场 max_deletes: 999：5 个确凿实体真实被删（净消失 5 > 3）——证明夹具杀伤力（H-G3）；候选隔离、漏登补行照常。
- **正式场**（默认阈值、默认冷却）：正式场默认阈值：净消失 5 > 3 触发熔断——中止整梦、记忆回梦前状态、报告写明熔断原因/真实净消失数（须 = 5，非 6/7）/被回滚动作清单（H-G1/G2）；锁与标记正常释放、冷却照常起算（H-G4）。

**M4 确凿（5 条）**：

| # | 文件 | 引用实体 | 讣告 |
|---|---|---|---|
| 1 | email-worker-notes.md | src/workers/email-worker.js | C2 2026-08-06 |
| 2 | pdf-worker-notes.md | src/workers/pdf-worker.js | C2 2026-08-06 |
| 3 | nightly-report-job.md | src/jobs/nightly-report.js | C2 2026-08-06 |
| 4 | legacy-format-utils.md | src/utils/legacy-format.js | C2 2026-08-06 |
| 5 | session-middleware-notes.md | src/middleware/session.js | C2 2026-08-06 |

**M4 候选（1 条）**：

| 文件 | 引用实体 | 预期处置 |
|---|---|---|
| cache-warmer-notes.md | src/utils/cache-warmer.js | 候选不删，隔离（不计入熔断计数——隔离标记不计入） |

**M5 漏登（1 条）**：

| 文件 | 预期处置 |
|---|---|
| staging-env-vars.md | L0 补索引行——纯索引行修复不计入熔断计数（H-G2 口径） |

## 三、健康库 healthy-garden

- git 时间线见 3.1 节表；记忆文件 10 条，索引完整。
- 体检零检出（或仅报告项）——H-C1；2 条合法链（app-structure→redis-config、users-route→app-structure）不得报断链。

### 3.1 git 时间线（2 个固定提交）

| SHA | 提交 | 日期 |
|---|---|---|
| `3467909` | init: 服务骨架 | 2026-07-15T10:00:00+08:00 |
| `c961bfb` | chore: 记忆库入库 | 2026-07-20T10:00:00+08:00 |

## 四、小库 small-pond

- git 时间线见 4.1 节表；记忆文件 6 条，索引完整。
- 库存 6 < 15 → 报告可见 M2 禁用标注（H-C2）；库本身零腐烂。

### 4.1 git 时间线（2 个固定提交）

| SHA | 提交 | 日期 |
|---|---|---|
| `19ca549` | init: 最小服务 | 2026-07-21T10:00:00+08:00 |
| `b24db27` | chore: 记忆库入库 | 2026-07-22T10:00:00+08:00 |

## 五、G9 留话页模板

- **文件**：`out/g9-note-template.md`（builder 只产模板**不落位**）。
- **内容**：段落标记 `### User` + 隔离 slug `cache-helper-notes` + 用户原话。
- **放置**：上游梦跑完后由 verify.mjs（自动线）或 PO（手工线）放置到底片目录，并同步 ledger.json（file 字段为文件名，按 sessionId 分组）——早放会被正确实现漏检（02.6-AC1 检索窗口 = 上次梦 runId 之后）。
- **预期**：下一场梦报告收录原话 + 出处页指针（H-I1）；台账 basename + 原话保留 + ### User 标记三点契约成立即检索成功（H-I2）。
