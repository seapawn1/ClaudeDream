#!/usr/bin/env python3
"""D4 机械体检：M1-M5，零 LLM。

用法: python m-checks.py <项目根路径> [--out 输出.json]

输出 JSON：每条候选带可复现证据（命令 + 输出）。
判据来源: Prototype-01-FirstDream/Sketches.md S6 表。
原型简化声明：M4 的实体抽取是原型级启发式（路径 + npm/pnpm 脚本命令），
不追求泛化；产物阶段需换成可配置的抽取器。
"""

import argparse
import json
import math
import re
import subprocess
import sys
from pathlib import Path

LINK_RE = re.compile(r"\[\[([\w-]+)\]\]")
INDEX_LINK_RE = re.compile(r"\]\(([\w./-]+\.md)\)")
PATH_RE = re.compile(r"\b((?:src|scripts|config|test|tests|docs)/[\w./-]+\.\w{1,5})\b")
CMD_RE = re.compile(r"\b((?:npm|pnpm|yarn) run [\w:-]+)\b")
ORPHAN_MIN_LIBRARY = 15  # 小库冷启动禁用 M2（Sketches 风险 R3）


def run_git(root: Path, *args: str) -> tuple[str, str]:
    """返回 (输出, 可复现命令字符串)。"""
    cmd = ["git", "-C", str(root), *args]
    p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    return p.stdout.strip(), "git " + " ".join(args)


def parse_frontmatter(text: str) -> dict:
    """极简 frontmatter 解析：name/description/metadata.type/metadata.sources，不依赖 pyyaml。"""
    fm = {"name": None, "type": None, "sources": []}
    if not text.startswith("---"):
        return fm
    end = text.find("\n---", 3)
    if end == -1:
        return fm
    in_sources = False
    for line in text[3:end].splitlines():
        stripped = line.strip()
        if in_sources:
            if stripped.startswith("- "):
                fm["sources"].append(stripped[2:].strip().strip("\"'"))
                continue
            in_sources = False
        if stripped.startswith("name:"):
            fm["name"] = stripped[5:].strip()
        elif stripped.startswith("type:"):
            fm["type"] = stripped[5:].strip()
        elif stripped.startswith("sources:"):
            rest = stripped[8:].strip()
            if not rest:
                in_sources = True
    return fm


def body_of(text: str) -> str:
    if text.startswith("---"):
        end = text.find("\n---", 3)
        if end != -1:
            return text[end + 4:]
    return text


def check_m4_entity(root: Path, token: str) -> dict | None:
    """实体 0 命中 → 候选；git 讣告可查 → 确凿。返回 None 表示实体仍存活。"""
    is_path = "/" in token and not token.startswith(("npm", "pnpm", "yarn"))
    if is_path:
        if (root / token).exists():
            return None
        grep_out, grep_cmd = run_git(root, "grep", "-c", token, "--", ":!.claude")
        if grep_out:  # 代码里仍被引用（如迁移文档），不算失效
            return None
        obit_out, obit_cmd = run_git(root, "log", "--diff-filter=D", "--format=%h %ad %s",
                                     "--date=short", "--", token)
        level = "conclusive" if obit_out else "tentative"
        evidence = f"test -e {token} -> 不存在; {grep_cmd} -> 0 命中"
        if obit_out:
            evidence += f"; {obit_cmd} -> {obit_out.splitlines()[0]}（讣告）"
        return {"entity": token, "level": level, "evidence": evidence}
    # 命令类：脚本还在 package.json 里吗
    pkg = root / "package.json"
    script_name = token.split("run ", 1)[1]
    if pkg.exists() and f'"{script_name}"' in pkg.read_text(encoding="utf-8"):
        return None
    hist_out, hist_cmd = run_git(root, "log", "-S", script_name, "--format=%h %ad %s",
                                 "--date=short", "--", "package.json")
    level = "conclusive" if hist_out else "tentative"
    evidence = f'grep "{script_name}" package.json -> 0 命中'
    if hist_out:
        evidence += f"; {hist_cmd} -> {hist_out.splitlines()[0]}（移除记录）"
    return {"entity": token, "level": level, "evidence": evidence}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("project_root")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    root = Path(args.project_root).resolve()
    mem_dir = root / ".claude" / "memory"
    if not mem_dir.is_dir():
        print(f"错误: {mem_dir} 不存在", file=sys.stderr)
        return 1

    memories = {}  # slug -> {path, fm, body, links}
    for f in sorted(mem_dir.glob("*.md")):
        if f.name == "MEMORY.md":
            continue
        text = f.read_text(encoding="utf-8")
        memories[f.stem] = {
            "file": f.name,
            "fm": parse_frontmatter(text),
            "body": body_of(text),
            "links": LINK_RE.findall(body_of(text)),
        }

    report = {"library_size": len(memories), "m1_broken_links": [], "m2_orphans": {},
              "m3_dangling_sources": [], "m4_dead_entities": [], "m5_index_drift": {}}

    # M1 断链：[[slug]] 指向的文件不存在
    for slug, m in memories.items():
        for target in m["links"]:
            if target not in memories:
                report["m1_broken_links"].append({
                    "file": m["file"], "target": f"[[{target}]]",
                    "evidence": f"test -e .claude/memory/{target}.md -> 不存在"})

    # M2 孤儿：仅观察不开票（大库里无边是常态，不是腐烂证据；小库整体禁用）
    if len(memories) < ORPHAN_MIN_LIBRARY:
        report["m2_orphans"] = {"status": "disabled", "reason": f"库存 <{ORPHAN_MIN_LIBRARY}，冷启动禁用"}
    else:
        linked = set()
        for slug, m in memories.items():
            if m["links"]:
                linked.add(slug)
                linked.update(t for t in m["links"] if t in memories)
        orphans = sorted(set(memories) - linked)
        report["m2_orphans"] = {"status": "observation_only", "count": len(orphans),
                               "note": "背景观察，不构成处置候选", "files": orphans}

    # M3 悬空溯源：sources 指向的文件已消失
    for slug, m in memories.items():
        for src in m["fm"]["sources"]:
            if not (root / src).exists():
                report["m3_dangling_sources"].append({
                    "file": m["file"], "source": src,
                    "evidence": f"test -e {src} -> 不存在"})

    # M4 实体失效 + git 讣告分级
    for slug, m in memories.items():
        tokens = set(PATH_RE.findall(m["body"])) | set(CMD_RE.findall(m["body"]))
        for token in sorted(tokens):
            hit = check_m4_entity(root, token)
            if hit:
                report["m4_dead_entities"].append({"file": m["file"], **hit})

    # M5 索引漂移：MEMORY.md 双向对账
    index_file = mem_dir / "MEMORY.md"
    indexed = set()
    if index_file.exists():
        indexed = {Path(p).stem for p in INDEX_LINK_RE.findall(index_file.read_text(encoding="utf-8"))}
    report["m5_index_drift"] = {
        "auto_fixable": True,
        "missing_in_index": sorted(set(memories) - indexed),
        "dangling_index_entries": sorted(indexed - set(memories)),
    }

    report["fuse_reference"] = {"note": "熔断线 = max(阀门 max_deletes, 库存 10%)",
                                "ten_percent": math.ceil(len(memories) * 0.1)}

    out = json.dumps(report, ensure_ascii=False, indent=2)
    if args.out:
        Path(args.out).write_text(out, encoding="utf-8")
    print(out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
