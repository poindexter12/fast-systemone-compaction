# fast-systemone-compaction : codebase map

*Last Updated: 2026-10-25*

One repository, three artifacts. The `fast-systemone-compaction` npm package in `src/` decides what a
coding-agent transcript can lose, by asking a scorer, for every tool call, whether the call and
whether its full result still matter. Two adapters run that library against a live session: the
Claude Code function-hook plugin in `hooks/` plus `.claude-plugin/`, which scores over TypeSafe's
System One API on `session.compact`, and the oh-my-pi extension in `omp/`, which scores through
omp's own built-in judge on `session_before_compact` and needs no TypeSafe key. By default nothing
is summarised: what survives is verbatim, and what does not is deleted. The Claude Code plugin's
opt-in `summarizeDropped` puts a host-written note about the deleted span in front of the verbatim
messages.

This is a deliberately divergent fork of `tamaratran/fast-jev-compaction`, published under its own
name because the protocol is System One and `jev-latest` is only one model that speaks it.

## Documents

| Document | What it answers |
|---|---|
| [architecture.md](architecture.md) | The three artifacts, the compaction pipeline, the state-fitting ladder, the budgets, the fallback |
| [tech-landscape.md](tech-landscape.md) | Languages, runtimes, toolchain, commands, CI, and which file is source of truth for what |
| [patterns.md](patterns.md) | Error handling, option resolution, the invariants, the test harness, and the tacit conventions (there is no linter) |
| [onboarding.md](onboarding.md) | Getting a working tree green, common tasks, and the known-broken things that are not your fault |

## Structure

Structural questions go to the graph, not to a document: `graphify-out/graph.json` is extracted from
the AST and is the only copy.

```bash
graphify explain "fitState()"             # one symbol and its neighbours, with file:line
graphify path "compact()" "fitState()"    # shortest path between two nodes
graphify query "where does execution start"
```

Refresh it with `graphify update .` after code changes: deterministic, AST only, no LLM and no API
cost. `graphify-out/GRAPH_REPORT.md` records the commit it was built from, so compare that against
`git rev-parse HEAD` before trusting it.

## How to use and maintain this map

Read this index first and open a document when you need it. These documents cover the project's
shape and conventions; they deliberately do not restate `.claude/rules/*.md`, which Claude Code
already loads every session and which own the working agreements (atomic commits, the verification
gates, the library/hook boundary, the fork's naming line). Where a rule and a document overlap, the
rule wins.

Keep the map honest as the code moves: update the affected document, then re-run the state writer so
staleness stays detectable. Every path cited here was verified to exist at the commit in
`.map-state.json`.
