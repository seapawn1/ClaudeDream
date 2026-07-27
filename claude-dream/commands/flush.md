Summarize the raw session dumps in today's daily log into structured entries.

Arguments: $ARGUMENTS

## Your Task

Read AGENTS.md first, then process today's daily log.

1. Determine today's date (use the system date from context or the current date).
2. Read `daily/YYYY-MM-DD.md` (today's log). If it doesn't exist, report "No daily log for today yet."
3. Find all sections marked `### Raw Session Dump (HH:MM)`.
4. For each raw dump section:
   a. Review the raw conversation text.
   b. Extract only what is worth preserving:
      - Key decisions with rationale
      - Lessons learned, gotchas, patterns discovered
      - Non-trivial Q&A exchanges
      - Action items explicitly mentioned
   c. Skip: routine tool calls, file reads without insight, trivial clarifications, boilerplate.
   d. If nothing is worth saving, write `FLUSH_OK - Nothing worth saving from this session`.
   e. Otherwise, replace the raw dump with a structured entry:

```
### Session (HH:MM) - [Brief Title]

**Context:** [One line about what was being worked on]

**Key Exchanges:**
- [Important insight or discussion]

**Decisions Made:**
- [Decision and rationale]

**Lessons Learned:**
- [Gotcha or pattern discovered]

**Action Items:**
- [ ] [Follow-up task]
```

5. Write the updated daily log back to `daily/YYYY-MM-DD.md`.
6. Only include sections that have actual content.
7. Report how many raw dumps were processed and summarized.

Do not compile into knowledge articles — that is `/compile`'s job.
