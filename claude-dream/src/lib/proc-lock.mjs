// 通用「pid 存活判定」文件锁——从 trigger-check.mjs 抽出来给台账写入（negatives/ledger.mjs）
// 复用，语义不变。原始踩坑记录见 trigger-check.mjs 里这三个函数曾经所在位置的历史注释
// （D3 review 三轮的教训：check-then-write 不是原子的、非 EEXIST 失败要清残留、EEXIST 不代表
// 活锁——可能是崩溃残留，靠锁文件里的 pid 是否查得到进程来判活/死）。

import { readFileSync, writeFileSync, rmSync } from 'node:fs';

export function isStaleLock(lockPath) {
  let pid = null;
  try {
    const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
    pid = lock?.pid;
  } catch {
    const until = Date.now() + 10;
    while (Date.now() < until) { /* 忙等 10ms，让正在写入的持锁者写完 */ }
    try {
      const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
      pid = lock?.pid;
    } catch {
      return true;
    }
  }
  if (typeof pid !== 'number' || pid <= 0) {
    return true;
  }
  try {
    process.kill(pid, 0);
    return false;
  } catch (err) {
    return err?.code === 'ESRCH';
  }
}

export function acquireLock(lockPath) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      writeFileSync(lockPath, JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() }), { flag: 'wx' });
      return true;
    } catch (err) {
      if (err?.code === 'EEXIST' && isStaleLock(lockPath)) {
        rmSync(lockPath, { force: true });
        continue;
      }
      if (err?.code !== 'EEXIST') {
        rmSync(lockPath, { force: true });
      }
      return false;
    }
  }
  return false;
}

export function releaseLock(lockPath) {
  rmSync(lockPath, { force: true });
}
