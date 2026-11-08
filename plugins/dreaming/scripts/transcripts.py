"""Read Claude Code session transcripts (jsonl) and render them in the cookbook's plain-text format.

The format follows the cookbook's analyzer prompt: a SESSION line, NOTE ABOUT THIS FILE lines, one
section per thread under "=== primary thread <id>: <agent> ===" or "=== sub-thread <id>: <agent> ===",
and blocks labelled USER:, AGENT:, TOOL CALL <tool>:, TOOL RESULT (<tool>): / [error]:, EVENT <type>:.
A text line that would read as a label or header is indented by one space. Thinking is not exported.

The transcript format is internal to Claude Code and changes between versions: record types this
module does not know are counted, never silently dropped from the count.
"""
import collections
import glob
import json
import os
import re

# Record types that carry no conversation content (metadata, bookkeeping, API mirrors).
SKIP_TYPES = {
    "api-request", "api-request-blob", "api-request-shape", "last-prompt", "atis-latch",
    "custom-title", "ai-title", "agent-name", "queue-operation", "mode", "permission-mode",
    "file-history-snapshot", "file-history-delta", "tools-used", "cost-state", "worktree-state",
    "relocated", "started", "result", "launched", "continued-in", "session-owner",
    "fork-context-ref", "summary",
}
# Attachment types that are user input; every other attachment is harness context.
USER_ATTACHMENTS = {"queued_command"}
NOTED_ATTACHMENTS = {"file", "edited_text_file"}
SKIP_SYSTEM = {"stop_hook_summary", "turn_duration", "api_error", "informational", "away_summary"}

LABEL_RE = re.compile(
    r"^(USER:|AGENT:|TOOL CALL |TOOL RESULT \(|THREAD MESSAGE |EVENT |=== |SESSION |NOTE ABOUT THIS FILE:)")
REMINDER_RE = re.compile(r"<system-reminder>.*?</system-reminder>\s*", re.S)


_READ_UPTO = {}
_LISTED = None


def reset_reads(listing=None):
    """Start a run: forget earlier reads; with `listing`, the files listed when the run started are
    the only ones it sees, so files created while it runs (new sessions, new subagents) wait for the
    next run instead of being half counted."""
    global _LISTED
    _READ_UPTO.clear()
    _LISTED = None if listing is None else {os.path.normcase(os.path.abspath(p)) for p in listing}


def listed(path):
    return _LISTED is None or os.path.normcase(os.path.abspath(path)) in _LISTED


def read_records(path):
    """The records of a jsonl transcript. A live session's file grows while it is read, and a run
    reads each file more than once (scan, convert, the reconciliation total): the first read stops
    at the end of the last complete line, and every later read until reset_reads() stops there too,
    so all of them see the same records."""
    key = os.path.normcase(os.path.abspath(path))
    with open(path, "rb") as fh:
        data = fh.read(_READ_UPTO[key]) if key in _READ_UPTO else fh.read()
    if key not in _READ_UPTO:
        cut = data.rfind(b"\n") + 1
        tail = data[cut:].strip()
        if tail:
            try:
                json.loads(tail.decode("utf-8", errors="replace"))
                cut = len(data)  # a complete last record without a newline
            except ValueError:
                pass  # a record still being written: left for the next run
        data = data[:cut]
        _READ_UPTO[key] = cut
    records, bad = [], 0
    for line in data.split(b"\n"):
        line = line.decode("utf-8", errors="replace").strip()
        if not line:
            continue
        try:
            records.append(json.loads(line))
        except ValueError:
            bad += 1
    return records, bad


def measure(o):
    """Characters of a record's message content, counted the way the sprint's first survey did:
    text, tool_use input as JSON, tool_result text (images count 0), string content. Thinking is
    not counted. Used to reconcile what came in with where it went."""
    m = o.get("message")
    if not isinstance(m, dict):
        return 0
    c = m.get("content")
    if isinstance(c, str):
        return len(c)
    n = 0
    for b in c if isinstance(c, list) else []:
        if not isinstance(b, dict):
            continue
        bt = b.get("type")
        if bt == "text":
            n += len(b.get("text", ""))
        elif bt == "tool_use":
            n += len(json.dumps(b.get("input", {}), ensure_ascii=False))
        elif bt == "tool_result":
            cc = b.get("content")
            if isinstance(cc, str):
                n += len(cc)
            elif isinstance(cc, list):
                n += sum(len(x.get("text", "")) for x in cc if isinstance(x, dict))
    return n


def escape(text):
    return "\n".join(" " + ln if LABEL_RE.match(ln) else ln for ln in text.split("\n"))


def block(label, body=""):
    body = escape(body.rstrip("\n")) if body else ""
    return f"{label}\n{body}" if body else label


def _text_of(content):
    """Text of a tool_result content: a string or a list of blocks."""
    if isinstance(content, str):
        return content
    parts = []
    for b in content or []:
        if not isinstance(b, dict):
            continue
        if b.get("type") == "text":
            parts.append(b.get("text", ""))
        elif b.get("type") == "image":
            parts.append("[image]")
        else:
            parts.append(f"[{b.get('type')}]")
    return "\n".join(parts)


def _call_fields(inp):
    lines = []
    for k, v in (inp or {}).items():
        if isinstance(v, str):
            lines.append(f"{k}:\n{v}" if "\n" in v else f"{k}: {v}")
        else:
            lines.append(f"{k}: {json.dumps(v, ensure_ascii=False)}")
    return "\n".join(lines)


def session_info(records, path):
    info = {"id": os.path.splitext(os.path.basename(path))[0], "title": None, "cwd": None,
            "branch": None, "created": None, "updated": None, "first_user": None}
    custom = ai = None
    for o in records:
        t = o.get("type")
        if t == "custom-title":
            custom = o.get("customTitle") or custom
        elif t == "ai-title":
            ai = o.get("aiTitle") or ai
        if o.get("cwd") and not info["cwd"]:
            info["cwd"] = o["cwd"]
        if o.get("gitBranch") and not info["branch"]:
            info["branch"] = o["gitBranch"]
        ts = o.get("timestamp")
        if isinstance(ts, str):
            info["created"] = info["created"] or ts
            info["updated"] = ts
        if t == "user" and info["first_user"] is None and not o.get("isMeta"):
            c = (o.get("message") or {}).get("content")
            if isinstance(c, str):
                info["first_user"] = c[:500]
            elif isinstance(c, list):
                txt = [b.get("text", "") for b in c if isinstance(b, dict) and b.get("type") == "text"]
                if txt:
                    info["first_user"] = txt[0][:500]
    info["title"] = custom or ai or "(untitled)"
    return info


def _clean(raw, ledger):
    """Strip system reminders and surrounding whitespace; book the removed characters."""
    cleaned = REMINDER_RE.sub("", raw)
    stripped = cleaned.strip()
    ledger["system_reminders"] += len(raw) - len(cleaned)
    ledger["whitespace"] += len(cleaned) - len(stripped)
    ledger["rendered"] += len(stripped)
    return stripped


def events(records, stats, ledger=None):
    """Turn one thread's records into events: dicts with label, body, uuid, ts, kind.

    ledger (a Counter) books every measured character (see measure) to exactly one bucket."""
    ledger = ledger if ledger is not None else collections.Counter()
    out, names = [], {}
    for o in records:
        t = o.get("type")
        uuid, ts = o.get("uuid"), o.get("timestamp")
        if t in SKIP_TYPES:
            stats["skipped:" + t] += 1
            ledger["skipped_record:" + t] += measure(o)
            continue
        if t in ("attachment", "system"):
            ledger["other_records"] += measure(o)
        if t == "attachment":
            a = o.get("attachment") or {}
            at = a.get("type")
            if at in USER_ATTACHMENTS and a.get("prompt"):
                out.append({"kind": "user", "label": "USER:", "body": str(a["prompt"]), "uuid": uuid, "ts": ts})
            elif at in NOTED_ATTACHMENTS:
                path = a.get("filename") or (a.get("content") or {}).get("file", {}).get("filePath")
                out.append({"kind": "event", "label": f"EVENT {at}: " + json.dumps({"path": path}, ensure_ascii=False),
                            "body": "", "uuid": uuid, "ts": ts})
            else:
                stats["skipped:attachment"] += 1
            continue
        if t == "system":
            sub = o.get("subtype")
            if sub == "compact_boundary":
                meta = o.get("compactMetadata") or {}
                out.append({"kind": "compact_boundary", "label": "EVENT compact_boundary: " + json.dumps(
                    {k: meta.get(k) for k in ("trigger", "preTokens", "postTokens")}), "body": "", "uuid": uuid, "ts": ts})
            elif sub == "local_command":
                body = REMINDER_RE.sub("", str(o.get("content") or ""))
                out.append({"kind": "event", "label": "EVENT local_command:", "body": body, "uuid": uuid, "ts": ts})
            elif sub in SKIP_SYSTEM:
                stats["skipped:system:" + str(sub)] += 1
            else:
                stats["unknown:system:" + str(sub)] += 1
            continue
        if t not in ("user", "assistant"):
            stats["unknown:" + str(t)] += 1
            ledger["unknown_record"] += measure(o)
            continue
        if o.get("isApiErrorMessage"):
            stats["skipped:api_error_message"] += 1
            ledger["api_error_messages"] += measure(o)
            continue
        content = (o.get("message") or {}).get("content")
        if t == "user":
            if o.get("isCompactSummary"):
                if isinstance(content, str):
                    text = REMINDER_RE.sub("", content)
                    ledger["system_reminders"] += len(content) - len(text)
                    ledger["rendered"] += len(text)
                else:
                    text = _text_of(content)
                    ledger["rendered"] += measure(o)
                out.append({"kind": "compact_summary", "label": "EVENT compact_summary:", "body": text,
                            "uuid": uuid, "ts": ts})
                continue
            if o.get("isMeta"):
                stats["skipped:meta_user"] += 1
                ledger["meta_user_messages"] += measure(o)
                continue
            if isinstance(content, str):
                text = _clean(content, ledger)
                if text:
                    out.append({"kind": "user", "label": "USER:", "body": text, "uuid": uuid, "ts": ts})
                continue
            texts = []
            for b in content or []:
                if not isinstance(b, dict):
                    continue
                bt = b.get("type")
                if bt == "tool_result":
                    tool = names.get(b.get("tool_use_id"), "unknown")
                    err = " [error]" if b.get("is_error") else ""
                    cc = b.get("content")
                    if isinstance(cc, str):
                        body = REMINDER_RE.sub("", cc)
                        ledger["system_reminders"] += len(cc) - len(body)
                        ledger["rendered"] += len(body)
                    else:
                        parts = []
                        for x in cc or []:
                            if isinstance(x, dict) and x.get("type") == "text":
                                raw = x.get("text", "")
                                cl = REMINDER_RE.sub("", raw)
                                ledger["system_reminders"] += len(raw) - len(cl)
                                ledger["rendered"] += len(cl)
                                parts.append(cl)
                            elif isinstance(x, dict):
                                parts.append(f"[{x.get('type')}]")
                                stats["non_text_result_blocks"] += 1
                        body = "\n".join(parts)
                    out.append({"kind": "tool_result", "label": f"TOOL RESULT ({tool}){err}:",
                                "body": body, "uuid": uuid, "ts": ts})
                elif bt == "text":
                    texts.append(_clean(b.get("text", ""), ledger))
                elif bt == "image":
                    texts.append("[image]")
                    stats["images"] += 1
            text = "\n".join(x for x in texts if x)
            if text:
                out.append({"kind": "user", "label": "USER:", "body": text, "uuid": uuid, "ts": ts})
            continue
        # assistant
        for b in content if isinstance(content, list) else [{"type": "text", "text": str(content or "")}]:
            if not isinstance(b, dict):
                continue
            bt = b.get("type")
            if bt == "text":
                txt = b.get("text", "")
                if txt.strip():
                    ledger["rendered"] += len(txt)
                    out.append({"kind": "agent", "label": "AGENT:", "body": txt, "uuid": uuid, "ts": ts})
                else:
                    ledger["whitespace"] += len(txt)
            elif bt == "tool_use":
                names[b.get("id")] = b.get("name")
                ledger["rendered"] += len(json.dumps(b.get("input", {}), ensure_ascii=False))
                out.append({"kind": "tool_call", "label": f"TOOL CALL {b.get('name')}:",
                            "body": _call_fields(b.get("input")), "uuid": uuid, "ts": ts})
            elif bt in ("thinking", "redacted_thinking"):
                stats["skipped:thinking"] += 1
                stats["thinking_chars"] += len(b.get("thinking", "") or "")
    for e in out:
        e["text"] = block(e["label"], e["body"])
    return out


def subagent_files(main_path):
    """Sub-thread transcripts of a session: <session>/subagents/**/agent-*.jsonl, oldest first."""
    base = main_path[:-len(".jsonl")]
    files = [f for f in glob.glob(os.path.join(base, "subagents", "**", "*.jsonl"), recursive=True) if listed(f)]
    return sorted(files, key=os.path.getmtime)


def subagent_meta(path):
    p = path[:-len(".jsonl")] + ".meta.json"
    try:
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def header_lines(info, notes):
    lines = [f"SESSION {info['id']}: {info['title']} (agent claude-code; created {info['created']})", ""]
    for n in notes:
        lines += [f"NOTE ABOUT THIS FILE: {n}", ""]
    return lines


def render(info, threads, notes):
    """threads: [(header, [event, ...]), ...] -> the file text."""
    lines = header_lines(info, notes)
    for head, evs in threads:
        lines += [head, ""]
        for e in evs:
            lines += [e["text"], ""]
    return "\n".join(lines).rstrip("\n") + "\n"


def new_stats():
    return collections.Counter()
