"""Shared paths and helpers for the ClaudeDream plugin scripts (stdlib only)."""
import json
import os
import time

HOME = os.path.expanduser("~")
DREAM_HOME = os.path.join(HOME, ".claude-dream")
RUNS_DIR = os.path.join(DREAM_HOME, "runs")
ACTIVE_DIR = os.path.join(DREAM_HOME, "active")
REGISTRY = os.path.join(DREAM_HOME, "registry.jsonl")


def config_dir():
    """The current Claude Code config dir: CLAUDE_CONFIG_DIR if set, else ~/.claude."""
    env = os.environ.get("CLAUDE_CONFIG_DIR")
    return os.path.abspath(os.path.expanduser(env)) if env else os.path.join(HOME, ".claude")


def resolve_projects_dir(arg=None):
    """PBI-012: the one directory to read session transcripts from.

    With an argument, only that directory; without one, <config dir>/projects.
    """
    if arg:
        return os.path.abspath(os.path.expanduser(arg))
    return os.path.join(config_dir(), "projects")


def now_stamp():
    return time.strftime("%Y%m%d-%H%M%S")


def new_run(kind, session_id):
    """Create a run work dir and register the session that started it."""
    run_id = f"{kind}-{now_stamp()}"
    workdir = os.path.join(RUNS_DIR, run_id)
    os.makedirs(workdir, exist_ok=True)
    register({"kind": kind, "run_id": run_id, "session_id": session_id, "workdir": workdir})
    return run_id, workdir


def register(entry):
    """Append to the run registry; prepare.py excludes every registered session and dir."""
    os.makedirs(DREAM_HOME, exist_ok=True)
    entry = dict(entry, ts=time.strftime("%Y-%m-%dT%H:%M:%S"))
    with open(REGISTRY, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def activate(session_id, workdir, write_roots, plugin_root):
    """Turn the guard hook on for one session."""
    os.makedirs(ACTIVE_DIR, exist_ok=True)
    state = {
        "session_id": session_id,
        "workdir": workdir,
        "write_roots": [os.path.abspath(p) for p in write_roots],
        "plugin_root": os.path.abspath(plugin_root),
    }
    with open(os.path.join(ACTIVE_DIR, f"{session_id}.json"), "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=1)
    return state


def deactivate(session_id):
    p = os.path.join(ACTIVE_DIR, f"{session_id}.json")
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            state = json.load(f)
        os.remove(p)
        return state
    return None


def active_state(session_id):
    if not session_id:
        return None
    p = os.path.join(ACTIVE_DIR, f"{session_id}.json")
    if not os.path.exists(p):
        return None
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def within(path, roots):
    """True if path is inside one of roots (case-insensitive on Windows)."""
    if not path:
        return False
    p = os.path.normcase(os.path.abspath(path))
    for r in roots:
        r = os.path.normcase(os.path.abspath(r))
        try:
            if os.path.commonpath([p, r]) == r:
                return True
        except ValueError:  # different drives
            continue
    return False
