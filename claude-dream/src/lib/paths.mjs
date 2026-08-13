import path from 'node:path';

export const RECURSION_GUARD_ENV = 'CLAUDE_INVOKED_BY';
export const RECURSION_GUARD_VALUE = 'claude-dream';
export const DEFAULT_COOLDOWN_MINUTES = 30;

export function dreamPaths(root) {
  const claudeDir = path.join(root, '.claude');
  const dreamDir = path.join(claudeDir, 'dream');
  const memoryDir = path.join(claudeDir, 'memory');
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
  };
}

// 供 run-id 用：ISO 时间去掉冒号/点，安全用作文件名
export function runIdNow() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}
