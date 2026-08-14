#!/usr/bin/env node
// PBI-04.1·AC2/AC3/AC4 + Sprint-2 交付接口约定①：SessionEnd hook 入口。零 API、零判断——
// 只落一个时间戳标记，然后甩给一个分离进程去做底片压缩、判冷却期、拉梦。hook 本身必须快返回，
// 不阻塞会话退出（README 架构 S5 的硬约束：SessionEnd 触发之后没有 LLM 在运行）。
//
// Sprint-2 起硬性要求：必须从 stdin 拿到官方 SessionEnd hook payload（字段名 snake_case，
// 官方文档 hooks#sessionend-input 核实：session_id / transcript_path / cwd）。stdin 空、
// 非 JSON、或缺任一必需字段——一律不落底片、不拉梦触发链，只留痕退出。Sprint-1 老约定
// （stdin 关闭时裸用 process.cwd() 照常拉梦）本轮起废止：底片是这条链路存在的意义，
// 拿不到干净的 session 身份信息就悄悄放过一场会话，等于底片产线本身在撒谎说"我覆盖了"。

import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dreamPaths, RECURSION_GUARD_ENV, RECURSION_GUARD_VALUE } from './lib/paths.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// D3 review 抓到的坑：官方文档确认 SessionEnd hook 默认共享 1.5 秒预算（注意点2），改之前
// 这里硬编码 2000ms——比外部预算还长，等于这道内部保险丝在默认配置下永远不会先于外部强杀
// 触发，形同虚设。改成读同一个官方覆盖开关（CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS，
// 验收考场可能会调大它）按比例收窄，默认情况下留 300ms 安全余量。
function stdinTimeoutMs() {
  const override = Number(process.env.CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS);
  if (Number.isFinite(override) && override > 0) {
    return Math.max(200, Math.round(override * 0.8));
  }
  return 1200;
}

async function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(data));
    // stdin 关闭（非交互调用）会立即 end；给一个保险超时防止极端情况下挂住 hook。
    setTimeout(() => resolve(data), stdinTimeoutMs());
  });
}

// 校验失败时无法信任 payload.cwd——但仍要留痕，只能退而求其次用 hook 进程自己的
// process.cwd()（Claude Code 调 hook 时本就以项目根为工作目录）。这不是"静默 fallback
// 继续正常流程"，是"记一笔诊断信息然后老实退出"，两者不是一回事。
function logInvalidPayload(reason, raw) {
  try {
    const paths = dreamPaths(process.cwd());
    mkdirSync(path.dirname(paths.negativeErrorTrace), { recursive: true });
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      context: 'session-end-invalid-payload',
      reason,
      rawStdinPreview: raw.slice(0, 500),
    });
    appendFileSync(paths.negativeErrorTrace, line + '\n', 'utf8');
  } catch {
    // 连留痕都失败：到这一步没有更安全的退路了，安静退出（AC5 底线：不能让 hook 抛出去炸会话）。
  }
}

async function main() {
  // AC4：梦进程自身结束不再触发（防递归）。
  if (process.env[RECURSION_GUARD_ENV] === RECURSION_GUARD_VALUE) {
    return;
  }

  const raw = await readStdin();

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    logInvalidPayload('stdin empty or not valid JSON', raw);
    return;
  }

  const { session_id: sessionId, transcript_path: transcriptPath, cwd } = payload ?? {};
  if (!sessionId || !transcriptPath || !cwd) {
    logInvalidPayload(
      `missing required field(s): ${['session_id', 'transcript_path', 'cwd'].filter((k) => !payload?.[k]).join(', ')}`,
      raw
    );
    return;
  }

  const paths = dreamPaths(cwd);
  mkdirSync(paths.dreamDir, { recursive: true });
  // 零 API、零判断：无条件落时间戳，冷却期判断留给分离进程。
  writeFileSync(paths.sessionEndMarker, JSON.stringify({ lastSessionEndAt: new Date().toISOString(), sessionId }, null, 2), 'utf8');

  // 注意点7「定序」：底片压缩与冷却检查/拉梦同在 trigger-check.mjs 的 main() 里顺序执行
  // （压缩在前），不是两个各自独立 detached 的进程互相赛跑——见 trigger-check.mjs 顶部注释。
  const triggerCheck = path.join(__dirname, 'trigger-check.mjs');
  const child = spawn(process.execPath, [triggerCheck, cwd, sessionId, transcriptPath], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
}

main();
