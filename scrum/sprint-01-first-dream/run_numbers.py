"""Sprint 01 working file: the numbers of a CLI or desktop run, from its own records (lead and agent models,
agents, minutes, tokens, write calls by tool_use id, tool errors, hook evidence). Item 9 and item 8 figures in 3.2
come from here. Run from the repository root; run ids are check-... or dream-... names under ~/.claude-dream/runs.

  python -I scrum/sprint-01-first-dream/run_numbers.py check-20261109-133655 dream-20261109-140922 ...
"""
import collections, glob, json, os, re, sys
from datetime import datetime
sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "plugins", "dreaming", "scripts"))
import common, dream

MODEL = re.compile(r'"model":"([^"]+)"')


def ts(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def lead_models(session_id):
    out = collections.Counter()
    for p in glob.glob(os.path.join(common.config_dir(), "projects", "*", session_id + ".jsonl")):
        seen = set()
        for line in open(p, encoding="utf-8", errors="replace"):
            if '"model"' not in line:
                continue
            o = json.loads(line)
            m = o.get("message") or {}
            if m.get("role") == "assistant" and m.get("model") and m.get("id") not in seen:
                seen.add(m.get("id"))
                out[m["model"]] += 1
    return dict(out)


def one(rid):
    run = json.load(open(os.path.join(common.RUNS_DIR, rid, "run.json"), encoding="utf-8"))
    print("=" * 78)
    print(rid, "| kind", run.get("kind", "dream"), "| sandbox", run.get("sandbox"), "| sessions", [s["session_id"][:8] for s in dream.run_sessions(run)])
    for s in dream.run_sessions(run):
        print("  lead models", s["session_id"][:8], lead_models(s["session_id"]))
    types, models, tok = collections.Counter(), collections.defaultdict(set), collections.Counter()
    errs, firsts, lasts, tools = collections.Counter(), [], [], collections.Counter()
    failed, started = [], 0
    rep_path = os.path.join(common.RUNS_DIR, rid, "check-report.json" if run.get("kind") == "check" else "run-report.json")
    upper = os.path.getmtime(rep_path) + 1 if os.path.exists(rep_path) else None
    for s in dream.run_sessions(run):
        for d in dream.workflow_dirs(s["session_id"], s["started_at"]):
            if upper and min(os.path.getmtime(os.path.join(d, n)) for n in os.listdir(d)) > upper:
                continue  # a later workflow of the same session (for example a check after this dream)
            labels = {}
            for line in open(os.path.join(d, "journal.jsonl"), encoding="utf-8"):
                r = json.loads(line)
                if r["type"] == "started":
                    labels[r["key"]] = r["label"]; started += 1
                elif r["type"] == "result" and r.get("result") is None:
                    failed.append(labels.get(r["key"]))
            for n in os.listdir(d):
                if not (n.startswith("agent-") and n.endswith(".jsonl")):
                    continue
                meta = json.load(open(os.path.join(d, n[:-6] + ".meta.json"), encoding="utf-8"))
                t = meta.get("agentType")
                types[t] += 1
                seen, seen_use, seen_res = set(), set(), set()  # a transcript can hold one record twice: count ids
                for line in open(os.path.join(d, n), encoding="utf-8", errors="replace"):
                    o = json.loads(line)
                    m = o.get("message") or {}
                    if o.get("timestamp"):
                        firsts.append(o["timestamp"]); lasts.append(o["timestamp"])
                    if m.get("role") == "assistant" and m.get("model"):
                        models[t].add(m["model"])
                    if m.get("usage") and m.get("id") not in seen:
                        seen.add(m.get("id"))
                        for k in ("input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens", "output_tokens"):
                            tok[k] += m["usage"].get(k) or 0
                    c = m.get("content")
                    for b in c if isinstance(c, list) else []:
                        if isinstance(b, dict) and b.get("type") == "tool_use" and b.get("id") not in seen_use:
                            seen_use.add(b.get("id"))
                            tools[b.get("name")] += 1
                        if (isinstance(b, dict) and b.get("type") == "tool_result" and b.get("is_error")
                                and b.get("tool_use_id") not in seen_res):
                            seen_res.add(b.get("tool_use_id"))
                            errs[str(b.get("content"))[:60]] += 1
    sessions_runs = [(x["session_id"], x["started_at"]) for x in dream.run_sessions(run)]
    calls = executed = 0
    for sid, since in sessions_runs:
        per, n_exec, _ = dream.agent_activity(sid, since)
        calls += sum(v["calls"] for v in per.values())
        executed += n_exec
    print("  write calls (Write/Edit, by tool_use id):", calls, "| refused by Claude Code's input checks:", calls - executed, "| past the checks:", executed)
    mins = round((ts(max(lasts)) - ts(min(firsts))).total_seconds() / 60, 1) if firsts else None
    print("  agents", dict(types), "| models", {k: sorted(v) for k, v in models.items()})
    print("  agent minutes (first to last record)", mins, "| started", started, "| failed (no result)", failed)
    print("  tokens", {k: f"{v / 1e6:.2f}M" for k, v in tok.items()}, "| tool calls", dict(tools))
    print("  tool errors", sum(errs.values()), dict(errs.most_common(4)))
    rep = os.path.join(common.RUNS_DIR, rid, "check-report.json" if run.get("kind") == "check" else "run-report.json")
    if os.path.exists(rep):
        r = json.load(open(rep, encoding="utf-8"))
        h = r.get("hook_log", {})
        print("  hook:", {k: h.get(k) for k in ("calls", "ok", "lead_ran_only_plugin_scripts", "agent_shell_attempts_blocked",
                                                 "network_or_mcp_attempts_blocked", "writes_allowed_outside_workdir",
                                                 "write_calls_missing_from_hook_log")})
        print("  report complete:", r.get("complete"), "| reported problems:", r.get("reported_problems"))
    else:
        print("  (no report file yet)")


for rid in sys.argv[1:]:
    one(rid)
