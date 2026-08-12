#!/usr/bin/env node
// PBI-04.3·AC4：下次会话开场出现一行提示。纯 stdout 输出，Claude Code 会自动把 stdout 加进上下文
// （SessionStart 事件契约）。看一次就消费掉，不然会一直重复提示。

import { readFileSync, existsSync, rmSync } from 'node:fs';
import { dreamPaths } from './lib/paths.mjs';

async function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(data));
    setTimeout(() => resolve(data), 2000);
  });
}

async function main() {
  const raw = await readStdin();
  let cwd = process.cwd();
  try {
    const payload = JSON.parse(raw);
    if (payload?.cwd) cwd = payload.cwd;
  } catch {
    // 非交互调用 fallback 到 process.cwd()
  }

  const paths = dreamPaths(cwd);
  if (existsSync(paths.promptCarrier)) {
    const line = readFileSync(paths.promptCarrier, 'utf8').trim();
    if (line) {
      console.log(line);
    }
    rmSync(paths.promptCarrier, { force: true });
  }
}

main();
