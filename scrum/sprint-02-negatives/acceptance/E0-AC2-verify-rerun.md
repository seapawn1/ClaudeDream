# E0·AC2 · Sprint-1 verify 打分后重跑记录

**执行人**：出卷线（`sprint-02-acceptance` worktree），2026-08-14。
**目的**：Sprint-1 打分后 developers 又改了两处代码（`5c04dd3`：冷却期 0 值显式解析、`.gitignore` 精确忽略 4 个运行态文件替代整目录忽略），这两笔改动没有重新过 verify。E0·AC2 要求补跑一次，确认打分结果没被这两笔改动动摇。

## 结论

**未见回归，得分与原始打分一致**：13 自动判据 ✔，0 不过，3 项人工待办（H0／H-A8／H-C3，与 Sprint-1 原始验收一样，脚本查不了、验收当场做）。`exit code 1` 是设计行为——verify.mjs 在人工项未打勾前一律非零退出，不代表跑挂了。

两笔代码改动本身已核实在场：`claude-dream/src/trigger-check.mjs` 里冷却期显式判空/非法/负数才回退默认（0 不再被 `||` 吞掉）；`.gitignore` 已是精确 4 个文件（`last-dream.json`／`session-end-marker.json`／`dream.lock`／`next-session-prompt.txt`），不再整目录忽略。

## 一个环境坑，记下防再摔

第一次跑直接炸了（4 ✔／6 ✖／6 待办，H-A9 报 exit 1 带 ESM loader 报错）。查下来不是代码问题，是**worktree 是全新 checkout，`claude-dream/node_modules` 没跟着来**（`.gitignore` 里 `node_modules/` 本就不追踪，git worktree 也不会复制被忽略的文件——这是官方文档写明的行为，不是 bug）。补一次 `npm install`（用现成的 `claude-dream/package-lock.json`）后重跑，前一节的干净结果就出来了。

**建议**：这条值得补进 `CLAUDE.md`「环境与坑」——以后开新 worktree 干活，先 `npm install` 再跑任何验证脚本，别把"依赖没装"当成"代码坏了"去排查。

## 完整判据表（本次重跑）

```
判据          源 AC         判定  说明
────────────────────────────────────────────────────────────────────────────────────────────────
H0     插件装得上                  04.1·AC1  ✋   manifest 结构合法；仍须人工在考场起一次 Claude Code 确认加载无报错
H-A1   该醒时醒：触发标记落盘            04.1·AC2  ✔   触发标记就位：.claude/dream/session-end-marker.json
H-A2   触发零成本：hook 无 API 调用    04.1·AC2  ✔   hook 内无模型调用、无网络请求
H-A3   经 Agent SDK 起梦         04.2·AC1  ✔   梦入口引用 @anthropic-ai/claude-agent-sdk
H-A4   梦前快照，pathspec 仅三处      04.2·AC3  ✔   快照先行收好梦前改动，3 笔提交全部收在三处白名单内
H-A5   占位引擎走完过场               04.3·AC1  ✔   体检→整合过场走完，退出码 0（本轮不判准确性）
H-A6   梦报告六节在位                04.3·AC2  ✔   报告 .claude/dream/2026-08-14T07-47-19-924Z-report.md 六节齐全
H-A7   记忆改动单笔 dream: 收口       04.3·AC3  ✔   单笔收口：「dream: 2026-08-14T07-47-19-924Z 占位整合」（另 1 笔证据提交）
H-A8   下次会话提示行载体就位            04.3·AC4  ✋   载体就位且非空；仍须人工在考场新开一次会话，确认开场真的出现那一行
H-A9   无人干预全程跑通               04.3·AC5  ✔   非交互（stdin 关闭）一次跑完，退出码 0
H-B1   冷却期内不重复触发且可配置          04.1·AC3  ✔   冷却期内不重复拉起；CLAUDE_DREAM_COOLDOWN_MINUTES=0.01 后重新拉起——配置确实在起作用
H-B2   梦自身结束不触发               04.1·AC4  ✔   置 CLAUDE_INVOKED_BY 后结束会话不触发——防递归成立
H-C1   白名单内放行、零权限提示           04.2·AC2  ✔   白名单内确有写入（2 处），且该次运行非交互无提示
H-C2   越界被拒且留日志               04.2·AC2  ✔   越界写入被拒，拒绝记录在 .claude/dream/2026-08-14T07-47-52-457Z-canUseTool.log
H-C3   canUseTool 前提结论在案      04.2·AC0  ✋   spike 记录在案；仍须人工读一遍，确认结论明确、走哪条路有交代
H-D1   revert 一步撤销            04.3·AC3  ✔   revert 8b33751 后回到梦前状态，记忆与 CLAUDE.md 零差异
────────────────────────────────────────────────────────────────────────────────────────────────
过 13 ｜ 不过 0 ｜ 待办（人工/阻塞）3　共 16 条，覆盖 13 条 AC
```

## 抄送

结论请 PO 转达 developers：Sprint-1 打分后的两笔改动（冷却 0 值、`.gitignore` 精确化）不影响原验收结果，欠账已清。
