Run health checks on the knowledge base.

Arguments: $ARGUMENTS

## Argument Parsing

Parse from `$ARGUMENTS`:
- `--structural-only` → skip the LLM contradiction check (all other checks are pure file I/O, free)

## Your Task

Invoke the `linter` subagent to run health checks on `knowledge/`.

The subagent runs seven checks:

| # | Check | Type | Catches |
|---|-------|------|---------|
| 1 | Broken links | Structural | `[[wikilinks]]` pointing to non-existent articles |
| 2 | Orphan pages | Structural | Articles with zero inbound links |
| 3 | Orphan sources | Structural | Daily logs not yet compiled (per state.json) |
| 4 | Stale articles | Structural | Source logs changed since compilation |
| 5 | Missing backlinks | Structural | A links to B but B doesn't link back |
| 6 | Sparse articles | Structural | Under 200 words |
| 7 | Contradictions | LLM | Conflicting claims across articles |

If `--structural-only`, skip check 7.

After the subagent completes:
1. Save the report to `reports/lint-YYYY-MM-DD.md`
2. Update `scripts/state.json` → set `last_lint` to current ISO timestamp
3. Report summary: errors / warnings / suggestions count

Severity levels:
- **error** — must fix (broken links)
- **warning** — should fix (orphans, staleness, contradictions)
- **suggestion** — consider fixing (missing backlinks, sparse articles)
