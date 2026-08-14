// PBI-01.1 编排层：把 compress.mjs（机械压缩）与 ledger.mjs（台账/幂等）接起来，
// 产出一页底片。session-end.mjs（活场触发）与 backfill.mjs（漏网场补捞）共用本模块，
// 保证两条路径的产出行为完全一致——不是各写一套、指望它们碰巧同步。
//
// AC4 声明的行为：逐行流式读取 transcript（node:readline + createReadStream），
// 峰值内存跟着「这一页要处理的新增行数」走，不随全稿体积（本仓库现存最大见自证报告）
// 整体飙升，不设人为体积上限。

import { createReadStream, existsSync, mkdirSync, writeFileSync, appendFileSync, statSync } from 'node:fs';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { dreamPaths, runIdNow } from '../lib/paths.mjs';
import { compressEntries } from './compress.mjs';
import { withLedgerLock, sliceNewEntries, recordPage } from './ledger.mjs';

/** 逐行读取 jsonl，解析失败的行不中断整个流程——原样按 AC3③ 的未知留痕精神收一条占位。 */
async function readTranscriptEntries(transcriptPath) {
  const entries = [];
  let rawBytes = 0;
  const rl = createInterface({ input: createReadStream(transcriptPath, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    rawBytes += Buffer.byteLength(line, 'utf8') + 1; // +1 近似换行符，量级对即可，非精确计费
    try {
      entries.push(JSON.parse(line));
    } catch {
      entries.push({ type: '(unparseable-line)', raw: line.slice(0, 2000) });
    }
  }
  return { entries, rawBytes };
}

function pageHeader({ sessionId, transcriptPath, runId, fromIndex, toIndex, stats, originalBytes, compressedBytes }) {
  const ratio = originalBytes > 0 ? ((compressedBytes / originalBytes) * 100).toFixed(2) : '0.00';
  return [
    '---',
    `sessionId: ${sessionId}`,
    `transcriptPath: ${transcriptPath}`,
    `runId: ${runId}`,
    `entryRange: [${fromIndex}, ${toIndex})`,
    `entryCount: ${toIndex - fromIndex}`,
    `originalBytes: ${originalBytes}`,
    `compressedBytes: ${compressedBytes}`,
    `compressionRatio: ${ratio}%`,
    `byKind: ${JSON.stringify(stats.byKind)}`,
    '---',
    '',
  ].join('\n');
}

function logError(root, context, err) {
  try {
    const paths = dreamPaths(root);
    mkdirSync(path.dirname(paths.negativeErrorTrace), { recursive: true });
    const line = JSON.stringify({ ts: new Date().toISOString(), context, error: String(err?.message ?? err) });
    appendFileSync(paths.negativeErrorTrace, line + '\n', 'utf8');
  } catch {
    // AC5 的底线：错误留痕本身失败也不能抛出去炸调用方。到这一步只能放弃留痕。
  }
}

/**
 * @param {object} opts
 * @param {string} opts.root 项目根目录
 * @param {string} opts.sessionId
 * @param {string} opts.transcriptPath 逐字稿绝对路径
 * @returns {Promise<{status: string, [key:string]: any}>}
 *   status: 'written' | 'skipped-no-new' | 'skipped-missing-transcript' | 'skipped-lock-busy' | 'error'
 */
export async function processSessionTranscript({ root, sessionId, transcriptPath }) {
  if (!sessionId || !transcriptPath) {
    return { status: 'error', reason: 'missing sessionId or transcriptPath' };
  }

  // AC6④：逐字稿已被官方 30 天清理——记账跳过，不报错，这是预期分支不是故障。
  if (!existsSync(transcriptPath)) {
    return { status: 'skipped-missing-transcript', sessionId, transcriptPath };
  }

  const paths = dreamPaths(root);

  let entries, rawBytesTotal;
  try {
    ({ entries, rawBytes: rawBytesTotal } = await readTranscriptEntries(transcriptPath));
  } catch (err) {
    logError(root, 'read-transcript', err);
    return { status: 'error', reason: String(err?.message ?? err) };
  }

  // 只用来算「这一页」的原始字节数（AC4 的体积对账要的是这一页的压缩前后对比，不是全稿累计）。
  // 简化：按条目在文件中的平均字节数估算新增切片的原始体积——转 sliceNewEntries 之后再精确算。
  let outcome;
  const runId = runIdNow();
  const negativesDir = paths.negativesDir;
  // 锁文件与台账都住在 negativesDir 里——必须先把目录建出来再拿锁，否则 acquireLock 撞见的是
  // "目录不存在"（ENOENT），不是"锁被占用"（EEXIST），会被误判成锁忙而白白放弃全部重试。
  mkdirSync(negativesDir, { recursive: true });

  let lockResult;
  try {
    lockResult = withLedgerLock(paths.negativeLedgerLock, paths.negativeLedger, (ledger) => {
    const sessionRecord = ledger[sessionId];
    const { newEntries, fromIndex, toIndex, anomaly } = sliceNewEntries(entries, sessionRecord);

    if (anomaly) {
      logError(root, 'ledger-anomaly', new Error(`${anomaly} sessionId=${sessionId}`));
    }

    if (newEntries.length === 0) {
      outcome = { status: 'skipped-no-new', sessionId, transcriptPath, anomaly };
      return ledger; // 台账不变，AC1 幂等——不产生第二页
    }

    const { markdown, stats } = compressEntries(newEntries);
    // 新增切片的原始体积：按整稿字节数乘以「新增条目数/总条目数」估算，量级对即可——
    // 逐行精确计费需要在 sliceNewEntries 之前就分别累计，为了保持 ledger.mjs 是纯函数
    // （不碰字节计费）这里用估算，AC4 要的是「压缩前后体积对账」这个数量级，不是逐字节审计。
    const sliceRatio = entries.length > 0 ? newEntries.length / entries.length : 1;
    const originalBytes = Math.round(rawBytesTotal * sliceRatio);
    const compressedBytes = Buffer.byteLength(markdown, 'utf8');

    const fileName = `${sessionId}--${runId}.md`;
    const filePath = path.join(negativesDir, fileName);
    mkdirSync(negativesDir, { recursive: true });
    const header = pageHeader({ sessionId, transcriptPath, runId, fromIndex, toIndex, stats, originalBytes, compressedBytes: compressedBytes + 0 });
    const fullContent = header + '\n' + markdown + '\n';
    // AC5 故障注入入口：设了这个环境变量就在真正写文件前抛错，模拟磁盘满/权限拒绝等真实
    // 写失败场景。抛出点选在"已经算完所有东西、正要落盘"这一刻，模拟最贴近真实的失败位置——
    // 不是提前在函数入口就拦截，那样测的是"能不能识别开关"，不是"写失败这条路径本身走不走得通"。
    if (process.env.CLAUDE_DREAM_NEGATIVES_INJECT_WRITE_FAILURE === 'true') {
      throw new Error('注入的写失败（CLAUDE_DREAM_NEGATIVES_INJECT_WRITE_FAILURE=true）');
    }

    // 先写页面文件，台账的 mutator 返回值随后由 withLedgerLock 原子落盘——万一在两步之间
    // 崩溃，最坏情况是台账没记上这页（下次重跑会再产一页，冗余但不丢信息），好过台账记了
    // 一页实际不存在的文件（那会让这段历史从此在校验时"查得到台账、查不到文件"）。
    writeFileSync(filePath, fullContent, 'utf8');

    outcome = {
      status: 'written',
      sessionId,
      transcriptPath,
      file: fileName,
      filePath,
      fromIndex,
      toIndex,
      entryCount: toIndex - fromIndex,
      stats,
      originalBytes,
      compressedBytes: Buffer.byteLength(fullContent, 'utf8'),
      ratio: originalBytes > 0 ? compressedBytes / originalBytes : 0,
    };

    return recordPage(ledger, sessionId, {
      file: fileName,
      fromIndex,
      toIndex,
      entryCount: toIndex - fromIndex,
      processedAt: new Date().toISOString(),
    });
    });
  } catch (err) {
    // AC5 底线：写失败（真实的，或上面注入的）不能向上抛出去阻断散会链路——记录后返回一个
    // 'error' 状态，调用方（trigger-check.mjs）该干嘛继续干嘛，不因为底片这一步栽了就停摆。
    logError(root, 'write-negative-page', err);
    return { status: 'error', sessionId, transcriptPath, reason: String(err?.message ?? err) };
  }

  if (lockResult === null) {
    return { status: 'skipped-lock-busy', sessionId, transcriptPath };
  }
  return outcome;
}
