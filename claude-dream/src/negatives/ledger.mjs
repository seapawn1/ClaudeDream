// PBI-01.1·AC1（幂等）+ AC6③（台账原子、补捞可重入）：台账（negativeLedger）读写与
// 增量切片。台账记的是「这个 session 上次处理到第几条」，不是 uuid——jsonl 里不少条目类型
// （custom-title/ai-title/mode/permission-mode/queue-operation 等）根本没有 uuid 字段，
// 用行下标计数配合官方「逐字稿只追加、不改写历史」的保证，比找 uuid 落点更简单也更稳。

import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { acquireLock, releaseLock } from '../lib/proc-lock.mjs';

export function readLedger(ledgerPath) {
  if (!existsSync(ledgerPath)) return {};
  try {
    return JSON.parse(readFileSync(ledgerPath, 'utf8'));
  } catch {
    // 损坏的台账不该让整条产线死掉——AC5 的"故障不伤会话"精神同样适用于台账自己。
    // 调用方负责把这个异常情况记进 error trace；这里只负责给出一个安全的空起点。
    return {};
  }
}

// tmp 文件必须和目标同目录，rename 才能保证同文件系统内的原子性（跨盘/跨网络挂载点的
// rename 不是原子操作，但 tmp 与目标本就同目录，不存在这个问题）。
export function writeLedgerAtomic(ledgerPath, data) {
  mkdirSync(path.dirname(ledgerPath), { recursive: true });
  const tmpPath = path.join(path.dirname(ledgerPath), `.ledger-${crypto.randomBytes(6).toString('hex')}.tmp`);
  writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  renameSync(tmpPath, ledgerPath);
}

/**
 * 拿锁 -> 读台账 -> 跑 mutator(ledger) 拿到新台账 -> 原子写 -> 放锁。
 * 拿不到锁（另一进程正持有活锁）时不无限等——重试几次退避后放弃，返回 null 让调用方
 * 记录"这次没写成、下次触发点再试"，不阻塞散会链路（AC5 精神）。
 * @param {string} lockPath
 * @param {string} ledgerPath
 * @param {(ledger: object) => object} mutator
 * @returns {object|null} 写入成功返回新台账，放弃返回 null
 */
export function withLedgerLock(lockPath, ledgerPath, mutator) {
  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (acquireLock(lockPath)) {
      try {
        const ledger = readLedger(ledgerPath);
        const next = mutator(ledger);
        writeLedgerAtomic(ledgerPath, next);
        return next;
      } finally {
        releaseLock(lockPath);
      }
    }
    // 短退避后重试——台账读改写是毫秒级操作，活锁通常很快释放；不是长时间持锁的场景。
    const until = Date.now() + 40 * (attempt + 1);
    while (Date.now() < until) { /* busy-wait 退避 */ }
  }
  return null;
}

/**
 * 给定完整解析后的条目数组与该 session 现有台账记录，切出「自上次处理以来的新增部分」。
 * @param {object[]} entries 当前 transcript 的全部已解析条目（按原稿顺序）
 * @param {{lastProcessedCount?: number}|undefined} sessionRecord
 * @returns {{newEntries: object[], fromIndex: number, toIndex: number, anomaly: string|null}}
 */
export function sliceNewEntries(entries, sessionRecord) {
  const lastCount = sessionRecord?.lastProcessedCount ?? 0;
  if (entries.length < lastCount) {
    // 逐字稿理应只追加不缩短——真出现这种情况说明有异常（文件被重置等），保守起见
    // 不重新处理已处理过的部分（防止产生重复内容的第二页），只标记异常留给调用方决定要不要报警。
    return { newEntries: [], fromIndex: lastCount, toIndex: entries.length, anomaly: 'transcript-shorter-than-recorded' };
  }
  return {
    newEntries: entries.slice(lastCount),
    fromIndex: lastCount,
    toIndex: entries.length,
    anomaly: null,
  };
}

/**
 * 纯函数：把一页的处理结果记进台账（不落盘，调用方经 withLedgerLock 的 mutator 使用）。
 */
export function recordPage(ledger, sessionId, { file, fromIndex, toIndex, entryCount, processedAt }) {
  const prev = ledger[sessionId] ?? { pages: [] };
  return {
    ...ledger,
    [sessionId]: {
      lastProcessedCount: toIndex,
      lastProcessedAt: processedAt,
      pages: [...prev.pages, { file, fromIndex, toIndex, entryCount, processedAt }],
    },
  };
}
