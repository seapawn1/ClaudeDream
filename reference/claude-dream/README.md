# claude-dream

**Your Claude Code conversations compile themselves into a searchable knowledge base — as a native Claude Code plugin.**

A faithful refactor of [claude-memory-compiler](https://github.com/coleam00/claude-memory-compiler) (inspired by [Karpathy's LLM KB](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)) that replaces the `claude-agent-sdk` background processes with Claude Code's native slash commands and subagents.

## Architecture

```
Conversation ──> SessionEnd/PreCompact hooks ──> daily/YYYY-MM-DD.md (raw context)
    ──> /flush (summarize) ──> /compile (compile to KB)
        ──> knowledge/concepts/, connections/, qa/
            ──> SessionStart injects index into next session ──> cycle repeats
```

## What Changed from the Original

| Original | This Plugin |
|---|---|
| `claude-agent-sdk` background process for flush | Hooks write raw context; `/flush` does LLM summarization in-session |
| `scripts/compile.py` calls SDK | `/compile` slash command + `compiler` subagent |
| `scripts/query.py` calls SDK | `/query` slash command + `query-engine` subagent |
| `scripts/lint.py` calls SDK | `/lint` slash command + `linter` subagent |
| Requires separate API credits | Runs on your existing Claude Code subscription |

## Quick Start

1. Copy `.claude/`, `hooks/`, `scripts/`, `AGENTS.md`, and `pyproject.toml` into your project root
2. Run `uv sync` to install minimal Python dependencies (no claude-agent-sdk needed)
3. Open Claude Code — hooks activate automatically next session

## Slash Commands

```
/flush                              # Summarize raw session dumps into structured daily log entries
/compile                            # Compile new daily logs into knowledge articles
/compile --all                      # Force recompile all logs
/compile --file daily/2026-07-27.md # Compile a specific log
/compile --dry-run                  # Preview what would be compiled
/query How do I handle auth?        # Ask the knowledge base
/query What's my error strategy? --file-back  # Ask + save answer back
/lint                               # Run all 7 health checks
/lint --structural-only             # Skip LLM contradiction check (free)
```

## How It Works

- **Hooks** (`hooks/`) fire automatically on session events. They extract conversation text and write it to `daily/YYYY-MM-DD.md` as raw session dumps. No API calls in the hooks — pure local I/O, always fast.
- **`/flush`** reads raw session dumps from today's daily log and uses Claude (the current session) to summarize them into structured entries. Run once at the end of a productive day.
- **`/compile`** invokes the `compiler` subagent to read daily logs and write structured wiki articles to `knowledge/`.
- **`/query`** invokes the `query-engine` subagent to answer questions using index-guided retrieval (no RAG).
- **`/lint`** invokes the `linter` subagent to run 7 health checks on the knowledge base.
- **SessionStart hook** injects `knowledge/index.md` and the recent daily log into every new session.

## Project Structure

```
claude-dream/
├── .claude/
│   ├── settings.json          # Hook configuration
│   ├── commands/
│   │   ├── compile.md      # /compile slash command
│   │   ├── query.md        # /query slash command
│   │   ├── lint.md         # /lint slash command
│   │   └── flush.md        # /flush slash command
│   └── agents/
│       ├── compiler.md     # Compiler subagent definition
│       ├── query-engine.md # Query engine subagent definition
│       └── linter.md       # Linter subagent definition
├── hooks/
│   ├── session-start.py       # Inject KB index into session (pure I/O)
│   ├── session-end.py         # Capture transcript → daily log raw dump
│   └── pre-compact.py         # Capture context before compaction
├── scripts/
│   ├── config.py              # Path constants
│   └── utils.py               # Shared helpers
├── daily/                     # Raw conversation logs (immutable source)
├── knowledge/                 # Compiled knowledge base (LLM-owned)
│   ├── index.md               # Master catalog
│   ├── log.md                 # Build log
│   ├── concepts/
│   ├── connections/
│   └── qa/
├── reports/                   # Lint reports (gitignored)
├── AGENTS.md                  # Schema — the compiler specification
├── README.md                  # This file
└── pyproject.toml             # python-dotenv, tzdata only
```

## Why No RAG?

At personal scale (50-500 articles), the LLM reading a structured `index.md` outperforms vector similarity. The LLM understands what you're really asking; cosine similarity just finds similar words. RAG becomes necessary at ~2,000+ articles when the index exceeds the context window.

## Technical Reference

See **[AGENTS.md](AGENTS.md)** for the full schema: article formats, hook architecture, health checks, conventions, and customization options.
