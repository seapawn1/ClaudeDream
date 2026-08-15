#!/usr/bin/env node
// PBI-04.1·AC3 + PBI-04.2·AC1 + Sprint-2 PBI-01.1：由 session-end.mjs detached 拉起的分离进程。
// 顺序职责：①先压底片（本场会话的逐字稿，零 API、零判断，AC5 故障不阻断后续）；
// ②再读冷却期状态，未到期就直接退出（不重复触发）；③到期则落锁再跑梦，防并发重叠。
// 顺序不能倒——注意点7「定序」要求底片写入先于梦启动，两者同源于散会事件、显式定序，
// 不靠"反正压得快"这种时序侥幸。三步同在一个 detached 进程里顺序跑，不是两个进程互相赛跑。

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dreamPaths, runIdNow, RECURSION_GUARD_ENV, RECURSION_GUARD_VALUE } from './lib/paths.mjs';
import { isStaleLock, acquireLock, releaseLock } from './lib/proc-lock.mjs';
import { processSessionTranscript } from './negatives/write-negative.mjs';
import { backfillNegatives } from './negatives/backfill.mjs';
import { resolveConfig } from './engine/config.mjs';
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
  const sessionId = process.argv[3];
  const transcriptPath = process.argv[4];
  const paths = dreamPaths(root);
  mkdirSync(paths.dreamDir, { recursive: true });

  // PBI-01.1：先压本场会话的底片，无论后面冷却期判断结果如何——底片是每场会话都该有的，
  // 不受"这次要不要拉梦"影响。sessionId/transcriptPath 缺失（例如直接 CLI 调试本文件）时
  // 跳过压缩，不影响后续冷却/拉梦逻辑，仅当作没有会话身份信息可用。
  // AC5：压缩过程本身的任何异常都不能向上抛——故障不阻断散会链路，写失败静默降级。
  if (sessionId && transcriptPath) {
    try {
      await processSessionTranscript({ root, sessionId, transcriptPath });
    } catch (err) {
      try {
        appendFileSync(
          paths.negativeErrorTrace,
          JSON.stringify({ ts: new Date().toISOString(), context: 'trigger-check-negative-step', error: String(err?.message ?? err) }) + '\n',
          'utf8'
        );
      } catch {
        // 连留痕都失败：不再重试，继续往下走冷却/拉梦逻辑，AC5 的底线是不阻断后续。
      }
    }
  }

  // AC6：漏网场补捞——「下一个机械触发点」就是这里，每次散会都顺带扫一遍这个项目名下
  // 还没处理过的逐字稿。每个已覆盖的会话在 processSessionTranscript 里都是 O(1) 的台账
  // 命中判断，不会让这一步显著拖慢检查链路。同样不允许向上抛出去阻断后续逻辑。
  try {
    await backfillNegatives({ root });
  } catch (err) {
    try {
      appendFileSync(
        paths.negativeErrorTrace,
        JSON.stringify({ ts: new Date().toISOString(), context: 'trigger-check-backfill-step', error: String(err?.message ?? err) }) + '\n',
        'utf8'
      );
    } catch {
      // 同上，留痕失败也不阻断。
    }
  }

  // PBI-02.1·AC2：enabled: false 时不拉梦——底片产线（上面两步）独立于梦开关，照常已跑完。
  // 读配置在冷却判断之前：阀门配置是整个触发链的配置源，冷却期也消费它（见下）。
  const config = resolveConfig(root);

  if (config.values.enabled === false) {
    return; // 梦被关掉：不判冷却、不拿锁、不跑梦。enabled 的判定只认布尔 false，其余一律按开。
  }

  // 冷却期从阀门配置解析（AC1：cooldown_minutes 键生效；AC4：配置文件 > 环境变量 > 默认值）。
  // 「0=关掉冷却」是合法语义（每次会话结束都触发）。JS 的 || 陷阱不再适用——resolveConfig 已把
  // 非法/负数回退默认，这里拿到的必然是 ≥0 的整数。
  const cooldownMs = config.values.cooldown_minutes * 60 * 1000;

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

  // runId 在这里生成（而非 runDream 内部）——PBI-02.6·AC1 的 G9 检索基准是「上次梦 runId」，
  // 需要它在三种终态（completed/failed/熔断）都留在 last-dream.json 里；熔断场也要有据可查。
  // runDream 接受可选 runId 参数，CLI 直跑不传时内部自行生成（行为不变）。
  const runId = runIdNow();
  const nowIso = () => new Date().toISOString();
  try {
    writeFileSync(paths.lastDreamState, JSON.stringify({ lastDreamAt: nowIso(), runId, status: 'running' }, null, 2), 'utf8');
    // PBI-01.2·AC1：把触发本次梦的 sessionId 带给 runDream，报告里的进料对账行才有据可查——
    // 底片写入（本函数顶部第①步）与这里显式定序，不是两个互不相关的动作凑巧都发生了。
    const summary = await runDream({ root, runId, triggeringSessionId: sessionId });
    // 熔断也是终态之一（02.4-AC3）：如实记 'fused' 而不是笼统 completed——冷却照常起算
    // （lastDreamAt 无条件写），rogue/机械正常场记 'completed'。
    const status = summary?.engine?.fused ? 'fused' : 'completed';
    writeFileSync(paths.lastDreamState, JSON.stringify({ lastDreamAt: nowIso(), runId, status, summary }, null, 2), 'utf8');
  } catch (err) {
    writeFileSync(paths.lastDreamState, JSON.stringify({ lastDreamAt: nowIso(), runId, status: 'failed', error: String(err?.message ?? err) }, null, 2), 'utf8');
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
