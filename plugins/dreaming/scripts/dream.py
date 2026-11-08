"""ClaudeDream entry script. Sprint 01 skeleton: only `plan` exists so far.

  python dream.py plan <session_id> [--projects-dir PATH]
"""
import argparse
import glob
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402


def main(argv):
    ap = argparse.ArgumentParser(prog="dream.py")
    ap.add_argument("command", choices=["plan"])
    ap.add_argument("session_id")
    ap.add_argument("--projects-dir", default=None,
                    help="where to read session transcripts; default: <Claude Code config dir>/projects")
    a = ap.parse_args(argv)
    projects = common.resolve_projects_dir(a.projects_dir)
    if not os.path.isdir(projects):
        print(f"projects dir not found: {projects}")
        return 2
    mains = glob.glob(os.path.join(projects, "*", "*.jsonl"))
    print(f"projects_dir: {projects}")
    print(f"source: {'--projects-dir' if a.projects_dir else 'default (config dir)'}")
    print(f"project dirs with sessions: {len({os.path.dirname(m) for m in mains})}")
    print(f"main sessions: {len(mains)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
