#!/usr/bin/env node
// 梦进程主体（Sprint-3 机械版）：纯机械梦编排——零 SDK、零网络、无登录态可跑整场。
// 管线：P0 梦前快照 → G9 定向翻底片（02.6）→ M1–M5 机械体检（02.2）→ 处置+熔断在线（02.3/02.4）
//     → 熔断回滚或 dream: 提交 → 六节报告（02.5）→ dream-evidence: 提交 → 提示行载体。
// 机械管线全部由受信任代码直接执行（SprintBacklog 1.1 架构前提）；本文件不 import SDK 包名，
// SDK 只存在于 run-dream-rogue.mjs（rogue 故障演练路径，动态 import）——机械路径零 SDK
// 由零 API 静态检查 + 无登录态运行自证双保险。
// 既有机制保持：CLAUDE_INVOKED_BY 防递归 env、dreamSessionIdsLog 登记随 rogue 路径保留；
// 机械路径无 SDK 子进程，三者「用不上」而非「失效」，不得删除（PBI-07 恢复后继续可用）。

import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dreamPaths, runIdNow } from './lib/paths.mjs';
import { createEngineLog } from './lib/exec-log.mjs';
import { resolveConfig } from './engine/config.mjs';
import { runMechanicalChecks } from './engine/check.mjs';
import { applyDisposal } from './engine/act.mjs';
import { fuseThreshold, shouldFuse, buildFuseDetail, restoreToPreDream } from './engine/fuse.mjs';
import { buildReport } from './engine/report.mjs';
import { retrieveUserMessages } from './engine/g9.mjs';
import { preDreamSnapshot, commitMemoryResults, commitEvidenceResults, countMemoryFiles } from './lib/dream-git.mjs';

const __filename = fileURLToPath(import.meta.url);
const ROGUE_TARGET_NAME = 'ROGUE-TARGET.md';

// PBI-01.2·AC1：进料对账——机械读台账，不由模型自述（Sprint-2 契约，保持原样）。
function negativeFeedReconciliation(paths, triggeringSessionId) {
  if (!triggeringSessionId) {
    return { triggeringSessionId: null, found: false, pageCount: 0, latestPage: null };
  }
  let ledger = {};
  try {
    if (existsSync(paths.negativeLedger)) {
      ledger = JSON.parse(readFileSync(paths.negativeLedger, 'utf8'));
    }
  } catch {
    // 台账读不出：对账如实报告「查不到」，不是梦失败的理由——这一步只负责写实。
  }
  const record = ledger[triggeringSessionId];
  const pages = record?.pages ?? [];
  return {
    triggeringSessionId,
    found: pages.length > 0,
    pageCount: pages.length,
    latestPage: pages.length > 0 ? pages[pages.length - 1].file : null,
  };
}

export async function runDream({ root, rogue = false, rogueTarget, triggeringSessionId, runId: providedRunId, baselineRunId }) {
  const rogueTargetPath = rogueTarget || ROGUE_TARGET_NAME;
  const runId = providedRunId || runIdNow();
  const paths = dreamPaths(root);
  mkdirSync(paths.memoryDir, { recursive: true });
  mkdirSync(paths.dreamDir, { recursive: true });

  // 阀门配置（02.1）：机械管线的全部档位都从这里解析
  const config = resolveConfig(root);
  const engineLogFile = path.join(paths.dreamDir, `${runId}-engine.log`);
  const exec = createEngineLog({ logFile: engineLogFile });

  const negativeFeed = negativeFeedReconciliation(paths, triggeringSessionId);
  const preSha = preDreamSnapshot(root, paths, runId);

  if (rogue) {
    // 故障演练路径（SDK 占位引擎 + canUseTool 围栏回归，需要登录态）——动态 import，
    // 机械路径永远不会加载 SDK 模块。
    const { runRogueDream } = await import('./run-dream-rogue.mjs');
    return runRogueDream({ root, runId, rogueTargetPath, paths, preSha, negativeFeed });
  }

  // ===== 机械管线（零 SDK / 零网络）=====
  const beforeCount = countMemoryFiles(paths.memoryDir);

  // D3 定向：梦开工前先翻底片找用户留话（02.6·AC1「梦定向阶段先读底片」）。
  // baselineRunId 由 trigger-check 在覆写 last-dream.json 之前读出并传入（D3 review F1：
  // 此处再读 last-dream.json 拿到的是本梦 running 态的 runId，基线会自指导致翻底片恒空）。
  // CLI 直跑不传时 g9 内部自行回退读 last-dream.json（该路径下无覆写顺序问题）。
  const g9 = retrieveUserMessages({ root, paths, exec, baselineRunId });

  // S6 体检（02.2）
  const { findings, mems, meta } = runMechanicalChecks({ root, paths, exec });

  // S7 处置 + 熔断在线（02.3/02.4）：净消失数每笔核对，破线即中止整梦
  const threshold = fuseThreshold({ maxDeletes: config.values.max_deletes, memoryCount: meta.memoryCount });
  const disposal = applyDisposal({
    root, paths, config, mems, findings, runId, exec, preSha,
    onDelete: (net) => shouldFuse({ netDisappeared: net, threshold: threshold.threshold }),
  });

  let fuseDetail = null;
  if (disposal.fused) {
    fuseDetail = buildFuseDetail({ threshold, netDisappeared: disposal.netDeleted, journal: disposal.journal });
    const restore = restoreToPreDream({ root, paths, preSha, exec });
    if (!restore.ok) {
      // 回滚失败 = 最坏情况：报告必须如实写明，不许粉饰
      fuseDetail.restoreFailed = restore.entry?.error ?? '未知回滚失败';
    }
  }

  const afterCount = countMemoryFiles(paths.memoryDir);

  // S9 提交拆分（C7 保持）：dream:（记忆，回滚原子）在前——报告要引用它的 sha。
  // 熔断场记忆已回滚，无 dream: 提交。
  const commits = {};
  if (!disposal.fused) {
    Object.assign(commits, commitMemoryResults(root, paths, runId, '机械整合'));
  }

  // S8 报告（02.5，六节，含 G9 摘录与熔断详情）
  const report = buildReport({
    runId, paths, config, checkMeta: meta, disposal, fuseDetail,
    preSha, dreamSha: commits.dream ?? null,
    negativeFeed, g9Quotes: g9.quotes,
    engineLogRel: `.claude/dream/${runId}-engine.log`,
  });
  writeFileSync(path.join(paths.dreamDir, `${runId}-report.md`), report, 'utf8');

  // 提示行载体（SessionStart 消费；30 秒版的一句话形态）。
  // D3 review F3：回滚失败不得谎称已回滚；L1：零处置但有待裁决时不谎称「零发现」。
  const pendingCount = disposal.pendingRulings.length;
  const summaryLine = disposal.fused
    ? fuseDetail?.restoreFailed
      ? `昨夜做了一场机械梦（${runId}）：触发了熔断，回滚失败——请立即人工核对，详见 .claude/dream/${runId}-report.md`
      : `昨夜做了一场机械梦（${runId}）：触发了熔断，记忆已回滚到梦前状态，详见 .claude/dream/${runId}-report.md`
    : disposal.journal.length > 0
      ? `昨夜做了一场机械梦（${runId}）：处置 ${disposal.journal.length} 笔（删除 ${disposal.netDeleted}）${pendingCount > 0 ? `，另有 ${pendingCount} 条待你裁决` : ''}，详见 .claude/dream/${runId}-report.md`
      : pendingCount > 0
        ? `昨夜做了一场机械梦（${runId}）：无自动处置，${pendingCount} 条待你裁决，详见 .claude/dream/${runId}-report.md`
        : `昨夜做了一场机械梦（${runId}）：体检零发现，无处置，详见 .claude/dream/${runId}-report.md`;
  writeFileSync(paths.promptCarrier, summaryLine, 'utf8');

  // 证据提交（报告 + 执行日志；刨去运行态文件）——C7：不随 dream: revert 销毁
  Object.assign(commits, commitEvidenceResults(root, paths, runId));

  return {
    runId,
    sdkError: null,
    beforeCount,
    afterCount,
    preSha,
    commits,
    reportPath: path.join(paths.dreamDir, `${runId}-report.md`),
    placeholderLanded: null, // 机械梦不产占位文件（Sprint-1 占位引擎的遗留字段，保持形状兼容）
    rogueBlocked: null,
    negativeFeed,
    engine: {
      configValues: config.values,
      configNotes: config.notes,
      envOverriddenKeys: config.envOverriddenKeys,
      meta,
      findingCount: findings.length,
      journal: disposal.journal,
      pendingRulings: disposal.pendingRulings,
      netDeleted: disposal.netDeleted,
      fused: disposal.fused,
      fuseDetail,
      g9: { quotes: g9.quotes.length, baselineRunId: g9.baselineRunId, pagesAfterBaseline: g9.pagesAfterBaseline },
    },
  };
}

// CLI 入口：node run-dream.mjs [--rogue] [--target=<相对项目根的路径>] [--session=<触发会话的 session_id>] [root]
if (process.argv[1] === __filename) {
  const args = process.argv.slice(2);
  const rogue = args.includes('--rogue');
  const targetArg = args.find((a) => a.startsWith('--target='));
  const rogueTarget = targetArg ? targetArg.slice('--target='.length) : undefined;
  const sessionArg = args.find((a) => a.startsWith('--session='));
  const triggeringSessionId = sessionArg ? sessionArg.slice('--session='.length) : undefined;
  const root = args.find((a) => !a.startsWith('--')) || process.cwd();
  runDream({ root, rogue, rogueTarget, triggeringSessionId }).then((summary) => {
    console.log(JSON.stringify(summary, null, 2));
    process.exit(summary.sdkError ? 1 : 0);
  });
}
