# Patterns and conventions

*Last Updated: 2026-10-23*

There is no linter and no formatter in this repo, so the conventions below are tacit: they live in
the existing code and nothing enforces them but review. Match what is there.

## Invariants

These hold across every layer, and breaking one produces an invalid transcript rather than a test
failure:

- **A tool result never survives without its tool call.** `applyDecisions` removes a `drop_call`
  pair together, in both the `toolUses` and `toolResults` of every message. This is the reason the
  output stays valid at all.
- **A call pair is never split across the pinned boundary.** `collectToolCalls` pins a call when
  either its call message or its result message is pinned.
- **A call with no result is never a candidate.** There is nothing to drop yet, so
  `collectToolCalls` skips it.
- **Untouched messages come back as the same objects.** `applyDecisions` returns input objects by
  identity, and `toSessionMessages` depends on that to preserve the engine's handles.

## Error handling: the library throws, the hook decides

`src/` throws on anything it cannot honour, with a message naming the binding limit:
`parseSystemOneResponse` on a non-OK status, malformed JSON or a missing `answers` object;
`noulAnswer` on an answer that is not a finite `noul`; `fitState` when the ladder bottoms out;
`batchCalls` when the state leaves no room for even one call's questions; `SystemOneClient` when the
key is missing.

The library never falls back, never retries and never logs. The host decides, and both hosts decide
the same way. The Claude Code hook wraps `compactSession` in a single try/catch and routes every
failure to `next(event)`, which is Claude Code's built-in summarising compaction, after announcing it
through `$.ui.log` and a 15-second toast. The omp extension catches and returns `undefined`, which
leaves omp's own summary in place, after announcing it through `ctx.ui.notify(..., 'error')`. A
fallback is always visible; a silent degradation is a defect.

## Option resolution

Three layers, each narrower than the last:

1. `DEFAULT_OPTIONS` in `src/compact.ts` holds every library default as a fully resolved object.
2. `resolveOptions(options)` coerces a partial `CompactOptions` into `ResolvedCompactOptions`: a
   `finite()` helper rejects `NaN` and `Infinity` where a number is required, floors and clamps the
   integer options, derives `maxStateChars`, and clamps `maxStateTokens` against the request budget.
   Every function downstream takes the resolved type, usually as a narrow `Pick<>` of just the keys
   it reads.
3. `resolveHookConfig(options)` in the hook reads `userConfig` by key name, keeping a number only if
   it is finite and a string only if it is non-empty, so a blank `baseUrl` leaves the default
   endpoint intact rather than overriding it with `''`.

An unset option is genuinely absent, not zero: `maxRequestChars` defaults to
`Number.POSITIVE_INFINITY` so the character budget is simply off for TypeSafe.

Functions take `Pick<ResolvedCompactOptions, ...>` rather than the whole object. It documents what a
function actually reads and keeps the tests honest, since a test can pass exactly those keys.

## Style conventions

- **Doc comment on exports.** Every exported function, type and constant that is not
  self-evident carries a `/** ... */` saying what it is for, often why. Internal helpers get one
  only when the reason is not obvious from the body.
- **Named exports only.** `src/index.ts` is a pure barrel of `export * from './x.js'`. The one
  default export in the tree is `omp/index.ts`, because omp loads an extension by calling the
  module's default. Host-imposed, not a precedent.
- **`.js` extensions on relative imports**, including from `hooks/` into `../src/`. Required by
  `NodeNext` resolution.
- **`import type` for type-only imports**, consistently.
- **Numeric separators** on large literals (`25_000`, `15_000`).
- **Small pure helpers**, often closures inside the function that needs them (`fits`, `shrink`,
  `rebuild`, `retotal` inside `fitState`). Mutation is fine when it is local to one function and the
  function is the unit of reasoning.
- **Measured constants carry their measurement** in the comment above them: where the number came
  from, not just what it means. See `REQUEST_OVERHEAD_CHARS` and `MIN_QUESTIONS_CHARS` in
  `src/compact.ts`.
- **British spelling** appears in comments (`serialised`, `abridged`). Follow the file.
- **`Jev` means the model, `SystemOne` means the wire protocol.** The model may be named only in
  `DEFAULT_MODEL`, the `jev-latest` defaults and the estimator calibration note.
  `tests/naming.test.ts` enforces this over `src/` and `hooks/`, with the allowed sites listed
  explicitly; add a site to that list rather than loosening the check. `omp/` is outside that scan,
  so the line there rests on review alone.
- **`omp` means the host, lowercase, in prose and in names.** `src/omp-threshold.ts`,
  `loadOmpPluginSettings`, `OMP_PLUGIN_DEFAULTS`. The library's own vocabulary stays
  host-independent; a module named for a host is a module that adapts to one.

## Testing

Nine suites under `tests/`, 93 tests, all offline:

| Suite | Covers |
|---|---|
| `fast-systemone-compaction.test.ts` | the library: options, token estimate, call pairing, every fitting stage, batching, decisions, `compact` end to end, and the HTTP client against an injected `fetch` |
| `hook.test.ts` | the Claude Code adapter: `resolveHookConfig`, `toSessionMessages` object identity, `compactSession` over a fake engine fetch, endpoint routing, and that failures throw so the hook falls back |
| `output.test.ts` | `trimOutput`: chunking, the keep/drop boundary, the marker, the archive hand-off, and that one request never exceeds a char cap |
| `omp-extension.test.ts` | the omp adapter: the yield/follow-up state machine, deferral to omp's method order, the `tokensAfter` arithmetic, the catch path, and the handler wiring, all against a fake `pi` and a fake judge |
| `omp-transcript.test.ts` | `fromAgentMessages` pairing a `toolResult` message to the call before it, `renderVerbatim` omitting empty messages, and `askerFromJudge` carrying a judge's answers through |
| `omp-threshold.test.ts` | `ompTriggerTokens` and `clearsOmpThreshold`: the token limit ahead of the percentage, the percentage when no limit is set, and the 80% line |
| `plugin-settings.test.ts` | `resolveOmpPluginSettings`: the defaults when nothing is stored, project winning over global, and an out-of-range number falling back |
| `naming.test.ts` | the model-versus-protocol naming line, over `src/` and `hooks/` |
| `version.test.ts` | that the one version agrees across `package.json`, both plugin manifests, and the lockfile |

Patterns worth copying:

- **Never contact TypeSafe.** A response is injected through the `fetch` option or a
  `SystemOneAsker` stub. A test that reads `TYPESAFE_API_KEY` or opens a socket is a defect in the
  test.
- **`fakeSystemOne(answer, seen)`** is the harness: it takes a function from question name to
  probability and optionally records what it was asked into a `seen` array, so a test can assert on
  the requests as well as the output. `(name) => name.startsWith('call_') ? 0.9 : 0.1` is how a
  `drop_result` scenario is set up.
- **Small builders over fixtures**: `message()`, `call()`, `result()`, `transcript()` construct
  transcripts inline. There are no fixture files.
- **An instrument has to be able to fail.** `naming.test.ts` carries a second test asserting that
  every allowed site still exists, so the guard cannot quietly become vacuous; when writing a check
  like this, prove it bites before trusting it.
- **A guard states its own blind spot.** `naming.test.ts` says in a comment that it scans `src/` and
  `hooks/` TypeScript only, so a clean run is not a claim about the READMEs, the manifests, the demo
  or `omp/`.
- **A host is faked at its own seam, not mocked deeply.** `omp-extension.test.ts` builds a `pi`
  object that records handlers and a judge returning fixed probabilities, then drives the handlers
  directly. Nothing imports `@oh-my-pi`, so the suite runs with omp uninstalled, the same way
  `hook.test.ts` runs without Claude Code.

## Logging and observability

The library has none. The hook is the only thing that speaks: `$.ui.log` for the per-call decision
log (chunked to stay under a 4096-char host limit by `decisionLogLines`), and `notify()` for the
outcome, which writes both a log line and a toast. `summarize(result)` renders the one-line verdict:
reduction percentage, the decision counts, the state's token count and fitting stage, and how many
requests it took.
