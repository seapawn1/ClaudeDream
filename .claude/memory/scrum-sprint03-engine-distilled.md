---
name: scrum-sprint03-engine-distilled
description: Sprint-3（引擎主干·纯机械梦，2026-08-16 收口）Review 蒸馏——六拆条与关键口径、D3 三阻断、七站亲验三硬伤、双盲对照胜出、流程三条沉淀、底片消费契约
metadata:
  type: project
---

Sprint-3 档案（`scrum/sprint-03-engine/`，待重构收尾删除，本记忆为知识载体）按 Sprint Review 原则蒸馏，2026-08-30。验收考卷未读未引（standing 约定）。上游 [[scrum-sprint02-negatives-distilled]]；LLM 层接棒见 ProductBacklog PBI-07（Sprint-4 Planning 定案八拆条，施工被 2026-08-30 全仓重构定局叫停，档案仅 reflog 可达）。

## Sprint Goal 与达成

> 梦不再是过场——纯机械梦上岗：零 API 成本跑真体检、真处置、真留证；熔断器让连删事故在结构上不可能；梦开工前先翻底片找用户留话。

**达成（PO 2026-08-16 定调验收通过）**：六拆条全交付，自证 319/319 → review 修复后 335/335；端到端七站亲验（修复后）全绿——隔离 3 条全真腐烂、健康零误报、确凿票 2/2、熔断回滚干净冷却拦截、G9 窗口语义恢复、一条命令回梦前。

## Increment（PBI-02.1–02.6）与关键口径

1. **02.1 阀门六键**（`.claude/claude-dream.local.md`）：enabled/llm_checks/delete_policy/max_deletes/claude_md_edits/cooldown_minutes；解析顺序**配置文件 > 环境变量 > 默认**（逐键），env 覆盖生效时报告点名不许静默；`enabled:false` 底片照常、只是不拉梦；环境变量 `CLAUDE_DREAM_ENABLED` 等四个 + 沿用两个。
2. **02.2 M1–M5 判据引擎**（`engine/check.mjs` 纯函数式）：M4 两级证据——0 命中=候选、git 讣告（`--diff-filter=D`）在案=确凿；**路径形 token 才有讣告通道，命令/函数形永远停在候选（无删除权）**；M4 检索 `git ls-files` 范围、显式排除 `.claude/`（记忆库自引用不算项目现状）；M2 库存 <15 整条禁用（R3 冷启动）；链接解析规则：`[[X]]` 无路径字符按 slug、有按相对路径 stat，皆无=断链。
3. **02.3 处置层**：L0 修断链=摘 `[[ ]]` 标记降普通正文（不乱改指向）；**无讣告，不删**（铁律在纯机械梦下的等价表述）；L3 隔离 `status: quarantined`+quarantine 块（reason/since/runId）可逆、每梦按 reason 复检复活解除；**feedback 类永不自动删、永不自动隔离，只进待你裁决**；user 类按 AC 字面不豁免（PO 维持）。
4. **02.4 熔断器**：计数对象=**记忆文件净消失数**（隔离/索引修复/非记忆文件不计）；阈值 max(max_deletes, **floor**(库存×10%))（向下取整=更严=安全方向）；严格大于触发；回滚 `git checkout <preSha> -- .claude/memory CLAUDE.md`（**仓库内相对路径**——Windows 绝对 pathspec 会被拒）；熔断算做过一场梦、冷却照常起算（防熔断→未冷却→再熔断死循环）；报告写明原因/真实净消失数/回滚清单。
5. **02.5 C2/C3 报告改造**：证据两种记法——真实执行的命令记原文+exit code+stdout 摘要+时间戳（`lib/exec-log.mjs` 是 execFileSync 唯一通道），纯代码判据记输入+判定+时间戳；抽查点一律 `git show <preSha>:<file>` 梦前基准、挑证明力最弱 3 笔、**必须能失败**；每笔删除内联死者遗言；新建类回滚提示是撤销式（对象梦前不存在）；多笔同文件显式标注连坐 + C1 局限诚实声明（单笔精撤后置）。
6. **02.6 G9 回程**：定向翻底片——检索**上次梦 runId 之后**产生的底片页中的用户原话、匹配隔离区/待裁决对象 slug、原文+出处页指针摘录进工作输入与报告；**底片消费契约=公开接口（PBI-06 重做必须保住，破③会静默失效）**：①台账 ledger.json 按 sessionId 分组、页记录 file 为文件名（消费方自行拼目录）；②页正文保留用户原话；③用户发言段落标记 `### User`/`### User (meta)`/`### User (steering)`。机械梦不因留话改变处置（听懂照办归 PBI-07）。

**架构前提（AC 推论非 How）**：机械管线不经 SDK/模型——M4 需要 shell 出 git 取证，SDK 路径下 scope-guard 无条件拒 shell 结构上做不到。run-dream.mjs 重写为机械编排（默认路径零 SDK 零网络，无登录态全链可跑）；SDK 唯一落点拆至 `run-dream-rogue.mjs` 动态 import（rogue 故障演练保留 canUseTool 围栏验证）；`CLAUDE_INVOKED_BY`/dreamSessionIdsLog/排除梦会话三机制「用不上但不删不破」。C1–C7 归属记账逐条有归宿（C2/C3/C5 前半/C6/C7 已交付或已实现；C1 后置整梦全撤兜底；C4 随 PBI-07）。

## D3 独立 review（opus）三阻断（修复+钉子）

F1 G9 基线生产链失效：trigger-check 覆写 last-dream.json 前未读旧 runId → 翻底片恒空（修复=覆写前读旧值传参 + undefined/null 双语义）；F2 回滚提示/抽查点 git 路径缺 `.claude/memory/` 前缀不可执行；F3 回滚失败时报告与提示行谎称已回滚（restoreFailed 三处渲染+提示行条件化）。中级含 fix-index 抽查点恒真恒假、无 frontmatter 隔离标记不可逆（拆壳+EOL 保留）。

## 端到端验收：七站亲验 → 三处硬伤 → 双盲对照

**流程**：AC 判分线收口作废（PO 裁定）→ PO 在场手操七站亲验 → 三处硬伤 → 修复任务书 → 双盲对照（developers 版 bee1ad8 vs 出卷线 agent 版，同考场同流程独立实测）→ PO 裁定 agent 版胜出全面采用 → 修复独立实测全绿。三处硬伤：①M2「无链=孤儿」误杀约 26 条健康记忆（判据口径错，收窄为**零链 ∧ 未登索引**）；②熔断回滚 Windows 绝对路径 pathspec 失败（实现 bug，改相对路径）；③CLI 直跑无冷却/last-dream（PO 裁定的设计变更，CLI 与 trigger-check 同构闸门）。双盲胜出关键：M4 路径实体存在性改 `git ls-files`（git grep 内容检索把正文提及当实体 → 9 条健康误隔离）；命令/函数形候选只留证不隔离。developers 版作废存档于 sprint-03-engine 分支（bee1ad8，分支已删、现仅 reflog 可达）。

## Retro 沉淀（流程三条，跨 Sprint 生效入 ProductBacklog「验收流程约定」第 3–5 条）

1. **验收结论只由「PO 在场端到端主线 + 第三方种植考场实测」驱动**——判分线发现了全部三处硬伤但埋在判分报告里没让 PO 亲眼看，端到端才是让 PO 相信的形态；判分器退居幕后只产参考数据。
2. **第三方考场是自证之后的必经关口**——自证 335/335 全绿 vs 第三方考场 7 处红：自证夹具口径随实现走（DoD 完整 = 自证 + 第三方考场）。
3. **重要修复默认双线盲改 + 同一考场对照实测，PO 裁胜出版**。另：sonnet agent 后台施工新模式验证成立（任务书行为级要求 + 独立实测 + 后台跑）。

## 回 backlog（不展示项）

PBI-05/PBI-06 本轮不做（PO 定案）；LLM 层拆 PBI-07 接棒；「上周」类宽口径相对日期转绝对记后续立项；待裁五项 PO 全认（last-dream.json 不入库、M2 链接密度阈值 0.5、M4 候选只留证、冷却拦截 exit 0、宽口径后置）。
