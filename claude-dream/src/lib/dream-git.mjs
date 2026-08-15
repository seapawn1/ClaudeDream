// 梦进程共用的 git 操作层：P0 梦前快照、dream:/dream-evidence: 双提交拆分、运行态文件排除。
// 从 Sprint-1 的 run-dream.mjs 原样抽出（机械管线与 rogue 故障演练两条路径共用同一套
// git 语义），零 SDK。全部经 execFileSync(argv 数组) 调用——受信任代码，不经 shell。
//
// 三个 D3 review 磨出来的坑都在这里钉死（不重复注释细节，只留指针）：
// 1. 运行态文件（last-dream.json 等）永不进任何提交——否则 git 历史永久留一份「梦还在跑」假记录；
// 2. commit 只提交「梦自己 add 的那几处」：判断范围与提交范围一致（stagedFiles + 精确路径喂 commit），
//    不吞人类暂存、不因空目录报 pathspec did not match；
// 3. C7：报告/日志走 dream-evidence: 独立提交，revert dream: 不销毁审计轨迹。

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

// 纯运行态（冷却判断、锁），不是证据，不该进版本历史。
const NEVER_COMMIT_BASENAMES = new Set(['last-dream.json', 'session-end-marker.json', 'dream.lock', 'dream-session-ids.log']);

export function git(root, args) {
  // windowsHide：无人值守跑梦的硬要求——SessionEnd 触发后没人盯着屏幕，每次 git 调用都弹
  // 一下控制台窗口的话，「安静地在后台做完」这个承诺直接破功。
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
}

export function gitTry(root, args) {
  try {
    return { ok: true, out: git(root, args) };
  } catch (err) {
    return { ok: false, out: '', err: String(err?.message ?? err) };
  }
}

export function unstageOperationalState(root, dreamDir) {
  for (const name of NEVER_COMMIT_BASENAMES) {
    gitTry(root, ['reset', '--', path.join(dreamDir, name)]); // 没被 add 过也无所谓，忽略结果
  }
}

/** 只算「梦自己 add 的、确实被 staged 的具体文件」——精确路径，喂 commit 不会空匹配。 */
export function stagedFiles(root, pathspec) {
  const out = git(root, ['diff', '--cached', '--name-only', '--', ...(pathspec ?? [])]);
  return out ? out.split('\n').map((l) => l.trim()).filter(Boolean) : [];
}

/** P0：梦前快照。只对 .claude/memory、.claude/dream（刨去运行态文件）、CLAUDE.md 有待提交变更时才提交。 */
export function preDreamSnapshot(root, paths, runId) {
  const pathspec = [paths.memoryDir, paths.dreamDir, paths.claudeMd].filter(existsSync);
  if (pathspec.length > 0) {
    git(root, ['add', '--', ...pathspec]);
    unstageOperationalState(root, paths.dreamDir);
    const staged = stagedFiles(root, pathspec);
    if (staged.length > 0) {
      git(root, ['commit', '-m', `dream-pre: 梦前快照 ${runId}`, '--', ...staged]);
    } else {
      // 裸 git reset 会把整个暂存区退回 HEAD（含人类暂存）——只退自己加过的这几处
      gitTry(root, ['reset', '--', ...pathspec]);
    }
  }
  const head = gitTry(root, ['rev-parse', 'HEAD']);
  return head.ok ? head.out : null;
}

/** dream: 提交（记忆+CLAUDE.md，回滚原子）。无变更则不提交，返回空对象。 */
export function commitMemoryResults(root, paths, runId, tag) {
  const commits = {};
  const memoryPathspec = [paths.memoryDir, paths.claudeMd].filter(existsSync);
  if (memoryPathspec.length > 0) {
    try {
      git(root, ['add', '--', ...memoryPathspec]);
      const staged = stagedFiles(root, memoryPathspec);
      if (staged.length > 0) {
        git(root, ['commit', '-m', `dream: ${runId} ${tag}`, '--', ...staged]);
        commits.dream = git(root, ['rev-parse', 'HEAD']);
      }
    } catch (err) {
      commits.dreamError = String(err?.message ?? err);
      gitTry(root, ['reset', '--', ...memoryPathspec]);
    }
  }
  return commits;
}

/** dream-evidence: 提交（报告与执行日志，C7：不随 dream: revert 销毁）。 */
export function commitEvidenceResults(root, paths, runId) {
  const commits = {};
  if (existsSync(paths.dreamDir)) {
    try {
      git(root, ['add', '--', paths.dreamDir]);
      unstageOperationalState(root, paths.dreamDir);
      const staged = stagedFiles(root, [paths.dreamDir]);
      if (staged.length > 0) {
        git(root, ['commit', '-m', `dream-evidence: ${runId} 报告与日志`, '--', ...staged]);
        commits.evidence = git(root, ['rev-parse', 'HEAD']);
      } else {
        gitTry(root, ['reset', '--', paths.dreamDir]);
      }
    } catch (err) {
      commits.evidenceError = String(err?.message ?? err);
      gitTry(root, ['reset', '--', paths.dreamDir]);
    }
  }
  return commits;
}

export function countMemoryFiles(memoryDir) {
  if (!existsSync(memoryDir)) return 0;
  return readdirSync(memoryDir).filter((f) => f.endsWith('.md') && f !== 'MEMORY.md').length;
}
