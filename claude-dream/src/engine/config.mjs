// PBI-02.1：阀门配置——.claude/claude-dream.local.md 六键 YAML frontmatter 解析与解析顺序。
// 三条铁律（AC）：
//  1. 解析顺序：配置文件 > 环境变量 > 默认值。环境变量仅供测试/临时注入覆盖，
//     覆盖发生时 provenance 记 'env'，报告「阀门状态」节必须标注（不静默覆盖）。
//  2. enabled: false 时不拉梦，但底片产线独立于梦开关（消费点在 trigger-check.mjs）。
//  3. llm_checks 本轮 on/off 行为一致（LLM 层未交付），报告须如实标注——数据在 provenance 与
//     llm_checks 值里，渲染归 report.mjs。
//
// 为什么不引 YAML 库：六键全是扁平标量（布尔/整数/枚举词），手写一个极简 frontmatter 解析器
// 只需几十行且零依赖——本插件唯一依赖是 Agent SDK，不为六个键加一棵依赖树。
// 未知键静默忽略（如 PBI-07 的 max_new_connections 提前出现也不该报错）；值格式不合法一律
// 回退默认值并记入 notes（透明，报告渲染时可展示）。

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { DEFAULT_COOLDOWN_MINUTES } from '../lib/paths.mjs';

export const CONFIG_FILE_NAME = 'claude-dream.local.md';

/** 六键元数据：默认值 / 环境变量名 / 值解析器。解析器返回 { ok, value }。 */
export const VALVE_SPECS = {
  enabled: {
    default: true,
    env: 'CLAUDE_DREAM_ENABLED',
    parse: (raw) => parseBool(raw),
  },
  llm_checks: {
    default: 'on',
    env: 'CLAUDE_DREAM_LLM_CHECKS',
    parse: (raw) => parseEnum(raw, ['on', 'off']),
  },
  delete_policy: {
    default: 'quarantine-first',
    env: 'CLAUDE_DREAM_DELETE_POLICY',
    parse: (raw) => parseEnum(raw, ['quarantine-first', 'report-only']),
  },
  max_deletes: {
    default: 3,
    env: 'CLAUDE_DREAM_MAX_DELETES',
    parse: (raw) => parseNonNegativeInt(raw),
  },
  claude_md_edits: {
    default: true,
    env: 'DREAM_CLAUDE_MD_EDITS', // 沿用 Sprint-1 起的既有变量名，不另起炉灶
    parse: (raw) => parseBool(raw),
  },
  cooldown_minutes: {
    default: DEFAULT_COOLDOWN_MINUTES, // 沿用代码既有常量，不引入第二套默认值
    env: 'CLAUDE_DREAM_COOLDOWN_MINUTES', // 沿用 Sprint-1 起的既有变量名
    parse: (raw) => parseNonNegativeInt(raw),
  },
};

function parseBool(raw) {
  const v = String(raw).trim().toLowerCase();
  if (v === 'true') return { ok: true, value: true };
  if (v === 'false') return { ok: true, value: false };
  return { ok: false };
}

function parseNonNegativeInt(raw) {
  const v = String(raw).trim();
  if (/^\d+$/.test(v)) {
    const n = Number(v);
    if (Number.isSafeInteger(n) && n >= 0) return { ok: true, value: n };
  }
  return { ok: false };
}

function parseEnum(raw, allowed) {
  const v = String(raw).trim().toLowerCase();
  return allowed.includes(v) ? { ok: true, value: v } : { ok: false };
}

/**
 * 解析 .claude/claude-dream.local.md 的 YAML frontmatter（第一个 --- 到第二个 --- 之间）。
 * 返回 { raw: Record<key, string>, malformedLines: string[] }；文件不存在返回 raw={}。
 * 行无冒号 → malformedLines；值去引号、去注释（简单 # 截断——六键值不含 #，安全）。
 */
export function readConfigFile(root) {
  const filePath = path.join(root, '.claude', CONFIG_FILE_NAME);
  const result = { exists: false, raw: {}, malformedLines: [] };
  if (!existsSync(filePath)) return result;
  result.exists = true;

  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return result; // 读不出按不存在处理；异常详情调用方另有留痕通道
  }

  const lines = content.split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '---') { start = i; break; }
  }
  if (start === -1) return result; // 无 frontmatter：整个文件视为无效配置源

  let end = -1;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') { end = i; break; }
  }
  if (end === -1) return result; // 只有开头的 ---，没有收尾：同样视为无效配置源

  for (const line of lines.slice(start + 1, end)) {
    if (!line.trim()) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) { result.malformedLines.push(line); continue; }
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    // 去注释：值本身不含 #（六键枚举/布尔/数字），出现 # 一律按注释截断
    const hashIdx = value.indexOf('#');
    if (hashIdx !== -1) value = value.slice(0, hashIdx).trim();
    // 去引号（单双引号成对包裹时）
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    if (key) result.raw[key] = value;
  }
  return result;
}

/**
 * 解析完整阀门配置。
 * @returns {{
 *   values: Record<key, any>,
 *   provenance: Record<key, 'default'|'file'|'env'>,
 *   envOverriddenKeys: string[],   // 本次生效来自环境变量的键（AC4：报告必须标注）
 *   notes: string[],               // 值不合法回退默认等值得标注的事项
 *   configFileExists: boolean,
 * }}
 */
export function resolveConfig(root, env = process.env) {
  const file = readConfigFile(root);
  const values = {};
  const provenance = {};
  const envOverriddenKeys = [];
  const notes = [];

  for (const key of Object.keys(VALVE_SPECS)) {
    const spec = VALVE_SPECS[key];

    // 顺序一：配置文件
    let raw;
    if (key in file.raw) {
      raw = file.raw[key];
      const parsed = spec.parse(raw);
      if (parsed.ok) {
        values[key] = parsed.value;
        provenance[key] = 'file';
      } else {
        values[key] = spec.default;
        provenance[key] = 'file'; // 出处是文件，只是值不合法——如实记录出处，另记 note
        notes.push(`配置文件键 ${key} 的值不合法（"${raw}"），回退默认 ${spec.default}`);
      }
      continue; // 文件里有键就按文件结算（含回退），不再看环境变量？——不，环境变量优先级更高，见下
    }

    // 顺序二：环境变量（仅当文件无此键时——AC4 配置文件优先于环境变量）
    const envRaw = env[spec.env];
    if (envRaw !== undefined && envRaw !== '') {
      const parsed = spec.parse(envRaw);
      if (parsed.ok) {
        values[key] = parsed.value;
        provenance[key] = 'env';
        envOverriddenKeys.push(key);
      } else {
        values[key] = spec.default;
        provenance[key] = 'env';
        envOverriddenKeys.push(key);
        notes.push(`环境变量 ${spec.env} 的值不合法（"${envRaw}"），回退默认 ${spec.default}`);
      }
      continue;
    }

    values[key] = spec.default;
    provenance[key] = 'default';
  }

  if (file.malformedLines.length > 0) {
    notes.push(`配置文件 frontmatter 有 ${file.malformedLines.length} 行无法解析（无冒号），已跳过`);
  }

  return { values, provenance, envOverriddenKeys, notes, configFileExists: file.exists };
}
