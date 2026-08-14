#!/usr/bin/env node
// PBI-04.1·AC3 + PBI-04.2·AC1："分离进程判条件后跑 Agent SDK"——由 session-end.mjs detached 拉起。
// 读冷却期状态，未到期就直接退出（不重复触发）；到期则落锁再跑梦，防并发重叠。

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dreamPaths, RECURSION_GUARD_ENV, RECURSION_GUARD_VALUE, DEFAULT_COOLDOWN_MINUTES } from './lib/paths.mjs';
import { isStaleLock, acquireLock, releaseLock } from './lib/proc-lock.mjs';
import { runDream } from './run-dream.mjs';

// 锁的 pid 存活判定逻辑（D3 三轮 review 磨出来的：check-then-write 非原子、非 EEXIST 失败要清残留、
// EEXIST 不代表活锁可能是崩溃残留……）已抽到 lib/proc-lock.mjs——Sprint-2 台账写入
// （negatives/ledger.mjs）要用同一套语义，这里重导出，保持这三个名字可从本文件 import 不变
// （self-test.mjs 现有引用不用跟着改）。
export { isStaleLock, acquireLock, releaseLock };

async function main() {
  if (process.env[RECURSION_GUARD_ENV] === RECURSION_GUARD_VALUE) {
    return; // AC4 防递归，双保险（session-end.mjs 已经挡过一次）
  }

  const root = process.argv[2] || process.cwd();
  const paths = dreamPaths(root);
  mkdirSync(paths.dreamDir, { recursive: true });

  // 「0=关掉冷却」是合法语义（冷却期可配置，0 分钟=每次会话结束都触发）。原写法 Number(env) || 默认
  // 会把 0 当 falsy 吞成默认 30 分钟——JS 的 || 陷阱，不是设计。显式判：未设置/非法/负数回退默认，其余含 0 照用。
  const parsedCooldown = Number(process.env.CLAUDE_DREAM_COOLDOWN_MINUTES);
  const cooldownMinutes = Number.isFinite(parsedCooldown) && parsedCooldown >= 0 ? parsedCooldown : DEFAULT_COOLDOWN_MINUTES;
  const cooldownMs = cooldownMinutes * 60 * 1000;

  let lastState = null;
  if (existsSync(paths.lastDreamState)) {
    try {
      lastState = JSON.parse(readFileSync(paths.lastDreamState, 'utf8'));
    } catch {
      lastState = null;
    }
  }

  if (lastState?.lastDreamAt) {
    const elapsed = Date.now() - new Date(lastState.lastDreamAt).getTime();
    if (elapsed < cooldownMs) {
      return; // AC3：冷却期内不重复触发（快速路径，不要求本身无race——真正的互斥靠下面的锁）
    }
  }

  // 真正的互斥关卡：拿不到锁说明另一个进程正在跑（活锁，别碰），或者上一场梦异常中断、锁没释放
  // （死锁残留）。两者靠锁文件里的 pid 存活检测区分：pid 活着 = 别抢；pid 死了 = 残留，安全清掉重抢。
  // 这样崩溃后无需人工干预就能自愈，同时不会误抢活锁引发并发（详见 acquireLock/isStaleLock）。
  if (!acquireLock(paths.lockFile)) {
    return;
  }

  try {
    writeFileSync(paths.lastDreamState, JSON.stringify({ lastDreamAt: new Date().toISOString(), status: 'running' }, null, 2), 'utf8');
    const summary = await runDream({ root });
    writeFileSync(paths.lastDreamState, JSON.stringify({ lastDreamAt: new Date().toISOString(), status: 'completed', summary }, null, 2), 'utf8');
  } catch (err) {
    writeFileSync(paths.lastDreamState, JSON.stringify({ lastDreamAt: new Date().toISOString(), status: 'failed', error: String(err?.message ?? err) }, null, 2), 'utf8');
  } finally {
    releaseLock(paths.lockFile);
  }
}

// 这是 detached、stdio:'ignore' 的后台进程，没人盯着它的 stderr——未捕获异常在这里等于静默死掉，
// 不会比"main() 内部已处理、正常返回"更糟，但至少不会抛成 Node 的 unhandled rejection 警告/退出码异常。
// CLI 守卫：只有被 node 直接执行（argv[1] 是本文件）时才跑 main()；被测试 import 时只拿到 isStaleLock/
// acquireLock/releaseLock，不触发真梦（和 run-dream.mjs 末尾的守卫同一个约定）。
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(() => {});
}
