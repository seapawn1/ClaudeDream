#!/usr/bin/env node
/**
 * run-selftest.mjs —— 考卷自己的体检：证明 verify.mjs 既能亮绿，也真的抓得住毛病。
 *
 * 一份从没跑过主体逻辑的验收脚本不配当验收标准（DoD·D1 同样约束考卷自己）。
 * 本自检拿 selftest/fake-plugin 这份假实现跑三轮：
 *   1. 正向：假实现规规矩矩走完回环 → 除三条人工项外全绿；
 *   2. 负向 sloppy-snapshot：快照改用 git add -A → H-A4 必须转红；
 *   3. 负向 two-commits：梦拆成两笔提交 → H-A7 必须转红；
 *   4. 负向 no-cooldown：无视冷却期 → H-B1 必须转红。
 * 任何一轮不符合预期，说明考卷本身有问题，不能拿去验收。
 *
 * 用法：node selftest/run-selftest.mjs
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ACC = join(HERE, '..')
const OUT = 'selftest/last-results.json'

function run(env = {}) {
  execFileSync('node', ['testbed/build-testbed.mjs'], { cwd: ACC, stdio: 'pipe' })
  try {
    execFileSync('node', ['verify.mjs', '--adapter', 'selftest/adapter.selftest.json', '--json', OUT], {
      cwd: ACC, stdio: 'pipe', env: { ...process.env, ...env },
    })
  } catch { /* 判据不全绿时 verify 以 1 退出，属预期 */ }
  const p = join(ACC, OUT)
  if (!existsSync(p)) throw new Error('verify.mjs 没有产出结果文件')
  const r = JSON.parse(readFileSync(p, 'utf8'))
  unlinkSync(p)
  return r
}

const rounds = [
  {
    name: '正向：假实现规矩走完回环',
    env: {},
    expect: (r) => {
      const bad = Object.entries(r).filter(([, v]) => v.mark === '✖' || v.mark === '○')
      const manual = Object.entries(r).filter(([, v]) => v.mark === '✋').map(([k]) => k)
      if (bad.length) return `本应全过，却有不过/阻塞：${bad.map(([k, v]) => `${k}(${v.note})`).join('；')}`
      if (manual.sort().join(',') !== 'H-A8,H-C3,H0') return `人工项应恰为 H0/H-A8/H-C3，实际 ${manual.join(',')}`
      return null
    },
  },
  {
    name: '负向 sloppy-snapshot：快照卷走白名单外的脏改动',
    env: { FAKE_MODE: 'sloppy-snapshot' },
    expect: (r) => (r['H-A4'].mark === '✖' ? null : `H-A4 本应转红，实际 ${r['H-A4'].mark}`),
  },
  {
    name: '负向 two-commits：梦拆成两笔提交',
    env: { FAKE_MODE: 'two-commits' },
    expect: (r) => (r['H-A7'].mark === '✖' ? null : `H-A7 本应转红，实际 ${r['H-A7'].mark}`),
  },
  {
    name: '负向 no-cooldown：无视冷却期重复触发',
    env: { FAKE_MODE: 'no-cooldown' },
    expect: (r) => (r['H-B1'].mark === '✖' ? null : `H-B1 本应转红，实际 ${r['H-B1'].mark}`),
  },
]

let bad = 0
for (const round of rounds) {
  process.stdout.write(`· ${round.name} ... `)
  try {
    const problem = round.expect(run(round.env))
    if (problem) { console.log(`不符预期\n    ${problem}`); bad++ }
    else console.log('符合预期')
  } catch (err) {
    console.log(`跑挂了\n    ${err.message}`)
    bad++
  }
}

console.log(bad === 0
  ? '\n考卷自检通过：亮得起绿灯，也抓得住三处故意做坏的地方。'
  : `\n考卷自检未通过：${bad} 轮不符预期——先修考卷，别拿去验收。`)
process.exit(bad === 0 ? 0 : 1)
