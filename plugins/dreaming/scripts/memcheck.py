"""Format and structure checks for a memory directory in Claude Code's native auto-memory format.

A memory file: frontmatter with `name`, `description` and `metadata.type` (user, feedback,
project or reference); other metadata keys are allowed. A retired file holds only the line
"MOVED TO [[slug]]". MEMORY.md: entry lines "- [Title](file.md) — hook"; headings, blockquotes and
blank lines are allowed; at most 200 lines and 25KB.
"""
import os
import re

TYPES = {"user", "feedback", "project", "reference"}
INDEX_LINES, INDEX_BYTES = 200, 25 * 1024
ENTRY_RE = re.compile(r"^- \[[^\]]+\]\(([^)]+\.md)\) — \S")
STUB_RE = re.compile(r"^MOVED TO \[\[([^\]]+)\]\]\s*$")


def frontmatter(text):
    """Top-level keys and the keys nested under metadata, from a simple YAML frontmatter block."""
    m = re.match(r"---\r?\n(.*?)\r?\n---\r?\n", text, re.S)
    if not m:
        return None
    top, meta, in_meta = {}, {}, False
    for line in m.group(1).splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if line[0] in " \t":
            if in_meta and ":" in line:
                k, v = line.strip().split(":", 1)
                meta[k.strip()] = v.strip()
            continue
        in_meta = False
        if ":" in line:
            k, v = line.split(":", 1)
            top[k.strip()] = v.strip()
            in_meta = k.strip() == "metadata" and not v.strip()
    top["metadata"] = meta
    return top


def check_file(path):
    with open(path, encoding="utf-8", errors="replace") as f:
        text = f.read()
    if STUB_RE.match(text.strip()):
        return []
    fm = frontmatter(text)
    if fm is None:
        return ["no frontmatter"]
    probs = []
    for k in ("name", "description"):
        if not fm.get(k):
            probs.append(f"frontmatter has no {k}")
    t = fm["metadata"].get("type")
    if t not in TYPES:
        probs.append(f"metadata.type is {t!r}, not one of {sorted(TYPES)}")
    if len(text.encode("utf-8")) > 100 * 1024:
        probs.append("over 100KB")
    return probs


def check_index(mem_dir):
    p = os.path.join(mem_dir, "MEMORY.md")
    if not os.path.exists(p):
        return ["no MEMORY.md"], {}
    with open(p, encoding="utf-8", errors="replace") as f:
        text = f.read()
    lines = text.splitlines()
    size = len(text.encode("utf-8"))
    probs, targets = [], []
    for ln in lines:
        s = ln.strip()
        if not s or s.startswith("#") or s.startswith(">"):
            continue
        m = ENTRY_RE.match(s)
        if not m:
            probs.append(f"index line not in the native format: {s[:80]}")
            continue
        targets.append(m.group(1))
    for t in targets:
        if not os.path.exists(os.path.join(mem_dir, t)):
            probs.append(f"index points to a missing file: {t}")
    if len(lines) > INDEX_LINES or size > INDEX_BYTES:
        probs.append(f"MEMORY.md is {len(lines)} lines / {size} bytes, over {INDEX_LINES} lines or {INDEX_BYTES} bytes")
    return probs, {"lines": len(lines), "bytes": size, "entries": len(targets)}


def check_dir(mem_dir):
    """All problems in one memory directory: {"index": [...], "files": {name: [...]}, "stats": {...}}."""
    index_probs, stats = check_index(mem_dir)
    files = {}
    listed = set()
    p = os.path.join(mem_dir, "MEMORY.md")
    if os.path.exists(p):
        with open(p, encoding="utf-8", errors="replace") as f:
            listed = {m.group(1) for m in (ENTRY_RE.match(l.strip()) for l in f) if m}
    for root, _, names in os.walk(mem_dir):
        for n in names:
            if not n.endswith(".md") or (root == mem_dir and n == "MEMORY.md"):
                continue
            full = os.path.join(root, n)
            rel = os.path.relpath(full, mem_dir).replace(os.sep, "/")
            probs = check_file(full)
            with open(full, encoding="utf-8", errors="replace") as f:
                is_stub = bool(STUB_RE.match(f.read().strip()))
            if not is_stub and rel not in listed:
                probs = probs + ["not listed in MEMORY.md"]
            if probs:
                files[rel] = probs
    return {"index": index_probs, "files": files, "stats": stats}
