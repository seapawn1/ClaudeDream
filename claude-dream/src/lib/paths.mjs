import path from 'node:path';

export const RECURSION_GUARD_ENV = 'CLAUDE_INVOKED_BY';
export const RECURSION_GUARD_VALUE = 'claude-dream';
export const DEFAULT_COOLDOWN_MINUTES = 30;

export function dreamPaths(root) {
  const claudeDir = path.join(root, '.claude');
  const dreamDir = path.join(claudeDir, 'dream');
  const memoryDir = path.join(claudeDir, 'memory');
  // Sprint-2 底片目录禁区（SprintBacklog 注意点5，硬约束）：不在 .claude/dream（白名单可写）、
  // 不在 .claude/memory（破 D2）、必须在 canUseTool 白名单外、不入梦前快照 pathspec。
  // 挑 .claude/negatives 作平级新目录，天然满足这四条——见 scope-guard.mjs 的 judgePath 与
  // run-dream.mjs 的 preDreamSnapshot pathspec，两处都只认 memoryDir/dreamDir/claudeMd 三处，
  // negativesDir 不在其中即代表结构上碰不到（不是靠"记得别加"，是压根没写在白名单里）。
  const negativesDir = path.join(claudeDir, 'negatives');
  return {
    root,
    claudeDir,
    memoryDir,
    dreamDir,
    claudeMd: path.join(root, 'CLAUDE.md'),
    memoryIndex: path.join(memoryDir, 'MEMORY.md'),
    sessionEndMarker: path.join(dreamDir, 'session-end-marker.json'),
    lastDreamState: path.join(dreamDir, 'last-dream.json'),
    promptCarrier: path.join(dreamDir, 'next-session-prompt.txt'),
    lockFile: path.join(dreamDir, 'dream.lock'),
    // AC6①：补捞时排除梦会话自己的逐字稿（防自吞污染底片）。run-dream.mjs 在拿到自己那场
    // Agent SDK 调用的 session_id 后追加一行到这里；backfill.mjs 读这份名单跳过对应文件。
    // 不靠解析 prompt 文本猜"这像不像梦的开场白"——那是语义判断，这是机械登记。
    dreamSessionIdsLog: path.join(dreamDir, 'dream-session-ids.log'),
    negativesDir,
    negativeLedger: path.join(negativesDir, 'ledger.json'),
    negativeLedgerLock: path.join(negativesDir, 'ledger.lock'),
    // AC5：错误留痕落点在底片目录之外——放在 .claude 根下，不在 negativesDir 里、也不挤进
    // dreamDir（那是梦引擎自己的证据目录，底片产线是独立于梦的另一条流水线，日志各管各的）。
    negativeErrorTrace: path.join(claudeDir, 'negatives-error.log'),
  };
}

// 供 run-id 用：ISO 时间去掉冒号/点，安全用作文件名
export function runIdNow() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}
