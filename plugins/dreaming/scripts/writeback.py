"""Checking a staged memory directory against its starting copy, writing it back, and restoring.

Per memory directory a run keeps three copies in its work dir:
  base/<key>    the real directory as it was when the run started (never touched);
  stage/<key>   the copy the agents worked on;
  backup/<key>  the real directory right before write-back (the rollback copy).
Write-back changes a real file only if it still equals its base copy: a file someone else changed
during the run is left alone and listed. Files are never deleted by write-back.
Restore puts the backup back, byte for byte, but first lists every file that changed after
write-back other than by this run, and leaves those alone unless forced.
"""
import hashlib
import json
import os
import re
import shutil

import memcheck

STUB_RE = re.compile(r"^MOVED TO \[\[([^\]]+)\]\]\s*$")


def tree(d):
    """{relative path: sha256} of every file under d."""
    out = {}
    if not os.path.isdir(d):
        return out
    for root, _, names in os.walk(d):
        for n in names:
            full = os.path.join(root, n)
            rel = os.path.relpath(full, d).replace(os.sep, "/")
            with open(full, "rb") as f:
                out[rel] = hashlib.sha256(f.read()).hexdigest()
    return out


def read(d, rel):
    with open(os.path.join(d, rel), encoding="utf-8", errors="replace") as f:
        return f.read()


def body_lines(text):
    """Fact-bearing lines of a memory file: the body without frontmatter, normalized."""
    m = re.match(r"---\r?\n.*?\r?\n---\r?\n", text, re.S)
    body = text[m.end():] if m else text
    return [re.sub(r"\s+", " ", ln).strip() for ln in body.splitlines()
            if ln.strip() and not ln.strip().startswith("#") and len(ln.strip()) > 3]


def slug_file(stage, slug):
    """The file a [[slug]] names: <slug>.md anywhere in the directory, or a file whose name: is slug."""
    for root, _, names in os.walk(stage):
        for n in names:
            if n == slug + ".md":
                return os.path.relpath(os.path.join(root, n), stage).replace(os.sep, "/")
    for root, _, names in os.walk(stage):
        for n in names:
            if n.endswith(".md"):
                rel = os.path.relpath(os.path.join(root, n), stage).replace(os.sep, "/")
                fm = memcheck.frontmatter(read(stage, rel)) or {}
                if fm.get("name") == slug:
                    return rel
    return None


def compare(base, stage):
    """What the run changed, and where every file that existed at the start went (acceptance 7)."""
    b, s = tree(base), tree(stage)
    added = sorted(set(s) - set(b))
    removed = sorted(set(b) - set(s))
    modified = sorted(r for r in set(b) & set(s) if b[r] != s[r])
    whereabouts, lost, thin = {}, [], []
    for rel in sorted(b):
        if not rel.endswith(".md") or rel == "MEMORY.md":
            continue
        if rel not in s:
            whereabouts[rel] = "missing"
            lost.append(rel)
            continue
        text = read(stage, rel)
        m = STUB_RE.match(text.strip())
        if not m:
            whereabouts[rel] = "kept" if b[rel] == s[rel] else "edited"
            continue
        if STUB_RE.match(read(base, rel).strip()):
            whereabouts[rel] = "stub already at start"
            continue
        target = slug_file(stage, m.group(1))
        if not target:
            whereabouts[rel] = f"moved to [[{m.group(1)}]], which does not exist"
            lost.append(rel)
            continue
        whereabouts[rel] = f"moved to {target}"
        old = body_lines(read(base, rel))
        new = set(body_lines(read(stage, target)))
        missing = [ln for ln in old if ln not in new]
        if old and len(missing) / len(old) > 0.1:
            thin.append({"file": rel, "target": target, "lines": len(old), "not_found": len(missing),
                         "examples": missing[:3]})
    return {"added": added, "modified": modified, "removed": removed, "whereabouts": whereabouts,
            "lost": lost, "moved_with_missing_lines": thin}


def claims_vs_diff(changes, diff, attempts):
    """The organizer's self-reported changes, checked against the real diff and against what the
    agents' own transcripts show (attempts: {file name: {"calls": n, "errors": [text]}}).

    Agent self-reports are never evidence; this lists the ones the record does not bear out."""
    touched = {os.path.basename(t) for t in set(diff["added"]) | set(diff["modified"])}
    failed = {f for f, a in attempts.items() if a.get("errors")}
    contradicted = []
    for c in changes or []:
        text = str(c)
        names = {os.path.basename(n) for n in re.findall(r"[\w\-./]+\.md", text)}
        if not names:
            continue
        if re.search(r"left (it )?as is|unchanged|no change|kept as|no merges|not changed|nothing to", text, re.I):
            continue  # a claim that nothing changed is consistent with an unchanged file
        if re.search(r"NOT DONE|refused|denied|permission", text, re.I):
            if not names & failed:
                contradicted.append({"claim": text, "why": "says a write failed, but no agent transcript shows a failed write to it"})
        elif not names & touched:
            contradicted.append({"claim": text, "why": "names files the diff shows unchanged"})
    return contradicted


def apply(base, stage, real, backup):
    """Write the staged directory back. Returns what was written and what was left alone."""
    b, s, r = tree(base), tree(stage), tree(real)
    if os.path.exists(backup):
        shutil.rmtree(backup)
    if os.path.isdir(real):
        shutil.copytree(real, backup)
    else:
        os.makedirs(backup)
    written, conflicts = [], []
    for rel, h in sorted(s.items()):
        if b.get(rel) == h:
            continue  # unchanged by the run
        if r.get(rel) != b.get(rel):
            conflicts.append(rel)  # changed elsewhere since the run started (or created elsewhere)
            continue
        dst = os.path.join(real, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(os.path.join(stage, rel), dst)
        written.append(rel)
    after = tree(real)
    return {"written": written, "conflicts": conflicts, "after": after}


def restore(real, backup, after, force=False):
    """Put the rollback copy back. `after` is the real tree recorded right after write-back."""
    now, bk = tree(real), tree(backup)
    foreign = sorted(rel for rel in set(now) | set(after) if now.get(rel) != after.get(rel))
    if foreign and not force:
        return {"restored": False, "changed_since_write_back": foreign}
    for rel in sorted(set(now) - set(bk)):
        if rel in after and now.get(rel) == after.get(rel):
            os.remove(os.path.join(real, rel))  # created by this run and untouched since
    for rel in bk:
        dst = os.path.join(real, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(os.path.join(backup, rel), dst)
    return {"restored": True, "identical": tree(real) == bk, "changed_since_write_back": foreign}


def save(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
