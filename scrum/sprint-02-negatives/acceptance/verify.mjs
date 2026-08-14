#!/usr/bin/env node
/**
 * verify.mjs — Sprint-02-negatives 验收脚本。判据定义见 TestPlan.md §1。
 *
 * 用法：
 *   node testbed/build-testbed.mjs   # 先重建考场（脏考场上的绿灯不算数）
 *   node verify.mjs                  # 跑全部自动/半自动判据
 *   node verify.mjs --adapter <path> --json <path>   # 换适配层、导出判定结果
 *
 * 出卷阶段没有 adapter.json 是正常的——那时全红，红的原因是"未答卷"，不是脚本坏了。
 * developers 完工后按 adapter.example.json 填一份 adapter.json，本脚本才真正开跑。
 *
 * 判定符号：✔ 过 ｜ ✖ 不过 ｜ ○ 前置未成立，无法判 ｜ ✋ 需人工/半自动判断
 */

import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, statSync, utimesSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const LAB = join(HERE, 'testbed', 'negatives-lab')
const TRANSCRIPTS = join(HERE, 'testbed', 'negatives-lab-transcripts')
const REPO_ROOT = join(HERE, '..', '..', '..')

// ---------------------------------------------------------------- 会话身份台账（与 build-testbed.mjs 同一份字面量）

const SESSION_IDS = {
  MAIN: '9a49720b-15ae-4445-9ddc-de88d0657612',
  UNKNOWN_TYPE: '11111111-2222-3333-4444-555555555555',
  CONCURRENT_1: 'c0000000-0000-0000-0000-000000000001',
  CONCURRENT_2: 'c0000000-0000-0000-0000-000000000002',
  ORPHAN: 'f0000000-0000-0000-0000-00000000000f',
  STALE: 'f0000000-0000-0000-0000-0000000000a1',
  LIVE: 'f0000000-0000-0000-0000-0000000000a2',
  DREAM_INVOKED: 'd0000000-0000-0000-0000-000000000d',
  WRITE_FAIL: 'e0000000-0000-0000-0000-00000000ee01',
  OFFLINE_CHECK: 'e0000000-0000-0000-0000-00000000ee02',
}

const MAIN_TRANSCRIPT_BYTES = statSync(join(TRANSCRIPTS, `${SESSION_IDS.MAIN}.jsonl`)).size
const E_MARKER = 'ACCEPTANCE-MARKER-7f3c1a91'
const UNKNOWN_MARKER = 'UNKNOWN-TYPE-PAYLOAD-9c2e77'

// 留/剔判据设计（H-A3，TestPlan.md §1.1）：7 个已知类别在 real-session-frozen.jsonl 里的天然标记
const KNOWN_CATEGORY_MARKERS = [
  ['用户消息·结构一（数组）', '你当前是什么身份'],
  ['用户消息·结构二（字符串）', '好的，今天武汉天气如何'],
  ['user 角色记录的工具返回', 'tool_reference'],
  ['attachment', 'deferred_tools_delta'],
  ['assistant 正文', '不能凭空报'],
  ['assistant thinking', 'Let me think about my core discipline'],
  ['file-history 等元数据', 'trackedFileBackups'],
]

// ---------------------------------------------------------------- 判据台账

const CHECKS = [
  ['H-A0', '接口约定①', 'stdin 空时不静默 fallback', false],
  ['H-A1', '01.1·AC1', '一场一文件、可寻址', false],
  ['H-A2', '01.1·AC1', '落点在固定只追加目录', false],
  ['H-A3', '01.1·AC3①②', '规则表一致性', true],
  ['H-A4', '01.1·AC3③', '未知类型保守保留＋留痕', false],
  ['H-A5', '01.1·AC3④', '口径限工具调用声明的', true],
  ['H-A6', '01.1·AC4', '体积对账数字', true],
  ['H-A7', '01.1·AC4', '底片≤逐字稿 10%', false],
  ['H-A8', '01.1·AC4', '超大稿有声明的行为', true],
  ['H-B1', '01.1·AC1', '重放旧底片字节不变', false],
  ['H-B2', '01.1·AC1', 'D4：哈希比对真会拦', false],
  ['H-B3', '01.1·AC1', '幂等：不产生第二页', false],
  ['H-C1', '01.1·AC5', '写失败链路不炸', false],
  ['H-C2', '01.1·AC5', '错误留痕在底片目录之外', false],
  ['H-D1', '01.2·AC1', '进料对账行出现', false],
  ['H-D2', '01.2·AC1', '对账行含 session id、定序对', false],
  ['H-D3', '01.2·AC2', '白名单不含底片目录（静态）', true],
  ['H-D4', '01.2·AC2', 'D4：作恶写入被拒且留痕', false],
  ['H-E1', '01.2·AC3', '标记话可原文检索', false],
  ['H-F1', '01.1·AC6', '补捞补齐漏网底片', false],
  ['H-F2', '01.1·AC6①', 'D4：排除梦会话', false],
  ['H-F3', '01.1·AC6②', 'D4：活稿判别不误冻', false],
  ['H-F4', '01.1·AC6③', '补捞可重入', false],
  ['H-F5', '01.1·AC6④', '已清理逐字稿跳过不报错', false],
  ['H-G1', '01.1·AC2', '静态：零 API 引用', false],
  ['H-G2', '01.1·AC2', '断网环境一键自证', true],
  ['H-H1', '01.1·AC6③', '并发两页都在、台账不坏', false],
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
  const p = argOf('--adapter') ? join(HERE, argOf('--adapter')) : join(HERE, 'adapter.json')
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
const src = (name) => (adapter.source?.[name] ? join(REPO_ROOT, adapter.source[name]) : null)

// ---------------------------------------------------------------- 小工具

/** 命令里的脚本路径容错：约定 cwd 是考场根，但答卷方看不见考场在仓库里的层级，
 *  命令写成仓库根相对路径是唯一理性选择——凡带路径分隔符、考场下不存在而仓库根下
 *  存在的 token，就地转绝对路径。同时替换 {ROGUE_TARGET}/{TRANSCRIPTS_DIR}/{CWD} 占位符。 */
function resolveCmdPaths(cmdline, placeholders = {}) {
  let line = cmdline
  for (const [k, v] of Object.entries(placeholders)) line = line.split(`{${k}}`).join(v)
  return line.split(' ').map((tok) => {
    const bare = tok.replace(/^["']|["']$/g, '')
    if (!bare || bare.startsWith('-') || !/[\\/]/.test(bare)) return tok
    if (existsSync(join(LAB, bare))) return tok
    const inRepo = join(REPO_ROOT, bare)
    return existsSync(inRepo) ? `"${inRepo}"` : tok
  }).join(' ')
}

function runCmd(cmdline, { env = {}, timeout, placeholders } = {}) {
  try {
    const out = execSync(resolveCmdPaths(cmdline, placeholders), {
      cwd: LAB,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
      timeout: timeout ?? adapter.timeoutMs ?? 300000,
    })
    return { ok: true, out, code: 0 }
  } catch (err) {
    return {
      ok: false,
      out: (err.stdout ?? '') + (err.stderr ?? ''),
      code: err.status ?? -1,
      timedOut: err.signal === 'SIGTERM' || /ETIMEDOUT|timed out/i.test(err.message ?? ''),
    }
  }
}

/** 跟 runCmd 唯一的差别：stdin 不关闭，写入 input 后再关闭——SessionEnd JSON 走这条。 */
function runCmdWithStdin(cmdline, input, { env = {}, timeout, placeholders } = {}) {
  try {
    const out = execSync(resolveCmdPaths(cmdline, placeholders), {
      cwd: LAB,
      encoding: 'utf8',
      input,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
      timeout: timeout ?? adapter.timeoutMs ?? 300000,
    })
    return { ok: true, out, code: 0 }
  } catch (err) {
    return {
      ok: false,
      out: (err.stdout ?? '') + (err.stderr ?? ''),
      code: err.status ?? -1,
      timedOut: err.signal === 'SIGTERM' || /ETIMEDOUT|timed out/i.test(err.message ?? ''),
    }
  }
}

function labPath(rel) { return join(LAB, rel) }
function labHas(rel) { return existsSync(labPath(rel)) }

/** 极简 glob：只支持单个 * ，够用即可。返回考场内相对路径数组。 */
function findFiles(pattern) {
  const dir = dirname(pattern)
  const base = pattern.slice(dir.length + 1)
  const abs = labPath(dir)
  if (!existsSync(abs)) return []
  const [prefix, suffix] = base.includes('*') ? base.split('*') : [base, '']
  return readdirSync(abs)
    .filter((f) => f.startsWith(prefix) && f.endsWith(suffix))
    .map((f) => `${dir}/${f}`)
}

/** 路径边界判断：child 是否真的落在 parentDir 目录**之内**——不能用裸字符串
 *  startsWith，"negatives-errors.log" 会被 "negatives" 误判成"在目录里"
 *  （自测时真的踩中过这一下，见 selftest 记录）。 */
function isUnder(child, parentDir) {
  const c = child.replace(/\\/g, '/').replace(/\/+$/, '')
  const p = parentDir.replace(/\\/g, '/').replace(/\/+$/, '')
  return c === p || c.startsWith(`${p}/`)
}

/** negativeDir 下相对路径的当前文件全集（不递归子目录之外的假设——目录形制留白，
 *  developers 可能建子目录；这里递归一层子目录，够用不追求完备）。
 *  刻意排除 negativeLedger 自己——台账文件也落在 negativeDir 下是合理选择，但它
 *  不是"一页底片"，把它算进"新增文件数"会让 H-A1/H-B3/H-F1/H-F4/H-H1 全部计数错位
 *  （自测时真的踩中过：H-A1 期望新增 1 个文件，因为把台账也算进去而报成 2 个）。 */
function negativeDirSnapshot() {
  const dir = path_('negativeDir')
  if (!dir) return new Set()
  const abs = labPath(dir)
  if (!existsSync(abs)) return new Set()
  const ledger = path_('negativeLedger')
  const out = new Set()
  const walk = (rel) => {
    const absDir = labPath(rel)
    for (const entry of readdirSync(absDir, { withFileTypes: true })) {
      const relPath = `${rel}/${entry.name}`
      if (entry.isDirectory()) walk(relPath)
      else if (!ledger || relPath !== ledger) out.add(relPath)
    }
  }
  walk(dir)
  return out
}

function diffNew(before, after) {
  return [...after].filter((f) => !before.has(f))
}

function hash(buf) { return createHash('sha256').update(buf).digest('hex') }

function transcriptPath(sessionId) { return join(TRANSCRIPTS, `${sessionId}.jsonl`) }

function sessionEndPayload(sessionId, cwd = LAB) {
  return JSON.stringify({ session_id: sessionId, transcript_path: transcriptPath(sessionId), cwd })
}

/** 喂 SessionEnd stdin JSON 模拟一场散会；sessionId 为 null 时喂空 stdin（H-A0）。 */
function runSessionEnd(sessionId, { env = {}, transcriptOverride } = {}) {
  const sessionEnd = cmd('sessionEnd')
  if (!sessionEnd) return { ok: false, out: '', code: -1, missing: true }
  const payload = sessionId === null ? '' : (transcriptOverride
    ? JSON.stringify({ session_id: sessionId, transcript_path: transcriptOverride, cwd: LAB })
    : sessionEndPayload(sessionId))
  return runCmdWithStdin(sessionEnd, payload, { env })
}

function runBackfill(env = {}) {
  const backfill = cmd('backfill')
  if (!backfill) return { ok: false, out: '', code: -1, missing: true }
  return runCmd(backfill, { env, placeholders: { TRANSCRIPTS_DIR: TRANSCRIPTS, CWD: LAB } })
}

// ---------------------------------------------------------------- 场景 A0：空 stdin 不静默 fallback

function scenarioA0() {
  const before = negativeDirSnapshot()
  const r = runSessionEnd(null)
  const after = negativeDirSnapshot()
  const newFiles = diffNew(before, after)
  if (r.missing) { fail('H-A0', 'adapter 未声明 commands.sessionEnd'); return }
  if (newFiles.length > 0) {
    fail('H-A0', `空 stdin 不该产出底片，但出现了：${newFiles.join('、')}`)
    return
  }
  const traceHit = path_('errorTrace') && labHas(path_('errorTrace'))
  if (r.timedOut) fail('H-A0', '空 stdin 应快速留痕退出，而不是挂起等待输入')
  else pass('H-A0', `空 stdin 未产出底片${traceHit ? '，且留痕可见' : '（未见 errorTrace 留痕，若实现另有留痕点属合理，人工可复核）'}`)
}

// ---------------------------------------------------------------- 场景 A：正常散会

const ctx = {}

function scenarioA() {
  // --- MAIN：正常散会 ---
  const before = negativeDirSnapshot()
  const r = runSessionEnd(SESSION_IDS.MAIN)
  const after = negativeDirSnapshot()
  const newFiles = diffNew(before, after)

  if (r.missing) {
    for (const id of ['H-A1', 'H-A2', 'H-A6', 'H-A7', 'H-A3', 'H-E1', 'H-B1', 'H-B2', 'H-B3']) {
      fail(id, 'adapter 未声明 commands.sessionEnd')
    }
    return
  }

  if (newFiles.length !== 1) {
    fail('H-A1', `期望恰好新增 1 个底片文件，实际新增 ${newFiles.length} 个：${newFiles.join('、') || '(无)'}（退出码 ${r.code}）`)
  } else {
    pass('H-A1', `底片产出：${newFiles[0]}，可定位到 MAIN 会话`)
  }

  const mainFile = newFiles[0]
  ctx.mainFile = mainFile

  if (!mainFile) {
    block('H-A2', '无新文件，无从判落点')
  } else {
    const dir = path_('negativeDir')
    if (isUnder(mainFile, dir)) pass('H-A2', `落在声明的 ${dir}`)
    else fail('H-A2', `新文件 ${mainFile} 不在声明的 negativeDir（${dir}）下`)
  }

  // --- H-A3：留/剔规则表一致性（半自动，见 TestPlan §1.1） ---
  if (!mainFile) {
    block('H-A3', '无底片文件，无从核对')
  } else {
    const text = readFileSync(labPath(mainFile), 'utf8')
    const disposition = KNOWN_CATEGORY_MARKERS.map(([label, marker]) => `${text.includes(marker) ? '留' : '剔'} ｜ ${label}`)
    const rulesPath = path_('retainRules')
    const rulesText = rulesPath && labHas(rulesPath) ? readFileSync(labPath(rulesPath), 'utf8') : null
    manual('H-A3', `实测去向：\n    ${disposition.join('\n    ')}\n  规则表（${rulesPath ?? '未声明 paths.retainRules'}）：${rulesText ? '已读取，人工比对上表与规则表是否一致' : '文件不存在或未声明——若无法核对应判不过'}`)
  }

  // --- H-A6/H-A7：体积对账 ---
  if (!mainFile) {
    block('H-A6', '无底片文件'); block('H-A7', '无底片文件')
  } else {
    const afterBytes = statSync(labPath(mainFile)).size
    const ratio = afterBytes / MAIN_TRANSCRIPT_BYTES
    const ledgerPath = path_('negativeLedger')
    const ledgerText = ledgerPath && labHas(ledgerPath) ? readFileSync(labPath(ledgerPath), 'utf8').slice(-800) : '(negativeLedger 不存在或未声明)'
    manual('H-A6', `实测：压缩前 ${MAIN_TRANSCRIPT_BYTES} 字节 → 压缩后 ${afterBytes} 字节（${(ratio * 100).toFixed(2)}%）。\n  sessionEnd 输出尾部：${r.out.slice(-300).trim() || '(空)'}\n  negativeLedger 尾部：${ledgerText}\n  人工核对：以上任一处是否能读到与实测一致的体积对账。`)
    if (ratio <= 0.10) pass('H-A7', `底片 ${afterBytes} / 逐字稿 ${MAIN_TRANSCRIPT_BYTES} = ${(ratio * 100).toFixed(2)}% ≤ 10%`)
    else fail('H-A7', `底片 ${afterBytes} / 逐字稿 ${MAIN_TRANSCRIPT_BYTES} = ${(ratio * 100).toFixed(2)}% 超过 10% 上限`)
  }

  manual('H-A8', `adapter.oversizedPolicy = ${JSON.stringify(adapter.oversizedPolicy ?? null)}——人工确认声明的行为合理（流式处理，或声明上限与超限动作）`)
  manual('H-A5', '人工读一遍压缩实现源码（adapter.source.negativeCompressor），确认未反解析 Bash/PowerShell 命令行文本去猜测间接文件改动')

  // --- UNKNOWN_TYPE：未知条目类型保守保留＋留痕（H-A4） ---
  const beforeU = negativeDirSnapshot()
  const rU = runSessionEnd(SESSION_IDS.UNKNOWN_TYPE)
  const afterU = negativeDirSnapshot()
  const newU = diffNew(beforeU, afterU)
  const errTracePath = path_('errorTrace')
  const errTraceText = errTracePath && labHas(errTracePath) ? readFileSync(labPath(errTracePath), 'utf8') : ''
  const seenInFile = newU.some((f) => readFileSync(labPath(f), 'utf8').includes(UNKNOWN_MARKER))
  const seenInTrace = errTraceText.includes(UNKNOWN_MARKER)
  if (rU.missing) fail('H-A4', 'adapter 未声明 commands.sessionEnd')
  else if (seenInFile || seenInTrace) pass('H-A4', `未知类型标记${seenInFile ? '在底片中保留' : ''}${seenInFile && seenInTrace ? '，且' : ''}${seenInTrace ? '在留痕中可见' : ''}`)
  else fail('H-A4', `未知类型标记 ${UNKNOWN_MARKER} 既未见于新底片也未见于 errorTrace——疑似被静默丢弃`)
}

// ---------------------------------------------------------------- 场景 E：回程检索（须在 B 破坏性自检之前跑）

function scenarioE() {
  if (!ctx.mainFile) { block('H-E1', 'MAIN 底片缺席（场景 A 未成功）'); return }
  const text = readFileSync(labPath(ctx.mainFile), 'utf8')
  if (text.includes(E_MARKER)) pass('H-E1', `按原文检索到标记话 ${E_MARKER}`)
  else fail('H-E1', `底片 ${ctx.mainFile} 中未检索到标记话 ${E_MARKER}`)
}

// ---------------------------------------------------------------- 场景 B：不可变 + 幂等

function scenarioB() {
  if (!ctx.mainFile) {
    for (const id of ['H-B1', 'H-B2', 'H-B3']) block(id, 'MAIN 底片缺席（场景 A 未成功）')
    return
  }
  const original = readFileSync(labPath(ctx.mainFile))
  const originalHash = hash(original)

  // H-B2：D4 负向对照——纯内存自检，证明哈希比对真的能识别差异（不碰磁盘上的真实底片）
  const corrupted = Buffer.from(original)
  corrupted[0] = corrupted[0] ^ 0xff
  const corruptedHash = hash(corrupted)
  if (corruptedHash !== originalHash) pass('H-B2', '手工翻转 1 字节后哈希确实不同——比对逻辑不是摆设')
  else fail('H-B2', '翻转 1 字节后哈希竟未变——哈希实现有问题（理论上不该发生）')

  // H-B1 + H-B3：重放同一份会话
  const before = negativeDirSnapshot()
  const r = runSessionEnd(SESSION_IDS.MAIN)
  const after = negativeDirSnapshot()
  const newFiles = diffNew(before, after)

  if (r.missing) { fail('H-B1', 'adapter 未声明 commands.sessionEnd'); fail('H-B3', '同上'); return }

  if (!labHas(ctx.mainFile)) {
    fail('H-B1', '重放后原底片文件消失')
  } else {
    const rerunHash = hash(readFileSync(labPath(ctx.mainFile)))
    if (rerunHash === originalHash) pass('H-B1', '重放同一场后旧底片字节不变（哈希一致）')
    else fail('H-B1', '重放同一场后旧底片字节变了——不可变性被破坏')
  }

  if (newFiles.length === 0) pass('H-B3', '重放同一场稿未产生第二页')
  else fail('H-B3', `重放同一场稿产生了新文件：${newFiles.join('、')}——幂等性被破坏`)
}

// ---------------------------------------------------------------- 场景 C：写失败（守卫类 D4）

function scenarioC() {
  const envName = adapter.faultInjection?.writeFailureEnv
  if (!envName) {
    fail('H-C1', 'adapter.faultInjection.writeFailureEnv 未声明')
    fail('H-C2', '同上')
    return
  }
  const before = negativeDirSnapshot()
  const r = runSessionEnd(SESSION_IDS.WRITE_FAIL, { env: { [envName]: '1' } })
  negativeDirSnapshot() // 观察用，不强制断言新文件计数（降级路径允许不产出底片）

  if (r.missing) { fail('H-C1', 'adapter 未声明 commands.sessionEnd'); fail('H-C2', '同上'); return }

  if (r.timedOut) fail('H-C1', '写失败注入后 sessionEnd 挂起——链路被拖住了')
  else if (r.code !== 0 && r.code !== 1) fail('H-C1', `写失败注入后退出码异常：${r.code}，疑似未捕获异常而非优雅降级`)
  else pass('H-C1', `写失败注入后散会链路正常收尾（退出码 ${r.code}），未挂起`)

  const errTracePath = path_('errorTrace')
  const negDir = path_('negativeDir')
  if (!errTracePath) {
    fail('H-C2', 'adapter.paths.errorTrace 未声明')
  } else if (!labHas(errTracePath)) {
    fail('H-C2', `声明的 errorTrace（${errTracePath}）在写失败注入后仍不存在`)
  } else if (negDir && isUnder(errTracePath, negDir)) {
    fail('H-C2', `errorTrace（${errTracePath}）落在底片目录（${negDir}）内，违反"落点在底片目录之外"`)
  } else {
    pass('H-C2', `错误留痕在 ${errTracePath}，落点在底片目录之外`)
  }
}

// ---------------------------------------------------------------- 场景 D：进料 + 拒写（守卫类 D4）

function scenarioD() {
  if (!ctx.mainFile) {
    for (const id of ['H-D1', 'H-D2', 'H-D3', 'H-D4']) block(id, 'MAIN 底片缺席（场景 A 未成功），进料对账无从谈起')
    return
  }
  const mainFileMtime = statSync(labPath(ctx.mainFile)).mtimeMs

  // 冷却期预置：让本场 runDream 不被冷却拦下（沿用 Sprint-1 adapter.cooldown 约定）
  const cd = adapter.cooldown
  if (cd?.durationEnvVar && cd?.file && cd?.key) {
    const stateP = labPath(cd.file)
    mkdirSync(dirname(stateP), { recursive: true })
    writeFileSync(stateP, JSON.stringify({ [cd.key]: '2020-01-01T00:00:00.000Z', status: 'completed' }, null, 2), 'utf8')
  }
  if (adapter.recursionGuardEnv?.name) delete process.env[adapter.recursionGuardEnv.name]

  const runDream = cmd('runDream')
  if (!runDream) {
    for (const id of ['H-D1', 'H-D2']) fail(id, 'adapter 未声明 commands.runDream')
  } else {
    const r = runCmd(runDream)
    const reportGlob = path_('reportGlob')
    const reports = reportGlob ? findFiles(reportGlob) : []
    if (!reportGlob || reports.length === 0) {
      fail('H-D1', `跑完梦（退出码 ${r.code}）后找不到报告：${reportGlob ?? '(未声明 paths.reportGlob)'}`)
      fail('H-D2', '无报告，无从核对对账行')
    } else {
      const reportFile = labPath(reports[reports.length - 1])
      const reportText = readFileSync(reportFile, 'utf8')
      const marker = adapter.report?.feedReconciliationMarker
      if (!marker) {
        fail('H-D1', 'adapter.report.feedReconciliationMarker 未声明，无法定位进料对账行')
        fail('H-D2', '同上')
      } else if (!reportText.includes(marker)) {
        fail('H-D1', `报告 ${reports[reports.length - 1]} 中未见声明的进料对账标记「${marker}」`)
        fail('H-D2', '对账行缺席，无从核对 session id')
      } else {
        pass('H-D1', `报告 ${reports[reports.length - 1]} 中出现进料对账行（标记「${marker}」）`)
        const reportMtime = statSync(reportFile).mtimeMs
        const hasSessionId = reportText.includes(SESSION_IDS.MAIN)
        const orderedRight = mainFileMtime <= reportMtime
        if (hasSessionId && orderedRight) pass('H-D2', `对账行覆盖 MAIN（${SESSION_IDS.MAIN}），底片写入（${new Date(mainFileMtime).toISOString()}）早于报告生成（${new Date(reportMtime).toISOString()}）`)
        else fail('H-D2', `${hasSessionId ? '' : 'session id 未见于报告；'}${orderedRight ? '' : '底片写入时间晚于报告生成时间，定序可疑'}`)
      }
    }
  }

  // H-D3：静态白名单核查（半自动）
  const guardSrc = src('scopeGuard')
  if (!guardSrc || !existsSync(guardSrc)) {
    fail('H-D3', 'adapter.source.scopeGuard 未声明或文件不存在')
  } else {
    const text = readFileSync(guardSrc, 'utf8')
    const hitLines = text.split('\n').filter((l) => /allow|whitelist|势力范围/i.test(l)).slice(0, 20)
    manual('H-D3', `${guardSrc} 中含关键词的行（节选 ${hitLines.length} 行）：\n    ${hitLines.join('\n    ') || '(无匹配行，人工通读全文确认)'}\n  人工确认其中不含 negativeDir（${path_('negativeDir')}）路径`)
  }

  // H-D4：作恶模式指定底片目录内路径，D4
  const runDreamRogue = cmd('runDreamRogue')
  const negDir = path_('negativeDir')
  if (!runDreamRogue || !negDir) {
    fail('H-D4', `adapter 未声明 ${!runDreamRogue ? 'commands.runDreamRogue' : 'paths.negativeDir'}`)
  } else {
    const rogueTarget = labPath(`${negDir}/ROGUE-PROBE-${SESSION_IDS.MAIN}.md`)
    const rBefore = negativeDirSnapshot()
    runCmd(runDreamRogue, { placeholders: { ROGUE_TARGET: rogueTarget } })
    const rAfter = negativeDirSnapshot()
    const wroteSomething = existsSync(rogueTarget) || diffNew(rBefore, rAfter).length > 0
    const canUseToolLogGlob = path_('canUseToolLogGlob')
    const logs = canUseToolLogGlob ? findFiles(canUseToolLogGlob) : []
    const logsMentionTarget = logs.some((f) => readFileSync(labPath(f), 'utf8').includes(rogueTarget) || readFileSync(labPath(f), 'utf8').includes(`ROGUE-PROBE-${SESSION_IDS.MAIN}.md`))
    if (wroteSomething) fail('H-D4', `作恶模式竟真的在底片目录内写入了：${rogueTarget}`)
    else if (!logsMentionTarget) fail('H-D4', `作恶写入被拒（未见文件落地），但日志（${canUseToolLogGlob ?? '未声明 paths.canUseToolLogGlob'}）中未见该路径的拒绝记录`)
    else pass('H-D4', `作恶模式指向底片目录内路径被拒，且日志可见该路径`)
  }
}

// ---------------------------------------------------------------- 场景 F：补捞（守卫类 D4，四条硬口径）

function scenarioF() {
  // H-F1：ORPHAN 从未触发 sessionEnd，直接补捞。考场刚生成时全部逐字稿 mtime 都是
  // "刚刚"，一个称职的活稿判别会把它们都当"正在进行"而不补——这正是 H-F3 要判的事，
  // 但会连带把 H-F1 也拖住，所以这里先把 ORPHAN 的 mtime 人为拨旧，只留它一个可补。
  const longAgoForOrphan = new Date('2020-01-01T00:00:00.000Z')
  utimesSync(transcriptPath(SESSION_IDS.ORPHAN), longAgoForOrphan, longAgoForOrphan)

  const before1 = negativeDirSnapshot()
  const rf = runBackfill()
  const after1 = negativeDirSnapshot()
  const new1 = diffNew(before1, after1)
  if (rf.missing) {
    for (const id of ['H-F1', 'H-F2', 'H-F3', 'H-F4', 'H-F5']) fail(id, 'adapter 未声明 commands.backfill')
    return
  }
  if (new1.length === 0) fail('H-F1', `补捞跑完（退出码 ${rf.code}）后 negativeDir 无新文件，ORPHAN 未被补齐`)
  else pass('H-F1', `补捞产出新文件：${new1.join('、')}`)

  // H-F2：DREAM_INVOKED 排除——先跑一次 sessionEnd（置递归防护 env，模拟梦自身散会时的真实条件），
  // 再跑一次 backfill（**不**带该 env——backfill 是后置批处理，不该靠"当下环境变量恰好设着"
  // 这种巧合去识别历史会话；它该信的是 sessionEnd 当时已经留下的记录，这里验证的是
  // backfill 不会不看记录、回头把已排除的会话再压一遍）。
  const guardEnv = adapter.recursionGuardEnv
  const before2 = negativeDirSnapshot()
  if (guardEnv?.name && guardEnv?.value) {
    runSessionEnd(SESSION_IDS.DREAM_INVOKED, { env: { [guardEnv.name]: guardEnv.value } })
  }
  runBackfill()
  const after2 = negativeDirSnapshot()
  const new2 = diffNew(before2, after2)
  const dreamLeaked = new2.some((f) => readFileSync(labPath(f), 'utf8').includes(SESSION_IDS.DREAM_INVOKED))
  if (!guardEnv?.name) fail('H-F2', 'adapter.recursionGuardEnv 未声明，无法验证排除机制')
  else if (dreamLeaked) fail('H-F2', `置 ${guardEnv.name} 后，DREAM_INVOKED 仍被压成了底片：${new2.join('、')}`)
  else pass('H-F2', `置 ${guardEnv.name}=${guardEnv.value} 后，DREAM_INVOKED 未被压成底片`)

  // H-F3：活稿判别——STALE（mtime 陈旧）该被补捞，LIVE（mtime 新鲜）不该被误冻
  const staleP = transcriptPath(SESSION_IDS.STALE)
  const liveP = transcriptPath(SESSION_IDS.LIVE)
  const longAgo = new Date('2020-01-01T00:00:00.000Z')
  const now = new Date('2026-08-14T12:00:00.000Z')
  utimesSync(staleP, longAgo, longAgo)
  utimesSync(liveP, now, now)
  const before3 = negativeDirSnapshot()
  runBackfill()
  const after3 = negativeDirSnapshot()
  const new3 = diffNew(before3, after3)
  const staleCaught = new3.some((f) => readFileSync(labPath(f), 'utf8').includes(SESSION_IDS.STALE))
  const liveCaught = new3.some((f) => readFileSync(labPath(f), 'utf8').includes(SESSION_IDS.LIVE))
  if (staleCaught && !liveCaught) pass('H-F3', 'STALE（mtime 陈旧）被补齐，LIVE（mtime 新鲜）未被误冻')
  else fail('H-F3', `活稿判别有误：STALE ${staleCaught ? '已补齐' : '未被补齐'}，LIVE ${liveCaught ? '被误冻压成了底片' : '正确跳过'}`)

  // H-F4：补捞可重入——对同一批再跑一次，不产生新文件
  const before4 = negativeDirSnapshot()
  runBackfill()
  const after4 = negativeDirSnapshot()
  const new4 = diffNew(before4, after4)
  if (new4.length === 0) pass('H-F4', '同一批连续补捞第二次未产生新文件，台账可重入')
  else fail('H-F4', `重复补捞产生了新文件：${new4.join('、')}——补捞不是幂等的`)

  // H-F5：已被官方清理的逐字稿——transcript_path 指向不存在文件
  const ghostSessionId = 'a0000000-0000-0000-0000-00000000ffff'
  const ghostPath = join(TRANSCRIPTS, 'this-file-does-not-exist.jsonl')
  const before5 = negativeDirSnapshot()
  const r5 = runSessionEnd(ghostSessionId, { transcriptOverride: ghostPath })
  const after5 = negativeDirSnapshot()
  const new5 = diffNew(before5, after5)
  if (r5.timedOut) fail('H-F5', '指向不存在的逐字稿时挂起，未能优雅跳过')
  else if (r5.code !== 0 && r5.code !== 1) fail('H-F5', `指向不存在的逐字稿时退出码异常：${r5.code}，疑似未捕获异常`)
  else if (new5.length > 0) fail('H-F5', `指向不存在的逐字稿却产出了底片：${new5.join('、')}`)
  else pass('H-F5', `指向不存在的逐字稿时优雅跳过（退出码 ${r5.code}），未产出底片、未挂起`)
}

// ---------------------------------------------------------------- 场景 G：零 API

function scenarioG() {
  const compressorSrc = src('negativeCompressor')
  if (!compressorSrc || !existsSync(compressorSrc)) {
    fail('H-G1', 'adapter.source.negativeCompressor 未声明或文件不存在')
  } else {
    const text = readFileSync(compressorSrc, 'utf8')
    const banned = [
      [/@anthropic-ai\/|anthropic\.com/i, '引用了 Anthropic SDK/接口'],
      [/\bquery\s*\(/, '出现 query( 调用（模型入口）'],
      [/https?:\/\/(?!localhost)/i, '出现外部网络地址'],
      [/\bfetch\s*\(|node:https?\b|require\(['"]https?['"]\)/, '出现网络请求'],
    ]
    const hits = banned.filter(([re]) => re.test(text)).map(([, why]) => why)
    if (hits.length) fail('H-G1', `压缩链路不该有这些：${hits.join('；')}`)
    else pass('H-G1', '压缩链路源码内无模型调用、无网络请求')
  }

  const offlineCmd = adapter.offlineSelfCheck?.command
  if (!offlineCmd) {
    manual('H-G2', 'adapter.offlineSelfCheck.command 未声明——人工在断网环境手跑一遍全链路确认')
  } else {
    const r = runCmd(offlineCmd, { env: { [adapter.offlineSelfCheck.env ?? 'CLAUDE_DREAM_NO_NETWORK']: '1' } })
    manual('H-G2', `跑了 adapter.offlineSelfCheck.command（退出码 ${r.code}）——人工确认执行环境确实无网络可达，而非仅设了环境变量`)
  }
}

// ---------------------------------------------------------------- 场景 H：并发

async function scenarioH() {
  const sessionEnd = cmd('sessionEnd')
  if (!sessionEnd) { fail('H-H1', 'adapter 未声明 commands.sessionEnd'); return }
  const before = negativeDirSnapshot()

  const runAsync = (sessionId) => new Promise((resolve) => {
    try {
      const out = execSync(resolveCmdPaths(sessionEnd), {
        cwd: LAB, encoding: 'utf8', input: sessionEndPayload(sessionId),
        stdio: ['pipe', 'pipe', 'pipe'], timeout: adapter.timeoutMs ?? 300000,
      })
      resolve({ ok: true, out })
    } catch (err) {
      resolve({ ok: false, out: (err.stdout ?? '') + (err.stderr ?? '') })
    }
  })

  await Promise.all([runAsync(SESSION_IDS.CONCURRENT_1), runAsync(SESSION_IDS.CONCURRENT_2)])
  const after = negativeDirSnapshot()
  const newFiles = diffNew(before, after)

  const c1 = newFiles.some((f) => readFileSync(labPath(f), 'utf8').includes(SESSION_IDS.CONCURRENT_1))
  const c2 = newFiles.some((f) => readFileSync(labPath(f), 'utf8').includes(SESSION_IDS.CONCURRENT_2))

  const ledgerPath = path_('negativeLedger')
  let ledgerIntact = null
  if (ledgerPath && labHas(ledgerPath)) {
    const text = readFileSync(labPath(ledgerPath), 'utf8').trim()
    try { JSON.parse(text); ledgerIntact = true } catch {
      const lines = text.split('\n').filter(Boolean)
      ledgerIntact = lines.length > 0 && lines.every((l) => { try { JSON.parse(l); return true } catch { return false } })
    }
  }

  if (c1 && c2) {
    pass('H-H1', `两页底片都在（${newFiles.join('、')}）${ledgerIntact === null ? '；台账格式未能自动判定，人工复核' : ledgerIntact ? '；台账仍可解析' : '；台账疑似损坏，需人工复核'}`)
  } else {
    fail('H-H1', `并发散会后底片不全：CONCURRENT_1 ${c1 ? '在' : '缺席'}，CONCURRENT_2 ${c2 ? '在' : '缺席'}`)
  }
}

// ---------------------------------------------------------------- 主流程

function render() {
  const width = Math.max(...CHECKS.map(([, ac]) => ac.length))
  console.log('\n判据          源 AC'.padEnd(width + 16) + '  判定  说明')
  console.log('─'.repeat(96))
  let passed = 0, failed = 0, pending = 0
  for (const [id, ac, title] of CHECKS) {
    const r = results.get(id) ?? { mark: '○', note: '未执行' }
    if (r.mark === '✔') passed++
    else if (r.mark === '✖') failed++
    else pending++
    const note = (r.note ?? '').split('\n')[0].slice(0, 60)
    console.log(`${id.padEnd(6)} ${title.padEnd(24)} ${ac.padEnd(width)}  ${r.mark}   ${note}`)
  }
  console.log('─'.repeat(96))
  console.log(`过 ${passed} ｜ 不过 ${failed} ｜ 待办（半自动/人工/阻塞）${pending}　共 ${CHECKS.length} 条`)

  const jsonPath = argOf('--json')
  if (jsonPath) {
    const dump = Object.fromEntries(CHECKS.map(([id]) => [id, results.get(id) ?? { mark: '○', note: '未执行' }]))
    writeFileSync(join(HERE, jsonPath), JSON.stringify(dump, null, 2), 'utf8')
  }
  return failed === 0 && pending === 0
}

async function main() {
  loadAdapter()

  if (!existsSync(LAB) || !existsSync(TRANSCRIPTS)) {
    console.error('考场不存在。先跑：node testbed/build-testbed.mjs')
    process.exit(2)
  }

  if (adapterMissing) {
    for (const [id] of CHECKS) fail(id, '未答卷：acceptance/adapter.json 缺失（见 adapter.example.json）')
    render()
    console.log('\n出卷阶段全红是正常的——实现还没交付。')
    process.exit(1)
  }

  const install = cmd('install')
  if (install) runCmd(install)

  // 执行顺序：A0（空 stdin，最干净的起点）→ A（正常散会，产出 MAIN 底片，A 内部含
  // UNKNOWN_TYPE 子场景）→ E（趁 MAIN 底片还没被 B 动过，先做回程检索）→ B（重放 +
  // 破坏性自检，D4 那步只在内存里操作，不碰磁盘）→ C（写失败，用独立身份不污染 MAIN）
  // → D（进料对账 + 作恶写入，要用到 MAIN 底片已存在这个前提）→ F（补捞，4 条硬口径）
  // → G（零 API 静态扫描 + 断网自证，独立身份）→ H（并发，独立身份，放最后避免跟前面
  // 场景抢 negativeDir 快照）。
  try { scenarioA0() } catch (err) { console.error(`场景 A0 异常：${err.message}`) }
  try { scenarioA() } catch (err) { console.error(`场景 A 异常：${err.message}`) }
  try { scenarioE() } catch (err) { console.error(`场景 E 异常：${err.message}`) }
  try { scenarioB() } catch (err) { console.error(`场景 B 异常：${err.message}`) }
  try { scenarioC() } catch (err) { console.error(`场景 C 异常：${err.message}`) }
  try { scenarioD() } catch (err) { console.error(`场景 D 异常：${err.message}`) }
  try { scenarioF() } catch (err) { console.error(`场景 F 异常：${err.message}`) }
  try { scenarioG() } catch (err) { console.error(`场景 G 异常：${err.message}`) }
  try { await scenarioH() } catch (err) { console.error(`场景 H 异常：${err.message}`) }

  const allGreen = render()
  console.log('\n半自动/人工核对项（脚本查不了全部结论，验收当场做）：')
  console.log('  H-A3 规则表一致性——比对实测去向表与 paths.retainRules 声明文件')
  console.log('  H-A5 压缩实现口径——确认未反解析 Bash/PowerShell 命令行猜测间接改动')
  console.log('  H-A6 体积对账——比对实现自报数字与脚本实测数字')
  console.log('  H-A8 超大稿声明——读一遍 adapter.oversizedPolicy 是否合理')
  console.log('  H-D3 白名单静态核查——读一遍打印出的 scopeGuard 关键行')
  console.log('  H-G2 断网自证——确认执行环境真的无网络可达')
  console.log('  H-M1（TestPlan.md，本表未列）——真实环境真跑一次正常散会，亲眼看底片落盘')
  process.exit(allGreen ? 0 : 1)
}

main()
