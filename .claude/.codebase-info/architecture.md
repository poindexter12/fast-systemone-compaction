# Architecture

*Last Updated: 2026-10-20*

## Two artifacts, one tree

The plugin root is the repository root, so `hooks/fast-systemone.ts` imports `../src/*.js` directly
and the dependency runs one way only:

```
.claude-plugin/plugin.json   plugin manifest + userConfig schema (the install prompt)
hooks/hooks.json             { "modules": ["./fast-systemone.ts"] }
hooks/fast-systemone.ts      adapter: userConfig -> options, SessionMessage <-> Message, fallback
        |
        v  imports ../src/*.js
src/index.ts                 barrel re-exporting all eight modules
src/types.ts                 every shape; no behaviour
src/request.ts               URL/body construction, response validation, noulAnswer
src/client.ts                SystemOneClient: a SystemOneAsker over global fetch
src/text.ts                  surrogate-safe slice boundaries (wellFormedEnd/Start), a leaf
src/state.ts                 token estimate, call pairing, the state-fitting ladder
src/compact.ts               option resolution, question building, batching, decisions, rebuild
src/output.ts                trimOutput: chunk one command's output, score chunks, collapse runs
src/messages.ts              compactMessages: compact + a client, for library callers
```

`src/` never imports a `claude-code` type. Those live in `types/claude-code.d.ts` and belong to
`hooks/`, which is what keeps the library usable by a caller bringing its own transport through
`SystemOneAsker`. The boundary is a rule, not just a habit: see
`.claude/rules/library-hook-boundary.md`.

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

### The decision ladder

`decideCall` reads the two probabilities against one `keepThreshold` (default 0.5):

| Condition | Action | What happens in the transcript |
|---|---|---|
| `call.pinned` | `keep` | untouched |
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
(`maxRequestTokens - 20 - 160`), so raising the request cap alone truncates harder instead of
throwing. With the defaults the clamp is inert: `min(25000, 29820)` is 25000.

The four constants in `src/compact.ts` are measured, not guessed. The request envelope
(`{"model":"jev-latest","state":"","questions":{}}`) is 48 chars and 24 estimated tokens, rounded to
`REQUEST_OVERHEAD_CHARS = 50` / `REQUEST_OVERHEAD_TOKENS = 20`; the worst question pair seen, a
49-character MCP tool name, costs 493 chars and 156 tokens, rounded to `MIN_QUESTIONS_CHARS = 500` /
`MIN_QUESTIONS_TOKENS = 160`.

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
  precomputed result landed.
- **`turn.complete`** reads `$.session.usage()` and calls `$.session.compact()` once context passes
  `compactAtPercent` (default 60). A `compacting` flag guards against re-entry.
- **`tool.call`**, matched on `{ tool: 'Bash' }`, is registered only when the `bashOutput` option is
  on, so a default install carries two handlers and behaves exactly as it did before the option
  existed. It runs `trimOutput` over `record.stdout` once the result exceeds `bashOutputMinChars`
  (default 4000), leaving stderr untouched and uncounted. A command or output that looks like it
  carries a secret is trimmed to a marker telling the agent to re-run it, and nothing is archived.

`compactAtPercent` and `minReductionRatio` are host policy and live only in the hook. The library
has no opinion about when to compact or whether the result was good enough.

## Endpoint routing

`buildSystemOneRequest` takes an optional `baseUrl` and otherwise uses `SYSTEM_ONE_URL`
(`https://api.typesafe.ai/v1/systemone`). The `model` is sent in the body and defaults to
`DEFAULT_MODEL`, `jev-latest`. The two are independent: pointing `baseUrl` at a self-hosted endpoint
still leaves `model` choosing the model, which is why the request and response types are named
`SystemOne*` and only the model constants say `Jev`.
