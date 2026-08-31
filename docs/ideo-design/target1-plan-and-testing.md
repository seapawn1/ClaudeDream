---
name: design-sprint-target1-distilled
description: 设计冲刺主靶 Target-1（整合段 S6–S8）档案全量蒸馏——定稿方案（判据/处置/三阀/报告六节/阀门六键）、四派草图、原型三场真梦+故障注入、C1–C7 改造、testbed 腐烂库设计、测试方法论
metadata:
  type: project
---

`scrum/.IDEO/design-sprint/Target-1-Consolidation/`（已冻结的设计冲刺主靶档案）的全量蒸馏，2026-08-30 仓库重构逐文件读后落成。未逐行读的仅生成物与脚本体（testbed/acme-api 45 文件、dream-full.diff×3、__pycache__、build-acme.py/m-checks.py/scope-guard.py 全文）——其设计已由 README/rot-manifest/audit-notes/run-dream.py 头部声明承载。**档案已随重构删除（2026-08-30，450040f），本记忆即唯一载体。**上游全局图见 [[design-sprint-core-distilled]]；本靶方案已落成插件（Sprint-1~3 交付机械层与围栏，LLM 层 = PBI-07）。

## 靶定义与结论

- **Goal**：造「梦」的良心——体检→整合→留证装配成一次可信整合；用户敢让 agent 自己删，事后看得清、退得回。圈靶理由：全地图只有这段真正写文件、造成不可逆损失；官方 Auto Dream 正在此翻车（#47959 静默删 23 文件）。
- **通过标准**：真实腐烂库上跑通一次整合，产出改后记忆+CLAUDE.md、梦报告、可回滚 git 提交；删除决策可辩护。
- **结论（TargetReview + verdict，2026-08-02）**：**达标放行，带 C1–C7 七条改造**。主干成立（判据/处置/阀门/回滚真跑通 + 故障注入验证）；兑现层三处结构性缺陷——证据是转述非执行日志、单条回滚跨笔连坐、机器推论无身份证——全部落在「信任」承诺上。

## 定稿方案（Sketches.md；Decider 选 D 派为主体、嫁接 A/B/C 九项）

- **判据两层**：机械层零 LLM 先跑——M1 断链 / M2 孤儿（<15 条库整体禁用）/ M3 悬空溯源（sources: 指向物消失）/ M4 实体失效 + git 讣告升级（`git log --diff-filter=D` 查到删除提交 = 确凿；查不到 = 仅候选，防改名误判）/ M5 索引漂移（auto_fixable）。LLM 层只吃机械筛出的候选——S1 记忆互矛盾（git 时间序 + 现状核验裁决，不许投票）/ S2 vs CLAUDE.md / S3 连接候选（机械共现先筛，LLM 只判「非显然」）；**每判必引双方原文（无证不理）**。
- **处置四级**：L0 随手修（断链/索引/相对日期转绝对）｜L1 自主改（删/合并/建 connection）——**删除票只能由机械确凿证据开出，LLM 只能否决、标注、降级**；合并登记 `merged_from` 不灭失信息；connection 单梦限 2 条｜L2 阀门管辖 CLAUDE.md（默认开；关 = 报告建议 + 记忆侧 `contradicts` 标注）｜L3 隔离观察（判据不足或 feedback 类：`status: quarantined` + 原因原地保留；**feedback 类永不自动删**，只进「待你裁决」；连续两梦无翻案升候删）。
- **三道安全阀**：熔断器（删除数 > max(max_deletes, 库存 10%) → 整梦中止、reset 回快照——#47959 式连删结构上不可能）；配置层缴械（工具白名单锁死 Read/Grep/Glob + Write 限 `.claude/memory/`、`.claude/dream/`、CLAUDE.md + Bash 仅 git——势力范围由权限层保证，不靠提示词自觉）；隔离优先（删错 ≫ 留错）。
- **留证**：报告六节 = 图 delta 对账行 / 30 秒版（敏感动作置顶）/ 明细每笔四要素（动作|判据编号|证据|单条回滚命令）/ 隔离观察区 / 抽查点（自动挑证明力最弱 3 笔）/ 尾行阀门状态；git 梦前快照提交 + `dream:` 单提交 = 回滚原子；SessionStart 一行提示送达。
- **阀门六键**（`.claude/claude-dream.local.md` frontmatter）：`enabled` / `claude_md_edits` / `delete_policy`（quarantine-first | report-only）/ `max_deletes` / `max_new_connections` / `llm_checks`（off = 纯机械梦零 API）。
- **wiki 层可剥离**（退路）：四派骨架同构，若 connection 被判废边制造机，关掉即退回纯维护梦、主干无伤——Test 实判 R1 不成立，未剥离。

## 四派竞争草图（SketchPool；A/C/D 真隔离 subagent、B 主 agent 亲画）

A 官方改良：贴官方四阶段 + 阀门（唯一原则性偏离处）+ 梦前快照 + 送达行。B 审计：对账单三段（期初/明细/期末）+ 30 秒版 + 抽查邀请 + 处置权 = 证明力 × 可逆性 + 「无证不删」工程护栏。C 机械：证据链删除 + 铁律（LLM 无删除开票权）+ 熔断器 + git 讣告。D wiki：**connection 即记忆**（官方契约内长知识网）+ frontmatter 溯源/Related 器官 + 图健康即免费体检。选 D 理由：四份中唯一兑现复利，且判据/隔离与其他派兼容、嫁接面干净；wiki 可剥离性让赌注安全。

## IdeaPool 精髓（14 弹药 + 6 反面清单 + S4 对摆）

判据：#1 外部现实当判据不投票、#2「记忆说 X 存在 ≠ X 现在存在」可机械核验、#3 机械免费打底 LLM 只判语义。所有权：#4 删错 ≫ 留错不对称成本、#5 CLAUDE.md 阀门默认改可关（官方不敢改的本质是没有回滚层）、#6 权限配置层缴械不靠自觉（claude-mem 五层冗余，"The redundancy IS the security property"）、#7 写入端 `<private>` 剥离、#8 severity 分级即处置分级。留证：#9 溯源链 + append-only、#10 每条记忆身份证号、#11 索引即摘要 + 硬上限。基建：#12 取舍规则声明在数据类型上、#13 官方机械压缩 + 窄 grep 兜底、#14 hook 零 API + 分离进程跑 SDK（无免费离线时刻的实证绕法）。
**反面清单（不偷）**：①零留证收尾 ②只报不删断头体检 ③compiler 的 stale = 源日志 hash 漂移 ≠ 内容被现实推翻 ④单向所有权无保护 ⑤纯提示词无工程护栏 ⑥写入即定稿 + 常驻运维面。
**S4 对摆**：机械压缩 = 卷宗（无损可回溯；claude-code-log 实测 jsonl→md 1.8%）vs LLM 提炼 = 笔录（有判断；写入即定稿；$0.45–0.65/日）→ 拍板 A 机械压缩底片层，提炼留梦内——梦是全系统唯一不占用户时间的 LLM 时刻。

## 原型实测（三场真梦 + rogue 故障注入）

- 施工侧 H1–H5 全过：5 条种植腐烂全处置（对 rot-manifest 逐条）、36 健康零误删、CLAUDE.md 恰改种植一行、四要素齐全、`git revert` 实测成功。
- run-01（阀开）：42→40，删 2 合 1 连接 1 隔离 1，改 CLAUDE.md 一处。run-02（关阀）：CLAUDE.md 零 diff、降级「建议（未动）」+ `contradicts` 标注，且**自主发现未种植的真过期**（deploy-env-vars「缺 env 起不来」被按 redis.js 回落代码改述）。run-03（真 agent + 熔断线压 1）：agent 读到线自觉只删 1 条、其余降级隔离——**合作型 agent 到不了工程熔断线**。
- rogue-dream.py 三发全拦：熔断（4 笔删除申请 → 整梦 reset 回快照）/ 铁律（伪造证据删健康记忆 → 拒绝回滚）/ 越界（改 src/app.js → D9 git 审计恢复零残留）。
- run-03 附带真发现：连接候选产出项目级安全线索（裸 async 插件 hook 不外泄 → JWT 可能对业务路由全不生效——静态推断未运行验证）；及删除额度自相矛盾时 agent 取更严值的正确保守行为。
- 梦间方差存在（run-01/02 合并方向相反、connection 选题不同）——都合法、信息都保全，可否接受待裁。

## 宣判 C1–C7（转产物 backlog；C1/C2/C3 = 信任兑现前提）

C1 回滚按文件出不按笔出 + 跨笔触及警告 + dream-undo 脚本（撤销键工程质量必须高于删除键）；C2 证据栏改贴执行日志（命令 + exit code + stdout + 时间戳，统一 shell 方言）；C3 抽查点必须能失败（一律以梦前状态 `git show <pre-sha>:<file>` 起手）+ 每笔删除内联「死者遗言」；C4 机器推论贴身份证（origin/confidence/generated_at/verified_at + 未确认 connection 顶部警告 + description 不得含源推不出的断言）；C5 首行摘要说全动作类型与触及文件数（提示行与报告同源生成、CLAUDE.md 笔目置顶）；C6 报告禁内部术语 + 合并是否占 max_deletes 额度写死并显示真实盘面消失数；C7 报告不进 dream commit（revert 不得销毁审计轨迹）。
**已拍板另两项产物工作**：S4 机械压缩底片层（含 G9 裁决回程修复 = 梦 D3 定向先翻底片找用户留话）；Agent SDK `canUseTool` 结构缴械（实测 .claude 受保护路径 + hook 嵌套 headless 不加载，原型以 git 审计执法，产物必须换进程内回调）。
**待裁三项**：observe-only 模式（P3：「不是降级，是功能不同的产品——从处置人变导游」，配分级放权与回执机制防堆积病）／梦间方差可否接受／个人侧复利怎么测。

## testbed 验收资产模式（可复用）

确定性 builder（build-acme.py，重跑一致）生成假项目 acme-api：42 条记忆 = 36 健康（显式列出，误删即败）+ 2 实体死（预期删）+ 2 重复（预期合并）+ 2 矛盾对（预期隔离，feedback 侧永不删）+ MEMORY.md 漏登 1 行（M5）+ 断链 1 处（M1）+ CLAUDE.md 恰 1 处过期（S2）+ 2 组连接候选（无预建边喂 D7）+ git 时间线含真实删除提交喂 M4 讣告 + 矛盾现场故意两 config 并存使机械无法定谳。rot-manifest 对答案卡 = H1/H2 判分基准与全部预期处置。Sprint 验收考场（scrum/*/acceptance/）沿用此模式。

## 教训与方法论（verdict §5）

①模拟用户测缺陷远胜真人（P1 审计人格核出十条结构性缺陷条条属实）；②真人偏倚显式记账（「赞」低于「追问」）；③布景数据必须从真产物机器提取不可手写（主持人手错两处被抓）；④安全阀只能故障注入证明（建议进产物 CI）；⑤抽查点定位 = 「存在即安心」，故必须经得起真查（P1 收束句：「报告告诉我它做了什么，但没让我能查证它做了什么——前者是产品，后者才是信任」）；⑥P1 观察期条款示范了不信任用户的放权路径（max_deletes=0 起步、动词覆盖得住 diff 才逐项放开）。
