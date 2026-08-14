// PBI-01.1·AC3：机械压缩核心——纯函数，不碰文件系统、不调网络、不调 Agent SDK（AC2）。
// 输入一批已解析的 transcript jsonl 条目，按 RETAIN-RULES.md 的规则表逐条判定去留，
// 输出底片 markdown 正文 + 统计。规则表与本文件的 RULES 必须逐条对应，改一处务必同改两处
// （见 RETAIN-RULES.md 开头的互相引用说明）。

const IMAGE_STUB = (bytes) => `[image, ${bytes} bytes, discarded]`;

// D3 review 抓到的坑：RETAIN-RULES.md 早就承诺"未知类型超过单条硬上限时截断，标注截断前
// 字节数"，但实现里一直没有这个上限——AC3③优先保真没错，但保真不该没有边界：一条离谱大的
// 未知类型条目会让 AC4 的 10% 体积预算在这一条上失控。100KB 是留了很宽裕的余量（真实数据里
// 已知类型的条目很少超过几 KB），只对"类型都不认识"的兜底路径生效，不影响任何已分类规则。
const UNKNOWN_RAW_CAP_BYTES = 100 * 1024;

function unknownRawBlock(raw) {
  const json = JSON.stringify(raw);
  const bytes = Buffer.byteLength(json, 'utf8');
  if (bytes <= UNKNOWN_RAW_CAP_BYTES) {
    return '```json\n' + json + '\n```';
  }
  // 按字节截断，不是按字符——真出现多字节字符正好被切在中间，Buffer.toString('utf8') 会
  // 用替换字符垫上，不会抛错崩溃，截断标记本身就说明这段不是完整数据，可接受的近似。
  const truncated = Buffer.from(json, 'utf8').subarray(0, UNKNOWN_RAW_CAP_BYTES).toString('utf8');
  return `\`\`\`json\n${truncated}\n\`\`\`\n\n_[截断：原始 ${bytes} 字节，只保留前 ${UNKNOWN_RAW_CAP_BYTES} 字节]_`;
}

// 工具调用只留「做了什么」的定位信息，不留「改成了什么」的完整参数体。
// 只列一两个最能定位动作的标量字段，覆盖不到的工具落到通用 fallback（不特判每个工具名，
// 避免又变成一张要跟着工具列表维护的清单——mechanical, not exhaustive）。
function toolUseSummary(input) {
  const p = input ?? {};
  if (typeof p.file_path === 'string') return `file_path=${p.file_path}`;
  if (typeof p.command === 'string') return `command=${truncateInline(p.command, 200)}`;
  if (typeof p.pattern === 'string') return `pattern=${p.pattern}${p.path ? ` path=${p.path}` : ''}`;
  if (typeof p.prompt === 'string') return `prompt=${truncateInline(p.prompt, 120)}`;
  if (typeof p.url === 'string') return `url=${p.url}`;
  const keys = Object.keys(p);
  return keys.length ? `(${keys.join(',')})` : '(no params)';
}

function truncateInline(s, max) {
  if (typeof s !== 'string') return String(s ?? '');
  return s.length > max ? s.slice(0, max) + '…' : s;
}

// attachment 的「安全标量字段」白名单——批量正文字段（content/stdout/stderr/planContent/
// addedBlocks/addedLines/技能正文等）一律不进这个白名单，天然被丢弃，不需要逐个拉黑。
const ATTACHMENT_SAFE_SCALAR_KEYS = [
  'hookName', 'hookEvent', 'exitCode', 'command', 'filename', 'displayPath',
  'style', 'mode', 'planFilePath', 'itemCount', 'reminderType', 'planExists',
];

function attachmentSummary(attachment) {
  const a = attachment ?? {};
  const parts = [`attachment.type=${a.type ?? '(missing)'}`];
  for (const key of ATTACHMENT_SAFE_SCALAR_KEYS) {
    if (a[key] !== undefined && a[key] !== null && typeof a[key] !== 'object') {
      parts.push(`${key}=${a[key]}`);
    }
  }
  if (Array.isArray(a.skills)) parts.push(`skills=${a.skills.length}`);
  if (Array.isArray(a.addedNames)) parts.push(`addedNames=${a.addedNames.length}`);
  if (Array.isArray(a.addedTypes)) parts.push(`addedTypes=${a.addedTypes.length}`);
  return parts.join(' ');
}

function extractUserText(message) {
  const content = message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((item) => item?.type === 'text')
      .map((item) => item.text)
      .join('\n\n');
  }
  return '';
}

function toolResultLine(item) {
  const bytes = typeof item.content === 'string' ? Buffer.byteLength(item.content, 'utf8') : JSON.stringify(item.content ?? '').length;
  const status = item.is_error ? 'error' : 'ok';
  return `- tool_result tool_use_id=${item.tool_use_id ?? '(unknown)'} status=${status} bytes=${bytes}`;
}

function imageLine(item) {
  return `_${IMAGE_STUB(item?.source?.data ? Math.ceil((item.source.data.length * 3) / 4) : 0)}_`;
}

// claude-code-log 原话核实过：enqueue/dequeue/popAll 是内部记账操作，内容与真实用户消息重复。
const QUEUE_OPERATION_KNOWN_DISCARD = new Set(['enqueue', 'dequeue', 'popAll']);

// 混合内容（比如同一条目里既有真实文本又有工具返回桩）按优先级归一个 kind 供统计用——
// 这个优先级只影响 stats 里怎么归类，不影响 lines 里实际写了什么，输出内容不受影响。
function classifyMixedKind({ hasRetainedText, hasStub, hasUnknownItem, lines }) {
  if (hasRetainedText) return 'retain';
  if (hasStub) return 'stub';
  if (hasUnknownItem) return 'unknown';
  return lines.length ? 'retain' : 'discard';
}

// 每条规则返回 { kind: 'retain'|'stub'|'discard'|'unknown', lines: string[], hasUnknownItem?: bool }
// lines 是要写进底片正文的 markdown 片段（可以是空数组——比如 discard）。hasUnknownItem 标记
// "entry 整体分类之外，还混了至少一个没见过的子类型"——D3 review 指出：旧写法一发现
// tool_result 就整条早退（会吞掉同数组里可能共存的文本/图片），且未列举的 content item 类型
// （比如 Anthropic Messages API 真实存在的 redacted_thinking）会静默消失、不进 stats——
// 两处都改成逐项处理 + 未知子类型也留一行可见的桩，并单独计数，不再让"entry 整体算 retain"
// 掩盖掉局部的信息丢失。
const RULES = {
  user(entry) {
    const message = entry.message;
    const content = message?.content;
    const lines = [];
    let hasRetainedText = false;
    let hasStub = false;
    let hasUnknownItem = false;

    if (typeof content === 'string') {
      if (content.trim()) {
        lines.push(`### User${entry.isMeta ? ' (meta)' : ''}\n\n${content.trim()}`);
        hasRetainedText = true;
      }
    } else if (Array.isArray(content)) {
      for (const item of content) {
        if (item?.type === 'tool_result') {
          lines.push(toolResultLine(item));
          hasStub = true;
        } else if (item?.type === 'text') {
          if (item.text?.trim()) {
            lines.push(`### User${entry.isMeta ? ' (meta)' : ''}\n\n${item.text.trim()}`);
            hasRetainedText = true;
          }
        } else if (item?.type === 'image') {
          lines.push(imageLine(item));
        } else {
          hasUnknownItem = true;
          lines.push(`_[unknown user content type=${item?.type ?? '(missing)'}, kept raw]_\n\n${unknownRawBlock(item)}`);
        }
      }
    }
    return { kind: classifyMixedKind({ hasRetainedText, hasStub, hasUnknownItem, lines }), lines, hasUnknownItem };
  },

  assistant(entry) {
    const items = entry.message?.content ?? [];
    const lines = [];
    let hasUnknownItem = false;
    for (const item of items) {
      if (item?.type === 'text') {
        if (item.text?.trim()) {
          lines.push(`### Assistant\n\n${item.text.trim()}`);
        }
      } else if (item?.type === 'thinking') {
        const n = item.thinking?.length ?? 0;
        lines.push(`_[thinking block, ${n} chars, discarded]_`);
      } else if (item?.type === 'tool_use') {
        lines.push(`- tool_use ${item.name ?? '(unknown)'} ${toolUseSummary(item.input)}`);
      } else if (item?.type === 'image') {
        lines.push(imageLine(item));
      } else {
        // 例如 redacted_thinking（Anthropic Messages API 真实存在的内容块类型，安全系统
        // 遮蔽 thinking 时会用它）——以前这里没有 else 分支，直接静默消失。
        hasUnknownItem = true;
        lines.push(`_[unknown assistant content type=${item?.type ?? '(missing)'}, kept raw]_\n\n${unknownRawBlock(item)}`);
      }
    }
    // kind 判定跟改动前完全一样（有内容就 retain，没内容 discard）——只是现在"有内容"里
    // 可能包含未知子类型的桩，hasUnknownItem 单独标出去，不改变这条既有分类语义。
    return { kind: lines.length ? 'retain' : 'discard', lines, hasUnknownItem };
  },

  system(entry) {
    const bits = [`system subtype=${entry.subtype ?? '(none)'} level=${entry.level ?? '(none)'}`];
    if (entry.subtype === 'compact_boundary' && entry.compactMetadata) {
      bits.push(`trigger=${entry.compactMetadata.trigger ?? '?'} preTokens=${entry.compactMetadata.preTokens ?? '?'}`);
    }
    if (entry.content && entry.content.length < 300) bits.push(truncateInline(entry.content, 300));
    return { kind: 'stub', lines: [`- ${bits.join(' ')}`] };
  },

  attachment(entry) {
    return { kind: 'stub', lines: [`- ${attachmentSummary(entry.attachment)}`] };
  },

  'file-history-snapshot': (entry) => {
    const n = Object.keys(entry.snapshot?.trackedFileBackups ?? {}).length;
    return { kind: 'stub', lines: [`- file-history-snapshot: ${n} tracked files`] };
  },

  summary(entry) {
    return { kind: 'retain', lines: [`### Summary (/compact)\n\n${(entry.summary ?? '').trim()}`] };
  },

  'queue-operation': (entry) => {
    if (entry.operation === 'remove') {
      const text = typeof entry.content === 'string' ? entry.content : extractUserText({ content: entry.content });
      return { kind: 'retain', lines: text?.trim() ? [`### User (steering)\n\n${text.trim()}`] : [] };
    }
    // 已知的三个内部记账操作值——claude-code-log 原话：内容与真实用户消息重复，丢了不损失信息。
    if (QUEUE_OPERATION_KNOWN_DISCARD.has(entry.operation)) {
      return { kind: 'discard', lines: [] };
    }
    // D3 review 抓到的坑：以前这条兜底分支不分青红皂白丢弃任何非 remove 的 operation 值，
    // 包括未来可能出现、现在还没见过的值——现在只有这三个「已知且核实过确实是内部记账、
    // 丢了不损失信息」的值走 discard，其余落进 AC3③ 的未知留痕轨道，不假设枚举永远只有这些。
    return { kind: 'unknown', lines: [`_[unknown queue-operation.operation=${entry.operation}, kept raw]_\n\n${unknownRawBlock(entry)}`], hasUnknownItem: true };
  },

  'ai-title': (entry) => ({ kind: 'stub', lines: [`- ai-title: ${entry.aiTitle}`] }),
  'custom-title': (entry) => ({ kind: 'stub', lines: [`- custom-title: ${entry.customTitle}`] }),
  'agent-name': (entry) => ({ kind: 'stub', lines: [`- agent-name: ${entry.agentName}`] }),
  'last-prompt': (entry) => ({ kind: 'stub', lines: [`- last-prompt: ${truncateInline(entry.lastPrompt, 200)}`] }),
  mode: (entry) => ({ kind: 'stub', lines: [`- mode: ${entry.mode}`] }),
  'permission-mode': (entry) => ({ kind: 'stub', lines: [`- permission-mode: ${entry.permissionMode}`] }),
};

/**
 * @param {object[]} entries 已解析的 transcript jsonl 条目（数组顺序＝原稿顺序）
 * @returns {{ markdown: string, stats: object }}
 */
export function compressEntries(entries) {
  const lines = [];
  const stats = {
    totalEntries: entries.length,
    byKind: { retain: 0, stub: 0, discard: 0, unknown: 0 },
    byType: {},
    // D3 review 抓到的坑：一条 entry 整体判定 retain/stub 时，混在里面的未知子类型（比如
    // assistant content 数组里一个没见过的 item type）以前完全不体现在统计里——"entry 整体
    // 算 retain"会把局部的信息丢失盖住，没人能从 stats 看出发生过。这个计数器专门独立于
    // byKind 之外，只要一条 entry 里出现过至少一个未知子类型就 +1，不管它整体归哪类。
    subitemUnknownCount: 0,
  };

  for (const entry of entries) {
    const type = entry?.type ?? '(no type)';
    stats.byType[type] = (stats.byType[type] ?? 0) + 1;

    const rule = RULES[type];
    if (!rule) {
      // AC3③：未知类型保守保留＋留痕，原样收整条 JSON，不摘要不静默丢弃（超过单条硬上限
      // 才截断，见 unknownRawBlock）。
      stats.byKind.unknown += 1;
      lines.push(`### ⚠️ UNKNOWN type=${type}\n\n${unknownRawBlock({ unknown: true, type, raw: entry })}`);
      continue;
    }
    const { kind, lines: entryLines, hasUnknownItem } = rule(entry);
    stats.byKind[kind] = (stats.byKind[kind] ?? 0) + 1;
    if (hasUnknownItem) stats.subitemUnknownCount += 1;
    lines.push(...entryLines);
  }

  return { markdown: lines.join('\n\n'), stats };
}
