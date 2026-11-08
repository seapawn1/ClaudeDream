"""Which memory directory a session belongs to, by the same rules native auto memory uses.

1. autoMemoryDirectory from the session's settings: <cwd>/.claude/settings.local.json, then
   <cwd>/.claude/settings.json, then the user's <config dir>/settings.json. (Claude Code reads the
   project files from the session's primary working directory; local beats project beats user.)
2. Otherwise the default: <config dir>/projects/<project>/memory/, where <project> is the git
   repository root of the cwd (worktrees and subdirectories share it; a worktree maps to its main
   checkout), or the cwd itself outside a git repository, with every non-alphanumeric character
   replaced by "-".
Managed (policy) settings are not read; on this machine none set autoMemoryDirectory.
"""
import json
import os
import re

import common


def sanitize(path):
    """Claude Code's project directory name for a path (names over 200 chars are not handled)."""
    return re.sub(r"[^A-Za-z0-9]", "-", path)


def _read_setting(path, key):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f).get(key)
    except (OSError, ValueError, AttributeError):
        return None  # missing, empty or broken files are ignored, as Claude Code does


def _expand(value):
    return os.path.normpath(os.path.expanduser(value))


def git_root(cwd):
    """The main checkout's root for cwd, or None outside a git repository.

    Works from the path alone when the directory no longer exists (temp dirs, removed worktrees).
    """
    norm = os.path.normpath(cwd)
    m = re.search(r"[\\/]\.claude[\\/]worktrees[\\/]", norm)
    if m:  # a Claude Code worktree: its main checkout is the path before .claude/worktrees
        return norm[: m.start()]
    d = norm
    while True:
        g = os.path.join(d, ".git")
        if os.path.isdir(g):
            return d
        if os.path.isfile(g):  # a worktree or submodule: gitdir: <main>/.git/worktrees/<name>
            try:
                with open(g, encoding="utf-8") as f:
                    line = f.read().strip()
            except OSError:
                return d
            if line.startswith("gitdir:"):
                target = os.path.normpath(line[len("gitdir:"):].strip())
                m = re.search(r"[\\/]\.git[\\/]worktrees[\\/]", target)
                if m:
                    return target[: m.start()]
            return d
        parent = os.path.dirname(d)
        if parent == d:
            return None
        d = parent


def memory_dir(cwd, config_dir=None):
    """Return (memory_dir, rule) for a session that started in cwd."""
    config_dir = config_dir or common.config_dir()
    for name in ("settings.local.json", "settings.json"):
        v = _read_setting(os.path.join(cwd, ".claude", name), "autoMemoryDirectory")
        if v:
            return _expand(v), f"autoMemoryDirectory in {os.path.join(cwd, '.claude', name)}"
    root = git_root(cwd)
    if root and os.path.normcase(root) != os.path.normcase(os.path.normpath(cwd)):
        # a worktree or subdirectory: Claude Code may also read the main checkout's local file
        v = _read_setting(os.path.join(root, ".claude", "settings.local.json"), "autoMemoryDirectory")
        if v:
            return _expand(v), f"autoMemoryDirectory in {os.path.join(root, '.claude', 'settings.local.json')}"
    v = _read_setting(os.path.join(config_dir, "settings.json"), "autoMemoryDirectory")
    if v:
        return _expand(v), "autoMemoryDirectory in user settings"
    base = root or os.path.normpath(cwd)
    return (os.path.join(config_dir, "projects", sanitize(base), "memory"),
            "default: git root" if root else "default: working directory")
