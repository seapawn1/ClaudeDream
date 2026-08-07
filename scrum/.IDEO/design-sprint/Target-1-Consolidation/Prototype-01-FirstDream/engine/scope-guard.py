#!/usr/bin/env python3
"""势力范围守门人（PreToolUse hook，安全阀 2 的实现层）。

为什么存在：`.claude` 是 Claude Code 的受保护路径，敏感检查先于一切 allow 规则，
headless 下等于写不进——官方放行通道只有 bypassPermissions 模式。
所以梦进程跑在 bypass 模式，本 hook 成为唯一守门人（hook 不是权限规则，bypass 不豁免它）：
deny-by-default，逐工具裁决。引擎的 D9 git 审计是第二道防线。

裁决表：
- Read/Glob/Grep/TodoWrite            -> allow（只读与自我管理）
- Write/Edit/NotebookEdit             -> 路径裁决：.claude/memory/、.claude/dream/ 内 allow；
                                         CLAUDE.md 看阀门（环境变量 DREAM_CLAUDE_MD_EDITS）；其余 deny
- Bash                                -> 仅只读 git 子命令（log/grep/show/diff/status/rev-parse/ls-files），
                                         且不得含 ; | & > 等链接重定向；其余 deny
- 其他一切工具（含 Task/WebFetch/...）-> deny
"""

import json
import os
import re
import sys
from pathlib import Path

ALWAYS_ALLOW = {"Read", "Glob", "Grep", "TodoWrite"}
FILE_TOOLS = {"Write", "Edit", "NotebookEdit", "MultiEdit"}
GIT_RO = re.compile(r"^git\s+(log|grep|show|diff|status|rev-parse|ls-files)\b[^;&|>]*$")


def judge_path(fp: str, cwd: Path) -> tuple[str, str]:
    p = Path(fp)
    if not p.is_absolute():
        p = cwd / p
    try:
        rel = p.resolve().relative_to(cwd).as_posix()
    except ValueError:
        return "deny", f"目标在项目外: {fp}"
    if rel.startswith((".claude/memory/", ".claude/dream/")):
        return "allow", "梦势力范围内"
    if rel == "CLAUDE.md":
        if os.environ.get("DREAM_CLAUDE_MD_EDITS", "true") == "true":
            return "allow", "CLAUDE.md 阀门开启"
        return "deny", "阀门 claude_md_edits=false：CLAUDE.md 一字不动，降级为报告建议"
    return "deny", f"梦势力范围外: {rel}（只可改 .claude/memory/、.claude/dream/、CLAUDE.md）"


def main() -> None:
    if os.environ.get("CLAUDE_DREAM") != "1":
        # 非梦进程：不输出任何决定（交回正常权限流程），守门人可常驻而不干扰日常会话
        return

    data = json.load(sys.stdin)
    tool = data.get("tool_name", "")
    cwd = Path(data.get("cwd", ".")).resolve()

    if tool in ALWAYS_ALLOW:
        decision, reason = "allow", "只读/自我管理工具"
    elif tool in FILE_TOOLS:
        decision, reason = judge_path(data.get("tool_input", {}).get("file_path", ""), cwd)
    elif tool == "Bash":
        cmd = data.get("tool_input", {}).get("command", "").strip()
        if GIT_RO.match(cmd):
            decision, reason = "allow", "只读 git"
        else:
            decision, reason = "deny", f"梦进程 Bash 仅限只读 git 子命令，拒绝: {cmd[:80]}"
    else:
        decision, reason = "deny", f"梦进程不发放此工具: {tool}"

    # 心跳日志：证明守门人在场（也是产物阶段的裁决审计线索）
    try:
        import tempfile
        with open(Path(tempfile.gettempdir()) / "scope-guard.log", "a", encoding="utf-8") as f:
            f.write(f"{tool}\t{decision}\t{reason}\n")
    except OSError:
        pass

    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": decision,
        "permissionDecisionReason": reason,
    }}, ensure_ascii=False))


if __name__ == "__main__":
    main()
