#!/usr/bin/env node
/**
 * verify.mjs — Sprint-01-skeleton 验收脚本。判据定义见 TestPlan.md §1。
 *
 * 用法：
 *   node testbed/build-testbed.mjs   # 先重建考场（脏考场上的绿灯不算数）
 *   node verify.mjs                  # 跑全部自动判据
 *   node verify.mjs --adapter <path> --json <path>   # 自检用：换适配层、导出判定结果
 *
 * 出卷阶段没有 adapter.json 是正常的——那时全红，红的原因是"未答卷"，不是脚本坏了。
 * developers 完工后按 adapter.example.json 填一份 adapter.json，本脚本才真正开跑。
 *
 * 判定符号：✔ 过 ｜ ✖ 不过 ｜ ○ 前置未成立，无法判 ｜ ✋ 需人工补一步
 */

import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const LAB = join(HERE, 'testbed', 'dream-lab')
const REPO_ROOT = join(HERE, '..', '..', '..')
const WHITELIST = ['.claude/memory/', '.claude/dream/', 'CLAUDE.md']

/** 白名单外的脏改动——用来证明梦前快照的 pathspec 真的收着（见 H-A4）。 */
const DIRT_TRACKED = 'src/report.js'
const DIRT_UNTRACKED = 'notes.txt'
/** 白名单内的梦前脏改动——快照该把它先收进 dream: 之前的提交，否则快照空转、判据空洞。 */
const DIRT_WHITELIST_MARK = '<!-- 验收预置：梦前未收口的用户改动，快照该把这行收进去 -->'

// ---------------------------------------------------------------- 判据台账

const CHECKS = [
  ['H0', '04.1·AC1', '插件装得上', true],
  ['H-A1', '04.1·AC2', '该醒时醒：触发标记落盘', false],
  ['H-A2', '04.1·AC2', '触发零成本：hook 无 API 调用', false],
  ['H-A3', '04.2·AC1', '经 Agent SDK 起梦', false],
  ['H-A4', '04.2·AC3', '梦前快照，pathspec 仅三处', false],
  ['H-A5', '04.3·AC1', '占位引擎走完过场', false],
  ['H-A6', '04.3·AC2', '梦报告六节在位', false],
  ['H-A7', '04.3·AC3', '记忆改动单笔 dream: 收口', false],
  ['H-A8', '04.3·AC4', '下次会话提示行载体就位', true],
  ['H-A9', '04.3·AC5', '无人干预全程跑通', false],
  ['H-B1', '04.1·AC3', '冷却期内不重复触发且可配置', false],
  ['H-B2', '04.1·AC4', '梦自身结束不触发', false],
  ['H-C1', '04.2·AC2', '白名单内放行、零权限提示', false],
  ['H-C2', '04.2·AC2', '越界被拒且留日志', false],
  ['H-C3', '04.2·AC0', 'canUseTool 前提结论在案', true],
  ['H-D1', '04.3·AC3', 'revert 一步撤销', false],
]

const results = new Map()
const pass = (id, note) => results.set(id, { mark: '✔', note })
const fail = (id, note) => results.set(id, { mark: '✖', note })
const block = (id, note) => results.set(id, { mark: '○', note })
const manual = (id, note) => results.set(id, { mark: '✋', note })

// ---------------------------------------------------------------- 小工具

function git(args, opts = {}) {
  return execSync(`git ${args}`, {
    cwd: LAB, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts,
  }).trim()
}

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

/** 命令里的脚本路径容错：约定 cwd 是考场根，但答卷方看不见考场在仓库里的层级，
 *  命令写成仓库根相对路径是唯一理性选择——凡带路径分隔符、考场下不存在而仓库根下
 *  存在的 token，就地转绝对路径。考场内相对路径与选项 token 原样保留。 */
function resolveCmdPaths(cmdline) {
  return cmdline.split(' ').map((tok) => {
    const bare = tok.replace(/^["']|["']$/g, '')
    if (!bare || bare.startsWith('-') || !/[\\/]/.test(bare)) return tok
    if (existsSync(join(LAB, bare))) return tok
    const inRepo = join(REPO_ROOT, bare)
    return existsSync(inRepo) ? `"${inRepo}"` : tok
  }).join(' ')
}

/** 以非交互方式跑适配层声明的命令：stdin 关闭，等待输入即超时判负（H-A9 的机制）。 */
function runCmd(cmd, { env = {}, timeout } = {}) {
  try {
    const out = execSync(resolveCmdPaths(cmd), {
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

function inWhitelist(path) {
  return WHITELIST.some((w) => (w.endsWith('/') ? path.startsWith(w) : path === w))
}

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

// ---------------------------------------------------------------- 预检

function preflight() {
  const manifest = src('pluginManifest')
  if (!manifest || !existsSync(manifest)) {
    fail('H0', 'adapter.source.pluginManifest 未声明或文件不存在')
    return
  }
  try {
    const m = JSON.parse(readFileSync(manifest, 'utf8'))
    const missing = ['name', 'version'].filter((k) => !m[k])
    if (missing.length) fail('H0', `plugin.json 缺必填字段：${missing.join('、')}`)
    else manual('H0', 'manifest 结构合法；仍须人工在考场起一次 Claude Code 确认加载无报错')
  } catch (err) {
    fail('H0', `plugin.json 解析失败：${err.message}`)
  }
}

// ---------------------------------------------------------------- 场景 A

/** 在白名单外制造脏改动，令 H-A4 的 pathspec 判据非空转：
 *  一个偷懒的 `git add -A` 快照会把它们卷进去，正确的 pathspec 快照不会。 */
function plantDirt() {
  const f = labPath(DIRT_TRACKED)
  writeFileSync(f, readFileSync(f, 'utf8') + '\n// 验收留下的脏改动，梦不该碰它\n', 'utf8')
  writeFileSync(labPath(DIRT_UNTRACKED), '验收留下的未跟踪文件，梦不该碰它\n', 'utf8')
  const cm = labPath('CLAUDE.md')
  writeFileSync(cm, readFileSync(cm, 'utf8') + '\n' + DIRT_WHITELIST_MARK + '\n', 'utf8')
}

function scenarioA() {
  const preHead = git('rev-parse HEAD')
  plantDirt()

  // 声明了 durationEnvVar 的实现，cooldown.file 是运行态（上次梦的时间戳）而非配置。
  // 预置一份「刚梦过」的状态，让本场 sessionEnd 只落标记、不真的在后台拉起梦——
  // A 场景的梦由下面的 runDream 同步跑，两场并发会撞实现的互斥锁，假摔。
  const cdA = adapter.cooldown
  if (cdA?.durationEnvVar && cdA?.file && cdA?.key) {
    const stateP = labPath(cdA.file)
    mkdirSync(dirname(stateP), { recursive: true })
    writeFileSync(stateP, JSON.stringify({ [cdA.key]: new Date().toISOString(), status: 'completed' }, null, 2), 'utf8')
  }

  // --- 触发链 ---
  const sessionEnd = cmd('sessionEnd')
  const marker = path_('triggerMarker')
  if (!sessionEnd || !marker) {
    fail('H-A1', 'adapter 未声明 commands.sessionEnd 或 paths.triggerMarker')
  } else {
    const r = runCmd(sessionEnd)
    if (labHas(marker)) pass('H-A1', `触发标记就位：${marker}`)
    else fail('H-A1', `跑完 sessionEnd 后 ${marker} 不存在（退出码 ${r.code}）`)
  }

  // --- hook 静态检查：零 API、零判断 ---
  const hookSrc = src('sessionEndHook')
  if (!hookSrc || !existsSync(hookSrc)) {
    fail('H-A2', 'adapter.source.sessionEndHook 未声明或文件不存在')
  } else {
    const text = readFileSync(hookSrc, 'utf8')
    const banned = [
      [/@anthropic-ai\/|anthropic\.com/i, '引用了 Anthropic SDK/接口'],
      [/\bquery\s*\(/, '出现 query( 调用（模型入口）'],
      [/https?:\/\/(?!localhost)/i, '出现外部网络地址'],
      [/\bfetch\s*\(|node:https?\b|require\(['"]https?['"]\)/, '出现网络请求'],
    ]
    const hits = banned.filter(([re]) => re.test(text)).map(([, why]) => why)
    if (hits.length) fail('H-A2', `SessionEnd hook 不该有这些：${hits.join('；')}`)
    else pass('H-A2', 'hook 内无模型调用、无网络请求')
  }

  // --- 梦入口经 Agent SDK ---
  const entry = src('dreamEntry')
  const sdk = adapter.sdkModule || '@anthropic-ai/claude-agent-sdk'
  if (!entry || !existsSync(entry)) {
    fail('H-A3', 'adapter.source.dreamEntry 未声明或文件不存在')
  } else {
    const text = readFileSync(entry, 'utf8')
    if (text.includes(sdk)) pass('H-A3', `梦入口引用 ${sdk}`)
    else fail('H-A3', `梦入口未见 ${sdk}——梦必须经 Agent SDK 拉起（canUseTool 是围栏的唯一落点）`)
  }

  // --- 跑梦 ---
  const runDream = cmd('runDream')
  if (!runDream) {
    for (const id of ['H-A4', 'H-A5', 'H-A6', 'H-A7', 'H-A9', 'H-C1', 'H-D1']) {
      fail(id, 'adapter 未声明 commands.runDream')
    }
    return { preHead, ran: false }
  }

  const run = runCmd(runDream)

  // H-A9 无人干预：非交互跑完、退出码 0
  if (run.timedOut) fail('H-A9', '超时——多半是在等人输入，这正是 AC5 要排除的情形')
  else if (!run.ok) fail('H-A9', `退出码 ${run.code}，未能一次跑完：${run.out.slice(-300).trim()}`)
  else pass('H-A9', '非交互（stdin 关闭）一次跑完，退出码 0')

  // H-A5 过场走完
  if (run.ok) pass('H-A5', '体检→整合过场走完，退出码 0（本轮不判准确性）')
  else block('H-A5', '梦未跑完，无从判断过场')

  const commitsAfter = git(`rev-list --reverse ${preHead}..HEAD`).split('\n').filter(Boolean)
  const subj = (c) => git(`log -1 --format=%s ${c}`)
  // 提交按角色归位：dream: 前缀是锚点；它之前的都算梦前快照（白名单干净时实现可跳过
  // 空快照，所以快照不以「第一笔」论，也不预设它的 message 前缀）；之后是证据类提交。
  const dreamIdx = commitsAfter.findIndex((c) => subj(c).startsWith('dream:'))

  // H-A4 梦前快照 + pathspec 收着：
  //   ① 梦造出的每一笔提交都不得越出三处白名单（pathspec 收着的总体现）
  //   ② 白名单内的梦前脏改动（CLAUDE.md 预置标记）须先被收进 dream: 之前的快照笔——
  //      否则用户梦前未收口的改动会和梦的改动混进同一笔，revert 梦会连用户的一起撤掉
  if (commitsAfter.length === 0) {
    fail('H-A4', '梦跑完后没有任何新提交——梦前快照缺席')
  } else {
    const leaks = []
    for (const c of commitsAfter) {
      const files = git(`show --name-only --format= ${c}`).split('\n').filter(Boolean)
      for (const f of files.filter((x) => !inWhitelist(x))) leaks.push(`${c.slice(0, 7)}:${f}`)
    }
    const preDream = dreamIdx === -1 ? commitsAfter : commitsAfter.slice(0, dreamIdx)
    const snapHasMark = preDream.some((c) => {
      try { return git(`show ${c}:CLAUDE.md`).includes(DIRT_WHITELIST_MARK) } catch { return false }
    })
    if (leaks.length) {
      fail('H-A4', `有提交卷进白名单外的路径：${leaks.join('、')}（多半是 git add -A 没收 pathspec）`)
    } else if (!snapHasMark) {
      fail('H-A4', '梦前留在 CLAUDE.md 的未收口改动没有先被收进 dream: 之前的快照笔——快照缺席或漏收')
    } else {
      pass('H-A4', `快照先行收好梦前改动，${commitsAfter.length} 笔提交全部收在三处白名单内`)
    }
  }

  // H-A6 报告六节
  const reportGlob = path_('reportGlob')
  const reports = reportGlob ? findFiles(reportGlob) : []
  if (!reportGlob) {
    fail('H-A6', 'adapter 未声明 paths.reportGlob')
  } else if (reports.length === 0) {
    fail('H-A6', `${reportGlob} 下没有梦报告`)
  } else {
    const text = readFileSync(labPath(reports[reports.length - 1]), 'utf8')
    const sections = adapter.report?.sections ?? []
    if (!sections.length) {
      fail('H-A6', 'adapter.report.sections 未声明六节标题写法')
    } else {
      const missing = sections.filter((s) => !text.includes(s))
      if (missing.length) fail('H-A6', `报告缺节：${missing.join('、')}`)
      else pass('H-A6', `报告 ${reports[reports.length - 1]} 六节齐全`)
    }
  }

  // H-A7 单笔 dream: 收口。报告/审计证据可按声明另收一笔（C7 未决，commitPolicy 声明即可），
  // 快照笔（dream: 之前）碰记忆/CLAUDE.md 是本分；判的是：dream: 前缀提交恰 1 笔，
  // 且 dream: 之后的提交不再碰记忆/CLAUDE.md。
  if (commitsAfter.length === 0) {
    block('H-A7', '无新提交')
  } else {
    const dreamCommits = commitsAfter.filter((c) => subj(c).startsWith('dream:'))
    const strayTouch = dreamIdx === -1 ? [] : commitsAfter.slice(dreamIdx + 1)
      .filter((c) => !subj(c).startsWith('dream:'))
      .filter((c) => git(`show --name-only --format= ${c}`).split('\n')
        .some((f) => f === 'CLAUDE.md' || f.startsWith('.claude/memory/')))
    const leftover = git('status --porcelain -- .claude/memory CLAUDE.md').trim()
    if (dreamCommits.length !== 1) {
      fail('H-A7', `应恰有 1 笔 dream: 前缀提交，实际 ${dreamCommits.length} 笔`)
    } else if (strayTouch.length) {
      fail('H-A7', `dream: 之后仍有提交在碰记忆/CLAUDE.md：${strayTouch.map((c) => c.slice(0, 7)).join('、')}`)
    } else if (leftover) {
      fail('H-A7', `记忆/CLAUDE.md 有改动没进提交：\n${leftover}`)
    } else {
      const extra = commitsAfter.length - dreamIdx - 1
      pass('H-A7', `单笔收口：「${subj(dreamCommits[0])}」${extra > 0 ? `（另 ${extra} 笔证据提交，commitPolicy 已声明）` : ''}`)
    }
  }

  // H-C1 白名单内放行、零权限提示
  if (commitsAfter.length >= 2) {
    const touched = git(`show --name-only --format= ${commitsAfter[commitsAfter.length - 1]}`)
      .split('\n').filter(Boolean)
    const inside = touched.filter(inWhitelist)
    if (!inside.length) fail('H-C1', '梦提交里没有白名单内的改动——放行与否无从判断')
    else if (run.ok) pass('H-C1', `白名单内确有写入（${inside.length} 处），且该次运行非交互无提示`)
    else fail('H-C1', '梦未正常跑完')
  } else {
    block('H-C1', '梦提交缺席')
  }

  // H-A8 提示行载体
  const carrier = path_('promptCarrier')
  if (!carrier) {
    fail('H-A8', 'adapter 未声明 paths.promptCarrier')
  } else if (!labHas(carrier)) {
    fail('H-A8', `提示载体 ${carrier} 不存在`)
  } else if (!readFileSync(labPath(carrier), 'utf8').trim()) {
    fail('H-A8', `提示载体 ${carrier} 是空的`)
  } else {
    manual('H-A8', '载体就位且非空；仍须人工在考场新开一次会话，确认开场真的出现那一行')
  }

  // 白名单外的脏改动应当原样还在工作树里
  const dirtStillThere = git('status --porcelain').includes(DIRT_UNTRACKED)
  if (!dirtStillThere) {
    const cur = results.get('H-A4')
    fail('H-A4', `${cur?.note ?? ''}｜但白名单外的未跟踪文件 ${DIRT_UNTRACKED} 不见了——有人越界动了它`)
  }

  // snapBase：revert 后对账的基线——dream: 之前最后一笔快照；快照被跳过（白名单本来干净）时用梦前 HEAD
  return { preHead, ran: run.ok, commitsAfter, snapBase: dreamIdx > 0 ? commitsAfter[dreamIdx - 1] : preHead }
}

// ---------------------------------------------------------------- 场景 B

function scenarioB() {
  const sessionEnd = cmd('sessionEnd')
  const marker = path_('triggerMarker')
  if (!sessionEnd || !marker) {
    fail('H-B1', 'adapter 未声明 commands.sessionEnd 或 paths.triggerMarker')
    fail('H-B2', '同上')
    return
  }
  // 防虚绿：触发链本身没走通时，「不触发」是空转通过，不算数
  if (results.get('H-A1')?.mark !== '✔') {
    block('H-B1', '触发链没走通（H-A1 未过），抑制行为无从判起')
    block('H-B2', '同上')
    return
  }

  const c = adapter.cooldown ?? {}
  const stateText = () => {
    const p = c.file ? labPath(c.file) : null
    return p && existsSync(p) ? readFileSync(p, 'utf8') : null
  }

  // H-B1 冷却期内不重复触发。两种声明方式两种测法：
  //   durationEnvVar 声明 —— 冷却时长走环境变量，cooldown.file 是运行态；触发标记按设计
  //   每次会话结束都刷新（那是 AC2 的落盘行为），「重复触发」的信号是运行态文件的变化。
  //   否则 —— 冷却时长写在 cooldown.file 的 cooldown.key 里，触发信号即标记刷新。
  if (c.durationEnvVar) {
    const s0 = stateText()
    runCmd(sessionEnd)
    let launched = false
    for (let i = 0; i < 10 && !launched; i++) { sleep(500); if (stateText() !== s0) launched = true }
    if (launched) {
      fail('H-B1', '冷却期内再次结束会话，梦仍被拉起——重复触发')
    } else {
      // 用 0.01 分钟而不是 0：「0 是否等于关掉冷却」语义未约定，不强判；
      // 近零的正数是无歧义的时长，足以证明配置接上了
      runCmd(sessionEnd, { env: { [c.durationEnvVar]: '0.01' } })
      let relaunched = false
      for (let i = 0; i < 40 && !relaunched; i++) { sleep(500); if (stateText() !== s0) relaunched = true }
      if (relaunched) pass('H-B1', `冷却期内不重复拉起；${c.durationEnvVar}=0.01 后重新拉起——配置确实在起作用`)
      else fail('H-B1', `${c.durationEnvVar}=0.01 后 20 秒内未见梦拉起——冷却配置没接上，或触发链本身坏了`)
    }
  } else {
    const before = labHas(marker) ? readFileSync(labPath(marker), 'utf8') : null
    runCmd(sessionEnd)
    const after = labHas(marker) ? readFileSync(labPath(marker), 'utf8') : null
    if (before !== null && after !== before) {
      fail('H-B1', '冷却期内再次结束会话，触发标记被刷新了——重复触发')
    } else if (!c.file || !c.key) {
      fail('H-B1', '冷却期内未重复触发，但 adapter.cooldown 未声明，无法验证「可配置」')
    } else if (stateText() === null) {
      fail('H-B1', `冷却配置文件 ${c.file} 不存在，无法验证「可配置」`)
    } else {
      const text = stateText()
      const patched = text.replace(new RegExp(`^(\\s*${c.key}\\s*:\\s*).*$`, 'm'), '$10')
      if (patched === text) {
        fail('H-B1', `在 ${c.file} 里找不到键 ${c.key}，无法验证「可配置」`)
      } else {
        writeFileSync(labPath(c.file), patched, 'utf8')
        runCmd(sessionEnd)
        const afterZero = labHas(marker) ? readFileSync(labPath(marker), 'utf8') : null
        writeFileSync(labPath(c.file), text, 'utf8')  // 还原
        if (afterZero !== after) pass('H-B1', '冷却期内不重复触发；冷却时长改为 0 后重新触发——配置确实在起作用')
        else fail('H-B1', `冷却期改为 0 后仍未触发——${c.key} 这个配置没接上，或触发链本身坏了`)
      }
    }
  }

  // H-B2 防递归
  const guard = adapter.recursionGuardEnv
  if (!guard?.name) {
    fail('H-B2', 'adapter 未声明 recursionGuardEnv')
    return
  }
  const snapshot = labHas(marker) ? readFileSync(labPath(marker), 'utf8') : null
  runCmd(sessionEnd, { env: { [guard.name]: guard.value ?? 'claude-dream' } })
  const post = labHas(marker) ? readFileSync(labPath(marker), 'utf8') : null
  if (post === snapshot) pass('H-B2', `置 ${guard.name} 后结束会话不触发——防递归成立`)
  else fail('H-B2', `置 ${guard.name} 后仍然触发了——梦会梦见自己`)
}

// ---------------------------------------------------------------- 场景 C

function scenarioC() {
  // H-C3 spike 结论在案（落盘位置的基准未在约定里写死——仓库根、考卷目录两个基准都认）
  const rec = adapter.spikeRecord
    ? [join(REPO_ROOT, adapter.spikeRecord), join(HERE, adapter.spikeRecord)].find((p) => existsSync(p)) ?? null
    : null
  if (!rec || !existsSync(rec)) {
    fail('H-C3', 'adapter.spikeRecord 未声明或文件不存在——AC0 的前提实测没有落盘')
  } else {
    const text = readFileSync(rec, 'utf8')
    const hasVerdict = /canUseTool/.test(text) && /(放行|成功|失败|退路|bypass)/.test(text)
    if (hasVerdict) manual('H-C3', 'spike 记录在案；仍须人工读一遍，确认结论明确、走哪条路有交代')
    else fail('H-C3', 'spike 记录里读不到明确结论（canUseTool 是否放行、是否走退路）')
  }

  // H-C2 越界被拒
  const rogue = cmd('runDreamRogue')
  const target = adapter.offWhitelistTarget
  const logGlob = path_('canUseToolLogGlob')
  if (!rogue) {
    fail('H-C2', 'adapter 未声明 commands.runDreamRogue——没有故障注入入口，围栏等于没测（TestPlan §3.2）')
    return
  }
  if (!target || !logGlob) {
    fail('H-C2', 'adapter 未声明 offWhitelistTarget 或 paths.canUseToolLogGlob')
    return
  }

  // 作恶目标可以是「写一个新文件」（预先不存在，被拦住就该一直不存在），也可以是改现成文件
  const targetState = () => (existsSync(labPath(target)) ? git(`hash-object ${target}`) : null)
  const beforeHash = targetState()
  runCmd(rogue)
  const afterHash = targetState()
  const logs = findFiles(logGlob)

  if (beforeHash !== afterHash) {
    fail('H-C2', `白名单外的 ${target} 被${beforeHash === null ? '创建' : '改动'}了——围栏没拦住`)
  } else if (!logs.length) {
    fail('H-C2', `${target} 未被改动，但 ${logGlob} 下没有拒绝日志——拦了但没留证`)
  } else {
    const logText = logs.map((f) => readFileSync(labPath(f), 'utf8')).join('\n')
    if (logText.includes(target)) pass('H-C2', `越界写入被拒，拒绝记录在 ${logs[logs.length - 1]}`)
    else fail('H-C2', `拒绝日志存在，但里面没有 ${target} 的记录——拦截与留证对不上`)
  }
}

// ---------------------------------------------------------------- 场景 D

function scenarioD(ctx) {
  const commits = ctx?.commitsAfter ?? []
  if (commits.length === 0) {
    block('H-D1', '没有可撤销的梦提交')
    return
  }
  // 撤销对象是那笔 dream: 前缀提交——commitPolicy 为 separate 时它不是最后一笔，
  // 报告/日志的证据提交不在撤销之列（撤梦不该销毁审计证据，正是 C7 顾虑本身）；
  // 对账基线是 dream: 之前的快照笔（或梦前 HEAD），不预设快照是否存在
  const dreamCommit = commits.find((c) => git(`log -1 --format=%s ${c}`).startsWith('dream:'))
  if (!dreamCommit) {
    fail('H-D1', '找不到 dream: 前缀提交，无从 revert')
    return
  }
  const snap = ctx.snapBase ?? commits[0]

  const r = runCmd(`git -c user.name=verify -c user.email=v@t.test revert --no-edit ${dreamCommit}`)
  if (!r.ok) {
    fail('H-D1', `git revert 失败：${r.out.slice(-300).trim()}`)
    return
  }
  const diff = git(`diff ${snap} HEAD -- .claude/memory CLAUDE.md`).trim()
  if (diff) fail('H-D1', `revert 后记忆/CLAUDE.md 与梦前快照仍有差异：\n${diff.slice(0, 500)}`)
  else pass('H-D1', `revert ${dreamCommit.slice(0, 7)} 后回到梦前状态，记忆与 CLAUDE.md 零差异`)
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
    console.log(`${id.padEnd(6)} ${title.padEnd(22)} ${ac.padEnd(width)}  ${r.mark}   ${note}`)
  }
  console.log('─'.repeat(96))
  console.log(`过 ${passed} ｜ 不过 ${failed} ｜ 待办（人工/阻塞）${pending}　共 ${CHECKS.length} 条，覆盖 13 条 AC`)

  const jsonPath = argOf('--json')
  if (jsonPath) {
    const dump = Object.fromEntries(CHECKS.map(([id]) => [id, results.get(id) ?? { mark: '○', note: '未执行' }]))
    writeFileSync(join(HERE, jsonPath), JSON.stringify(dump, null, 2), 'utf8')
  }
  return failed === 0 && pending === 0
}

function main() {
  loadAdapter()

  if (!existsSync(LAB)) {
    console.error('考场不存在。先跑：node testbed/build-testbed.mjs')
    process.exit(2)
  }

  if (adapterMissing) {
    for (const [id] of CHECKS) fail(id, '未答卷：acceptance/adapter.json 缺失（见 adapter.example.json）')
    render()
    console.log('\n出卷阶段全红是正常的——实现还没交付。')
    process.exit(1)
  }

  if (git('status --porcelain').trim()) {
    console.error('考场工作树不干净。先跑：node testbed/build-testbed.mjs')
    process.exit(2)
  }

  preflight()
  const install = cmd('install')
  if (install) runCmd(install)

  // 执行顺序是 A → D → C → B，不是 A→B→C→D：
  // D 要在梦刚跑完的干净状态下 revert，B/C 会往 .claude/dream/ 里写标记与日志，
  // 先跑它们会让 revert 撞上"本地改动会被覆盖"而假摔；
  // B 必须垫底——验证「冷却改 0 应重新触发」会真的拉起一场后台梦，
  // 放在别的场景前面会撞实现的互斥锁。
  let ctx
  try { ctx = scenarioA() } catch (err) { console.error(`场景 A 异常：${err.message}`) }
  try { scenarioD(ctx) } catch (err) { console.error(`场景 D 异常：${err.message}`) }
  try { scenarioC() } catch (err) { console.error(`场景 C 异常：${err.message}`) }
  try { scenarioB() } catch (err) { console.error(`场景 B 异常：${err.message}`) }

  const allGreen = render()
  console.log('\n人工核对三项（脚本查不了，验收当场做）：')
  console.log('  1. H0   在 testbed/dream-lab/ 起一次 Claude Code，插件加载无报错')
  console.log('  2. H-A8 在考场新开一次会话，开场确实出现那一行梦提示')
  console.log('  3. H-C3 读一遍 spike 记录，结论明确、走哪条路有交代')
  process.exit(allGreen ? 0 : 1)
}

main()
