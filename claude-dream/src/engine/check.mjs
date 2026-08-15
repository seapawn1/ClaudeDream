// PBI-02.2：M1–M5 机械体检判据引擎。零 API——只碰文件系统与 git（经 createEngineLog.run 的
// argv 数组调用），不 import SDK、不发网络。所有判据由受信任代码直接执行（SprintBacklog 1.1
// 架构前提，非本文件自选）。
//
// 判据清单（Sketches 机械层表）：
//   M1 断链：[[目标]] 指向的文件不存在 → 检出，附出处（哪个文件的哪条引用）
//   M2 孤儿：全库链接图反查，无出链且无入链 → 检出；库存 <15 条整条禁用（R3），禁用如实入 meta
//   M3 悬空溯源：frontmatter sources: 指向的日志/文件已消失 → 检出
//   M4 实体失效：正文引用的路径/函数/命令在当前项目 0 命中 → 「候选」；路径形实体再查 git 讣告
//      （git log --diff-filter=D）命中 → 升「确凿」；查不到保持「候选」（防改名误判）
//   M5 索引漂移：MEMORY.md 行集合与实际文件集合双向对账，两个方向的差集都检出、标 auto_fixable
//
// 证据纪律（C2）：每条 finding 的 evidence 字段是执行日志的引用（exec.record/exec.run 的返回
// entry），报告生成时按「真实命令」/「纯代码判据」两种记法渲染，不出现无记录支撑的论证。

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const MEMORY_INDEX = 'MEMORY.md';
const M2_COLD_START_MIN = 15; // R3：库存 <15 条时 M2 整条禁用（小库冷启动孤儿全是噪音）
const M4_EXCLUDE_PATHSPEC = ':!.claude'; // M4 检索排除 .claude/：记忆库自引用不算「当前项目实体」
const M4_EXTENSIONS = new Set([
  'mjs', 'js', 'cjs', 'ts', 'tsx', 'jsx', 'py', 'json', 'md', 'txt', 'yaml', 'yml',
  'css', 'html', 'sh', 'bat', 'ps1', 'rs', 'go', 'java', 'cpp', 'c', 'h', 'toml', 'lock', 'csv',
]);

/** 记忆目录下除 MEMORY.md 外的全部 .md 文件（排序保证确定性）。 */
export function listMemoryFiles(memoryDir) {
  if (!existsSync(memoryDir)) return [];
  return readdirSync(memoryDir).filter((f) => f.endsWith('.md') && f !== MEMORY_INDEX).sort();
}

function parseScalar(value) {
  let v = value.trim();
  // 去引号（成对单双引号）；YAML 行尾注释（六键级配置不含 #，记忆 frontmatter 的 description 可能含
  // # 号——所以这里只截「行首是 #」的纯注释行，不截行尾 #，宁保守不误伤正文）
  if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
    v = v.slice(1, -1);
  }
  return v;
}

function parseSourcesInline(value) {
  // 三种形态：sources: /a/b.jsonl（单值）/ sources: [a, b]（内联列表）/ sources: []（空）
  const v = value.trim();
  if (!v) return [];
  if (v.startsWith('[')) {
    const inner = v.slice(1, v.endsWith(']') ? -1 : v.length);
    return inner.split(',').map((s) => s.trim()).filter(Boolean).map((s) => parseScalar(s));
  }
  return [parseScalar(v)];
}

/**
 * 解析单个记忆文件：frontmatter（name/description/metadata 子键/modified/sources）+ 正文。
 * 任何解析异常都降级为「能拿多少拿多少」，绝不抛——判据引擎不允许因一个畸形文件炸掉整场梦。
 * sources 支持三形态：单值 / [内联列表] / 缩进 - 块列表。
 */
export function parseMemoryFile(filePath) {
  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
  const lines = content.split(/\r?\n/);
  let fmEnd = -1;
  if (lines[0]?.trim() === '---') {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') { fmEnd = i; break; }
    }
  }
  const hasFrontmatter = fmEnd !== -1;
  const body = hasFrontmatter ? lines.slice(fmEnd + 1).join('\n') : content;

  const frontmatter = {};
  if (hasFrontmatter) {
    let currentKey = null;
    let inSourcesBlock = false;
    for (let i = 1; i < fmEnd; i++) {
      const raw = lines[i];
      if (!raw.trim()) continue;
      const indent = raw.match(/^\s*/)[0].length;
      if (indent > 0 && inSourcesBlock && raw.trim().startsWith('- ')) {
        frontmatter.sources.push(raw.trim().slice(2).trim());
        continue;
      }
      const m = raw.match(/^(\s*)([^:]+):\s*(.*)$/);
      if (!m) continue;
      const key = m[2].trim();
      const value = m[3].trim();
      // 允许缩进子键的嵌套块：metadata 与 quarantine（L3 隔离标记，见 act.mjs）
      if (indent > 0 && (currentKey === 'metadata' || currentKey === 'quarantine')) {
        frontmatter[currentKey] = frontmatter[currentKey] || {};
        frontmatter[currentKey][key] = parseScalar(value);
        continue;
      }
      inSourcesBlock = key === 'sources' && !value;
      currentKey = key;
      if (key === 'sources') {
        frontmatter.sources = inSourcesBlock ? [] : parseSourcesInline(value);
      } else if (key === 'metadata' || key === 'quarantine') {
        frontmatter[key] = frontmatter[key] || {};
      } else {
        frontmatter[key] = parseScalar(value);
      }
    }
  }

  return {
    filePath,
    slug: path.basename(filePath, '.md'),
    name: frontmatter.name ?? null,
    description: frontmatter.description ?? null,
    type: frontmatter.metadata?.type ?? null,
    modified: frontmatter.modified ?? null,
    sources: Array.isArray(frontmatter.sources) ? frontmatter.sources : [],
    status: frontmatter.status ?? null,
    quarantine: frontmatter.quarantine && typeof frontmatter.quarantine === 'object' ? frontmatter.quarantine : null,
    body,
    hasFrontmatter,
  };
}

/** 正文里的全部 [[链接]]，去重、保序。 */
export function extractLinks(body) {
  const links = [];
  const seen = new Set();
  for (const m of body.matchAll(/\[\[([^\]\n]{1,200})\]\]/g)) {
    const t = m[1].trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      links.push(t);
    }
  }
  return links;
}

/** 链接解析规则（SprintBacklog 3.4#1）：含路径字符按项目相对路径；否则按记忆 slug 查 <slug>.md。 */
export function resolveLink(link, memoryDir, root) {
  if (/[/\\]/.test(link) || link.includes('.')) {
    const abs = path.isAbsolute(link) ? link : path.join(root, link);
    return { mode: 'project', exists: existsSync(abs) };
  }
  return { mode: 'memory', exists: existsSync(path.join(memoryDir, `${link}.md`)) };
}

/** 找 token 首次出现的正文行号（1 起，找不到 null）——出处的「哪条引用」细化到行。 */
function lineOf(bodyLines, needle) {
  const idx = bodyLines.findIndex((l) => l.includes(needle));
  return idx === -1 ? null : idx + 1;
}

// ---------- M1 断链 ----------

function checkM1({ mems, memoryDir, root, exec }) {
  const findings = [];
  for (const mem of mems) {
    const bodyLines = mem.body.split(/\r?\n/);
    for (const link of extractLinks(mem.body)) {
      const resolved = resolveLink(link, memoryDir, root);
      const evidence = exec.record({
        criterion: 'M1', object: mem.slug, inputs: { link, resolvedAs: resolved.mode },
        result: resolved.exists ? 'resolved' : 'broken',
      });
      if (!resolved.exists) {
        findings.push({
          id: 'M1', object: mem.slug, detail: { link, resolvedAs: resolved.mode, line: lineOf(bodyLines, link) }, evidence,
        });
      }
    }
  }
  return findings;
}

// ---------- M2 孤儿 ----------

/**
 * 链接图口径：节点 = 记忆文件（slug）；出链 = 该文件正文里的一切 [[链接]]（不论是否解析成功——
 * 有出链意图即不算孤立，断链归 M1 管）；入链 = 其他文件里指向本 slug 的链接。
 * 链接目标带路径字符的（项目路径引用）不算记忆图边；[[foo.md]] 形式容忍并归一到 slug foo。
 * 导出供 act.mjs 的隔离复检复用（同一口径单一来源，不复刻一份）。
 */
export function buildLinkGraph(mems) {
  const slugs = new Set(mems.map((m) => m.slug));
  const inDegree = new Map(mems.map((m) => [m.slug, new Set()]));
  const outLinks = new Map();
  for (const mem of mems) {
    const links = extractLinks(mem.body);
    outLinks.set(mem.slug, links);
    for (const link of links) {
      const target = link.includes('.md') ? link.replace(/\.md$/, '') : link;
      if (!/[/\\]/.test(target) && slugs.has(target)) {
        inDegree.get(target).add(mem.slug);
      }
    }
  }
  return { inDegree, outLinks };
}

function checkM2({ mems, memoryCount, exec }) {
  if (memoryCount < M2_COLD_START_MIN) {
    exec.record({
      criterion: 'M2', inputs: { memoryCount, threshold: M2_COLD_START_MIN },
      result: 'disabled-cold-start',
    });
    return { disabled: true, reason: `库存 ${memoryCount} 条 < ${M2_COLD_START_MIN}，冷启动保护（R3）整条禁用`, findings: [] };
  }
  const { inDegree, outLinks } = buildLinkGraph(mems);
  const findings = [];
  for (const mem of mems) {
    const links = outLinks.get(mem.slug) ?? [];
    const inCount = inDegree.get(mem.slug)?.size ?? 0;
    const evidence = exec.record({
      criterion: 'M2', object: mem.slug,
      inputs: { outLinkCount: links.length, inLinkCount: inCount },
      result: links.length === 0 && inCount === 0 ? 'orphan' : 'connected',
    });
    if (links.length === 0 && inCount === 0) {
      findings.push({ id: 'M2', object: mem.slug, detail: { outLinkCount: 0, inLinkCount: 0 }, evidence });
    }
  }
  return { disabled: false, reason: null, findings };
}

// ---------- M3 悬空溯源 ----------

function checkM3({ mems, root, exec }) {
  const findings = [];
  for (const mem of mems) {
    for (const source of mem.sources) {
      const abs = path.isAbsolute(source) ? source : path.join(root, source);
      const exists = existsSync(abs);
      const evidence = exec.record({
        criterion: 'M3', object: mem.slug, inputs: { source, resolvedTo: abs },
        result: exists ? 'resolved' : 'dangling',
      });
      if (!exists) {
        findings.push({ id: 'M3', object: mem.slug, detail: { source }, evidence });
      }
    }
  }
  return findings;
}

// ---------- M4 实体失效 ----------

/**
 * 实体抽取口径（SprintBacklog 3.4#3，机械启发式，边界如实记录）：
 *  1. 反引号 token：路径形（含 / \ 或以已知扩展名结尾）/ 命令形（含空格）/ 函数形（含括号）→ 抽；
 *     纯词（`npm` 单蹦）不抽——0 命中无信号，只会制造误报（查准兜底 AC7）。
 *  2. 裸路径形 token（未加反引号）：以已知扩展名结尾才算实体（domain.com 之类结尾段
 *     不在扩展名表 → 不抽，天然滤掉 URL 片段）。
 *  3. URL 直接跳过；含通配符（* ? [）跳过（grep -F 与 git pathspec 都处理不了 glob 语义）；
 *     中文句读字符粘进来的碎片跳过。
 */
export function extractEntities(body) {
  const seen = new Set();
  const add = (t) => {
    t = t.trim();
    if (t.length < 3 || t.length > 150) return;
    if (/^\d+$/.test(t)) return;
    if (/[*?\[]/.test(t)) return;
    if (/[。，；：]/.test(t)) return;
    seen.add(t);
  };
  // 先把 URL 整段掩掉再抽取——裸路径 regex 会从 URL 中段切出 "//example.com/docs.md"
  // 之类的碎片（token 不以 http 开头，isUrlish 拦不住），以 .md/.js 结尾的 URL 尤其会
  // 变成假实体。掩到空白即整个 URL 出局，比逐 token 猜"这像不像 URL"干净。
  const masked = body.replace(/https?:\/\/[^\s"'（）()\[\]]+/g, ' ').replace(/www\.[^\s"'（）()\[\]]+/g, ' ');
  for (const m of masked.matchAll(/`([^`\n]{1,150})`/g)) {
    const t = m[1].trim();
    if (!t) continue;
    const pathish = /[/\\]/.test(t) || /\.[a-zA-Z0-9]{1,10}$/.test(t);
    if (pathish || /\s/.test(t) || /[()]/.test(t)) add(t);
  }
  for (const m of masked.matchAll(/[\w@./\\\-]{1,150}\.([a-zA-Z0-9]{1,10})/g)) {
    if (M4_EXTENSIONS.has(m[1])) add(m[0]);
  }
  return [...seen];
}

/** 实体分类：路径形（可查讣告）还是命令/函数形（无机械讣告通道，永远候选）。 */
function entityKind(t) {
  if (/[/\\]/.test(t) || /\.[a-zA-Z0-9]{1,10}$/.test(t)) return 'path';
  return 'command-or-function';
}

/** 把路径形实体规整成 git 相对路径；绝对路径在项目外 / 含空格命令形态 → null（不可查讣告）。 */
function toGitPath(token, root) {
  let p = token.replace(/\\/g, '/');
  if (p.startsWith('./')) p = p.slice(2);
  if (path.isAbsolute(token)) {
    const rel = path.relative(root, token).replace(/\\/g, '/');
    if (rel.startsWith('..') || path.isAbsolute(rel)) return null; // 项目外绝对路径：非当前项目实体
    return rel;
  }
  return p;
}

function checkM4({ mems, root, exec }) {
  const findings = [];
  for (const mem of mems) {
    const bodyLines = mem.body.split(/\r?\n/);
    for (const entity of extractEntities(mem.body)) {
      // 第一步：项目现状检索（git grep 跟踪文件，排除 .claude/；未跟踪文件不参与——已知边界）。
      // git grep 无命中时退出码 1（不是进程错误）；退出码 0 = 命中。其他退出码 = 检索本身失败，
      // 不据此制造候选（检索失败 ≠ 0 命中，宁缺毋滥）。
      const grep = exec.run('git', ['grep', '-I', '-F', '-e', entity, '--', M4_EXCLUDE_PATHSPEC], { cwd: root });
      let hits = false;
      if (grep.ok) {
        hits = grep.stdout.trim().length > 0;
      } else if (grep.entry.exitCode !== 1) {
        exec.record({ criterion: 'M4', object: mem.slug, result: 'search-failed', inputs: { entity }, error: grep.entry.error });
        continue;
      }
      if (hits) {
        exec.record({ criterion: 'M4', object: mem.slug, inputs: { entity }, result: 'hit' });
        continue;
      }

      // 第二步：0 命中 → 候选；路径形实体再跑 git 讣告（git log --diff-filter=D），有删除记录升确凿。
      let evidenceLevel = 'candidate';
      let obituary = null;
      const kind = entityKind(entity);
      if (kind === 'path') {
        const gitPath = toGitPath(entity, root);
        if (gitPath) {
          const log = exec.run('git', ['log', '--diff-filter=D', '--format=%H', '-1', '--', gitPath], { cwd: root });
          const deleted = log.ok && log.stdout.trim().length > 0;
          obituary = { path: gitPath, deleted, evidence: log.entry };
          if (deleted) evidenceLevel = 'confirmed';
        }
      }
      const evidence = exec.record({
        criterion: 'M4', object: mem.slug,
        inputs: { entity, entityKind: kind, searchCommand: grep.entry.command },
        result: `zero-hits-${evidenceLevel}`,
        // 命令证据随判定记录一并携带（报告按 C2 命令记法渲染：命令原文+exit code+stdout 摘要+时间戳）
        commands: [grep.entry, obituary?.evidence ?? null].filter(Boolean),
      });
      findings.push({
        id: 'M4', object: mem.slug,
        detail: { entity, entityKind: kind, line: lineOf(bodyLines, entity), obituary: obituary?.path ?? null },
        evidenceLevel, // 'candidate' | 'confirmed' ——两级证据必须可区分（AC4）
        evidence,
      });
    }
  }
  return findings;
}

// ---------- M5 索引漂移 ----------

/**
 * MEMORY.md 行集合与实际文件集合双向对账：索引有盘上无 = 陈旧索引行；盘上有索引无 = 漏索引。
 * 两个方向都检出、都标 auto_fixable（L0 修复）。非指针行（标题/空行/注释）不参与。
 */
function checkM5({ mems, memoryIndexPath, exec }) {
  let indexContent = '';
  try {
    indexContent = readFileSync(memoryIndexPath, 'utf8');
  } catch {
    indexContent = '';
  }
  const indexed = new Set();
  for (const line of indexContent.split(/\r?\n/)) {
    const m = line.match(/\[[^\]]*\]\(([^)]+)\)/);
    if (!m) continue;
    // 容忍两种写法：裸 file.md 与 <file.md>（尖括号是 markdown 链接的合法包裹，防御性剥离）
    const target = m[1].trim().replace(/^\.\//, '').replace(/^<|>$/g, '');
    if (target.endsWith('.md') && target !== MEMORY_INDEX) indexed.add(target);
  }
  const onDisk = new Set(mems.map((m) => `${m.slug}.md`));

  const findings = [];
  for (const stale of [...indexed].filter((f) => !onDisk.has(f)).sort()) {
    const evidence = exec.record({
      criterion: 'M5', object: MEMORY_INDEX, inputs: { direction: 'indexed-but-missing-on-disk', file: stale },
      result: 'drift',
    });
    findings.push({ id: 'M5', object: MEMORY_INDEX, detail: { direction: 'indexed-but-missing-on-disk', file: stale }, autoFixable: true, evidence });
  }
  for (const unindexed of [...onDisk].filter((f) => !indexed.has(f)).sort()) {
    const evidence = exec.record({
      criterion: 'M5', object: unindexed, inputs: { direction: 'on-disk-but-missing-in-index' },
      result: 'drift',
    });
    findings.push({ id: 'M5', object: unindexed, detail: { direction: 'on-disk-but-missing-in-index' }, autoFixable: true, evidence });
  }
  return findings;
}

/**
 * 主入口：跑全部五条判据。
 * @param {object} opts
 * @param {string} opts.root 项目根
 * @param {object} opts.paths dreamPaths(root) 的结果
 * @param {object} opts.exec createEngineLog 的返回（命令执行 + 证据记录都走它）
 * @returns {{findings: object[], meta: {memoryCount, m2Disabled, m2DisabledReason, checkedAt}, mems: object[]}}
 */
export function runMechanicalChecks({ root, paths, exec }) {
  const mems = listMemoryFiles(paths.memoryDir).map((f) => parseMemoryFile(path.join(paths.memoryDir, f))).filter(Boolean);
  const memoryCount = mems.length;
  const findings = [];

  findings.push(...checkM1({ mems, memoryDir: paths.memoryDir, root, exec }));
  const m2 = checkM2({ mems, memoryCount, exec });
  findings.push(...m2.findings);
  findings.push(...checkM3({ mems, root, exec }));
  findings.push(...checkM4({ mems, root, exec }));
  findings.push(...checkM5({ mems, memoryIndexPath: paths.memoryIndex, exec }));

  return {
    findings,
    mems,
    meta: {
      memoryCount,
      m2Disabled: m2.disabled,
      m2DisabledReason: m2.reason,
      checkedAt: new Date().toISOString(),
    },
  };
}
