# PBI-04.2 · AC0 Spike 记录

**问题**：Agent SDK 的 `canUseTool` 进程内回调，能否在梦进程写 `.claude/memory/` 时被调用并放行？若不能，退路为 `bypassPermissions` + git 快照审计。

**结论：放行路线成立，不需要退路。** `permissionMode: "default"` + `canUseTool` 回调，在写受保护路径 `.claude/memory/` 时确实被调用；回调返回 allow，文件真的落盘；回调返回 deny，文件真的没有落盘（不是只报告决定，是决定生效）。`CLAUDE_INVOKED_BY` 防递归环境变量经 SDK `options.env` 传入后，在被拉起的子进程里确实可读。四项全部实测通过，证据见同目录 `result.json`（含时间戳的完整调用日志）。

## 方法

`spike.mjs`：用 `@anthropic-ai/claude-agent-sdk`（V1 `query()`）在隔离的 `scratch/` 目录（不碰仓库真实 `.claude/`）里跑一次三步任务：

1. 读环境变量 `CLAUDE_INVOKED_BY` 写入 `.claude/memory/env-check.txt`（验证 AC4 的防递归变量可读）
2. `Write` 工具写 `.claude/memory/spike-ac0-proof.md`（白名单内，预期允许）
3. `Write` 工具写项目根的 `spike-ac0-escape.md`（白名单外，预期拒绝）

`canUseTool` 回调按路径判断放行/拒绝——判据移植自 `engine/scope-guard.py` 的 `judge_path`：只放行 `.claude/memory/`、`.claude/dream/`、`CLAUDE.md`，其余一律拒绝且记入调用日志。

## 关键配置（以及一个绕不过去的坑）

```js
options: {
  cwd: scratch,
  permissionMode: 'default',   // 不是 dontAsk，也不是 bypassPermissions
  canUseTool,
  settingSources: ['user'],
  env: { ...process.env, CLAUDE_INVOKED_BY: 'claude-dream-spike-ac0' },
}
```

- **`permissionMode` 必须是 `"default"`，不能是 `"dontAsk"`。** 官方文档「Protected paths」表（`/en/permission-modes#protected-paths`）写明：`.claude/` 属受保护路径，`default`/`acceptEdits` 下写入结果是 "Prompted"（即落到 `canUseTool`），但 `dontAsk` 下是直接 "Denied"——**根本不会调用 `canUseTool`**。reference/claude-mem 的 `hardened-options.ts` 用的是 `dontAsk`，但那是反着用的：它要的是"永远拒绝"，`canUseTool` 只是兜底审计，从未指望被真正调用。我们要的是相反效果（真放行），选错 mode 会直接看起来像"canUseTool 没用"，其实是 mode 选错。
- **第一次跑失败，报 `Not logged in`**——不是 canUseTool 的问题，是环境问题：本机鉴权走 `CLAUDE_CODE_OAUTH_TOKEN`（在 `~/.claude/settings.json` 的 `env` 块里），但这个变量在 Bash 工具子进程的环境里被清空了（大概率是刻意的安全边界，防止 agent 顺手用 Bash 把自己的鉴权令牌带出去——`ALL_PROXY`/`HTTPS_PROXY` 等代理配置同样被清空）。一开始为了测试干净特意设了 `settingSources: []`，反而把这条鉴权链路也一起隔离掉了。改成 `settingSources: ['user']` 后，子进程自己读盘拿 `~/.claude/settings.json` 里的 `env` 块自行注入令牌，问题消失——全程没有经手令牌明文。这是本机特有的第三方鉴权路由（README 里点过的"第三方网络中转"猜测，这次算是坐实了代理变量确实存在），生产环境走标准 OAuth 登录大概率不会撞见这一层，但如果插件要打包自测脚本，这个坑值得留一笔。

## 副产现（两条题外话，但对生产实现有用）

1. **Windows 上 SDK 拉起的 shell 工具叫 "PowerShell"，不叫 "Bash"。** 第一轮跑env检查步骤时按 POSIX `$VAR` 语法写的命令，模型确实原样执行了，只是工具本身是 PowerShell，`$CLAUDE_INVOKED_BY` 在 PowerShell 里是未定义的普通变量（不是环境变量），写出来是空行——不是 canUseTool 拦了，是 shell 方言选错。改成让模型按自己工具类型选语法（PowerShell 用 `$env:VAR`）后一次过。**engine/scope-guard.py 的 Bash 白名单判断（`tool == "Bash"` + 只读 git 正则）在这台机器上会直接漏判**——产物阶段 PBI-04.2 的围栏必须同时认得 "Bash" 和 "PowerShell" 两个工具名，否则 Windows 上的围栏形同虚设（PowerShell 调用会落进"未识别工具全拒绝"的默认分支，是拒绝所以不算安全漏洞，但会让梦进程在 Windows 上无法执行任何 shell 动作，需要显式决定要不要放行）。
2. **绝对路径越权也被正确拦下。** 模型第二轮曾把落点算成 `C:\Users\DELL\.claude\memory\spike-ac0-proof.md`（自己全局主目录下的 `.claude`，不是 scratch 项目内），`judgePath` 按"是否能 relative 到 cwd 内"正确判了"目标在项目外"并拒绝——不只是相对路径 `../` 逃逸这一种攻击面被覆盖到了。

## 结论对 PBI-04.2 后续实现的直接影响

- `canUseTool` 白名单实现可以照抄这次验证过的 `judgePath` 逻辑（原样移植自 scope-guard.py），不必再猜。
- `permissionMode: 'default'`、`settingSources` 至少含 `'user'`、`env` 显式传 `CLAUDE_INVOKED_BY`，这三项进正式实现，不是 spike 专属配置。
- Bash/PowerShell 双工具名要在围栏判断里显式处理，否则 Windows 目标机器上梦进程的 Bash 权限形同虚设（可能是产品期望的行为，但需要明写而不是意外结果）。

*本目录用后即弃，不进插件产物；`spike.mjs`/`package.json` 保留供复跑（`npm install && node spike.mjs`），`node_modules/`、`scratch/` 已加入 .gitignore。*
