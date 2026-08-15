#!/usr/bin/env node
/**
 * verify.mjs — Sprint-3-engine 验收判分脚本。判据定义见 TestPlan.md §1（主线七站）。
 *
 * 用法：
 *   node testbed/build-testbed.mjs   # 先重建考场（脏考场上的绿灯不算数）
 *   node verify.mjs                  # 跑全部自动/半自动判据
 *   node verify.mjs --adapter <path> --json <path>   # 换适配层、导出判定结果
 *
 * 接线依据：developers 按 DoD·D5 落盘的 adapter.json（Sprint-3 增量版）。
 * 没找到 adapter.json 时判「未答卷」，退出码 2（环境未就绪），不是脚本坏了。
 *
 * 判定符号：✔ 过 ｜ ✖ 不过 ｜ ○ 前置未成立，无法判 ｜ ✋ 需人工/半自动判断
 * 退出码：0 全绿（含半自动/人工项已人工确认）｜ 1 有不过或有待办 ｜ 2 环境未就绪
 * （考场/adapter 缺失）——TestPlan §5。
 *
 * 贯穿说明：所有考场梦都在无登录态环境跑（HOME 重定向 + 凭据遮蔽 + 断网模拟——死代理），
 * 除站 4 正式场外 env 覆盖 cooldown_minutes=0 连跑；全场 env llm_checks=off。
 */

import { execSync, execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, 'testbed', 'out')
const ANSWER_JSON = join(OUT, 'answer-key.json')
const REPO_ROOT = join(HERE, '..', '..', '..')
const NO_LOGIN_HOME = join(OUT, '.nologin-home')

// ---------------------------------------------------------------- 判据台账

const CHECKS = [
  // 站 1 · 真体检
  ['H-B1', '02.2-AC1', '断链检出、附出处', false],
  ['H-B2', '02.2-AC2', '孤儿检出', false],
  ['H-B3', '02.2-AC3', '悬空溯源检出', false],
  ['H-B4', '02.2-AC4', 'M4 确凿级：真讣告升确凿', false],
  ['H-B5', '02.2-AC4', 'M4 候选级：无讣告留候选', false],
  ['H-B6', '02.2-AC5', '索引漂移双向差集检出', false],
  ['H-B7', '02.2-AC7', '健康记忆零误报', false],
  ['H-C1', '02.2-AC7', '全健康库零检出', false],
  ['H-C2', '02.2-AC2', '库存 <15 时 M2 禁用状态入报告', false],
  // 站 2 · 真处置
  ['H-D1', '02.3-AC1', 'L0 随手修自动执行、进报告四要素', false],
  ['H-D2', '02.3-AC2+02.4-AC1', '确凿票执行删除、仅限 M4 确凿级', false],
  ['H-D3', '02.3-AC2', '候选级无删除权', false],
  ['H-D4', '02.3-AC3', 'report-only 档零删除动作', false],
  ['H-E1', '02.3-AC5', 'feedback 类种腐烂后字节不变、不进隔离', false],
  ['H-E2', '02.3-AC5', 'feedback 类只进报告「待你裁决」节', false],
  ['H-F1', '02.3-AC4', '隔离标记形态 + 可逆', false],
  // 站 3 · 真留证
  ['H-H1', '02.5-AC1', '明细每笔四要素齐全', false],
  ['H-H2', '02.5-AC1', '新建类回滚提示形态 + 连坐标注', true],
  ['H-H3', '02.5-AC2', 'C2 证据两种记法（执行日志）', true],
  ['H-H4', '02.5-AC3', 'C3 抽查点梦前基准、必须能失败', true],
  ['H-H5', '02.5-AC4', '每笔删除内联死者遗言', false],
  ['H-H6', '02.5-AC5', '自动挑证明力最弱 3 笔生成抽查点', false],
  ['H-H7', '02.5-AC6', '30 秒版说全动作类型、CLAUDE.md 置顶（本轮空真）', true],
  // 站 4 · 熔断器
  ['H-G1', '02.4-AC1', '超阈值即中止、记忆回梦前状态', false],
  ['H-G2', '02.4-AC1', '阈值口径写死：净消失数=仅记忆文件', false],
  ['H-G3', '02.4-AC2', 'D4 负向对照：判据本身真会拦', false],
  ['H-G4', '02.4-AC3', '熔断后现场干净 + 冷却照常起算', false],
  // 站 5 · G9 回程
  ['H-I1', '02.6-AC1', '定向阶段读上次梦 runId 之后的底片页', false],
  ['H-I2', '02.6-AC2', '底片消费契约三点', false],
  ['H-I3', '02.6-AC3', '底片目录只读（机械管线源码）', true],
  // 贯穿判据
  ['H-A1', '02.1-AC4', '环境变量覆盖生效且报告标注', false],
  ['H-J1', '贯穿条件', '全链静态扫描无 SDK/网络引用', false],
  ['H-J2', '贯穿条件', '无登录态环境整梦跑通', true],
  ['H-J3', '02.2-AC6', '五判据自身不发起 SDK/网络调用', false],
  // 回归卷（§7 另计）
  ['H-K1', '连带影响', '防递归标记机制完好（Sprint-01 卷重跑）', false],
  ['H-K2', '连带影响', '会话登记/backfill 排除完好（Sprint-02 F 系列重跑）', false],
  ['H-K3', '连带影响', '底片产线不受本轮影响（Sprint-02 卷重跑，点名豁免 H-D1/D2）', false],
  // 人工项
  ['H-M1', '兜真实性', '真实环境真跑一场纯机械梦，亲眼看报告与提交', true],
]

const results = new Map()
const pass = (id, note) => results.set(id, { mark: '✔', note })
const fail = (id, note) => results.set(id, { mark: '✖', note })
const block = (id, note) => results.set(id, { mark: '○', note })
const manual = (id, note) => results.set(id, { mark: '✋', note })

// ---------------------------------------------------------------- 适配层

const argOf = (flag) => {
  const i = process.argv.indexOf(flag)
  return i > -1 ? process.argv[i + 1] : null
}

let adapter = {}
let adapterMissing = false

function loadAdapter() {
  const p = argOf('--adapter') ? resolve(HERE, argOf('--adapter')) : join(HERE, 'adapter.json')
  if (!existsSync(p)) { adapterMissing = true; return }
  try {
    adapter = JSON.parse(readFileSync(p, 'utf8'))
  } catch (err) {
    adapterMissing = true
    console.error(`adapter.json 解析失败：${err.message}`)
  }
}

const cmd = (name) => adapter.commands?.[name]?.trim() || null
const path_ = (name) => adapter.paths?.[name] || null
const srcAbs = (name) => (adapter.dreamEngine?.source?.[name] ? join(REPO_ROOT, adapter.dreamEngine.source[name]) : null)

// ---------------------------------------------------------------- 小工具

/** 仓库根相对路径 → 绝对路径（cwd 是考场根时，答卷方命令里 repo 根相对路径必须能解析）。 */
function resolveCmdPaths(cmdline, placeholders = {}) {
  let line = cmdline
  for (const [k, v] of Object.entries(placeholders)) line = line.split(`{${k}}`).join(v)
  return line.split(' ').map((tok) => {
    const bare = tok.replace(/^["']|["']$/g, '')
    if (!bare || bare.startsWith('-') || !/[\\/]/.test(bare)) return tok
    const inRepo = join(REPO_ROOT, bare)
    return existsSync(inRepo) ? `"${inRepo}"` : tok
  }).join(' ')
}

/** 无登录态环境：HOME 重定向到空目录 + 遮蔽凭据 + 死代理断网模拟（任何网络尝试当场失败）。 */
function noLoginEnv() {
  mkdirSync(NO_LOGIN_HOME, { recursive: true })
  const env = { ...process.env, HOME: NO_LOGIN_HOME, USERPROFILE: NO_LOGIN_HOME }
  for (const key of Object.keys(env)) {
    if (/^(ANTHROPIC|CLAUDE_CODE_OAUTH|CLAUDE_AI)/.test(key)) delete env[key]
  }
  env.HTTP_PROXY = 'http://127.0.0.1:9/'
  env.HTTPS_PROXY = 'http://127.0.0.1:9/'
  env.ALL_PROXY = 'http://127.0.0.1:9/'
  delete env.NO_PROXY
  delete env.no_proxy
  return env
}

function runCmd(cmdline, cwd, { env = {}, timeout } = {}) {
  try {
    const out = execSync(resolveCmdPaths(cmdline), {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...noLoginEnv(), ...env },
      timeout: timeout ?? adapter.timeoutMs ?? 300000,
    })
    return { ok: true, out, code: 0 }
  } catch (err) {
    return { ok: false, out: (err.stdout ?? '') + (err.stderr ?? ''), code: err.status ?? -1 }
  }
}

/** 跑一场梦：cwd = 考场项目根（fixture），env 增量覆盖无登录态基线。 */
function runDream(fixtureName, env = {}) {
  const run = cmd('runDream')
  if (!run) return { ok: false, out: 'adapter.commands.runDream 未声明', code: -1 }
  return runCmd(run, fx(fixtureName), { env })
}

// ---------------------------------------------------------------- 考场访问

const fx = (name) => join(OUT, name)
const fxHas = (name, rel) => existsSync(join(fx(name), rel))
const fxRead = (name, rel) => readFileSync(join(fx(name), rel), 'utf8')
const fxWrite = (name, rel, content) => { writeFileSync(join(fx(name), rel), content, 'utf8') }
const memPath = (name, file) => join(fx(name), '.claude', 'memory', file)
const memRead = (name, file) => readFileSync(memPath(name, file), 'utf8')
const memHas = (name, file) => existsSync(memPath(name, file))

function gitFx(name, args) {
  return execFileSync('git', args, { cwd: fx(name), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function answerKey() {
  return JSON.parse(readFileSync(ANSWER_JSON, 'utf8'))
}

/** 基线下某文件内容（记忆库入库提交 SHA，取自对答案卡时间线末条）。 */
function baselineBytes(fixtureName, rel) {
  const key = answerKey()
  const sha = key.timelines[fixtureName].at(-1).sha
  return execFileSync('git', ['show', `${sha}:${rel}`], { cwd: fx(fixtureName), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

/** 最新一份报告 / 执行日志 / last-dream（glob 取最新 mtime）。 */
function newestOf(fixtureName, globRel) {
  const dir = join(fx(fixtureName), dirname(globRel))
  if (!existsSync(dir)) return null
  const pattern = globRel.split('/').at(-1)
  const rx = new RegExp('^' + pattern.split('*').map(escapeRx).join('.*') + '$')
  const files = readdirSync(dir).filter((f) => rx.test(f))
  if (files.length === 0) return null
  files.sort((a, b) => statSync(join(dir, b)).mtimeMs - statSync(join(dir, a)).mtimeMs)
  return join(dir, files[0])
}
const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const reportPath = (name) => newestOf(name, path_('reportGlob') ?? '.claude/dream/*-report.md')
const engineLogPath = (name) => newestOf(name, path_('engineLogGlob') ?? '.claude/dream/*-engine.log')
const lastDreamPath = (name) => join(fx(name), '.claude', 'dream', 'last-dream.json')

function readReport(name) {
  const p = reportPath(name)
  return p ? readFileSync(p, 'utf8') : null
}
function readEngineLog(name) {
  const p = engineLogPath(name)
  if (!p) return []
  return readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
}
function readLastDream(name) {
  const p = lastDreamPath(name)
  return p && existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null
}

/** 报告中找某节文本（标题行含关键字，到下一同级标题为止；找不到返回 ''）。 */
function reportSection(report, keyword) {
  if (!report) return ''
  const lines = report.split('\n')
  let start = -1
  for (let i = 0; i < lines.length; i++) {
    if (/^#+\s/.test(lines[i]) && lines[i].includes(keyword)) { start = i; break }
  }
  if (start < 0) return ''
  const level = lines[start].match(/^(#+)/)[1].length
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#+)\s/)
    if (m && m[1].length <= level) { end = i; break }
  }
  return lines.slice(start + 1, end).join('\n')
}

/** 剥掉隔离标记（status 行 + quarantine 块），返回剩余全文——可逆性对账用。 */
function stripQuarantine(text) {
  let t = text.replace(/^status: quarantined\r?\n/m, '')
  t = t.replace(/^quarantine:\r?\n(?:^[ \t].*\r?\n?)*/m, '')
  return t
}

const ACTION_KEYS = ['fix-link', 'fix-index-add-line', 'fix-index-remove-line', 'quarantine', 'unquarantine', 'delete', 'delete-suggestion']

// ---------------------------------------------------------------- 场景

/** 前置检查：adapter 声明齐全（开考先自检的脚本侧一半——消费项必须都声明）。 */
function preflight() {
  const missing = []
  if (!cmd('runDream')) missing.push('commands.runDream')
  if (!path_('reportGlob')) missing.push('paths.reportGlob')
  if (!path_('engineLogGlob')) missing.push('paths.engineLogGlob')
  if (!path_('negativeDir')) missing.push('paths.negativeDir')
  if (!path_('negativeLedger')) missing.push('paths.negativeLedger')
  if (!adapter.valveConfig?.file) missing.push('valveConfig.file')
  if (!adapter.dreamEngine?.source) missing.push('dreamEngine.source')
  if (!adapter.cooldown) missing.push('cooldown')
  return missing
}

/** H-J1：机械管线源码静态扫描——无 @anthropic-ai / fetch / https.request 等。 */
function scenarioStatic() {
  const sources = adapter.dreamEngine?.source ?? {}
  const files = Object.values(sources).map((p) => join(REPO_ROOT, p)).filter((p) => existsSync(p))
  if (files.length === 0) { fail('H-J1', 'dreamEngine.source 声明的源码文件都不存在'); return }
  const bad = []
  for (const f of files) {
    const text = readFileSync(f, 'utf8')
    for (const [i, line] of text.split('\n').entries()) {
      if (/@anthropic-ai|anthropic-sdk|\bfetch\s*\(|https?\.request\s*\(|\baxios\b|\.query\s*\(\s*['"`]/.test(line)) {
        bad.push(`${f.split(/[\\/]/).at(-1)}:${i + 1}: ${line.trim()}`)
      }
    }
  }
  if (bad.length === 0) pass('H-J1', `扫描 ${files.length} 个机械管线源文件，零 SDK/网络引用`)
  else fail('H-J1', `发现可疑引用：\n${bad.slice(0, 5).join('\n')}`)
}

/** H-I3：底片目录只读——打印 g9.mjs 对底片目录的访问，人工确认只有读 API。 */
function scenarioG9Static() {
  const g9 = srcAbs('engineG9')
  if (!g9 || !existsSync(g9)) { fail('H-I3', 'adapter.dreamEngine.source.engineG9 指向的文件不存在'); return }
  const text = readFileSync(g9, 'utf8')
  const writeOps = ['writeFileSync', 'appendFileSync', 'mkdirSync', 'rmSync', 'unlinkSync', 'renameSync', 'createWriteStream', 'writeFile', 'appendFile']
  const hits = []
  for (const [i, line] of text.split('\n').entries()) {
    if (/negatives|negativeDir/i.test(line) && writeOps.some((op) => line.includes(op))) {
      hits.push(`${i + 1}: ${line.trim()}`)
    }
  }
  if (hits.length === 0) {
    manual('H-I3', `g9.mjs 中未发现面向底片目录的写操作调用（自动查 0 处；请人工扫一眼确认只读边界）`)
  } else {
    manual('H-I3', `g9.mjs 发现写操作与底片目录共现，请人工确认：\n${hits.join('\n')}`)
  }
}

/** H-J2：无登录态冒烟检查必须红灯（必要证据）+ 记录环境，真实性人工确认。 */
function scenarioSmoke() {
  const smoke = join(REPO_ROOT, 'claude-dream', 'test', 'smoke-check.mjs')
  if (!existsSync(smoke)) { manual('H-J2', 'smoke-check.mjs 不存在，无法取无登录态必要证据'); return }
  const r = runCmd(`node "${smoke}"`, REPO_ROOT)
  if (!r.ok) {
    pass('H-J2', `无登录态环境冒烟检查红灯（必要证据成立，exit ${r.code}）；各场梦同环境整场跑通已由各场景验证——无登录态真实性请人工确认一次（HOME 重定向+凭据遮蔽+死代理断网模拟）`)
  } else {
    fail('H-J2', '冒烟检查绿灯——无登录态环境没造成功，各场梦的证据不作数')
  }
}

/** 站 1/2/3：主库 acme-api 一场梦（llm off + 冷却 0），覆盖 B/D/E/F/H/A 判据。 */
function scenarioB() {
  const key = answerKey()
  const main = key.fixtures['acme-api']
  const r = runDream('acme-api', {
    CLAUDE_DREAM_LLM_CHECKS: 'off',
    CLAUDE_DREAM_COOLDOWN_MINUTES: '0',
  })
  if (!r.ok) {
    for (const id of ['H-B1', 'H-B2', 'H-B3', 'H-B4', 'H-B5', 'H-B6', 'H-B7', 'H-D1', 'H-D2', 'H-D3', 'H-E1', 'H-E2', 'H-F1', 'H-H1', 'H-H2', 'H-H3', 'H-H4', 'H-H5', 'H-H6', 'H-H7', 'H-A1'])
      block(id, `主库梦跑失败（exit ${r.code}）：${r.out.slice(0, 120).replace(/\n/g, ' ')}`)
    return
  }
  const report = readReport('acme-api')
  const engLog = readEngineLog('acme-api')
  const reportOr = (fragment) => (report ?? '').includes(fragment)
  const logOr = (fragment) => engLog.some((e) => JSON.stringify(e).includes(fragment))
  const any = (fragment) => reportOr(fragment) || logOr(fragment)

  // ---- 站 1 · 真体检 ----
  pass('H-B1', any('express-migration-plan') && any('fastify-migration-done') ? '断链被检出且出处指向宿主' : '见报告/执行日志')
  if (!(any('express-migration-plan') && any('fastify-migration-done'))) fail('H-B1', '断链未检出或出处缺失')

  pass('H-B2', any('legacy-cron-jobs') ? '孤儿被检出' : '')
  if (!any('legacy-cron-jobs')) fail('H-B2', '孤儿 legacy-cron-jobs.md 未被检出')

  pass('H-B3', any('migration-timeline-notes') ? '悬空溯源被检出' : '')
  if (!any('migration-timeline-notes')) fail('H-B3', '悬空溯源 migration-timeline-notes.md 未被检出')

  const confirmed = main.m4Confirmed.map((x) => x.file)
  const candidate = main.m4Candidates[0].file
  const confirmedOk = confirmed.every((f) => any(f) && (reportOr(`确凿`) || logOr('确凿')))
  pass('H-B4', confirmedOk ? `${confirmed.join('、')} 检出为「确凿」` : '')
  if (!confirmedOk) fail('H-B4', 'M4 确凿级未检出或证据未升确凿')

  const candOk = any(candidate) && (reportOr('候选') || logOr('候选'))
  pass('H-B5', candOk ? `${candidate} 检出为「候选」，两级证据可区分` : '')
  if (!candOk) fail('H-B5', 'M4 候选级未检出或未保持「候选」')

  const idxBoth = (report ?? '').includes('ioredis-lazy-connect') && (report ?? '').includes('rollback-playbook')
  pass('H-B6', idxBoth ? '漏登与幽灵行两个方向都检出' : '')
  if (!idxBoth) fail('H-B6', '索引漂移双向差集未全部检出')

  // ---- 站 2 · 真处置 ----
  // H-D1：L0 修复落盘 + 报告明细含各笔
  const fm = memRead('acme-api', 'fastify-migration-done.md')
  const idx = memRead('acme-api', 'MEMORY.md')
  const fixLink = !fm.includes('[[express-migration-plan]]')
  const fixRelDate = !fm.includes('上周')
  const fixAdd = idx.includes('ioredis-lazy-connect.md')
  const fixRmGhost = !idx.includes('rollback-playbook.md')
  const l0All = fixLink && fixRelDate && fixAdd && fixRmGhost
  const detail = reportSection(report, '明细')
  const detailMentions = (frag) => (detail || (report ?? '')).includes(frag)
  const l0Reported = ['fix-link', 'fix-index-add-line', 'fix-index-remove-line'].every((k) => detailMentions(k)) || ['断链', '索引'].every((k) => detailMentions(k))
  pass('H-D1', l0All && l0Reported ? '去链/相对日期转绝对/补索引行/删幽灵行四笔落盘且入明细' : '')
  if (!l0All) fail('H-D1', `L0 修复未落盘：去链=${fixLink} 相对日期=${fixRelDate} 补行=${fixAdd} 删幽灵行=${fixRmGhost}`)
  else if (!l0Reported) fail('H-D1', 'L0 修复落盘了但报告明细未收录')

  // H-D2：R1/R2 删除、其余零删除
  const deleted = confirmed.filter((f) => !memHas('acme-api', f))
  const restIntact = key.fixtures['acme-api'].zeroFalsePositiveBaseline
    .concat(['express-auth-middleware-notes.md', 'legacy-dev-server.md'])
    .filter((f) => !confirmed.includes(f))
    .every((f) => memHas('acme-api', f))
  pass('H-D2', deleted.length === 2 && restIntact ? `删除恰为 ${deleted.join('、')}，其余记忆零删除` : '')
  if (deleted.length !== 2 || !restIntact) fail('H-D2', `确凿删除执行异常：实际删除 ${deleted.length} 笔（${deleted.join('、')}），其余完整=${restIntact}`)

  // H-D3：候选不删
  pass('H-D3', memHas('acme-api', candidate) ? `${candidate} 原样保留（无讣告不删）` : '')
  if (!memHas('acme-api', candidate)) fail('H-D3', '候选级文件被删——越权')

  // H-E1：feedback 字节不变、不进隔离
  const vitestNow = memRead('acme-api', 'switch-to-vitest.md')
  const vitestBefore = baselineBytes('acme-api', '.claude/memory/switch-to-vitest.md')
  const e1 = vitestNow === vitestBefore && !vitestNow.includes('status: quarantined')
  pass('H-E1', e1 ? 'switch-to-vitest.md 字节与梦前一致、无隔离标记（连断链都不修）' : '')
  if (!e1) fail('H-E1', 'feedback 类被改动或进了隔离')

  // H-E2：待裁决节
  const e2 = (report ?? '').includes('switch-to-vitest') && (report ?? '').includes('待你裁决')
  pass('H-E2', e2 ? '待裁决节可见该条目及其断链' : '')
  if (!e2) fail('H-E2', '报告未见 switch-to-vitest 的「待你裁决」条目')

  // H-F1：候选隔离标记 + 可逆
  const candText = memRead('acme-api', candidate)
  const marked = candText.includes('status: quarantined') && candText.includes('quarantine:')
  const reversible = stripQuarantine(candText) === baselineBytes('acme-api', `.claude/memory/${candidate}`)
  pass('H-F1', marked && reversible ? 'status: quarantined + quarantine 块在，去标记即还原' : '')
  if (!marked) fail('H-F1', '候选未带隔离标记')
  else if (!reversible) fail('H-F1', '隔离标记形态不对——去掉标记不等于原文（可逆性破坏）')

  // ---- 站 3 · 真留证 ----
  const rows = (detail.match(/^\|.*\|$/gm) ?? []).filter((l) => !/^[\s|:-]+$/.test(l))
  const actionRows = rows.filter((l) => ACTION_KEYS.some((k) => l.includes(k)) || /M\d/.test(l))
  const fourElements = actionRows.every((l) => /回滚/.test(l) && /M\d/.test(l) && /[\d]{4}-[\d]{2}-[\d]{2}T|执行日志|时间戳/.test(l))
  pass('H-H1', actionRows.length > 0 && fourElements ? `${actionRows.length} 笔明细四要素齐全` : '')
  if (actionRows.length === 0) fail('H-H1', '报告明细节未解析出动作行')
  else if (!fourElements) fail('H-H1', '存在四要素不全的动作行')

  const coalesce = (detail ?? '').includes('影响其他') || (detail ?? '').includes('连坐')
  const rollbackNewStyle = /撤销|删除/.test(detail ?? '') && !/恢复梦前版本/.test(detail ?? '')
  if (coalesce && rollbackNewStyle) manual('H-H2', '自动部分过：连坐标注在、新建类回滚提示为撤销/删除式——请人工抽读明细确认连坐标注诚实')
  else if (!coalesce) fail('H-H2', '同文件两笔（去链+相对日期）未见连坐显式标注')
  else fail('H-H2', '新建类回滚提示形态不对')

  const kinds = new Set(engLog.map((e) => e.kind))
  const hasCommandEvidence = engLog.some((e) => e.kind === 'command' && /exit/i.test(JSON.stringify(e)))
  if (kinds.has('command') && kinds.has('code') && hasCommandEvidence) manual('H-H3', '自动部分过：执行日志含命令类（exit code）与代码类两种证据——请人工抽读各一行确认记法')
  else if (!kinds.has('command') || !kinds.has('code')) fail('H-H3', '执行日志两种证据形态不全')
  else fail('H-H3', '命令类证据缺 exit code')

  const spot = reportSection(report, '抽查点')
  const spotPreDream = /git show|梦前|preSha/i.test(spot)
  manual('H-H4', spotPreDream ? '抽查点以梦前状态为基准（git show/preSha 起手）；请人工确认每条真的能失败' : '抽查点未见梦前基准迹象——需人工核对')
  if (!spot) fail('H-H4', '报告无抽查点节')

  const deadLetters = confirmed.every((f) => {
    const body = baselineBytes('acme-api', `.claude/memory/${f}`)
    const snippet = body.slice(body.indexOf('metadata:') < 0 ? 0 : body.indexOf('---', 5), body.length).trim().slice(0, 40)
    return (report ?? '').includes(snippet) || /死者遗言/.test(report ?? '') && (report ?? '').includes(f)
  })
  pass('H-H5', deadLetters ? 'R1/R2 删除行内联死者遗言' : '')
  if (!deadLetters) fail('H-H5', '删除明细未见死者遗言')

  const spotCount = (spot.match(/^\s*([-*]|\d+\.)\s/gm) ?? []).length || (spot.match(/^\|.*\|$/gm) ?? []).filter((l) => !/^[\s|:-]+$/.test(l)).length
  const expectSpot = Math.min(3, actionRows.length)
  pass('H-H6', spotCount === expectSpot ? `抽查点 ${spotCount} = min(3, 动作数 ${actionRows.length})` : '')
  if (spotCount !== expectSpot) fail('H-H6', `抽查点数量 ${spotCount} ≠ min(3, ${actionRows.length}) = ${expectSpot}`)

  const summary30 = reportSection(report, '30 秒版')
  const observedActions = ACTION_KEYS.filter((k) => detail.includes(k))
  const cnMap = { 'fix-link': '断链', 'fix-index-add-line': '补索引', 'fix-index-remove-line': '删索引', quarantine: '隔离', unquarantine: '解除隔离', delete: '删除', 'delete-suggestion': '删除建议' }
  const typesAll = observedActions.every((k) => summary30.includes(k) || summary30.includes(cnMap[k]))
  const noClaudeCommit = (() => {
    try {
      const lastMsg = gitFx('acme-api', ['log', '-1', '--format=%s'])
      const touched = gitFx('acme-api', ['show', '--name-only', '--format=', 'HEAD']).split('\n').filter(Boolean)
      return /^dream[:：]/.test(lastMsg) && !touched.some((p) => p === 'CLAUDE.md')
    } catch { return false }
  })()
  if (typesAll && noClaudeCommit) manual('H-H7', `自动部分过：30 秒版说全 ${observedActions.length} 类动作；dream 提交未触 CLAUDE.md（空真被证实）——请人工对账动作类型与置顶逻辑`)
  else if (!typesAll) fail('H-H7', '30 秒版漏报动作类型')
  else fail('H-H7', 'dream 提交触及 CLAUDE.md——L2 归 PBI-07，本轮不该动')

  // ---- 贯穿 ----
  const valve = reportSection(report, '阀门状态')
  const a1 = valve.includes('本次由环境变量覆盖') && valve.includes('llm_checks') && valve.includes('cooldown_minutes')
  pass('H-A1', a1 ? '阀门状态节标注了 env 覆盖（llm_checks/cooldown_minutes）' : '')
  if (!a1) fail('H-A1', 'env 覆盖未标注或标注缺键')

  // H-B7：零误报基线——40 条中 38 条字节不变（fastify-migration-done 允许 L0 两笔、switch-to-vitest 已单独判过）
  const baseline = key.fixtures['acme-api'].zeroFalsePositiveBaseline
    .filter((f) => !['fastify-migration-done.md', 'switch-to-vitest.md'].includes(f))
  const dirty = baseline.filter((f) => memHas('acme-api', f) && memRead('acme-api', f) !== baselineBytes('acme-api', `.claude/memory/${f}`))
  const missingFiles = baseline.filter((f) => !memHas('acme-api', f))
  // 合法双链防误报：M1 finding.object 用 slug（接口口径）——合法链宿主出现在 M1 检出里即误报
  const legalFroms = new Set(key.fixtures['acme-api'].legalLinks.map((l) => l.from.replace(/\.md$/, '')))
  const legalMisreported = engLog.filter((e) => String(e.criterion ?? '').toUpperCase() === 'M1' && legalFroms.has(String(e.object ?? ''))).map((e) => e.object)
  const b7 = dirty.length === 0 && missingFiles.length === 0 && legalMisreported.length === 0
  pass('H-B7', b7 ? '38 条健康基线字节全同、零删除零隔离；合法双链未报断链' : '')
  if (dirty.length) fail('H-B7', `健康记忆被改动：${dirty.join('、')}`)
  if (missingFiles.length) fail('H-B7', `健康记忆被删除：${missingFiles.join('、')}`)
  if (legalMisreported.length) fail('H-B7', `合法链宿主被 M1 误报：${legalMisreported.join('、')}`)

  // H-J3：同 J2 环境 B 场景全链跑通（自动，跑通即证）
  const bSeries = ['H-B1', 'H-B2', 'H-B3', 'H-B4', 'H-B5', 'H-B6', 'H-B7', 'H-D1', 'H-D2', 'H-D3', 'H-E1', 'H-E2', 'H-F1']
  const bGreen = bSeries.every((id) => results.get(id)?.mark === '✔')
  pass('H-J3', bGreen ? '无登录态环境五判据+处置全链跑通' : '')
  if (!bGreen) fail('H-J3', 'B 场景判据未全绿，零 API 全链结论不成立')
}

/** H-C1/H-C2：健康库零检出、小库 M2 禁用标注。 */
function scenarioC() {
  const r1 = runDream('healthy-garden', { CLAUDE_DREAM_LLM_CHECKS: 'off', CLAUDE_DREAM_COOLDOWN_MINUTES: '0' })
  if (!r1.ok) { fail('H-C1', `健康库梦跑失败（exit ${r1.code}）`); return }
  const key = answerKey()
  const garden = key.fixtures['healthy-garden']
  const gardenDirty = (() => {
    try {
      const files = readdirSync(join(fx('healthy-garden'), '.claude', 'memory')).filter((f) => f !== 'MEMORY.md')
      const bad = files.filter((f) => readFileSync(memPath('healthy-garden', f), 'utf8') !== baselineBytes('healthy-garden', `.claude/memory/${f}`))
      const report = readReport('healthy-garden') ?? ''
      const findings = /M[1-5]/.test(report)
      return { bad, findings, report }
    } catch { return { bad: ['异常'], findings: true, report: '' } }
  })()
  pass('H-C1', gardenDirty.bad.length === 0 && !gardenDirty.findings ? '健康库零改动、报告零检出任一 M 判据' : '')
  if (gardenDirty.bad.length) fail('H-C1', `健康库被改动：${gardenDirty.bad.join('、')}`)
  else if (gardenDirty.findings) fail('H-C1', '健康库报告出现判据命中——误报')

  const r2 = runDream('small-pond', { CLAUDE_DREAM_LLM_CHECKS: 'off', CLAUDE_DREAM_COOLDOWN_MINUTES: '0' })
  if (!r2.ok) { fail('H-C2', `小库梦跑失败（exit ${r2.code}）`); return }
  const report2 = readReport('small-pond') ?? ''
  const m2Disabled = /M2[\s\S]{0,20}(禁用|disabled|少于|不足)|(禁用|disabled)[\s\S]{0,20}M2/.test(report2) || (report2.includes('M2') && /<15|库存/.test(report2))
  pass('H-C2', m2Disabled ? '报告可见 M2 禁用标注（库存 6 < 15）' : '')
  if (!m2Disabled) fail('H-C2', '小库报告未见 M2 禁用标注')
}

/** H-D4：重建干净考场后 report-only 档零删除。 */
function scenarioD4() {
  execSync('node testbed/build-testbed.mjs', { cwd: HERE, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' })
  const r = runDream('acme-api', {
    CLAUDE_DREAM_LLM_CHECKS: 'off',
    CLAUDE_DREAM_COOLDOWN_MINUTES: '0',
    CLAUDE_DREAM_DELETE_POLICY: 'report-only',
  })
  if (!r.ok) { fail('H-D4', `report-only 梦跑失败（exit ${r.code}）`); return }
  const r1 = memHas('acme-api', 'express-auth-middleware-notes.md')
  const r2 = memHas('acme-api', 'legacy-dev-server.md')
  const report = readReport('acme-api') ?? ''
  const suggested = report.includes('delete-suggestion') || report.includes('删除建议')
  pass('H-D4', r1 && r2 && suggested ? 'R1/R2 未删、删除建议只进报告' : '')
  if (!(r1 && r2)) fail('H-D4', 'report-only 档发生了删除')
  else if (!suggested) fail('H-D4', '报告未见删除建议')
  execSync('node testbed/build-testbed.mjs', { cwd: HERE, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' })
}

/** 站 4：熔断器——对照场（max_deletes 999）+ 正式场（默认阈值/默认冷却）。 */
function scenarioG() {
  const key = answerKey()
  const brk = key.fixtures['breaker-yard']
  const confirmed = brk.m4Confirmed.map((x) => x.file)

  // ---- 对照场 ----
  const ctrl = runDream('breaker-yard', {
    CLAUDE_DREAM_LLM_CHECKS: 'off',
    CLAUDE_DREAM_COOLDOWN_MINUTES: '0',
    CLAUDE_DREAM_MAX_DELETES: '999',
  })
  if (!ctrl.ok) { fail('H-G3', `对照场梦跑失败（exit ${ctrl.code}）`); return }
  const deleted = confirmed.filter((f) => !memHas('breaker-yard', f))
  const candMarked = memHas('breaker-yard', 'cache-warmer-notes.md')
    && memRead('breaker-yard', 'cache-warmer-notes.md').includes('status: quarantined')
  const idxAdded = memRead('breaker-yard', 'MEMORY.md').includes('staging-env-vars.md')
  const ctrlReport = readReport('breaker-yard') ?? ''
  const net5 = /净消失[^0-9]{0,8}5/.test(ctrlReport) || /5\s*[个笔]?\s*(确凿|删除|净)/.test(ctrlReport)
  pass('H-G3', deleted.length === 5 && candMarked && idxAdded ? `对照场真实删了 ${deleted.length} 个确凿实体（> 默认阈值 3）、候选隔离、索引补行——夹具杀伤力为真` : '')
  if (deleted.length !== 5) fail('H-G3', `对照场净消失 ${deleted.length} ≠ 5——夹具或删除机制与预期不符`)
  else if (!candMarked || !idxAdded) fail('H-G3', '对照场候选未隔离或索引未补行')

  const valve = reportSection(ctrlReport, '阀门状态')
  const a1ctrl = valve.includes('本次由环境变量覆盖') && valve.includes('max_deletes') && valve.includes('cooldown_minutes')
  if (a1ctrl) {
    if (results.get('H-A1')?.mark !== '✖') pass('H-A1', '阀门状态节标注 env 覆盖（B 场 llm_checks/冷却 + 对照场 max_deletes/冷却两键）')
  } else if (results.get('H-A1')?.mark === '✔') {
    fail('H-A1', '对照场 env 覆盖标注缺键（须含 max_deletes 与冷却）')
  }

  // ---- 重建后正式场 ----
  execSync('node testbed/build-testbed.mjs', { cwd: HERE, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' })
  const formal = runDream('breaker-yard', { CLAUDE_DREAM_LLM_CHECKS: 'off' }) // 默认 max_deletes=3、默认冷却 30
  if (!formal.ok) {
    fail('H-G1', `正式场梦异常退出（exit ${formal.code}）：${formal.out.slice(0, 120)}`)
    fail('H-G2', '同上（G1 前置未成立）')
    return
  }
  const last = readLastDream('breaker-yard')
  const fused = last?.status === 'fused'
  const memoryIntact = (() => {
    const files = readdirSync(join(fx('breaker-yard'), '.claude', 'memory'))
    return files.every((f) => memRead('breaker-yard', f) === baselineBytes('breaker-yard', `.claude/memory/${f}`))
  })()
  const formalReport = readReport('breaker-yard') ?? ''
  const reasons = formalReport.includes('熔断') && /净消失/.test(formalReport) && /回滚/.test(formalReport)
  pass('H-G1', fused && memoryIntact && reasons ? 'status=fused、11 条记忆回梦前状态、报告写明熔断原因/净消失数/回滚清单' : '')
  if (!fused) fail('H-G1', 'last-dream.json status ≠ fused')
  else if (!memoryIntact) fail('H-G1', '熔断后记忆未回梦前状态')
  else if (!reasons) fail('H-G1', '报告缺熔断原因/净消失数/回滚清单')

  const netM = formalReport.match(/净消失[^0-9]{0,8}(\d+)/)
  pass('H-G2', netM && netM[1] === '5' ? '报告净消失数 = 5（仅记忆文件，隔离候选与索引补行未计入）' : '')
  if (!netM || netM[1] !== '5') fail('H-G2', `报告净消失数 ${netM?.[1] ?? '未找到'} ≠ 5——口径错（隔离/索引修复/非记忆文件不得计入）`)

  // ---- 冷却照常起算：立刻重跑被拦 ----
  const runIdAfterFuse = readLastDream('breaker-yard')?.runId
  const rerun = runDream('breaker-yard', { CLAUDE_DREAM_LLM_CHECKS: 'off' })
  const runIdAfterRerun = readLastDream('breaker-yard')?.runId
  const blocked = (runIdAfterFuse && runIdAfterRerun === runIdAfterFuse) || /冷却|cooldown/i.test(rerun.out)
  pass('H-G4', blocked ? '熔断后立刻重跑被冷却拦下（runId 未推进，熔断算做过一场梦）' : '')
  if (!blocked) fail('H-G4', `熔断后立刻重跑未被冷却拦下（exit ${rerun.code}）：${rerun.out.slice(0, 120)}`)
  execSync('node testbed/build-testbed.mjs', { cwd: HERE, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' })
}

/** 站 5：G9 回程——上游梦 → 放留话页 → 再跑梦，报告须收录原话+出处指针。 */
function scenarioI() {
  const tplPath = join(OUT, 'g9-note-template.md')
  if (!existsSync(tplPath)) { block('H-I1', 'G9 模板缺失（builder 未跑）'); block('H-I2', '同上'); return }
  const tpl = readFileSync(tplPath, 'utf8')
  const sid = 'g9-handover-00000000-0000-0000-0000-000000000001'

  // 上游梦（主库重建后跑一场——隔离 cache-helper-notes，产生 runId 基线）
  execSync('node testbed/build-testbed.mjs', { cwd: HERE, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' })
  const up = runDream('acme-api', { CLAUDE_DREAM_LLM_CHECKS: 'off', CLAUDE_DREAM_COOLDOWN_MINUTES: '0' })
  if (!up.ok) { block('H-I1', `上游梦失败（exit ${up.code}）`); block('H-I2', '同上'); return }
  const last1 = readLastDream('acme-api')
  const runId1 = last1?.runId
  if (!runId1) { block('H-I1', '上游梦未落 runId（last-dream.json）'); block('H-I2', '同上'); return }

  // 放置留话页（时点：上游梦之后——早放会被正确实现漏检）。
  // 页名 -- 后段 = 上游 runId + 后缀——字典序恒大于基线；后缀形不可解析时按接口口径
  // 「不可解析时间戳的页保守纳入」，同样被检索到（宁多摘不漏摘）。
  const seg = `${runId1}-01`
  const pageName = `${sid}--${seg}.md`
  const negDir = path_('negativeDir') ?? '.claude/negatives'
  mkdirSync(join(fx('acme-api'), negDir), { recursive: true })
  fxWrite('acme-api', `${negDir}/${pageName}`, tpl)
  const ledgerRel = path_('negativeLedger') ?? '.claude/negatives/ledger.json'
  const ledger = { [sid]: { pages: [{ file: pageName, fromIndex: 0, toIndex: 0, entryCount: 1, processedAt: new Date().toISOString(), lastProcessedBytes: Buffer.byteLength(tpl) }] } }
  fxWrite('acme-api', ledgerRel, JSON.stringify(ledger, null, 2))

  // 再跑梦
  const down = runDream('acme-api', { CLAUDE_DREAM_LLM_CHECKS: 'off', CLAUDE_DREAM_COOLDOWN_MINUTES: '0' })
  if (!down.ok) { fail('H-I1', `下游梦失败（exit ${down.code}）`); fail('H-I2', '同上'); return }
  const report = readReport('acme-api') ?? ''
  const wordsIn = report.includes('我复查了上一场梦隔离区') && report.includes('别误删')
  const pointerIn = report.includes(pageName)
  pass('H-I1', wordsIn && pointerIn ? '留话原话被收录 + 出处页指针在报告里' : '')
  if (!wordsIn) fail('H-I1', '报告未收录留话原话')
  else if (!pointerIn) fail('H-I1', '报告缺出处页指针')

  pass('H-I2', wordsIn ? '契约三点成立：台账 file 为 basename、原话保留、### User 标记可机械识别——检索成功本身即契约证据' : '')
  if (!wordsIn) fail('H-I2', '检索失败，契约三点未成立')
  execSync('node testbed/build-testbed.mjs', { cwd: HERE, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' })
}

/** 回归卷（§7）：重跑 Sprint-01/02 两套旧卷，接线合并版 adapter，点名豁免 Sprint-02 H-D1/D2。 */
function scenarioK() {
  const s01Dir = join(REPO_ROOT, 'scrum', 'sprint-01-skeleton', 'acceptance')
  const s02Dir = join(REPO_ROOT, 'scrum', 'sprint-02-negatives', 'acceptance')
  const merged = mergeAdapters()
  if (!merged) {
    for (const id of ['H-K1', 'H-K2', 'H-K3']) block(id, '合并版 adapter 无法生成（Sprint-01/02 adapter.json 缺失）')
    return
  }
  mkdirSync(OUT, { recursive: true })
  const mergedPath = join(OUT, 'merged-adapter.json')
  writeFileSync(mergedPath, JSON.stringify(merged, null, 2), 'utf8')

  for (const [dir, builder] of [[s01Dir, join(s01Dir, 'testbed', 'build-testbed.mjs')], [s02Dir, join(s02Dir, 'testbed', 'build-testbed.mjs')]]) {
    if (existsSync(builder)) {
      execSync(`node "${builder}"`, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' })
    }
  }

  const runOld = (dir) => {
    const verify = join(dir, 'verify.mjs')
    if (!existsSync(verify)) return null
    const relAdapter = relative(dir, mergedPath)
    const relJson = relative(dir, join(OUT, dir.includes('sprint-01') ? 'k1-old.json' : 'k2-old.json'))
    try {
      execSync(`node "${verify}" --adapter "${relAdapter}" --json "${relJson}"`, {
        stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8',
        timeout: adapter.timeoutMs ?? 300000,
      })
    } catch { /* 非零退出常见（有 ✋ 项）——判定看 JSON */ }
    const out = join(OUT, dir.includes('sprint-01') ? 'k1-old.json' : 'k2-old.json')
    return existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : null
  }

  const k1 = runOld(s01Dir)
  const k2 = runOld(s02Dir)

  if (!k1) { block('H-K1', 'Sprint-01 verify.mjs 未跑出 JSON（脚本缺失或形制不兼容）') }
  else {
    const bad = Object.entries(k1).filter(([, r]) => r.mark === '✖' || r.mark === '○').map(([id]) => id)
    pass('H-K1', bad.length === 0 ? 'Sprint-01 卷整卷重跑全绿（防递归/冷却/白名单连带机制完好）' : '')
    if (bad.length) fail('H-K1', `Sprint-01 卷未过：${bad.join('、')}`)
  }

  if (!k2) { block('H-K2', 'Sprint-02 verify.mjs 未跑出 JSON'); block('H-K3', '同上') }
  else {
    const exempt = new Set(['H-D1', 'H-D2']) // §4 点名豁免：报告「进料对账行」结构预期变更
    const rows = Object.entries(k2)
    const fBad = rows.filter(([id, r]) => id.startsWith('H-F') && (r.mark === '✖' || r.mark === '○')).map(([id]) => id)
    const restBad = rows.filter(([id, r]) => !id.startsWith('H-F') && !exempt.has(id) && (r.mark === '✖' || r.mark === '○')).map(([id]) => id)
    pass('H-K2', fBad.length === 0 ? 'Sprint-02 补捞/backfill 排除系列重跑全绿' : '')
    if (fBad.length) fail('H-K2', `Sprint-02 F 系列未过：${fBad.join('、')}`)
    pass('H-K3', restBad.length === 0 ? `Sprint-02 卷重跑全绿（豁免点名 H-D1/D2：${Object.entries(k2).filter(([id]) => exempt.has(id)).map(([id, r]) => `${id}${r.mark}`).join(' ')})` : '')
    if (restBad.length) fail('H-K3', `Sprint-02 卷未过（豁免外）：${restBad.join('、')}`)
  }
}

/** Sprint-1/2 adapter.json 为基底 + Sprint-3 增量版覆盖（Sprint-3 版只列新增/变更键）。 */
function mergeAdapters() {
  const basePaths = [
    join(REPO_ROOT, 'scrum', 'sprint-02-negatives', 'acceptance', 'adapter.json'),
    join(REPO_ROOT, 'scrum', 'sprint-01-skeleton', 'acceptance', 'adapter.json'),
  ]
  let merged = {}
  for (const p of basePaths.reverse()) {
    if (existsSync(p)) merged = deepMerge(merged, JSON.parse(readFileSync(p, 'utf8')))
  }
  merged = deepMerge(merged, adapter)
  delete merged._versionNote
  delete merged._pathConvention
  return Object.keys(merged).length ? merged : null
}
const deepMerge = (a, b) => {
  const out = { ...a }
  for (const [k, v] of Object.entries(b)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && typeof out[k] === 'object' && !Array.isArray(out[k])
      ? deepMerge(out[k], v) : v
  }
  return out
}

// ---------------------------------------------------------------- 主流程

function render() {
  console.log('\n判据      源 AC                       判定  说明')
  console.log('─'.repeat(100))
  let passed = 0, failed = 0, pending = 0
  for (const [id, ac, title] of CHECKS) {
    const r = results.get(id) ?? { mark: '○', note: '未执行' }
    if (r.mark === '✔') passed++
    else if (r.mark === '✖') failed++
    else pending++
    const note = (r.note ?? '').split('\n')[0].slice(0, 64)
    console.log(`${id.padEnd(6)} ${title.padEnd(30)} ${ac.padEnd(28)}  ${r.mark}   ${note}`)
  }
  console.log('─'.repeat(100))
  console.log(`过 ${passed} ｜ 不过 ${failed} ｜ 待办（半自动/人工/阻塞）${pending}　共 ${CHECKS.length} 条`)

  const jsonPath = argOf('--json')
  if (jsonPath) {
    const p = resolve(HERE, jsonPath)
    mkdirSync(dirname(p), { recursive: true })
    const dump = Object.fromEntries(CHECKS.map(([id]) => [id, results.get(id) ?? { mark: '○', note: '未执行' }]))
    writeFileSync(p, JSON.stringify(dump, null, 2), 'utf8')
  }
  return failed === 0 && pending === 0
}

function main() {
  loadAdapter()

  const labReady = existsSync(ANSWER_JSON) && existsSync(join(OUT, 'acme-api'))
  if (!labReady) {
    console.error('考场不存在。先跑：node testbed/build-testbed.mjs')
    process.exit(2)
  }

  if (adapterMissing) {
    console.error('未答卷：acceptance/adapter.json 缺失——developers 按 DoD·D5 落盘后才开跑（环境未就绪，不算打回）')
    process.exit(2)
  }

  const missing = preflight()
  if (missing.length) {
    console.error(`adapter.json 声明不完整（开考先自检不过）：缺 ${missing.join('、')}`)
    process.exit(2)
  }

  // 静态 + 冒烟先跑（不依赖梦）
  scenarioStatic()
  scenarioG9Static()
  scenarioSmoke()

  // 场景顺序照主线七站：B（站 1/2/3）→ C（健康/小库）→ D4（report-only）→ G（站 4 熔断）
  // → I（站 5 G9）→ K（回归卷）。每场景起跑前重建考场，脏考场上的绿灯不算数。
  try { scenarioB() } catch (err) { console.error(`场景 B 异常：${err.message}`) }
  try { scenarioC() } catch (err) { console.error(`场景 C 异常：${err.message}`) }
  try { scenarioD4() } catch (err) { console.error(`场景 D4 异常：${err.message}`) }
  try { scenarioG() } catch (err) { console.error(`场景 G 异常：${err.message}`) }
  try { scenarioI() } catch (err) { console.error(`场景 I 异常：${err.message}`) }
  try { scenarioK() } catch (err) { console.error(`场景 K 异常：${err.message}`) }

  manual('H-M1', '真实环境真跑一场纯机械梦（llm_checks: off），亲眼看报告六节与 git 提交形态——PO 人工项')

  const allGreen = render()
  console.log('\n半自动/人工核对项（脚本查不了全部结论，验收当场做）：')
  console.log('  H-H2 回滚提示形态——抽读明细里的连坐标注是否诚实')
  console.log('  H-H3 证据栏——抽读一行命令类证据与一行代码类证据')
  console.log('  H-H4 抽查点——确认每条真的能失败（不是梦后状态自动满足）')
  console.log('  H-H7 30 秒版——人工核对动作类型对账与 CLAUDE.md 置顶逻辑')
  console.log('  H-I3 底片只读——扫一眼上面打印的 g9.mjs 写操作共现行')
  console.log('  H-J2 无登录态——确认环境造法可信（HOME 重定向+凭据遮蔽+死代理）')
  console.log('  H-M1 真实环境真跑一场——PO 亲手看')
  process.exit(allGreen ? 0 : 1)
}

main()
