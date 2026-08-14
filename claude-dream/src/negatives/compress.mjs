// PBI-01.1·AC3：机械压缩核心——纯函数，不碰文件系统、不调网络、不调 Agent SDK（AC2）。
// 输入一批已解析的 transcript jsonl 条目，按 RETAIN-RULES.md 的规则表逐条判定去留，
// 输出底片 markdown 正文 + 统计。规则表与本文件的 RULES 必须逐条对应，改一处务必同改两处
// （见 RETAIN-RULES.md 开头的互相引用说明）。

const IMAGE_STUB = (bytes) => `[image, ${bytes} bytes, discarded]`;

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

function hasToolResult(message) {
  return Array.isArray(message?.content) && message.content.some((item) => item?.type === 'tool_result');
}

function toolResultSummaries(message) {
  return (message?.content ?? [])
    .filter((item) => item?.type === 'tool_result')
    .map((item) => {
      const bytes = typeof item.content === 'string' ? Buffer.byteLength(item.content, 'utf8') : JSON.stringify(item.content ?? '').length;
      const status = item.is_error ? 'error' : 'ok';
      return `tool_result tool_use_id=${item.tool_use_id ?? '(unknown)'} status=${status} bytes=${bytes}`;
    });
}

function imageStubsIn(content) {
  if (!Array.isArray(content)) return [];
  return content
    .filter((item) => item?.type === 'image')
    .map((item) => IMAGE_STUB(item?.source?.data ? Math.ceil((item.source.data.length * 3) / 4) : 0));
}

// 每条规则返回 { kind: 'retain'|'stub'|'discard'|'unknown', lines: string[] }
// lines 是要写进底片正文的 markdown 片段（可以是空数组——比如 discard）。
const RULES = {
  user(entry) {
    const message = entry.message;
    if (hasToolResult(message)) {
      const stubs = toolResultSummaries(message);
      return { kind: 'stub', lines: stubs.map((s) => `- ${s}`) };
    }
    const text = extractUserText(message);
    const images = imageStubsIn(message?.content);
    const lines = [];
    if (text.trim()) lines.push(`### User${entry.isMeta ? ' (meta)' : ''}\n\n${text.trim()}`);
    for (const stub of images) lines.push(`_${stub}_`);
    return { kind: lines.length ? 'retain' : 'discard', lines };
  },

  assistant(entry) {
    const items = entry.message?.content ?? [];
    const lines = [];
    for (const item of items) {
      if (item?.type === 'text') {
        if (item.text?.trim()) lines.push(`### Assistant\n\n${item.text.trim()}`);
      } else if (item?.type === 'thinking') {
        const n = item.thinking?.length ?? 0;
        lines.push(`_[thinking block, ${n} chars, discarded]_`);
      } else if (item?.type === 'tool_use') {
        lines.push(`- tool_use ${item.name ?? '(unknown)'} ${toolUseSummary(item.input)}`);
      } else if (item?.type === 'image') {
        lines.push(`_${IMAGE_STUB(item?.source?.data ? Math.ceil((item.source.data.length * 3) / 4) : 0)}_`);
      }
    }
    return { kind: lines.length ? 'retain' : 'discard', lines };
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
    return { kind: 'discard', lines: [] };
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
  };

  for (const entry of entries) {
    const type = entry?.type ?? '(no type)';
    stats.byType[type] = (stats.byType[type] ?? 0) + 1;

    const rule = RULES[type];
    if (!rule) {
      // AC3③：未知类型保守保留＋留痕，原样收整条 JSON，不摘要不静默丢弃。
      stats.byKind.unknown += 1;
      lines.push(`### ⚠️ UNKNOWN type=${type}\n\n\`\`\`json\n${JSON.stringify({ unknown: true, type, raw: entry })}\n\`\`\``);
      continue;
    }
    const { kind, lines: entryLines } = rule(entry);
    stats.byKind[kind] = (stats.byKind[kind] ?? 0) + 1;
    lines.push(...entryLines);
  }

  return { markdown: lines.join('\n\n'), stats };
}
