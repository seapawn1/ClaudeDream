#!/usr/bin/env node
// PBI-04.1·AC3 + PBI-04.2·AC1："分离进程判条件后跑 Agent SDK"——由 session-end.mjs detached 拉起。
// 读冷却期状态，未到期就直接退出（不重复触发）；到期则落锁再跑梦，防并发重叠。

import { readFileSync, writeFileSync, existsSync, mkdirSync, openSync, closeSync, rmSync } from 'node:fs';
import { dreamPaths, RECURSION_GUARD_ENV, RECURSION_GUARD_VALUE, DEFAULT_COOLDOWN_MINUTES } from './lib/paths.mjs';
import { runDream } from './run-dream.mjs';

// D3 review 抓到的坑：原来的"锁"只是"读冷却期时间戳、没到期就写 running"——纯 check-then-write，
// 两个 SessionEnd 靠得够近时能同时读到"还没人在跑"，然后都往下走，跑出两场并发的梦、两遍互相打架的 git
// commit。冷却期检查留着当快速路径（大多数时候不会真的撞上，没必要每次都走一遍系统调用），但真正的互斥
// 靠这把锁：'wx' 是排他创建，文件已存在就抛 EEXIST——这一步是原子的，检查和创建没有中间状态可插队。
// D3 review 二轮抓到的坑：openSync 成功但后面 writeFileSync/closeSync 失败（少见，但真实存在——磁盘满、
// 权限变化中途发生等）时，锁文件已经在磁盘上创建了，原来的写法会把这个非 EEXIST 错误再抛出去，
// 但没人负责删这个半成品锁文件——之后所有触发都会一直撞见"锁已存在"，梦从此再也跑不起来，
// 且没有人值守能发现。改成：非 EEXIST 的失败也当成"这次没拿到锁"处理，同时把可能已创建的残留清掉，
// 不让一次偶发 I/O 错误变成永久性卡死。
function acquireLock(lockPath) {
  try {
    const fd = openSync(lockPath, 'wx');
    writeFileSync(fd, JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() }));
    closeSync(fd);
    return true;
  } catch (err) {
    if (err?.code !== 'EEXIST') {
      rmSync(lockPath, { force: true });
    }
    return false;
  }
}

function releaseLock(lockPath) {
  rmSync(lockPath, { force: true });
}

async function main() {
  if (process.env[RECURSION_GUARD_ENV] === RECURSION_GUARD_VALUE) {
    return; // AC4 防递归，双保险（session-end.mjs 已经挡过一次）
  }

  const root = process.argv[2] || process.cwd();
  const paths = dreamPaths(root);
  mkdirSync(paths.dreamDir, { recursive: true });

  const cooldownMinutes = Number(process.env.CLAUDE_DREAM_COOLDOWN_MINUTES) || DEFAULT_COOLDOWN_MINUTES;
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

  // 真正的互斥关卡：拿不到锁说明另一个进程正在跑（或者上一场梦异常中断、锁没释放——
  // 后一种情况需要人工核实卡住的原因再手动删 dream.lock，不自动抢锁，抢了反而可能两边一起写）。
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
main().catch(() => {});
