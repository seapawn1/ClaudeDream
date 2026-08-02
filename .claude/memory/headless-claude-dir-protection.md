---
name: headless-claude-dir-protection
description: headless 下 .claude/ 受保护路径只有 bypass 模式可写，PreToolUse hook 嵌套 headless 不加载——梦引擎产物必须走 Agent SDK
metadata: 
  node_type: memory
  type: project
  originSessionId: 273a0660-2887-4bbf-8aa8-d810bb05855c
  modified: 2026-08-02T04:47:41.530Z
---

2026-08-02 Prototype-01 联调实测（烧了约六轮探针得出，勿重蹈）：`.claude` 是 Claude Code 受保护路径，**敏感检查先于一切 allow 规则**（官方 permission-modes 文档"Protected paths"节明写），settings 写 `Edit(.claude/**)` 无效；headless（`claude -p`）唯一放行通道是 `--permission-mode bypassPermissions`。且 `Write(path)` 规则不参与文件权限匹配，必须用 `Edit(path)`。更坑：**PreToolUse hook 在嵌套 headless（Claude Code 内起 claude -p）下不加载**——`--settings`/项目/用户三级、洗净 CLAUDE* 环境变量均实测无效（v2.1.220）。

**Why**：这决定了 ClaudeDream 梦进程的缴械架构——原型跑 bypass + D9 git 审计执法（引擎 run-dream.py 原型简化声明有全文）；**产物阶段必须走 Agent SDK 的 `canUseTool` 进程内回调**实现结构缴械，这已从 IdeaPool #14 的"推荐"升级为"必选"。

**How to apply**：任何要在 headless 里写 `.claude/` 的方案，不要再试白名单/hook 路线，直接按 bypass+审计（原型）或 Agent SDK（产物）设计；守门逻辑已有现成单测通过的 [[scope-guard]]（engine/scope-guard.py，可移植为 canUseTool 回调）。安全阀验证用故障注入（engine/rogue-dream.py 模式）而非真 agent——合作型 agent 永远到不了熔断线。
