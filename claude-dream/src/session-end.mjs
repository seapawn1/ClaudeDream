#!/usr/bin/env node
// PBI-04.1·AC2/AC3/AC4：SessionEnd hook 入口。零 API、零判断——只落一个时间戳标记，
// 然后甩给一个分离进程去判冷却期、拉梦。hook 本身必须快返回，不阻塞会话退出
// （README 架构 S5 的硬约束：SessionEnd 触发之后没有 LLM 在运行）。

import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dreamPaths, RECURSION_GUARD_ENV, RECURSION_GUARD_VALUE } from './lib/paths.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(data));
    // stdin 关闭（非交互调用）会立即 end；给一个保险超时防止极端情况下挂住 hook。
    setTimeout(() => resolve(data), 2000);
  });
}

async function main() {
  // AC4：梦进程自身结束不再触发（防递归）。
  if (process.env[RECURSION_GUARD_ENV] === RECURSION_GUARD_VALUE) {
    return;
  }

  const raw = await readStdin();
  let cwd = process.cwd();
  try {
    const payload = JSON.parse(raw);
    if (payload?.cwd) cwd = payload.cwd;
  } catch {
    // 非 JSON / 空 stdin：按约定 fallback 到 process.cwd()（adapter.json 里已声明非交互式以此为准）
  }

  const paths = dreamPaths(cwd);
  mkdirSync(paths.dreamDir, { recursive: true });
  // 零 API、零判断：无条件落时间戳，冷却期判断留给分离进程。
  writeFileSync(paths.sessionEndMarker, JSON.stringify({ lastSessionEndAt: new Date().toISOString() }, null, 2), 'utf8');

  const triggerCheck = path.join(__dirname, 'trigger-check.mjs');
  const child = spawn(process.execPath, [triggerCheck, cwd], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
}

main();
