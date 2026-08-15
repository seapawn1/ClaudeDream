// PBI-02.4：熔断器——三道安全阀的第一道，连删事故在结构上不可能。
// 口径写死（AC1，为 PBI-07 引入合并时留好口径）：
//   计数对象 = 记忆文件净消失数（仅整文件删除；隔离标记不计入、纯索引行修复不计入、
//   非记忆文件的改动不计入——本轮处置层只产生整文件删除这一种消失形态）；
//   库存基准 = 梦前状态的记忆文件数（runMechanicalChecks 的 meta.memoryCount，处置前快照）；
//   判定 = 净消失数 > max(max_deletes, floor(库存 × 10%))——严格大于，不含等于；
//   10% 取 floor（向下取整 = 阈值更严 = 熔断更早，安全方向，见 SprintBacklog 3.4#5）。
// 熔断动作 = 中止整梦、记忆状态回滚到梦前（git checkout preSha 限 pathspec）、报告写明
//   熔断原因/真实净消失数/被回滚动作清单；锁与标记释放、冷却照常起算由 trigger-check 保证
//   （AC3——熔断算「做过一场梦」，不写死这一点会出现「熔断→未进冷却→立刻重跑→再熔断」死循环）。

/**
 * 计算熔断阈值。
 * @param {number} maxDeletes 配置值（max_deletes 键）
 * @param {number} memoryCount 梦前记忆文件数
 * @returns {{threshold: number, maxDeletes: number, tenPercent: number}}
 */
export function fuseThreshold({ maxDeletes, memoryCount }) {
  const tenPercent = Math.floor(memoryCount * 0.1);
  return { threshold: Math.max(maxDeletes, tenPercent), maxDeletes, tenPercent };
}

/** 熔断判定：严格大于（AC1 写死「>」，不含等于）。 */
export function shouldFuse({ netDisappeared, threshold }) {
  return netDisappeared > threshold;
}

/**
 * 回滚到梦前状态：git checkout preSha 限 pathspec（.claude/memory + CLAUDE.md）。
 * 受信任代码 argv 数组调用，不经 shell。返回 exec.run 的结果（ok=false 时调用方须处理——
 * 回滚失败 = 最坏情况，报告必须如实写明）。
 * @param {object} opts
 * @param {string} opts.root
 * @param {object} opts.paths dreamPaths(root)
 * @param {string} opts.preSha 梦前快照 sha
 * @param {object} opts.exec createEngineLog 的返回
 */
export function restoreToPreDream({ root, paths, preSha, exec }) {
  // pathspec 显式限死三处中与记忆相关的两处（.claude/dream 是证据目录，不在回滚范围——
  // 报告与执行日志必须存活，不能随记忆一起回滚，否则熔断现场无记录可查）。
  return exec.run('git', ['checkout', preSha, '--', paths.memoryDir, paths.claudeMd], { cwd: root });
}

/**
 * 组装熔断详情（报告用）：原因、阈值口径、触发时真实净消失数。
 * @param {object} opts
 * @param {object} opts.threshold fuseThreshold 的返回
 * @param {number} opts.netDisappeared 触发时的真实净消失数
 * @param {object[]} opts.journal 截至熔断时已执行的动作清单（回滚动作清单的数据源）
 */
export function buildFuseDetail({ threshold, netDisappeared, journal }) {
  return {
    reason: `净消失 ${netDisappeared} > max(max_deletes=${threshold.maxDeletes}, 库存10%=${threshold.tenPercent}) = ${threshold.threshold}`,
    threshold: threshold.threshold,
    maxDeletes: threshold.maxDeletes,
    tenPercent: threshold.tenPercent,
    netDisappeared,
    rolledBackActions: journal.map((a) => ({
      action: a.action,
      object: a.object,
      criterionId: a.criterionId,
    })),
  };
}
