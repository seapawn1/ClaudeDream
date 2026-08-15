// PBI-02.6：G9 回程——梦定向阶段先翻底片，找用户对上梦的留话。
// 机械检索口径（AC1）：检索「上次梦 runId 之后」产生的全部底片页中的用户原话，凡提及
// 隔离区/「待你裁决」对象标识（记忆文件名/slug）的段落，摘录进本梦工作输入与报告
// （原文引用 + 出处页指针）。语义理解升级（听懂并照办）归 PBI-07——本轮只做标识匹配。
//
// 底片消费契约（AC2，写入交付接口约定，PBI-06 重做压缩时必须保住）：
//   ① 台账结构：ledger.json 按 sessionId 分组，每页记录含 file 字段，值为**文件名**而非
//     完整路径，消费方自行与底片目录拼接；
//   ② 底片页正文保留用户原话；
//   ③ 用户发言在页内有稳定的、可机械识别的段落标记：`### User`、`### User (meta)`、
//     `### User (steering)` 三种标题行（compress.mjs 渲染形态，换形态会让本检索静默失效）。
//
// 只读边界（AC3）：本模块对底片目录零写——代码路径中不出现任何面向 negativesDir 的写操作，
// 只调用文件读取 API（结构上保证，不是靠"记得别写"）。「越界写底片」的 canUseTool 故障注入
// 测试（--rogue）继续保留在 run-dream 的 SDK 路径，不受本模块影响。

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { parseMemoryFile } from './check.mjs';

const USER_SECTION = /^###\s+User\b/;
const SECTION_START = /^###\s+/;
const MEMORY_FILE_TOKEN = /\b([a-zA-Z0-9][a-zA-Z0-9-]{2,})\.md\b/g;

/** 从底片页文件名（<sessionId>--<runId>.md）提取页 runId；不可解析返回 ''（见口径注释）。 */
export function pageRunId(fileName) {
  const idx = String(fileName).lastIndexOf('--');
  if (idx === -1) return '';
  return String(fileName).slice(idx + 2).replace(/\.md$/, '');
}

/** 提取页正文里全部 ### User 系段落（三种标记形态同一正则覆盖），返回 {text}[]。 */
export function extractUserSections(content) {
  const lines = content.split(/\r?\n/);
  const sections = [];
  let current = null;
  for (const line of lines) {
    if (USER_SECTION.test(line.trim())) {
      if (current) sections.push({ text: current.join('\n').trim() });
      current = [];
    } else if (SECTION_START.test(line.trim())) {
      if (current) sections.push({ text: current.join('\n').trim() });
      current = null;
    } else if (current) {
      current.push(line);
    }
  }
  if (current) sections.push({ text: current.join('\n').trim() });
  return sections.filter((s) => s.text.length > 0);
}

/** 标识匹配：整词边界（前后非 [a-zA-Z0-9-]）上命中 slug 或 slug.md——防 'hub' 误中 'chubby'。 */
export function matchesIdentifier(text, identifier) {
  const esc = String(identifier).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\w-])${esc}(\\.md)?([^\\w-]|$)`, 'i').test(text);
}

/**
 * 收集标识集：①当前已隔离文件的 slug（跨梦状态，本轮定向时已可见）；②上次梦报告的
 * 隔离观察区/待你裁决节里的记忆文件名（.md token）。两类都是「隔离区/待你裁决对象」。
 */
function collectIdentifiers({ root, paths, baselineRunId }) {
  const identifiers = new Set();
  // ①当前隔离中
  const memoryDir = paths.memoryDir;
  if (existsSync(memoryDir)) {
    for (const f of readdirSync(memoryDir)) {
      if (!f.endsWith('.md') || f === 'MEMORY.md') continue;
      const mem = parseMemoryFile(path.join(memoryDir, f));
      if (mem?.status === 'quarantined' && mem.slug) identifiers.add(mem.slug);
    }
  }
  // ②上次梦报告（基线 runId 有报告才可能有）
  if (baselineRunId) {
    const reportPath = path.join(paths.dreamDir, `${baselineRunId}-report.md`);
    if (existsSync(reportPath)) {
      try {
        const report = readFileSync(reportPath, 'utf8');
        // 只从隔离观察区与待你裁决两节取材，不在整篇报告里乱扫
        const zoneIdx = report.indexOf('## 隔离观察区');
        if (zoneIdx !== -1) {
          const zone = report.slice(zoneIdx, report.indexOf('## 抽查点', zoneIdx) === -1 ? report.length : report.indexOf('## 抽查点', zoneIdx));
          for (const m of zone.matchAll(MEMORY_FILE_TOKEN)) {
            identifiers.add(m[1]);
          }
        }
      } catch {
        // 报告读不出：标识集少一块，摘录范围收窄——如实少摘，不报错（G9 是引用性功能）
      }
    }
  }
  return [...identifiers].filter((id) => id.length >= 3).sort();
}

/**
 * G9 定向翻底片主入口。
 * @param {object} opts
 * @param {string} opts.root
 * @param {object} opts.paths dreamPaths(root)
 * @param {object} opts.exec createEngineLog 的返回
 * @returns {{
 *   quotes: {page: string, sessionId: string, text: string, matchedIdentifier: string}[],
 *   baselineRunId: string|null,
 *   pagesAfterBaseline: number,
 *   identifiers: string[],
 * }}
 */
export function retrieveUserMessages({ root, paths, exec }) {
  // 基线：上次梦 runId（last-dream.json 三种终态都带 runId，02.1 起）。无 = 首次梦，全部页在范围内。
  let baselineRunId = null;
  try {
    if (existsSync(paths.lastDreamState)) {
      const state = JSON.parse(readFileSync(paths.lastDreamState, 'utf8'));
      baselineRunId = typeof state?.runId === 'string' && state.runId ? state.runId : null;
    }
  } catch {
    baselineRunId = null;
  }

  // 台账（契约①：按 sessionId 分组，页记录 file 为文件名）
  let ledger = {};
  try {
    if (existsSync(paths.negativeLedger)) {
      ledger = JSON.parse(readFileSync(paths.negativeLedger, 'utf8'));
    }
  } catch {
    ledger = {};
  }
  const pages = [];
  for (const [sessionId, record] of Object.entries(ledger)) {
    for (const p of record?.pages ?? []) {
      if (p?.file && typeof p.file === 'string') pages.push({ sessionId, file: p.file });
    }
  }

  // 基线过滤：页 runId 严格大于基线 runId（同为 ISO 形时间戳，字典序即时间序）。
  // 不可解析页 runId 的页**保守纳入**（宁多摘不漏摘——摘录进报告只是引用，漏摘才是静默失效，
  // 正是契约③警告的失效形态）。
  const after = pages.filter((p) => {
    const rid = pageRunId(p.file);
    return !rid || !baselineRunId || rid > baselineRunId;
  });

  const identifiers = collectIdentifiers({ root, paths, baselineRunId });

  const quotes = [];
  for (const p of after) {
    const pagePath = path.join(paths.negativesDir, p.file);
    if (!existsSync(pagePath)) continue; // 台账有、盘上无：跳过不报错（契约外防御）
    let content;
    try {
      content = readFileSync(pagePath, 'utf8');
    } catch {
      continue;
    }
    for (const section of extractUserSections(content)) {
      const matched = identifiers.find((id) => matchesIdentifier(section.text, id));
      if (matched) {
        quotes.push({ page: p.file, sessionId: p.sessionId, text: section.text, matchedIdentifier: matched });
      }
    }
  }

  exec.record({
    criterion: 'G9', inputs: { baselineRunId, pagesAfterBaseline: after.length, identifierCount: identifiers.length },
    result: `quotes=${quotes.length}`,
  });

  return { quotes, baselineRunId, pagesAfterBaseline: after.length, identifiers };
}
