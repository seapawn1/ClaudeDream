"""Provenance record of the plugin's two adapted agents: builds plugins/dreaming/agents/{analyzer,organizer}.md from
the prompts of Anthropic's "Dreaming with a dynamic workflow" cookbook (MIT, see the plugin's NOTICE;
references/dreaming-cookbook/example_data/memory_distill/prompts/) with a fixed list of changes, so every change from
the original is visible here. Change those two prompts here, not by hand in agents/: the output equals the committed
files (checked on 2026-11-09). checker.md is new and is not built from the cookbook.

  python -I tools/build_agents.py        (run from the repository root)
"""
import os

SRC = "references/dreaming-cookbook/example_data/memory_distill/prompts"
DST = "plugins/dreaming/agents"

NOTICE = """# Adapted from Anthropic's "Dreaming with a dynamic workflow" cookbook
# (anthropics/claude-cookbooks, managed_agents), MIT License, Copyright (c) 2023 Anthropic.
# Changes: paths and the memory format (Claude Code's native auto memory: frontmatter with
# metadata.type, MEMORY.md with "- [Title](file.md) — hook" lines). See the plugin's NOTICE."""

FRONTMATTER_OLD = """    ---
    name: <slug>
    description: <concise description of what this file covers and when to read it>
    metadata: <freeform, optional>
    ---"""
FRONTMATTER_NEW = """    ---
    name: <slug>
    description: <concise description of what this file covers and when to read it>
    metadata:
      type: <user, feedback, project or reference>
    ---"""
TYPES = ("  The type is one of: user (who the user is: role, expertise, preferences), feedback (guidance the "
         "user gave on how to work, corrections and confirmed approaches, with the reason), project (ongoing "
         "work, goals, decisions and constraints of the project) or reference (pointers to outside resources). "
         "Keep any other metadata fields a file already has.\n")


def build(name, header, changes):
    with open(os.path.join(SRC, name), encoding="utf-8") as f:
        text = f.read()
    for old, new in changes:
        assert text.count(old) >= 1, (name, old[:60])
        text = text.replace(old, new)
    assert "_index.md" not in text and "{mem_dir}" not in text and "/mnt/" not in text, name
    with open(os.path.join(DST, header[0]), "w", encoding="utf-8", newline="\n") as f:
        f.write("---\n" + NOTICE + "\n" + header[1] + "---\n\n" + text.strip() + "\n")


ANALYZER = [
    ("plus a shared memory directory mounted read-write.", "plus a shared memory directory that you read and write."),
    ("Transcript format: your assigned file is one of: a plain-text export of a Claude Managed Agents session; "
     "a JSON export of such a session; a JSON or JSONL log of Messages API or Agent SDK calls; or other plain "
     "text or Markdown, such as notes a developer kept or a transcript pasted from another tool.",
     "Transcript format: your assigned file is a plain-text export of a Claude Code session, or of one part of "
     "it when the session was long."),
    ("- `EVENT <type>:` — anything else, such as a thread being created or an error, with the event's fields as "
     "JSON on the same line.",
     "- `EVENT <type>:` — anything else, such as a thread being created or an error, with the event's fields as "
     "JSON on the same line. `EVENT compact_summary:` is followed instead by Claude Code's own summary of the "
     "conversation before that point, on the lines below."),
    ("Your task message names the one transcript file you are assigned to, by its path under "
     "/mnt/session/uploads/. The shared memory directory you read and write is mounted at {mem_dir}.",
     "Your task message names the one transcript file you are assigned to, by its full path, and the shared "
     "memory directory you read and write."),
    ("{run_preferences}For your assigned transcript:", "For your assigned transcript:"),
    (FRONTMATTER_OLD, FRONTMATTER_NEW),
    ("If the frontmatter block already exists, update the description to match the current content; don't "
     "duplicate.\n",
     "If the frontmatter block already exists, update the description to match the current content; don't "
     "duplicate.\n" + TYPES),
    ("- Maintain _index.md at the root of the memory directory: this is the catalog a future agent reads first. "
     "One line per memory file:\n    [[slug]] — one sentence on what it covers\n  Grouped under ## <domain> "
     "headings so the agent can scan for the right cluster. After your edits, add/update entries for every file "
     "you touched or created. Create _index.md if it doesn't exist.",
     "- Maintain MEMORY.md at the root of the memory directory: this is the catalog Claude Code loads into every "
     "session, and it reads only the first 200 lines or 25KB. One line per memory file:\n    - [Title](file.md) "
     "— one-line hook\n  where the hook states the memory's point, so that the line alone is useful. Keep the "
     "file's existing heading and order and add new lines at the end. After your edits, add/update entries for "
     "every file you touched or created. Create MEMORY.md, headed `# Memory Index`, if it doesn't exist."),
]
# the JSON export paragraph does not apply to Claude Code transcripts
JSON_PARA_START = "A JSON export is one object holding the session"

ORGANIZER = [
    ("mounted read-write at {mem_dir}. No other agent", "named in your task message. No other agent"),
    ("never carry it into _index.md,", "never carry it into MEMORY.md,"),
    ("""    ---
    name: <slug>
    description: <what this file covers and when to read it>
    metadata: <freeform, optional>
    ---""", """    ---
    name: <slug>
    description: <what this file covers and when to read it>
    metadata:
      type: <user, feedback, project or reference>
    ---"""),
    ("Fix missing or duplicated frontmatter; update stale descriptions.",
     "Fix missing or duplicated frontmatter; update stale descriptions. The type is one of user, feedback, "
     "project or reference; keep any other metadata fields a file already has."),
    ("Stubs get no _index.md entry", "Stubs get no MEMORY.md entry"),
    ("- _index.md at the root is complete and accurate: one line per memory file, \"[[slug]] — one sentence on "
     "what it covers\", grouped under \"## <domain>\" headings; no entries for stubs or for files that no longer "
     "exist, and no file without an entry (_index.md itself needs none).",
     "- MEMORY.md at the root is complete and accurate: one line per memory file, \"- [Title](file.md) — "
     "one-line hook\", under the file's existing heading; no entries for stubs or for files that no longer exist, "
     "and no file without an entry (MEMORY.md itself needs none). Claude Code loads only the first 200 lines or "
     "25KB of MEMORY.md into each session, so keep it within both: short hooks, detail in the memory files."),
    ("write the file at its new path inside {mem_dir})", "write the file at its new path inside the memory directory)"),
    ("Fix _index.md entry by entry", "Fix MEMORY.md entry by entry"),
    ("{run_preferences}When you are done", "When you are done"),
    ("{\"index_entries\": <the number of entries now in _index.md>", "{\"index_entries\": <the number of entries now in MEMORY.md>"),
]


def drop_json_para(text):
    i = text.index(JSON_PARA_START)
    j = text.index("\n\n", i)
    return text[:i] + text[j + 2:]


if __name__ == "__main__":
    with open(os.path.join(SRC, "analyzer_system.md"), encoding="utf-8") as f:
        a = drop_json_para(f.read())
    tmp = os.path.join(DST, "_analyzer_src.md")
    with open(tmp, "w", encoding="utf-8", newline="\n") as f:
        f.write(a)
    SRC_SAVE = SRC
    SRC = DST
    build("_analyzer_src.md", ("analyzer.md",
          "name: analyzer\ndescription: ClaudeDream analyzer. Reads one transcript part and adds what it shows to "
          "one project's memory directory. Used only by the dreaming workflow.\nmodel: haiku\n"
          "tools: Read, Write, Edit, Glob, Grep\n"), ANALYZER)
    os.remove(tmp)
    SRC = SRC_SAVE
    build("organizer_system.md", ("organizer.md",
          "name: organizer\ndescription: ClaudeDream organizer. Tidies one project's memory directory after its "
          "analyzers finish. Used only by the dreaming workflow.\nmodel: haiku\n"
          "tools: Read, Write, Edit, Glob, Grep\n"), ORGANIZER)
    print("built analyzer.md and organizer.md")
