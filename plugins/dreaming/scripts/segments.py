"""Fork de-duplication and cutting sessions into segments for the analyzers.

De-duplication (one run): a forked session copies its parent's messages with the same uuids. Each
uuid is rendered in one session only, its owner: the copy whose record still carries its own
file's sessionId (the original), else the copy in the session that started first.

Segments: a session's threads are packed into parts of at most `budget` characters. A compaction
boundary always starts a new part. Every part after a compaction carries Claude Code's own
compaction summary of what came before, as context. Tool results longer than `max_event` are cut
to their head and tail, with a line saying how much was left out.
"""
import collections

import transcripts as tx

MAX_EVENT = 20_000
HEAD, TAIL = 16_000, 3_000
MAX_SUMMARY = 30_000
WRAP = 2_000  # the Read tool cuts very long lines; wrap them


def uuid_index(sid, records):
    """The light per-session data owner_map needs: [(uuid, record sessionId, index)]."""
    return [(o.get("uuid"), o.get("sessionId"), i) for i, o in enumerate(records)
            if o.get("uuid") and o.get("type") in ("user", "assistant", "system", "attachment")]


def owner_map(sessions):
    """sessions: [(session_id, first_ts, uuid_index)] -> {uuid: owner session_id}."""
    copies = collections.defaultdict(list)
    for sid, first_ts, index in sessions:
        for u, rec_sid, i in index:
            copies[u].append((sid, rec_sid, first_ts or "", i))
    owners = {}
    for u, cs in copies.items():
        if len(cs) == 1:
            owners[u] = cs[0][0]
            continue
        own = [c for c in cs if c[0] == c[1]]
        if len(own) == 1:  # the one copy still carrying its own file's sessionId is the original
            owners[u] = own[0][0]
            continue
        files = {c[0] for c in cs}
        named = collections.Counter(c[1] for c in cs if c[1] in files and c[1] != c[0])
        if named:  # copies that kept the parent's sessionId point at the original
            owners[u] = named.most_common(1)[0][0]
            continue
        owners[u] = min(cs, key=lambda c: (c[2], c[3], c[0]))[0]
    return owners


def dedup(sid, records, owners, ledger=None):
    """Drop records another session owns. Returns (kept, dropped_by_owner, last_summary_before_kept)."""
    kept, dropped = [], collections.Counter()
    last_summary, summary_before_first_kept = None, None
    for o in records:
        if o.get("type") == "user" and o.get("isCompactSummary"):
            c = (o.get("message") or {}).get("content")
            last_summary = c if isinstance(c, str) else tx._text_of(c)
        u = o.get("uuid")
        if u and owners.get(u, sid) != sid:
            dropped[owners[u]] += 1
            if ledger is not None:
                ledger["fork_copies"] += tx.measure(o)
            continue
        if not kept:
            summary_before_first_kept = last_summary if not o.get("isCompactSummary") else None
        kept.append(o)
    return kept, dropped, summary_before_first_kept


def _wrap(text):
    out = []
    for ln in text.split("\n"):
        while len(ln) > WRAP:
            out.append(ln[:WRAP])
            ln = ln[WRAP:]
        out.append(ln)
    return "\n".join(out)


def shape(event, stats):
    """Cut an over-long tool result, wrap long lines, and re-render the block."""
    body = event["body"]
    if event["kind"] == "tool_result" and len(body) > MAX_EVENT:
        cut = len(body) - HEAD - TAIL
        body = body[:HEAD] + f"\n[... {cut} characters of this tool result left out ...]\n" + body[-TAIL:]
        stats["truncated_results"] += 1
        stats["truncated_chars"] += cut
    event["text"] = tx.block(event["label"], _wrap(body))
    return event


def summary_event(text):
    text = text or ""
    if len(text) > MAX_SUMMARY:
        text = text[:MAX_SUMMARY] + f"\n[... {len(text) - MAX_SUMMARY} characters of the summary left out ...]"
    return {"kind": "carried_summary", "label": "EVENT compact_summary:", "body": text,
            "text": tx.block("EVENT compact_summary:", _wrap(text))}


def check_carried(parts, first_summary=None):
    """PBI-001 acceptance criterion 3, recomputed from the parts themselves: every part after a
    compaction opens with the latest summary before it (its own boundary, or a carried copy).
    Returns a list of problems."""
    problems, latest = [], first_summary
    for k, p in enumerate(parts, 1):
        evs = [e for _, es in p["sections"] for e in es]
        carried = [e for e in evs if e["kind"] == "carried_summary"]
        real = [e for e in evs if e["kind"] != "carried_summary"]
        if real and real[0]["kind"] == "compact_boundary":
            if carried:
                problems.append(f"part {k}: starts at a compaction but also carries a summary")
        elif latest is not None:
            want = summary_event(latest)["body"]
            if len(carried) != 1 or carried[0]["body"] != want or evs[0] is not carried[0]:
                problems.append(f"part {k}: does not open with the latest compaction summary")
        elif carried:
            problems.append(f"part {k}: carries a summary although none came before it")
        for e in real:
            if e["kind"] == "compact_summary":
                latest = e["body"]
    return problems


def pack(threads, budget, first_summary=None):
    """threads: [(header, [event])] -> parts: [{"sections": [(header, [event])], "carried": bool, "chars": int}].

    Each event of the input lands in exactly one part (carried summaries are added copies).
    """
    parts = []
    summary = first_summary

    def new_part():
        p = {"sections": [], "carried": False, "chars": 0}
        parts.append(p)
        return p

    primary = threads[0][0] if threads else ""
    cur = None
    for header, evs in threads:
        for e in evs:
            size = len(e["text"]) + 2
            boundary = e["kind"] == "compact_boundary"
            need_new = cur is None or boundary or (cur["chars"] + size > budget and cur["chars"] > 0)
            if need_new and not (boundary and cur is not None and cur["chars"] == 0):
                cur = new_part()
                if summary and not boundary:
                    s = summary_event(summary)
                    cur["sections"].append((primary, [s]))
                    cur["carried"] = True
                    cur["chars"] += len(primary) + len(s["text"]) + 4
            if not cur["sections"] or cur["sections"][-1][0] != header:
                cur["sections"].append((header, []))
                cur["chars"] += len(header) + 2
            cur["sections"][-1][1].append(e)
            cur["chars"] += size
            if e["kind"] == "compact_summary":
                summary = e["body"]
    return [p for p in parts if any(evs for _, evs in p["sections"])]
