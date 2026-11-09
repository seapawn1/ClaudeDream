"""Every lead shell command in every hook log under ~/.claude-dream/runs through the evidence rule (and the pinned guard
rule with the command's own scripts directory): python -I replay_all_lead.py <plugin root>"""
import collections, glob, json, os, shlex, sys
sys.stdout.reconfigure(encoding="utf-8")
root = sys.argv[1]
sys.path.insert(0, os.path.join(root, "scripts"))
import common, dream
res, bad = collections.Counter(), []
for log in glob.glob(os.path.expanduser("~/.claude-dream/runs/*/hooklog.jsonl")):
    for line in open(log, encoding="utf-8"):
        if not line.strip():
            continue
        try:
            r = json.loads(line)
        except ValueError:
            res['(unparseable line)'] += 1
            continue
        if r.get("agent_id") or r.get("tool") not in ("Bash", "PowerShell"):
            continue
        cmd, dec = r.get("command"), r.get("decision")
        ev = dream.is_plugin_script(cmd)
        scripts_dir = None
        try:
            parts = shlex.split((cmd or "").replace("\\", "/"))
            script = next(p for p in parts[1:] if not p.startswith("-"))
            scripts_dir = os.path.dirname(script)
        except Exception:
            pass
        pinned = bool(scripts_dir) and common.lead_script_command(cmd, scripts_dir)
        res[(r.get("tool"), dec, ev, pinned)] += 1
        if (dec == "allow") != ev or (dec == "allow") != pinned:
            bad.append((dec, ev, pinned, (cmd or "")[:100]))
print("(tool, logged decision, evidence rule, pinned rule): count")
for k, v in sorted(res.items(), key=str):
    print(" ", k, v)
print("disagreements between the logged decision and the new rules:", len(bad))
for b in bad:
    print("  ", b)
