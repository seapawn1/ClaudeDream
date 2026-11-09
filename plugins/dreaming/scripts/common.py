"""Shared paths and helpers for the ClaudeDream plugin scripts (stdlib only)."""
import json
import os
import shlex
import time

HOME = os.path.expanduser("~")
DREAM_HOME = os.environ.get("CLAUDE_DREAM_HOME") or os.path.join(HOME, ".claude-dream")  # env: tests
RUNS_DIR = os.path.join(DREAM_HOME, "runs")
ACTIVE_DIR = os.path.join(DREAM_HOME, "active")
REGISTRY = os.path.join(DREAM_HOME, "registry.jsonl")


def config_dir():
    """The current Claude Code config dir: CLAUDE_CONFIG_DIR if set, else ~/.claude."""
    env = os.environ.get("CLAUDE_CONFIG_DIR")
    return os.path.abspath(os.path.expanduser(env)) if env else os.path.join(HOME, ".claude")


def resolve_projects_dir(arg=None, config_dir_arg=None):
    """PBI-012: the one directory to read session transcripts from.

    --projects-dir, if given, and only that directory; else <--config-dir>/projects; else
    <current config dir>/projects.
    """
    if arg:
        return os.path.abspath(os.path.expanduser(arg))
    if config_dir_arg:
        return os.path.join(os.path.abspath(os.path.expanduser(config_dir_arg)), "projects")
    return os.path.join(config_dir(), "projects")


def routing_config_dir(projects_arg=None, config_dir_arg=None):
    """PBI-012: the config dir memory routing uses, and where that came from.

    A project without autoMemoryDirectory keeps its memory under <config dir>/projects/<path>/memory, and the
    user-level settings are <config dir>/settings.json. When the transcripts come from another account's (or
    another place's) config dir, the memory belongs there too:
      1. --config-dir, if given;
      2. else the parent of --projects-dir, when that directory is named "projects";
      3. else the current config dir (what it was before --projects-dir could point elsewhere).
    Returns (path, source) with source "--config-dir", "parent of --projects-dir" or "current config dir"."""
    if config_dir_arg:
        return os.path.abspath(os.path.expanduser(config_dir_arg)), "--config-dir"
    if projects_arg:
        p = os.path.abspath(os.path.expanduser(projects_arg))
        if os.path.normcase(os.path.basename(p)) == "projects":
            return os.path.dirname(p), "parent of --projects-dir"
    return config_dir(), "current config dir"


def routing_line(routing):
    """The one line that says where memory is resolved from, for the start and finish output."""
    if not routing:
        return "memory routing: not recorded (the run was started by an older version)"
    return f"memory routing: config dir {routing['config_dir']} (from {routing['source']})"


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


_PYTHON = ("python", "python.exe", "python3", "python3.exe", "py", "py.exe")
_OPTIONS = {"-I", "-u", "-B", "-E", "-s", "-S", "-O", "-OO", "-q"}  # -X takes a value, handled in the loop


def _shell_syntax(cmd):
    """True if the command has shell syntax that could chain, redirect or substitute commands: a line break or
    one of ; & | < > ` $ anywhere (both shells expand $ and ` inside double quotes), parentheses outside
    quotes, or a quote left open. Parentheses inside quotes are plain text (a path like Program Files (x86))."""
    quote = None
    for ch in cmd:
        if ch in "\n\r;&|<>`$":
            return True
        if quote:
            if ch == quote:
                quote = None
        elif ch in "'\"":
            quote = ch
        elif ch in "()":
            return True
    return quote is not None


def lead_script_command(command, scripts_dir=None, known=None):
    """The one rule for a shell command the lead of a run may run: python, only harmless options, and a script
    of the plugin, with arguments. With scripts_dir (the guard): the script is a .py file directly in that
    directory. Without it (the evidence check, which reads logs written under any install path): a .py file in
    a directory named scripts, whose name is in `known` when that is given."""
    cmd = (command or "").strip()
    if not cmd or _shell_syntax(cmd):
        return False
    try:
        parts = shlex.split(cmd.replace("\\", "/"))
    except ValueError:
        return False
    if not parts or os.path.basename(parts[0]).lower() not in _PYTHON:
        return False
    i = 1
    while i < len(parts) and parts[i].startswith("-"):
        if parts[i] == "-X" and i + 1 < len(parts):
            i += 2
            continue
        if parts[i] not in _OPTIONS:
            return False
        i += 1
    if i >= len(parts):
        return False
    script = os.path.normcase(os.path.normpath(parts[i]))
    name, folder = os.path.basename(script), os.path.dirname(script)
    if not name.endswith(".py"):
        return False
    if scripts_dir is not None:
        return folder == os.path.normcase(os.path.normpath(scripts_dir))
    return os.path.basename(folder) == "scripts" and (known is None or name in known)


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
