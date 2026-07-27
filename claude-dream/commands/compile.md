Compile daily conversation logs into structured knowledge articles.

Arguments: $ARGUMENTS

## Argument Parsing

Parse the following from `$ARGUMENTS`:
- `--all` → force recompile all daily logs (ignore hash state)
- `--file <path>` → compile only this specific file (e.g., `daily/2026-07-27.md`)
- `--dry-run` → list what would be compiled, but do not write anything

If no arguments are given, compile only new or changed daily logs.

## Your Task

1. Read `AGENTS.md` — this is your compiler specification. Follow it exactly.
2. Read `scripts/state.json` if it exists. The `ingested` field maps filename → `{hash, compiled_at}`.
3. List all files in `daily/` matching `*.md`.
4. Determine which logs to compile:
   - If `--file <path>`: only that file
   - If `--all`: all logs in `daily/`
   - Otherwise: only logs whose SHA-256 hash (first 16 hex chars) differs from `scripts/state.json`
5. If `--dry-run`: print the list and stop.
6. If nothing needs compiling, report "Nothing to compile — all daily logs are up to date."
7. For each log to compile, invoke the `compiler` subagent with the daily log path as context.
   - The subagent will read the schema, index, existing articles, and the daily log, then write/update knowledge articles.
8. After each compilation, update `scripts/state.json`:
   ```json
   {
     "ingested": {
       "2026-07-27.md": {
         "hash": "<first-16-chars-of-sha256>",
         "compiled_at": "<ISO-timestamp>"
       }
     },
     "query_count": 0,
     "last_lint": null,
     "total_cost": 0.0
   }
   ```
9. Report: how many logs were compiled, total knowledge articles in `knowledge/`.

## Paths

- Daily logs: `daily/`
- Knowledge base: `knowledge/`
- State file: `scripts/state.json`
- Schema: `AGENTS.md`
