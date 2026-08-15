// PBI-02.3：机械处置层——L0 随手修 / 确凿删除 / L3 隔离 + 隔离复检 + feedback 保护。
// 权限模型（Sketches S7 机械层落点）：
//   L0 随手修（auto_fixable）：修断链（摘除失效 [[链接]] 标记降为正文）、索引双向对账修复——
//       结构性、可机械判定，直接做。
//   确凿删除：删除票只由 M4「确凿」级（git 讣告在案）开出——铁律「无讣告，不删」。
//       delete_policy=report-only 时零删除动作，删除建议只进报告。
//   L3 隔离：M2 孤儿 / M3 悬空溯源 / M4 候选——判据不足一律隔离不删；frontmatter 标
//       status: quarantined + quarantine 块（原因/起始信息），去掉标记即还原原状（可逆）。
//   feedback 类（metadata.type=feedback，用户亲口纠正过的）：永不自动删除、永不自动进隔离、
//       永不自动改写正文——只进「待你裁决」清单。
//   隔离复检（AC6）：已隔离条目每梦按起始原因复检，失效实体重新命中（复活）→ 解除隔离并记录。
//       「连续两梦无翻案升候删」需语义翻案判定，归 PBI-07；本轮只保证标记携带足够跨梦起始信息。
//
// 本模块只做「按 findings 计算并落盘处置」，零 SDK。每笔动作进 journal（报告四要素的数据源）。

import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { buildLinkGraph } from './check.mjs';

const QUARANTINE_REASONS = new Map([
  ['M2', 'M2-orphan'],
  ['M3', 'M3-dangling-source'],
  ['M4', 'M4-zero-hits-candidate'],
]);

// ---------- 文本层操作 ----------

/** 摘除正文里全部 [[X]] 标记降为纯文本 X（L0 修断链的具体形态：保文字、去失效声明）。 */
export function demoteLinksInBody(body, links) {
  let out = body;
  for (const link of links) {
    // 只替换字面 [[link]]（同文的健康链接不受影响）；link 含正则元字符时转义
    const esc = link.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`\\[\\[${esc}\\]\\]`, 'g'), link);
  }
  return out;
}

/**
 * 在 frontmatter 里插入/更新 quarantine 标记（可逆：removeQuarantineMarker 还原）。
 * 无 frontmatter 的文件（本身已违反 D2 契约的腐烂形态）补一个最小 frontmatter 承载标记。
 */
export function applyQuarantineMarker(content, { reason, since, runId, entity }) {
  const lines = content.split(/\r?\n/);
  const fmEnd = lines[0]?.trim() === '---' ? lines.slice(1).findIndex((l) => l.trim() === '---') : -2;
  const markerLines = [
    `status: quarantined`,
    `quarantine:`,
    `  reason: ${reason}`,
    `  since: ${since}`,
    `  runId: ${runId}`,
    ...(entity ? [`  entity: ${entity}`] : []),
  ];
  if (fmEnd >= 0) {
    const closeIdx = fmEnd + 1; // lines 里收尾 --- 的绝对下标
    const out = [...lines.slice(0, closeIdx), ...markerLines, ...lines.slice(closeIdx)];
    return out.join('\n');
  }
  // 无 frontmatter：补一个最小块（name 用文件名 stem 占位——本文件形态已违规，标记优先）
  return ['---', ...markerLines, '---', '', content.trimStart()].join('\n');
}

/** 去掉 quarantine 标记与 status: quarantined 行——还原到隔离前状态（可逆性的另一半）。 */
export function removeQuarantineMarker(content) {
  const lines = content.split(/\r?\n/);
  const out = [];
  let inQuarantineBlock = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === 'quarantine:') { inQuarantineBlock = true; continue; }
    if (inQuarantineBlock) {
      if (/^\s+[^:]+:/.test(line) || trimmed === '') { continue; } // 块内键与块尾空行
      inQuarantineBlock = false; // 非缩进键行：块结束，该行正常处理
    }
    if (trimmed === 'status: quarantined') continue;
    out.push(line);
  }
  return out.join('\n');
}

// ---------- 处置编排 ----------

/**
 * @param {object} opts
 * @param {string} opts.root
 * @param {object} opts.paths dreamPaths(root)
 * @param {object} opts.config resolveConfig 的返回值（消费 delete_policy）
 * @param {object[]} opts.mems parseMemoryFile 结果（含 status/quarantine 字段）
 * @param {object[]} opts.findings runMechanicalChecks 的 findings
 * @param {string} opts.runId
 * @param {object} opts.exec createEngineLog 的返回
 * @param {object} opts.preSha 梦前快照 sha（回滚提示用）
 * @param {(count: number) => void} [opts.onDelete] 每笔删除后回调（02.4 熔断计数接入点）
 * @returns {{journal: object[], pendingRulings: object[], netDeleted: number, fused: boolean}}
 */
export function applyDisposal({ root, paths, config, mems, findings, runId, exec, preSha, onDelete }) {
  const journal = [];
  const pendingRulings = [];
  const memoryDir = paths.memoryDir;
  const indexPath = paths.memoryIndex;
  let netDeleted = 0;
  let fused = false;
  const nowIso = new Date().toISOString();
  const bySlug = new Map(mems.map((m) => [m.slug, m]));
  const byObj = new Map(); // 文件 -> 本梦触及它的动作数（回滚提示「撤销本笔将同时影响其他 N 笔」）
  const touch = (file) => byObj.set(file, (byObj.get(file) ?? 0) + 1);

  function journalAction(entry) {
    // affectsOthers 不在这里算——推入时刻还不知道后面还有没有别的笔碰同一文件，
    // 后置结算（见函数末尾），这里只记账与登记触及。
    journal.push(entry);
    touch(entry.rollback.file);
  }

  function rollbackFor(file) {
    return {
      file,
      kind: 'restore-pre-dream',
      hint: preSha
        ? `git checkout ${preSha} -- ${file.replaceAll('\\', '/')}`
        : '（梦前快照不可得，整梦回滚兜底走 git log 手动核对）',
    };
  }

  function readFile(file) {
    try {
      return readFileSync(path.join(memoryDir, file), 'utf8');
    } catch {
      return null;
    }
  }

  function writeFile(file, content) {
    writeFileSync(path.join(memoryDir, file), content, 'utf8');
  }

  function readIndex() {
    try {
      return readFileSync(indexPath, 'utf8');
    } catch {
      return '';
    }
  }

  function writeIndex(content) {
    writeFileSync(indexPath, content, 'utf8');
  }

  function indexLinesFor(file) {
    const esc = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return readIndex().split(/\r?\n/).map((l, i) => ({ line: l, i, matches: new RegExp(`\\(<?${esc}>?\\)`).test(l) }));
  }

  function removeIndexLines(file) {
    const kept = indexLinesFor(file).filter((x) => !x.matches).map((x) => x.line);
    writeIndex(kept.join('\n'));
  }

  function addIndexLine(file, mem) {
    const title = mem?.name ?? file.replace(/\.md$/, '');
    const hook = (mem?.description ?? '').split('\n')[0].slice(0, 120);
    const line = `- [${title}](${file})${hook ? ` — ${hook}` : ''}`;
    const idx = readIndex();
    writeIndex(idx.trimEnd() + '\n' + line + '\n');
    return line;
  }

  // ---------- 第一步：隔离复检（AC6）——复活解除隔离并记录 ----------
  const { inDegree, outLinks } = buildLinkGraph(mems);
  for (const mem of mems) {
    if (mem.status !== 'quarantined' || !mem.quarantine) continue;
    const reason = mem.quarantine.reason ?? '';
    let revived = false;
    let recheckInputs = {};
    let recheckCommands = [];
    if (reason === 'M2-orphan') {
      const out = (outLinks.get(mem.slug) ?? []).length;
      const inn = inDegree.get(mem.slug)?.size ?? 0;
      recheckInputs = { outLinkCount: out, inLinkCount: inn };
      revived = out > 0 || inn > 0;
    } else if (reason === 'M3-dangling-source') {
      recheckInputs = { sources: mem.sources };
      revived = mem.sources.length > 0 && mem.sources.every((s) => existsSync(path.isAbsolute(s) ? s : path.join(root, s)));
    } else if (reason === 'M4-zero-hits-candidate') {
      const entity = mem.quarantine.entity;
      recheckInputs = { entity };
      if (entity) {
        const grep = exec.run('git', ['grep', '-I', '-F', '-e', entity, '--', ':!.claude'], { cwd: root });
        revived = grep.ok && grep.stdout.trim().length > 0;
        recheckCommands = [grep.entry];
      }
    } else {
      exec.record({ criterion: 'M4-recheck', object: mem.slug, result: 'unknown-reason-skip', inputs: { reason } });
      continue;
    }
    const evidence = exec.record({
      criterion: 'quarantine-recheck', object: mem.slug, inputs: { reason, ...recheckInputs },
      result: revived ? 'revived' : 'stays-quarantined',
      commands: recheckCommands, // M4 复检的真实 grep 取证，报告按 C2 命令记法渲染
    });
    if (revived) {
      const content = readFile(`${mem.slug}.md`);
      if (content !== null) {
        const restored = removeQuarantineMarker(content);
        writeFile(`${mem.slug}.md`, restored);
        journalAction({
          action: 'unquarantine', criterionId: 'L3-recheck', object: `${mem.slug}.md`,
          detail: { reason, since: mem.quarantine.since ?? null },
          evidence,
          rollback: { ...rollbackFor(`${mem.slug}.md`), kind: 'restore-pre-dream' },
        });
      }
    }
  }

  // ---------- 第二步：按文件归并 findings，逐文件处置 ----------
  // findings.object 两种形态：M1/M2/M3/M4 用 slug（如 victim-confirmed），M5 盘上方向用文件名
  // （如 unindexed.md）——这里统一归一到文件名（journal 的 object 一律是带 .md 的文件名）。
  const files = new Set(findings.map((f) => f.object).filter((o) => o !== 'MEMORY.md'));
  for (const file of [...files].sort()) {
    const filename = file.endsWith('.md') ? file : `${file}.md`;
    const mem = bySlug.get(filename.replace(/\.md$/, '')) ?? null;
    const type = mem?.type ?? null;
    const fs = findings.filter((f) => f.object === file);

    // feedback 类：永不删、永不隔离、永不改正文——全部进待裁决
    if (type === 'feedback') {
      for (const f of fs) {
        pendingRulings.push({
          object: filename, type: 'feedback-protected',
          finding: f,
          note: 'feedback 类记忆（用户亲口纠正过）——AC5 铁律：永不自动删除、永不进隔离，待你裁决',
        });
      }
      continue;
    }

    // 确凿删除（铁律：只有 M4 确凿级开票；report-only 档位零删除动作）
    const confirmed = fs.filter((f) => f.id === 'M4' && f.evidenceLevel === 'confirmed');
    if (confirmed.length > 0) {
      const contentBefore = readFile(filename);
      const entities = confirmed.map((f) => f.detail.entity);
      if (config.values.delete_policy === 'report-only') {
        journal.push({
          action: 'delete-suggestion', criterionId: 'M4', object: filename,
          detail: { entities, evidenceLevel: 'confirmed', suppressedBy: 'delete_policy=report-only' },
          evidence: confirmed.map((f) => f.evidence),
          rollback: { file: filename, kind: 'not-applied', hint: '未执行（report-only 档位）——如需删除请手动确认', affectsOthers: 0 },
        });
        pendingRulings.push({
          object: filename, type: 'delete-suggestion',
          note: `M4 确凿（讣告在案：${entities.join(', ')}），delete_policy=report-only 档位下仅建议不执行`,
          finding: confirmed[0],
        });
      } else {
        rmSync(path.join(memoryDir, filename), { force: true });
        removeIndexLines(filename);
        netDeleted += 1;
        journalAction({
          action: 'delete', criterionId: 'M4', object: filename,
          detail: { entities, evidenceLevel: 'confirmed', indexLinesRemoved: true },
          evidence: confirmed.map((f) => f.evidence),
          contentBefore, // 死者遗言：报告内联被删正文
          rollback: { ...rollbackFor(filename), hint: preSha ? `git checkout ${preSha} -- ${filename.replaceAll('\\', '/')} ${path.relative(root, indexPath).replaceAll('\\', '/')}` : rollbackFor(filename).hint },
        });
        if (onDelete && onDelete(netDeleted)) {
          // 熔断（02.4）：onDelete 返回真值 = 熔断线已破，中止整梦——跳过剩余全部处置，
          // 已执行的处置由调用方 restoreToPreDream 回滚（journal 即回滚动作清单）。
          fused = true;
          return finalize();
        }
        // 该文件上的其他 findings 随删除一并消解，不再逐一处置
        const rest = fs.filter((f) => !confirmed.includes(f));
        if (rest.length > 0) {
          exec.record({ criterion: 'M4', object: filename, result: 'superseded-by-delete', inputs: { superseded: rest.map((f) => f.id) } });
        }
        continue;
      }
    }

    // L3 隔离（判据不足；已在隔离中的不复加标记——保留首次隔离的起始信息，AC6）
    const quarantineWorthy = fs.filter((f) => QUARANTINE_REASONS.has(f.id));
    if (quarantineWorthy.length > 0 && mem?.status !== 'quarantined') {
      const content = readFile(filename);
      if (content !== null) {
        const first = quarantineWorthy[0];
        const reason = QUARANTINE_REASONS.get(first.id);
        const entity = first.id === 'M4' ? first.detail.entity : undefined;
        const marked = applyQuarantineMarker(content, { reason, since: nowIso, runId, entity });
        writeFile(filename, marked);
        const evidence = exec.record({
          criterion: 'L3-quarantine', object: filename, inputs: { reason, sources: fs.map((f) => f.id) },
          result: 'quarantined',
        });
        journalAction({
          action: 'quarantine', criterionId: first.id, object: filename,
          detail: { reason, findings: fs.map((f) => f.id), entity },
          evidence,
          rollback: { ...rollbackFor(filename), kind: 'undo-new-marker', hint: `去除 frontmatter 中 status: quarantined 与 quarantine 块即可还原（或 ${rollbackFor(filename).hint}）` },
        });
      }
    }

    // L0 修断链（M1）：摘除失效 [[链接]] 标记降为正文
    const m1s = fs.filter((f) => f.id === 'M1');
    if (m1s.length > 0) {
      const content = readFile(filename);
      if (content !== null) {
        const links = m1s.map((f) => f.detail.link);
        const fixed = demoteLinksInBody(content, links);
        if (fixed !== content) {
          writeFile(filename, fixed);
          const evidence = exec.record({
            criterion: 'L0-fix-link', object: filename, inputs: { links }, result: 'demoted-to-plain-text',
          });
          journalAction({
            action: 'fix-link', criterionId: 'M1', object: filename,
            detail: { links, count: links.length },
            evidence,
            rollback: rollbackFor(filename),
          });
        }
      }
    }
  }

  // ---------- 第三步：M5 索引双向修复（全局结构层，不受文件类型豁免影响） ----------
  const m5s = findings.filter((f) => f.id === 'M5');
  for (const f of m5s) {
    if (f.detail.direction === 'indexed-but-missing-on-disk') {
      removeIndexLines(f.detail.file);
      const evidence = exec.record({
        criterion: 'L0-fix-index', object: 'MEMORY.md', inputs: { removed: f.detail.file }, result: 'stale-line-removed',
      });
      journalAction({
        action: 'fix-index-remove-line', criterionId: 'M5', object: 'MEMORY.md',
        detail: { removedLine: f.detail.file },
        evidence,
        rollback: rollbackFor('MEMORY.md'),
      });
    } else {
      // 盘上有、索引无——补一行指针（D2 契约修复）
      const mem = bySlug.get(f.object.replace(/\.md$/, '')) ?? null;
      const added = addIndexLine(f.object, mem);
      const evidence = exec.record({
        criterion: 'L0-fix-index', object: f.object, inputs: { added }, result: 'pointer-line-added',
      });
      journalAction({
        action: 'fix-index-add-line', criterionId: 'M5', object: 'MEMORY.md',
        detail: { addedLine: added, forFile: f.object },
        evidence,
        rollback: { file: 'MEMORY.md', kind: 'undo-new-line', hint: `删除 MEMORY.md 中新增行「${added}」（或 ${rollbackFor('MEMORY.md').hint}）`, affectsOthers: 0 },
      });
    }
  }

  // 连坐标注后置结算：journal 全部落定后才知道每个文件被几笔触及。
  // 「撤销本笔将同时影响其他 N 笔」——N = 同文件其余笔数（02.5-AC1 要求显式标注；C1 单笔精撤后置，
  // 本轮只诚实标注连坐面，不假装能按笔精确回滚）。
  function finalize() {
    for (const entry of journal) {
      entry.rollback.affectsOthers = Math.max(0, (byObj.get(entry.rollback.file) ?? 0) - 1);
    }
    return { journal, pendingRulings, netDeleted, fused };
  }

  return finalize();
}
