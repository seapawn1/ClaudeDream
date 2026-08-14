#!/usr/bin/env node
// E0·AC1（Sprint-2 开工首件事，Sprint-1 Retro 改进项2）：真梦前置冒烟检查。
// 一条命令查登录态/token/SDK 可达，红绿分明，红时一句话说清缺什么。
// 跑法：node claude-dream/test/smoke-check.mjs
//
// 为什么不只查凭据文件存在：文件在不代表 token 没过期、网络能通——冒烟检查要的是
// 「现在真的能跑一场梦」这个信号，不是「配置看起来齐全」这个信号（Sprint-1 Retro
// 「空转冒充覆盖」的教训：绿灯亮着只因它守的那条路没人走过）。唯一作数的判据是第 3 步
// 的真实最小 SDK 调用；凭据文件/环境变量摸底只是红灯时帮着说清缺什么的辅助信息。
//
// 认证机制依据（官方文档 2026-08-14 查证）：
// - ANTHROPIC_API_KEY / CLAUDE_CODE_OAUTH_TOKEN / ANTHROPIC_AUTH_TOKEN 均适用于
//   「CLI 及其包装层，包括 Agent SDK」（authentication#credential-management）
// - 凭据文件 Windows 落点 %USERPROFILE%\.claude\.credentials.json，若设了
//   CLAUDE_CONFIG_DIR 则在该目录下（同上）
// - 「Could not resolve authentication method」是 headless/Agent SDK 场景的典型报错，
//   官方原话：交互式登录检查在第一次请求前不会跑（errors#could-not-resolve-authentication-method）

import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

const CRED_ENV_SIGNALS = ['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_AUTH_TOKEN'];
const THIRD_PARTY_SIGNALS = [
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_VERTEX',
  'CLAUDE_CODE_USE_FOUNDRY',
  'CLAUDE_CODE_USE_ANTHROPIC_AWS',
];

function credentialsFilePath() {
  const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  return path.join(configDir, '.credentials.json');
}

// 同 run-dream.mjs 的 spawnHidden 用意：SDK 默认拉起 claude CLI 子进程，Windows 上
// 不保证不弹控制台窗口。这里不是无人值守场景，但同样没理由让一次诊断脚本闪一下窗口。
function spawnHidden({ command, args, cwd, env, signal }) {
  return spawn(command, args, { cwd, env, signal, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
}

// 只在红灯时打印，当辅助诊断线索——不在绿灯时打印。本机实测踩过一次反例：
// 这两行都报「不存在/无」而真实调用照样成功（本机认证经某种网关/daemon 代理解析，
// 不落在 credentials 文件或裸环境变量上）——绿灯旁边硬贴一行「查不到凭据」纯属误导，
// 且无助于诊断（本来就没坏）。红灯时这两行仍有价值：至少排除掉「最常见的两种缺失」。
function printDiagnosticHints() {
  const credPath = credentialsFilePath();
  console.log(`凭据文件：${existsSync(credPath) ? '存在' : '不存在'}（${credPath}）`);
  const envSignals = [...CRED_ENV_SIGNALS, ...THIRD_PARTY_SIGNALS].filter((k) => process.env[k]);
  console.log(`认证相关环境变量：${envSignals.length ? envSignals.join(', ') : '(无——注意：本机若通过网关/daemon 代理鉴权，这里也会显示无，不代表真的没配好)'}`);
}

function classify(msg) {
  if (/Could not resolve authentication method/i.test(msg)) {
    return '未登录或凭据不可达——确认 ANTHROPIC_API_KEY / CLAUDE_CODE_OAUTH_TOKEN 设在启动这个进程的环境里（不只是交互式 shell），或跑 claude 的 /login。参考 https://code.claude.com/docs/en/errors#could-not-resolve-authentication-method';
  }
  if (/expired|unauthoriz|401/i.test(msg)) {
    return '登录态过期——跑 claude 的 /login 重新登录';
  }
  if (/ENOENT|not found|no such file/i.test(msg)) {
    return 'claude 可执行文件找不到——确认 Claude Code 已安装、在 PATH 上';
  }
  if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|network/i.test(msg)) {
    return '网络不可达——检查代理/网络设置（HTTP_PROXY/HTTPS_PROXY/NO_PROXY）';
  }
  if (/abort/i.test(msg)) {
    return `调用超时——网络慢或卡住，可设环境变量 CLAUDE_DREAM_SMOKE_TIMEOUT_MS 调大超时`;
  }
  return '未分类错误，看下面的原始信息';
}

async function main() {
  console.log('=== E0·AC1 真梦前置冒烟检查 ===');

  // 1) SDK 包可解析？
  let query;
  try {
    ({ query } = await import('@anthropic-ai/claude-agent-sdk'));
  } catch (err) {
    console.log('\nFAIL - SDK 不可解析');
    console.log(`一句话：@anthropic-ai/claude-agent-sdk 装不上/找不到——先在 claude-dream/ 下跑 npm install。`);
    console.log(`原始错误：${String(err?.message ?? err)}`);
    process.exit(1);
  }

  // 2) 唯一作数的判据：真跑一次最小 SDK 调用，不发放任何工具（deny-all canUseTool 兜底，
  //    防止模型意外尝试工具调用时卡在等交互式权限确认，直到超时才收场）。
  const timeoutMs = Number(process.env.CLAUDE_DREAM_SMOKE_TIMEOUT_MS) || 30000;
  const abortController = new AbortController();
  const timeoutHandle = setTimeout(() => abortController.abort(), timeoutMs);

  let resultText = null;
  let sdkError = null;
  try {
    for await (const msg of query({
      prompt: '只回复 ok 两个字，不要调用任何工具。',
      options: {
        maxTurns: 1,
        permissionMode: 'default',
        canUseTool: async () => ({ behavior: 'deny', message: '冒烟检查不发放任何工具' }),
        settingSources: ['user'],
        spawnClaudeCodeProcess: spawnHidden,
        abortController,
      },
    })) {
      if (msg.type === 'result') resultText = msg.result ?? '';
    }
  } catch (err) {
    sdkError = err;
  } finally {
    clearTimeout(timeoutHandle);
  }

  if (sdkError) {
    const msg = String(sdkError?.message ?? sdkError);
    console.log('\nFAIL - SDK 调用失败');
    console.log(`一句话：${classify(msg)}`);
    printDiagnosticHints();
    console.log(`原始错误：${msg}`);
    process.exit(1);
  }

  if (resultText === null) {
    console.log('\nFAIL - SDK 调用未产出 result 消息（异常但未抛错，罕见分支）');
    printDiagnosticHints();
    process.exit(1);
  }

  console.log('\nPASS - 登录态/token/SDK 均可达，真梦现在能跑');
  process.exit(0);
}

main();
