"""Sprint 01 smoke test: environment facts, guard hook, script write into a default memory dir.

  python smoke.py start <session_id>   -> prints facts, starts a guarded run
  python smoke.py finish <session_id>  -> summarizes the hook log, ends the run
"""
import glob
import json
import os
import platform
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402

PLUGIN_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# A default (no autoMemoryDirectory) memory dir that belongs to the Sprint 01 probe project.
PROBE_MEMORY = os.path.join(common.config_dir(), "projects",
                            "C--Users-seapawn-AppData-Local-Temp-claude-dream-probe", "memory")
LAST = os.path.join(common.DREAM_HOME, "smoke", "last-result.md")


def start(session_id):
    run_id, workdir = common.new_run("smoke", session_id)
    common.activate(session_id, workdir, [workdir], PLUGIN_ROOT)
    projects = common.resolve_projects_dir()
    n = len(glob.glob(os.path.join(projects, "*", "*.jsonl")))
    script_write = "fail"
    try:
        os.makedirs(PROBE_MEMORY, exist_ok=True)
        p = os.path.join(PROBE_MEMORY, "smoke-script.md")
        with open(p, "w", encoding="utf-8") as f:
            f.write("smoke script wrote this\n")
        script_write = "ok: " + p
    except OSError as e:
        script_write = f"fail: {e}"
    facts = {
        "WORKDIR": workdir,
        "python": sys.version.split()[0] + " at " + sys.executable,
        "python_on_path": shutil.which("python") or "not found",
        "platform": platform.platform(),
        "CLAUDE_CONFIG_DIR": os.environ.get("CLAUDE_CONFIG_DIR") or "(unset)",
        "projects_dir_default": projects,
        "projects_dir_main_sessions": n,
        "plugin_root": PLUGIN_ROOT,
        "script_write_default_memory_dir": script_write,
    }
    with open(os.path.join(workdir, "facts.json"), "w", encoding="utf-8") as f:
        json.dump(facts, f, ensure_ascii=False, indent=1)
    for k, v in facts.items():
        print(f"{k}: {v}")


def finish(session_id):
    state = common.deactivate(session_id)
    if not state:
        print("no active smoke run for this session")
        return
    workdir = state["workdir"]
    with open(os.path.join(workdir, "facts.json"), encoding="utf-8") as f:
        facts = json.load(f)
    log = []
    p = os.path.join(workdir, "hooklog.jsonl")
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            log = [json.loads(line) for line in f if line.strip()]
    lines = ["# ClaudeDream smoke test", ""]
    lines += [f"- {k}: {v}" for k, v in facts.items()]
    lines += ["", f"- hook fired: {'yes' if log else 'no'} ({len(log)} calls)", "",
              "| agent_type | tool | decision | path or command |", "| --- | --- | --- | --- |"]
    for r in log:
        target = (r.get("path") or r.get("command") or "").replace("|", "/")[:120]
        lines.append(f"| {r.get('agent_type') or 'lead'} | {r.get('tool')} | {r.get('decision')} | {target} |")
    files = sorted(os.listdir(workdir))
    lines += ["", "- files in workdir: " + ", ".join(files)]
    forbidden = os.path.join(common.DREAM_HOME, "smoke-forbidden.txt")
    lines.append(f"- forbidden file exists: {os.path.exists(forbidden)}")
    probe_file = os.path.join(PROBE_MEMORY, "smoke-script.md")
    if os.path.exists(probe_file):
        os.remove(probe_file)
        try:
            os.rmdir(PROBE_MEMORY)
        except OSError:
            pass
    text = "\n".join(lines) + "\n"
    with open(os.path.join(workdir, "result.md"), "w", encoding="utf-8") as f:
        f.write(text)
    os.makedirs(os.path.dirname(LAST), exist_ok=True)
    with open(LAST, "w", encoding="utf-8") as f:
        f.write(text)
    print(text)


if __name__ == "__main__":
    cmd, sid = sys.argv[1], sys.argv[2]
    start(sid) if cmd == "start" else finish(sid)
