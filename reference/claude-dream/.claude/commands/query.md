Query the knowledge base using index-guided retrieval (no RAG).

Arguments: $ARGUMENTS

## Argument Parsing

Parse from `$ARGUMENTS`:
- First non-flag argument: the question to ask (may contain spaces)
- `--file-back` → save the answer as a Q&A article in `knowledge/qa/`

Example: `What auth patterns do I use? --file-back`
Parses as: question = "What auth patterns do I use?", file_back = true

## Your Task

Invoke the `query-engine` subagent to answer the question.

Provide it with:
1. The question
2. Whether to file the answer back (--file-back flag)
3. The full content of `knowledge/` (index + all articles)

The subagent will:
1. Read `knowledge/index.md` to identify relevant articles
2. Read those articles in full
3. Synthesize a clear answer with `[[wikilink]]` citations
4. If `--file-back`: create a Q&A article in `knowledge/qa/`, update `knowledge/index.md` and `knowledge/log.md`

After the subagent completes, update `scripts/state.json`:
- Increment `query_count` by 1

Report the answer to the user.
