#!/usr/bin/env python3
"""梦引擎工程层：D1(简化触发) -> D2 快照 -> D4 机械体检 -> 调起梦 agent -> D9 审计/执行/提交。

用法: python run-dream.py <目标项目路径> [--model <model>] [--fuse-override N]

结构性安全设计（不是提示词约定，是能力剥夺）：
- 缴械: 梦 agent 经 --allowedTools 只拿到 Read/Glob/Grep + 路径受限的 Write/Edit + 只读 git；
  没有 rm、没有任意 Bash——LLM 在结构上无删除能力；
- 铁律: agent 只能把删除请求写进处置清单 .claude/dream/.disposals.json，
  引擎逐条校验（M4 conclusive 或 merged_from 登记）后代为执行，非法请求整单拒绝；
- 熔断: 请求删除数 > max(阀门 max_deletes, 库存10%) -> 整梦 reset 回快照；
- 阀门: claude_md_edits=false 时直接不发放 CLAUDE.md 的写权限，并在审计时兜底恢复。

原型简化声明: D1 触发用手动运行近似（SessionEnd hook + 冷却期 + hash 变化检测留产物阶段）；
`CLAUDE_DREAM=1` 环境变量是防递归占位。
"""

import argparse
import json
import math
import re
import shutil
import subprocess
import sys
from datetime import date
from pathlib import Path

ENGINE_DIR = Path(__file__).resolve().parent
SCOPE = [".claude/memory", ".claude/dream", "CLAUDE.md"]

DEFAULT_VALVE = {"enabled": "true", "claude_md_edits": "true",
                 "delete_policy": "quarantine-first", "max_deletes": "3",
                 "max_new_connections": "2", "llm_checks": "on"}


def sh(root: Path, *args: str, check: bool = True) -> str:
    p = subprocess.run(["git", "-C", str(root), *args], capture_output=True,
                       text=True, encoding="utf-8", errors="replace")
    if check and p.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} 失败: {p.stderr.strip()}")
    return p.stdout.strip()


def load_valve(root: Path) -> dict:
    valve = dict(DEFAULT_VALVE)
    vf = root / ".claude" / "claude-dream.local.md"
    if not vf.exists():
        vf.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(ENGINE_DIR / "valve-template.md", vf)
        print(f"[引擎] 阀门文件不存在，已从模板部署: {vf}")
    text = vf.read_text(encoding="utf-8")
    m = re.match(r"---\n(.*?)\n---", text, re.S)
    if m:
        for line in m.group(1).splitlines():
            if ":" in line and not line.strip().startswith("#"):
                k, v = line.split(":", 1)
                valve[k.strip()] = v.split("#")[0].strip()
    return valve


def memory_count(root: Path) -> int:
    mem = root / ".claude" / "memory"
    return len([f for f in mem.glob("*.md") if f.name != "MEMORY.md"])


def merged_from_slugs(root: Path) -> set:
    """扫描幸存记忆 frontmatter 的 merged_from 登记（合并删除的审计凭据）。"""
    slugs = set()
    for f in (root / ".claude" / "memory").glob("*.md"):
        head = f.read_text(encoding="utf-8")[:800]
        m = re.search(r"merged_from:\s*\[([^\]]*)\]", head)
        if m:
            slugs.update(s.strip().strip("\"'") for s in m.group(1).split(","))
        else:
            block = re.search(r"merged_from:\s*\n((?:\s+-\s+.+\n?)+)", head)
            if block:
                slugs.update(l.strip()[2:].strip() for l in block.group(1).splitlines() if l.strip())
    return slugs


def build_prompt(valve: dict, mchecks: dict, snapshot: str, today: str,
                 fuse_limit: int, prev_reports: list) -> str:
    template = (ENGINE_DIR / "dream-prompt.md").read_text(encoding="utf-8")
    body = template.split("\n---\n", 1)[1]
    prev_note = ("上梦报告: " + ", ".join(prev_reports)) if prev_reports else "本次是第一梦，无上梦报告"
    valve_yaml = "\n".join(f"{k}: {v}" for k, v in valve.items())
    return (body.replace("{DATE}", today)
                .replace("{SNAPSHOT}", snapshot)
                .replace("{VALVE_YAML}", valve_yaml)
                .replace("{FUSE_LIMIT}", str(fuse_limit))
                .replace("{MAX_CONNECTIONS}", valve["max_new_connections"])
                .replace("{MCHECKS_JSON}", json.dumps(mchecks, ensure_ascii=False, indent=1))
                .replace("{PREV_REPORT_NOTE}", prev_note)
                .replace("{ENABLED}", valve["enabled"])
                .replace("{CLAUDE_MD_EDITS}", valve["claude_md_edits"])
                .replace("{DELETE_POLICY}", valve["delete_policy"])
                .replace("{MAX_DELETES}", valve["max_deletes"]))


def allowed_tools(valve: dict) -> str:
    rules = ["Read", "Glob", "Grep",
             "Write(.claude/memory/**)", "Edit(.claude/memory/**)",
             "Write(.claude/dream/**)", "Edit(.claude/dream/**)",
             "Bash(git log:*)", "Bash(git grep:*)", "Bash(git show:*)",
             "Bash(git diff:*)", "Bash(git status:*)"]
    if valve["claude_md_edits"] == "true":  # 关阀 = 结构上收回 CLAUDE.md 写权限
        rules += ["Edit(CLAUDE.md)", "Write(CLAUDE.md)"]
    return ",".join(rules)


def invoke_claude(root: Path, prompt: str, tools: str, model: str | None) -> str:
    exe = shutil.which("claude")
    if not exe:
        raise RuntimeError("找不到 claude CLI")
    cmd = [exe, "-p", "--allowedTools", tools]
    if model:
        cmd += ["--model", model]
    if exe.lower().endswith((".cmd", ".bat")):
        cmd = ["cmd", "/c"] + cmd
    print(f"[引擎] 调起梦 agent（工具白名单已缴械，{len(tools.split(','))} 条规则）...")
    p = subprocess.run(cmd, cwd=str(root), input=prompt, capture_output=True,
                       text=True, encoding="utf-8", errors="replace", timeout=2400)
    if p.returncode != 0:
        raise RuntimeError(f"claude -p 退出码 {p.returncode}: {p.stderr[-2000:]}")
    return p.stdout


def abort_dream(root: Path, snapshot: str, reason: str, today: str) -> None:
    """熔断/违纪：整梦回滚到快照，留一份熔断报告。"""
    sh(root, "reset", "--hard", snapshot)
    sh(root, "clean", "-fd", "--", ".claude/dream")
    report = root / ".claude" / "dream" / f"{today}-aborted.md"
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(f"# 梦中止 {today}\n\n本梦已整体回滚到快照 `{snapshot}`，记忆库未发生任何变化。\n\n原因：{reason}\n",
                      encoding="utf-8")
    sh(root, "add", "--", ".claude/dream")
    sh(root, "commit", "-m", f"dream: {today} 熔断中止（{reason.splitlines()[0]}）")
    print(f"[引擎] 梦中止并回滚: {reason}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("project_root")
    ap.add_argument("--model", default=None)
    ap.add_argument("--fuse-override", type=int, default=None,
                    help="测试用：强行改写熔断线（H4 熔断实测）")
    args = ap.parse_args()
    root = Path(args.project_root).resolve()
    today = date.today().isoformat()

    valve = load_valve(root)
    if valve["enabled"] != "true":
        print("[引擎] 阀门 enabled=false，不做梦。")
        return 0

    lib_size = memory_count(root)
    fuse_limit = args.fuse_override if args.fuse_override is not None \
        else max(int(valve["max_deletes"]), math.ceil(lib_size * 0.1))

    # D2 梦前快照（pathspec 限定，回滚锚点）
    (root / ".claude" / "dream").mkdir(parents=True, exist_ok=True)
    sh(root, "add", "-A", "--", *SCOPE)
    sh(root, "commit", "--allow-empty", "-m", f"dream: snapshot {today}")
    snapshot = sh(root, "rev-parse", "HEAD")
    print(f"[引擎] D2 快照: {snapshot[:10]} ｜ 库存 {lib_size} 条 ｜ 熔断线 {fuse_limit}")

    # D4 机械体检
    mc = subprocess.run([sys.executable, str(ENGINE_DIR / "m-checks.py"), str(root)],
                        capture_output=True, text=True, encoding="utf-8")
    if mc.returncode != 0:
        raise RuntimeError(f"m-checks 失败: {mc.stderr}")
    mchecks = json.loads(mc.stdout)
    conclusive = {c["file"] for c in mchecks["m4_dead_entities"] if c["level"] == "conclusive"}
    print(f"[引擎] D4 机械体检: M1={len(mchecks['m1_broken_links'])} "
          f"M4确凿={len(conclusive)} M5漂移={len(mchecks['m5_index_drift']['missing_in_index']) + len(mchecks['m5_index_drift']['dangling_index_entries'])}")

    if valve["llm_checks"] != "on":
        print("[引擎] llm_checks=off：纯机械梦（原型仅落体检报告，不处置）。")
        (root / ".claude" / "dream" / f"{today}-mechanical.md").write_text(
            "# 机械梦报告（llm_checks=off）\n\n```json\n"
            + json.dumps(mchecks, ensure_ascii=False, indent=2) + "\n```\n", encoding="utf-8")
        sh(root, "add", "--", ".claude/dream")
        sh(root, "commit", "-m", f"dream: {today} 纯机械体检")
        return 0

    # D3/D5-D8 梦 agent
    prev = sorted(p.name for p in (root / ".claude" / "dream").glob("*.md"))
    prompt = build_prompt(valve, mchecks, snapshot, today, fuse_limit, prev)
    stdout = invoke_claude(root, prompt, allowed_tools(valve), args.model)
    print(f"[引擎] 梦 agent 收尾输出: {stdout.strip().splitlines()[-1] if stdout.strip() else '(空)'}")

    # ---- D9 审计与执行 ----
    # 1) 处置清单：铁律校验后由引擎代为删除
    disposals_file = root / ".claude" / "dream" / ".disposals.json"
    disposals = []
    if disposals_file.exists():
        disposals = json.loads(disposals_file.read_text(encoding="utf-8"))

    if len(disposals) > fuse_limit:  # 熔断
        abort_dream(root, snapshot,
                    f"熔断：请求删除 {len(disposals)} 条 > 熔断线 {fuse_limit}（max({valve['max_deletes']}, 库存10%)）",
                    today)
        return 2

    if valve["delete_policy"] == "report-only" and disposals:
        abort_dream(root, snapshot, "违纪：delete_policy=report-only 下仍开出处置清单", today)
        return 3

    merged = merged_from_slugs(root)
    for d in disposals:  # 铁律：每笔删除必须有机械确凿证据或合并登记
        fname = Path(d["file"]).name
        legit = fname in conclusive or Path(fname).stem in merged
        if not legit:
            abort_dream(root, snapshot,
                        f"铁律违反：请求删除 {fname}，既不在 M4 确凿清单也无 merged_from 登记", today)
            return 3

    for d in disposals:
        target = root / ".claude" / "memory" / Path(d["file"]).name
        if target.exists():
            target.unlink()
    if disposals:
        print(f"[引擎] 铁律校验通过，执行删除 {len(disposals)} 条: "
              + ", ".join(Path(d['file']).name for d in disposals))
    if disposals_file.exists():
        disposals_file.unlink()  # 清单是过程件，不入提交

    # 2) 阀门兜底：关阀时 CLAUDE.md 必须零改动（权限层已挡，git 层再验）
    if valve["claude_md_edits"] != "true":
        if sh(root, "diff", "--name-only", snapshot, "--", "CLAUDE.md"):
            sh(root, "checkout", snapshot, "--", "CLAUDE.md")
            print("[引擎] 阀门兜底：CLAUDE.md 改动已恢复（claude_md_edits=false）")

    # 3) 势力范围兜底：范围外被改的已跟踪文件一律恢复
    dirty = [l[3:] for l in sh(root, "status", "--porcelain").splitlines()]
    out_of_scope = [f for f in dirty
                    if not any(f.startswith(s) or f == "CLAUDE.md" for s in SCOPE)]
    for f in out_of_scope:
        sh(root, "checkout", "--", f, check=False)
        print(f"[引擎] 越界改动已恢复: {f}")

    # 4) 契约校验：MEMORY.md 双向对账
    mc2 = subprocess.run([sys.executable, str(ENGINE_DIR / "m-checks.py"), str(root)],
                         capture_output=True, text=True, encoding="utf-8")
    drift = json.loads(mc2.stdout)["m5_index_drift"]
    if drift["missing_in_index"] or drift["dangling_index_entries"]:
        print(f"[引擎] 警告：梦后索引仍有漂移 {drift}（记入人工复核）")

    # 5) dream: 单提交 = 回滚原子
    diff_stat = sh(root, "diff", "--name-status", snapshot, "--", *SCOPE)
    quarantined = sh(root, "diff", snapshot, "--unified=0", "--", ".claude/memory"
                     ).count("+status: quarantined")
    new_conn = len([l for l in diff_stat.splitlines() if l.startswith("A") and "connection-" in l])
    merged_n = len([d for d in disposals if str(d.get("criterion", "")).lower().startswith("merge")])
    deleted_n = len(disposals) - merged_n
    sh(root, "add", "-A", "--", *SCOPE)
    sh(root, "commit", "--allow-empty", "-m",
       f"dream: {today} 删{deleted_n} 合{merged_n} 连{new_conn} 隔离{quarantined}")
    dream_commit = sh(root, "rev-parse", "--short", "HEAD")

    # 6) SessionStart 提示行（原型：落文件+打印；产物阶段由 hook 注入）
    reports = [p.name for p in (root / ".claude" / "dream").glob(f"{today}*.md")]
    summary = (f"昨夜做了一场梦：删 {deleted_n} · 合 {merged_n} · 新连接 {new_conn} · 隔离 {quarantined}"
               f"，报告 -> .claude/dream/{reports[0] if reports else '(未找到)'}")
    (root / ".claude" / "dream" / "latest.txt").write_text(summary + "\n", encoding="utf-8")
    print(f"[引擎] D9 完成。dream 提交 {dream_commit}（快照 {snapshot[:10]}）")
    print(f"[引擎] {summary}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
