# Architecture

*Last Updated: 2026-10-25*

## Three artifacts, one tree

The plugin root is the repository root, so both adapters import `../src/*.js` directly and the
dependency runs one way only. Nothing in `src/` imports either host:

```
.claude-plugin/plugin.json   plugin manifest + userConfig schema (the install prompt)
hooks/hooks.json             { "modules": ["./fast-systemone.ts"] }
hooks/fast-systemone.ts      adapter: userConfig -> options, SessionMessage <-> Message, fallback

omp/package.json             omp manifest: omp.extensions + omp.settings schema
omp/host.d.ts                ambient @oh-my-pi modules, so omp/ typechecks uninstalled
omp/index.ts                 adapter: omp judge -> asker, AgentMessage -> Message, verbatim string
        |
        v  both import ../src/*.js
src/index.ts                 barrel re-exporting all twelve modules
src/types.ts                 every shape; no behaviour
src/request.ts               URL/body construction, response validation, noulAnswer
src/client.ts                SystemOneClient: a SystemOneAsker over global fetch
src/text.ts                  surrogate-safe slice boundaries (wellFormedEnd/Start), a leaf
src/state.ts                 token estimate, call pairing, the state-fitting ladder
src/compact.ts               option resolution, question building, batching, decisions, rebuild
src/output.ts                trimOutput: chunk one command's output, score chunks, collapse runs
src/messages.ts              compactMessages: compact + a client, for library callers
src/judge-asker.ts           askerFromJudge: omp's judge behind SystemOneAsker
src/agent-transcript.ts      omp AgentMessage <-> Message, and renderVerbatim
src/omp-threshold.ts         omp's compaction trigger and its 80% recovery line, recomputed
src/plugin-settings.ts       reads the two numbers omp's Plugins tab saved
```

`src/` never imports a `claude-code` type. Those live in `types/claude-code.d.ts` and belong to
`hooks/`, which is what keeps the library usable by a caller bringing its own transport through
`SystemOneAsker`. The boundary is a rule, not just a habit: see
`.claude/rules/library-hook-boundary.md`. The omp extension is the proof that the seam works: it
brings omp's judge instead of a TypeSafe client and reuses `compact()` unchanged.

The four omp-facing modules live in `src/` rather than in `omp/` so they get unit tests and so
`omp/index.ts` stays a wiring file. None of them imports an `@oh-my-pi` module; those imports are
confined to `omp/index.ts`, typed by `omp/host.d.ts`. `src/plugin-settings.ts` is the one place in
`src/` that touches the filesystem, reading omp's own saved settings through `node:fs/promises`.

## The compaction pipeline

`compact(messages, asker, options)` in `src/compact.ts` is the whole flow:

```
collectToolCalls(messages, preserveRecentMessages)      src/state.ts
  pairs every tool_use to its tool_result by tool_use_id
  assigns short ids t1, t2, ... and marks `pinned`
        |
        v   candidates = calls that are not pinned (nothing to ask about the rest)
fitState(messages, calls, resolved)                     src/state.ts
  the WHOLE history, tool outputs replaced by a note, shrunk until it fits
        |
        v
batchCalls(candidates, fittedState, resolved)           src/compact.ts
  splits the two-questions-per-call load into requests that fit alongside the state
        |
        v   one request per batch, all in flight at once (Promise.all)
asker.ask(state, questions)  ->  { answers: { call_t7: {noul}, result_t7: {noul} } }
        |
        v
decideCall(call, answer, options)                       src/compact.ts
applyDecisions(messages, decisions, calls, headChars, archive?)  src/compact.ts
        |
        v   CompactResult { messages, decisions, stats }
```

Two `noul` (probability-of-true) questions are asked per candidate call, built by `questionsFor`:
`call_<id>` asks whether the call still matters, `result_<id>` whether its full output must stay
verbatim. The state is identical in every batch; only the questions differ.

### Pinning

`isPinned(index, total, preserveRecentMessages)` pins message 0 and the newest
`preserveRecentMessages` (default 6). A call is pinned when *either* its call message or its result
message is pinned, so a pair is never split across the boundary. Pinned calls are never asked about
and always decided `keep` / reason `pinned`.

Protection joins that rule rather than replacing it. A third question, `protect_m<index>`, is asked
once per *message* a candidate call touches: whether it is where the user states a standing rule,
constraint or preference, or names work still not done. A call carries the higher of the two answers
for its own message and its result's. Because the answer arrives in the same round as the per-call
pair, it cannot feed `isPinned` itself : pinning decides which calls become candidates, and
candidates decide which questions get asked, so a true pinning feed would need a second round trip.
It is applied as a veto in the ladder instead, which protects a message from deletion but not from
`fitState`'s abridgement, since fitting runs before any answer exists.

### The decision ladder

`decideCall` reads the three probabilities against `keepThreshold` (default 0.5) and
`protectThreshold` (default 0.7, deliberately higher):

| Condition | Action | What happens in the transcript |
|---|---|---|
| `call.pinned` | `keep` | untouched |
| `protect >= protectThreshold` | `keep` | untouched, whatever the two keep scores say |
| `keepResult >= keepThreshold` | `keep` | untouched |
| `keepCall >= keepThreshold` | `drop_result` | the call stays; the result keeps `truncateHeadChars` (default 300) plus a marker naming the dropped char count |
| otherwise | `drop_call` | the call and its result both disappear, leaving a one-line note only when the output was archived |

### Archiving what is dropped

Both destructive actions offer the output to `compact()`'s optional `archive` callback first. It
returns the path the output was saved to, which the marker left behind cites, so the agent can read
the file rather than re-run the tool; returning `undefined`, or passing no callback, deletes the
output outright and leaves no note. The library only threads the path into the marker text, so `src/`
keeps no filesystem dependency.

The hook is the only supplier of that callback. `archiveWriter` in `hooks/fast-systemone.ts` names a
file per output under `.claude/fast-systemone-compaction/`, collects the paths during compaction, and
writes them on `flush` after `compact()` returns, so a run that throws or falls back to the built-in
summary leaves nothing on disk. `looksSecret` withholds output carrying credentials, which also
suppresses its note. The `archiveResults` plugin option (default `true`) decides whether the hook
passes a callback at all.

`applyDecisions` rebuilds only the messages it touches and returns every untouched message as the
same object it came in as. That identity is load-bearing: the hook's `toSessionMessages` uses it to
hand the engine back its own objects (handles included) for anything unchanged, and handle-less
copies only for what was rebuilt. A message left with no text, no tool uses and no tool results is
dropped entirely.

## The state-fitting ladder

`fitState` in `src/state.ts` sends the entire conversation as context, which is the point of the
design, so it has to make it fit. It measures each history entry once via `entrySize` (one
`JSON.stringify` yielding both tokens and chars) and walks these stages in order, returning as soon
as both budgets hold. The stage name is reported in `stats.stateStage`.

| Stage | What it does |
|---|---|
| `full` | structured tool calls, tool input truncated to 1000 chars |
| `inputs<=200`, `inputs<=60` | tighter caps on serialised tool input (`INPUT_CHARS`) |
| `texts abridged` | long message texts keep a 400-char head and 150-char tail |
| `old messages collapsed` | an unpinned message's text becomes `[… N chars omitted …]` |
| `old calls compacted` | an unpinned message's structured calls become one line each (`compactCall`) |
| `old messages left out` | unpinned entries carrying no call are removed |
| `old calls merged` | runs of adjacent unpinned call-only entries fold into one entry, paying the per-entry envelope once |

Within every stage, unpinned entries are processed before pinned ones. If the last stage still does
not fit, `fitState` throws, naming whichever budget binds. Tool *outputs* are never in the state at
all: each call carries only `ok|error, N chars (omitted)`.

### Why a hand-rolled token estimate

`estimateTokens` is a word-piece heuristic, not a tokenizer: one token per six letters of a word,
half a token per digit, nine tenths for any other symbol. It was calibrated against the usage the
Jev model reports on real transcripts, where it lands 2 to 18 percent *above* the true count. A
plain characters-per-token ratio was tried and undercounts these JSON-heavy states by up to 40
percent, which is the wrong direction to be wrong in.

### The two budgets

Tokens are an estimate; characters are exact. An endpoint that caps the bytes it reads needs the
second one.

| Option | Default | Meaning |
|---|---|---|
| `maxStateTokens` | 25 000 | estimated ceiling for the state |
| `maxRequestTokens` | 30 000 | estimated ceiling for state plus one batch of questions |
| `maxRequestChars` | `Infinity` | exact ceiling for the serialised request; unset means no character budget, which is all TypeSafe needs |
| `maxStateChars` | derived | `maxRequestChars` minus the envelope and one batch's floor |

`maxStateChars` is derived inside `resolveOptions` and cannot be set by a caller, specifically so the
pair cannot drift the way the token pair can. `resolveOptions` also clamps `maxStateTokens` down to
what the request budget leaves for at least one call's questions
(`maxRequestTokens - 20 - 290`), so raising the request cap alone truncates harder instead of
throwing. With the defaults the clamp is inert: `min(25000, 29690)` is 25000.

The four constants in `src/compact.ts` are measured, not guessed. The request envelope
(`{"model":"jev-latest","state":"","questions":{}}`) is 48 chars and 24 estimated tokens, rounded to
`REQUEST_OVERHEAD_CHARS = 50` / `REQUEST_OVERHEAD_TOKENS = 20`; the worst questions for one call :
its pair plus a protect question for each of its two messages, measured with a 49-character MCP tool
name, a 29-character id and a six-digit result size : cost 1012 chars and 286 tokens, rounded to
`MIN_QUESTIONS_CHARS = 1020` / `MIN_QUESTIONS_TOKENS = 290`. The pair alone is 596 and 160, so the
constants were remeasured when the third question landed rather than scaled.

One deliberate inaccuracy: `entrySize` charges one comma per entry, so `n` entries are billed `n`
separators where the serialised array needs `n - 1`. The reported `chars` therefore sits exactly one
above the true length. It is left alone because it errs toward the safe side, and
`tests/fast-systemone-compaction.test.ts` asserts the `+ 1` on purpose.

## The hook, and what happens when it fails

`hooks/fast-systemone.ts` registers three handlers, one of them conditionally:

- **`session.compact`** resolves the API key (plugin `apiKey`, then `TYPESAFE_API_KEY` from the
  environment, then `env.TYPESAFE_API_KEY` in settings), passes `archiveWriter($)` unless
  `archiveResults` is off, runs `compactSession`, logs the per-call decisions, and returns the rewritten messages. If the reduction comes in under
  `minReductionRatio` (default 0.25), or anything throws, it calls `next(event)` and lets Claude
  Code's own summarising compaction run instead. Every fallback is announced through `$.ui.log`
  plus a toast, so a silent degradation is not possible. It registers with no trigger matcher, so
  it takes every trigger the host dispatches: `manual` for `/compact`, `auto` at the context limit,
  and `precompute` for idle compaction, which is computed ahead of time and installed only if the
  conversation still leads. `outcomeNotice()` reads `event.trigger` so the toast does not claim a
  precomputed result landed. With `summarizeDropped` on (default off), a compaction that clears
  `minReductionRatio` and is not `precompute` then calls `summaryOfDropped`, which hands only the
  messages the judge removed back to `next()` with instructions to record their concrete facts, and
  prepends whatever comes back to the kept messages. Nothing dropped, a skipped summary or a thrown
  one all yield no note, never a fallback: the verbatim result stands either way. The summarizer is
  the host's, so this sits in the hook rather than `src/`; no keep or drop decision changes.
- **`turn.complete`** reads `$.session.usage()` and calls `$.session.compact()` once context passes
  `compactAtPercent` (default 60). A `compacting` flag guards against re-entry.
- **`tool.call`**, matched on `{ tool: 'Bash' }`, is registered only when the `bashOutput` option is
  on, so a default install carries two handlers and behaves exactly as it did before the option
  existed. It runs `trimOutput` over `record.stdout` once the result exceeds `bashOutputMinChars`
  (default 4000), leaving stderr untouched and uncounted. A command or output that looks like it
  carries a secret is trimmed to a marker telling the agent to re-run it, and nothing is archived.

`compactAtPercent` and `minReductionRatio` are host policy and live only in the hook. The library
has no opinion about when to compact or whether the result was good enough.

## The omp extension, and the two passes it takes

`omp/index.ts` registers two handlers on oh-my-pi and swaps out compaction's *result* rather than
its trigger. omp decides when to compact; this extension decides what the compacted span contains.

- **`session_before_compact`** takes the messages omp was about to summarize plus the turn prefix it
  held back, maps them with `fromAgentMessages`, and runs the same `compact()` over them. The asker
  is `askerFromJudge(resolveJudge(...))`, so scoring goes through omp's `judge` model role: native
  System One when that role speaks it, omp's text bridge otherwise. No `TYPESAFE_API_KEY` is read on
  this path. `preserveRecentMessages` is `0`, because omp has already withheld the newest messages
  and they stay real messages outside the replaced span.
- **`session_compact`** is where the second pass is started, when one is needed.

The hook returns a `{ compaction: { summary, firstKeptEntryId, tokensBefore } }` object, and
`summary` is a *string*: omp's API can substitute the summary text but not the message list. So
`renderVerbatim` renders the kept messages as text, with a leading line telling the agent that
nothing below was summarized, each message under a `## role` heading, each surviving call fenced,
and each truncated result already carrying its marker. Verbatim-but-flattened is the compromise this
host forces; the Claude Code hook, which can hand back real messages, does not pay it.

### Why a follow-up pass exists

omp only treats a compaction as successful when what remains sits at or below 80% of the trigger
that fired it, and a verbatim span can easily be larger than a summary of it. `ompTriggerTokens` and
`clearsOmpThreshold` in `src/omp-threshold.ts` recompute that same arithmetic from the context window
and omp's `thresholdTokens`/`thresholdPercent` settings, against a `tokensAfter` estimated as
`tokensBefore - span + summary`. If the result still sits above the line, `session_compact` sets
`yieldNext`, waits for the pass that is still marked compacting to finish (`setTimeout(..., 0)`), and
calls `ctx.compact()` again. That second before-hook returns `undefined`, which stands aside and lets
omp's own method order summarize a history that already contains the verbatim result. The two flags,
`yieldNext` and `followUp`, are the whole state machine, and `tests/omp-extension.test.ts` pins both.

A thrown judge request is caught and also returns `undefined`, so the failure mode matches the Claude
Code hook's: announce it through the host's UI and let the host's own summarising compaction run.

### Where its two numbers come from

`keepThreshold` and `truncateHeadChars` are declared under `omp.settings` in `omp/package.json` and
set from omp's Settings → Plugins. `loadOmpPluginSettings` reads them per compaction:
`omp-plugins.lock.json` under `ompPluginsDir()` for the global values, `.omp/plugin-overrides.json`
in the project for the overrides, project winning per key. A missing file, unparseable JSON or an
out-of-range number silently falls back to `OMP_PLUGIN_DEFAULTS`, so an `extensions:` path that was
never installed through the plugin manager still runs on the defaults.

## Endpoint routing

`buildSystemOneRequest` takes an optional `baseUrl` and otherwise uses `SYSTEM_ONE_URL`
(`https://api.typesafe.ai/v1/systemone`). The `model` is sent in the body and defaults to
`DEFAULT_MODEL`, `jev-latest`. The two are independent: pointing `baseUrl` at a self-hosted endpoint
still leaves `model` choosing the model, which is why the request and response types are named
`SystemOne*` and only the model constants say `Jev`.
