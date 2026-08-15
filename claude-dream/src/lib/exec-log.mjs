// 受信任代码执行外部命令的唯一通道 + C2 证据形态的数据源。
// PBI-02.2 架构前提：机械管线由受信任代码直接执行——这里用 execFileSync(argv 数组) 调 git，
// 不经 shell、不经 SDK、不经 canUseTool（scope-guard 的 judgeShell 无条件拒绝一切 shell 命令，
// 机械管线绕开它的理由见 SprintBacklog 1.1，不重复）。
//
// C2「证据栏改贴执行日志」：真实执行的命令记——命令原文 + exit code + stdout 摘要 + 时间戳；
// 纯代码判据（文件系统比对）记——判据输入、判定结果、时间戳。两类证据都落执行日志文件
// （.claude/dream/<runId>-engine.log，JSONL），报告只引用日志，不出现无记录支撑的论证式证据。

import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const SUMMARY_MAX = 500;

function summarize(s) {
  const str = String(s ?? '');
  if (str.length <= SUMMARY_MAX) return str;
  return str.slice(0, SUMMARY_MAX) + `…（截断，原 ${str.length} 字符）`;
}

/**
 * @param {object} opts
 * @param {string} [opts.logFile] 执行日志落点；不传时只返回 entry 不落盘（纯函数单测用）
 */
export function createEngineLog({ logFile } = {}) {
  if (logFile) mkdirSync(path.dirname(logFile), { recursive: true });

  function append(entry) {
    if (!logFile) return entry;
    appendFileSync(logFile, JSON.stringify(entry) + '\n', 'utf8');
    return entry;
  }

  return {
    /**
     * 执行外部命令（argv 数组，不经 shell）。
     * @returns {{ok: boolean, stdout: string, stderr: string, entry: object}}
     *   ok=false 含两类：非零退出码（如 git grep 无命中退出 1——调用方须按语义区分，
     *   exitCode 在 entry 里）与进程级失败。每次调用无论成败都记录执行日志条目。
     */
    run(command, args, { cwd } = {}) {
      const entry = {
        ts: new Date().toISOString(),
        kind: 'command',
        command: [command, ...(args ?? [])].join(' '),
        exitCode: 0,
        stdoutSummary: '',
        stderrSummary: '',
      };
      try {
        const stdout = execFileSync(command, args, { cwd, encoding: 'utf8', windowsHide: true });
        entry.exitCode = 0;
        entry.stdoutSummary = summarize(stdout);
        return { ok: true, stdout, stderr: '', entry: append(entry) };
      } catch (err) {
        entry.exitCode = typeof err.status === 'number' ? err.status : -1;
        entry.stdoutSummary = summarize(err.stdout);
        entry.stderrSummary = summarize(err.stderr);
        entry.error = String(err?.message ?? err);
        return { ok: false, stdout: String(err.stdout ?? ''), stderr: String(err.stderr ?? ''), entry: append(entry) };
      }
    },
    /**
     * 纯代码判据的证据记录（C2 第二种记法）：判据输入、判定结果、时间戳。
     * 传入字段自由扩展；ts 由这里统一盖戳，调用方不要自己传。
     */
    record(fields) {
      return append({ ts: new Date().toISOString(), kind: 'code', ...fields });
    },
  };
}
