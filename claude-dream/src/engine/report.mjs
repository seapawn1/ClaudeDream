// PBI-02.5：梦报告生成（六节骨架 + C2/C3 证据改造）。
// C2：证据栏「从论证变记录」——真实执行的命令记命令原文+exit code+stdout 摘要+时间戳；
//     纯代码判据记判据输入、判定结果、时间戳；两种证据都来自执行日志
//     （.claude/dream/<runId>-engine.log，JSONL），报告只引用，不出现无记录支撑的论证。
// C3：抽查点一律以梦前状态为基准（git show preSha:file 起手），每一条都设计为「能失败」；
//     每笔删除内联死者遗言（看一眼不需要判断力，回滚才需要）；自动挑证明力最弱的 3 笔。
// C5（本轮半条）：30 秒版说全动作类型（不可只报数字）；触及 CLAUDE.md 的动作置顶
//     （机械层本轮不产生 CLAUDE.md 动作——L2 归 PBI-07，渲染逻辑照写，无则如实无）。
// 抽查点命令统一 PowerShell 方言（本机 shell 现状，C2「同篇统一方言」的抽查点侧对应）。

import path from 'node:path';

const ROLLBACK_LIMIT_NOTE =
  '注意：单笔精确回滚（跨笔不连坐）是已知未完备项（后置 C1）；「回滚提示」按该笔实际形态给出，' +
  '若标注「同时影响其他 N 笔」，撤销本笔会连坐同文件的其他笔。';

// ---------- 证据渲染（C2） ----------

function fmtEntry(entry) {
  if (!entry) return '（无证据记录）';
  const lines = [];
  if (entry.kind === 'command') {
    lines.push(
      [
        `命令：\`${entry.command}\``,
        `exit code：${entry.exitCode}`,
        entry.stdoutSummary ? `stdout 摘要：\`${entry.stdoutSummary}\`` : null,
        `时间戳：${entry.ts}`,
      ].filter(Boolean).join(' ｜ ')
    );
  } else {
    lines.push(
      [
        `判据输入：\`${JSON.stringify(entry.inputs ?? {})}\``,
        `判定结果：\`${entry.result ?? ''}\``,
        `时间戳：${entry.ts}`,
      ].join(' ｜ ')
    );
  }
  // 纯代码判据可能携带真实执行的命令证据（如 M4 的 grep/讣告取证）——命令类证据
  // 一律按 C2 命令记法渲染，不让它埋没在嵌套字段里（D3 教训：证据可检索性优先）。
  for (const cmd of entry.commands ?? []) {
    if (cmd?.kind === 'command') lines.push(`  - ${fmtEntry(cmd)}`);
  }
  return lines.join('\n');
}

function renderEvidence(evidence) {
  const list = Array.isArray(evidence) ? evidence : [evidence];
  const nonNull = list.filter(Boolean);
  if (nonNull.length === 0) return '（无证据记录）';
  return nonNull.map((e) => `- ${fmtEntry(e)}`).join('\n');
}

// ---------- 回滚提示（02.5-AC1） ----------

function renderRollbackHint(a) {
  const r = a.rollback ?? {};
  const parts = [r.hint ?? '（无回滚提示）'];
  if (r.affectsOthers > 0) parts.push(`⚠️ 撤销本笔将同时影响同文件的其他 ${r.affectsOthers} 笔`);
  return parts.join('；');
}

// ---------- 30 秒版（C5 本轮半条） ----------

const ACTION_TYPE_NAMES = {
  'fix-link': '修断链',
  'fix-index-add-line': '补索引行',
  'fix-index-remove-line': '删陈旧索引行',
  quarantine: '隔离',
  unquarantine: '解除隔离',
  delete: '删除',
  'delete-suggestion': '删除建议（未执行）',
};

function groupByActionType(journal) {
  const groups = new Map();
  for (const a of journal) {
    if (!groups.has(a.action)) groups.set(a.action, []);
    groups.get(a.action).push(a);
  }
  return groups;
}

function render30Second({ journal, pendingRulings, fuseDetail, dreamSha, engineLogRel }) {
  const lines = ['本场机械梦（零 API）执行完毕。'];
  const groups = groupByActionType(journal);

  // 触及 CLAUDE.md 的动作置顶（C5 后半：本轮机械处置不产生此类动作，渲染逻辑先行）
  const claudeMdActions = journal.filter((a) => (a.rollback?.file ?? '').includes('CLAUDE.md'));
  if (claudeMdActions.length > 0) {
    lines.push(`⚠️ 触及 CLAUDE.md 的动作 ${claudeMdActions.length} 笔（置顶）：`);
    for (const a of claudeMdActions) lines.push(`- ${ACTION_TYPE_NAMES[a.action] ?? a.action}｜${a.object}`);
  }

  if (journal.length === 0) {
    lines.push('本轮体检零发现，无处置动作。');
  } else {
    lines.push('动作类型全览（说全类型，不止数字）：');
    for (const [action, list] of groups) {
      const name = ACTION_TYPE_NAMES[action] ?? action;
      const objects = [...new Set(list.map((a) => a.object))].join('、');
      lines.push(`- ${name} ${list.length} 笔：${objects}`);
    }
  }

  if (pendingRulings.length > 0) {
    lines.push(`- 待你裁决 ${pendingRulings.length} 条（feedback 保护/report-only 建议，见隔离观察区）`);
  }

  if (fuseDetail) {
    lines.push(`⚠️ 本梦已熔断：${fuseDetail.reason}——记忆状态已回滚到梦前，见「熔断」节`);
  }

  lines.push(`执行日志：\`${engineLogRel}\`（全部命令/判据证据的原始记录）`);

  if (dreamSha) {
    lines.push(`整梦撤销：\`git revert ${dreamSha}\`（回滚原子 = dream: 前缀提交）`);
  } else {
    lines.push('整梦撤销：本梦未产生 dream: 提交（无记忆改动或已熔断回滚）——如需撤销见明细逐笔回滚提示。');
  }

  return lines.join('\n');
}

// ---------- 图 delta 对账 ----------

function renderGraphDelta({ checkMeta, disposal, fuseDetail }) {
  const parts = [`${checkMeta.memoryCount} 条记忆（梦前） -> ${checkMeta.memoryCount - disposal.netDeleted} 条（梦后）`];
  const q = disposal.journal.filter((a) => a.action === 'quarantine').length;
  const uq = disposal.journal.filter((a) => a.action === 'unquarantine').length;
  const del = disposal.journal.filter((a) => a.action === 'delete').length;
  const fixes = disposal.journal.filter((a) => a.action.startsWith('fix-')).length;
  parts.push(`删除 ${del}`, `新隔离 ${q}`, `解除隔离 ${uq}`, `L0 修复 ${fixes} 笔`);
  if (fuseDetail) parts.push(`⚠️ 熔断：${fuseDetail.reason}`);
  return parts.join(' ｜ ');
}

// ---------- 明细 ----------

function renderDetails({ journal, engineLogRel }) {
  if (journal.length === 0) return '(无处置动作)';
  const rows = [];
  for (const a of journal) {
    const name = ACTION_TYPE_NAMES[a.action] ?? a.action;
    const detailBits = Object.entries(a.detail ?? {})
      .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
      .join('，');
    // 原始动作键随中文名一并渲染——报告既要人读得懂，也要机器/验收能按稳定标记检索
    rows.push(`### ${name}（${a.action}）｜${a.object}｜判据 ${a.criterionId}`);
    rows.push(`- 详情：${detailBits || '（无）'}`);
    rows.push(`- 证据：`);
    rows.push(renderEvidence(a.evidence));
    rows.push(`- 回滚提示：${renderRollbackHint(a)}`);
    if (a.action === 'delete' && typeof a.contentBefore === 'string') {
      // AC4：每笔删除内联死者遗言——看一眼不需要判断力，回滚才需要
      rows.push(`- 死者遗言（被删正文全文）：`);
      rows.push('```');
      rows.push(a.contentBefore);
      rows.push('```');
    }
    rows.push('');
  }
  rows.push(`*执行日志（全部证据的原始记录）：\`${engineLogRel}\`*`);
  return rows.join('\n');
}

// ---------- 隔离观察区 ----------

function renderQuarantineZone({ journal, pendingRulings, g9Quotes }) {
  const sections = [];
  const newQ = journal.filter((a) => a.action === 'quarantine');
  const unq = journal.filter((a) => a.action === 'unquarantine');
  if (newQ.length > 0) {
    sections.push('本梦新隔离：');
    for (const a of newQ) {
      sections.push(`- ${a.object}（${a.detail?.reason ?? ''}${a.detail?.entity ? `，实体：${a.detail.entity}` : ''}）——起始信息已随标记落盘，后续每梦复检`);
    }
  } else {
    sections.push('本梦新隔离：无');
  }
  if (unq.length > 0) {
    sections.push('本梦解除隔离（复活）：');
    for (const a of unq) {
      sections.push(`- ${a.object}（原隔离原因 ${a.detail?.reason ?? ''}，复检通过，标记已移除）`);
    }
  }
  if (pendingRulings.length > 0) {
    sections.push('待你裁决：');
    for (const p of pendingRulings) {
      sections.push(`- ${p.object}：${p.note}`);
    }
  } else {
    sections.push('待你裁决：无');
  }
  if (g9Quotes && g9Quotes.length > 0) {
    sections.push('梦前用户留话（G9 定向翻底片摘录，原文引用）：');
    for (const q of g9Quotes) {
      sections.push(`- 出处：${q.page}｜对象：${q.matchedIdentifier ?? '（未绑定具体对象）'}`);
      sections.push(`  > ${q.text.replace(/\n/g, '\n  > ')}`);
    }
  }
  return sections.join('\n');
}

// ---------- 抽查点（C3） ----------

// 证明力排序（弱在前）：纯代码判定（无外部验证）< 带命令取证背书（git 讣告）。
// 抽查点挑最弱的 3 笔——它们最需要用户起疑时能查证。
const PROOF_STRENGTH = {
  'fix-index-add-line': 0, 'fix-index-remove-line': 0, 'fix-link': 0,
  quarantine: 1, unquarantine: 1, 'delete-suggestion': 1,
  delete: 2,
};

function renderSpotChecks({ journal, preSha }) {
  if (journal.length === 0) return '(本梦无动作，无抽查点)';
  const ranked = [...journal]
    .filter((a) => a.action !== 'delete-suggestion') // 未执行的动作没有可抽查的现场
    .sort((a, b) => (PROOF_STRENGTH[a.action] ?? 1) - (PROOF_STRENGTH[b.action] ?? 1));
  const picked = ranked.slice(0, 3); // AC5：自动挑证明力最弱的 3 笔，不足 3 全列
  const shortSha = preSha ? preSha.slice(0, 7) : '（梦前快照不可得，本条抽查点无法以梦前状态为基准——请走整梦回滚核对 git log）';

  const lines = [
    `> 以下抽查点一律以**梦前状态**（${shortSha}）为基准起手核对；每一条都设计为「能失败」——若本梦动作不实，它必然翻红。`,
  ];
  let n = 0;
  for (const a of picked) {
    n += 1;
    const file = (a.object ?? '').replaceAll('\\', '/');
    const fileNoMd = file.replace(/\.md$/, '');
    const show = preSha ? `git show ${preSha}:${file}` : '';
    if (a.action === 'fix-link') {
      const link = a.detail?.links?.[0] ?? '';
      lines.push(`${n}. （修断链｜${file}）梦前正文确含失效链接标记：`);
      lines.push(`   \`git show ${preSha}:${file} | Select-String -Pattern "\\[\\[${link}\\]\\]"\`（应有匹配；梦后正文已无该标记）`);
    } else if (a.action === 'quarantine') {
      lines.push(`${n}. （隔离｜${file}）梦前状态确无隔离标记：`);
      lines.push(`   \`git show ${preSha}:${file} | Select-String -Pattern "status: quarantined"\`（应无匹配——若梦前已有标记则本笔隔离是假动作）`);
    } else if (a.action === 'unquarantine') {
      lines.push(`${n}. （解除隔离｜${file}）梦前状态确有隔离标记：`);
      lines.push(`   \`git show ${preSha}:${file} | Select-String -Pattern "status: quarantined"\`（应有匹配——若梦前没有标记则本笔解除是假动作）`);
    } else if (a.action === 'delete') {
      const entity = a.detail?.entities?.[0] ?? '';
      lines.push(`${n}. （删除｜${file}）死者梦前存在且讣告在案：`);
      lines.push(`   \`git show ${preSha}:${file}\`（应能读出被删正文，报告明细已内联全文供对照）`);
      lines.push(`   \`git log --diff-filter=D --format=%H -1 -- ${entity}\`（应有讣告提交——无讣告则本笔删除违反铁律）`);
    } else if (a.action === 'fix-index-add-line') {
      lines.push(`${n}. （补索引行｜MEMORY.md）梦前索引确无该行：`);
      lines.push(`   \`git show ${preSha}:${file} | Select-String -Pattern "${fileNoMd}"\`（应无匹配——若梦前已有该行则本笔补行是假动作）`);
    } else if (a.action === 'fix-index-remove-line') {
      lines.push(`${n}. （删陈旧索引行｜MEMORY.md）梦前索引确有该行：`);
      lines.push(`   \`git show ${preSha}:${file} | Select-String -Pattern "${fileNoMd}"\`（应有匹配——若梦前无该行则本笔删除是假动作）`);
    } else {
      lines.push(`${n}. （${a.action}｜${file}）见明细证据与执行日志 \`${a.evidence?.ts ?? ''}\``);
    }
  }
  lines.push('');
  lines.push(ROLLBACK_LIMIT_NOTE);
  return lines.join('\n');
}

// ---------- 阀门状态 ----------

function renderValveStatus({ config, negativeFeed, fuseDetail }) {
  const lines = [];
  for (const key of ['enabled', 'llm_checks', 'delete_policy', 'max_deletes', 'claude_md_edits', 'cooldown_minutes']) {
    const v = config.values[key];
    const p = config.provenance[key];
    lines.push(`- ${key} = ${typeof v === 'string' ? v : JSON.stringify(v)}（来源：${p === 'default' ? '默认值' : p === 'file' ? '配置文件' : '环境变量'}）`);
  }
  if (config.envOverriddenKeys.length > 0) {
    // AC4：不允许静默覆盖——每个生效的环境变量覆盖都要点名
    for (const key of config.envOverriddenKeys) {
      lines.push(`- ⚠️ 本次由环境变量覆盖：\`${key}\``);
    }
  }
  if (config.values.llm_checks === 'on') {
    // AC3：如实标注，不假装 on 档位有语义
    lines.push('- ⚠️ LLM 层待 PBI-07，本档位（llm_checks=on）暂不生效——本场为纯机械梦（零 API）');
  }
  for (const note of config.notes) {
    lines.push(`- 配置注记：${note}`);
  }
  if (fuseDetail) {
    lines.push(`- ⚠️ 熔断：${fuseDetail.reason}；触发时真实净消失 ${fuseDetail.netDisappeared}，已回滚动作 ${fuseDetail.rolledBackActions.length} 笔`);
  }
  if (negativeFeed) {
    const line = negativeFeed.triggeringSessionId
      ? `进料对账：触发本场梦的会话 ${negativeFeed.triggeringSessionId} 的底片 ${negativeFeed.found ? `已读到（${negativeFeed.pageCount} 页，最近一页 ${negativeFeed.latestPage}）` : '**未找到**'}`
      : '进料对账：本次调用未指定触发会话（未传 --session，跳过对账）';
    lines.push(line);
  }
  return lines.join('\n');
}

/**
 * @param {object} opts
 * @param {string} opts.runId
 * @param {object} opts.paths dreamPaths(root)
 * @param {object} opts.config resolveConfig 的返回
 * @param {object} opts.checkMeta runMechanicalChecks 的 meta
 * @param {object} opts.disposal applyDisposal 的返回（journal/pendingRulings/netDeleted）
 * @param {object|null} opts.fuseDetail buildFuseDetail 的返回（未熔断为 null）
 * @param {string|null} opts.preSha 梦前快照 sha
 * @param {string|null} opts.dreamSha dream: 提交 sha（报告在提交后生成时可得；未提交/熔断为 null）
 * @param {object|null} opts.negativeFeed 进料对账数据（Sprint-2 契约保持）
 * @param {object[]} opts.g9Quotes G9 摘录（02.6；本轮可为空数组）
 * @param {string} opts.engineLogRel 执行日志相对项目根路径（报告内引用）
 */
export function buildReport({ runId, paths, config, checkMeta, disposal, fuseDetail, preSha, dreamSha, negativeFeed, g9Quotes, engineLogRel }) {
  const sections = [
    `# 梦报告 ${runId}（机械梦 · 零 API）`,
    '',
    '## 图 delta 对账',
    renderGraphDelta({ checkMeta, disposal, fuseDetail }),
    '',
    '## 30 秒版',
    render30Second({ journal: disposal.journal, pendingRulings: disposal.pendingRulings, fuseDetail, dreamSha, engineLogRel }),
    '',
    '## 明细（四要素：动作 | 判据编号 | 证据 | 回滚提示）',
    renderDetails({ journal: disposal.journal, engineLogRel }),
    '',
    '## 隔离观察区',
    renderQuarantineZone({ journal: disposal.journal, pendingRulings: disposal.pendingRulings, g9Quotes }),
    '',
    '## 抽查点',
    renderSpotChecks({ journal: disposal.journal, preSha }),
    '',
    '## 阀门状态',
    renderValveStatus({ config, negativeFeed, fuseDetail }),
    '',
  ];
  return sections.join('\n');
}
