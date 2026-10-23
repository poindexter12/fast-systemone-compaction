# fast-systemone-compaction

Claude Code plugin that replaces the compaction summary with System One decisions:
every tool call and result is scored in one fast request, stale ones are
dropped or truncated, everything kept stays verbatim. Also usable as an npm
library.

## What and why

Most context compaction asks an LLM to summarize old turns. A summary is
lossy: a file path, exact error, constraint, or command can disappear even when
it matters later. This library never rewrites anything. It only deletes tool
calls and tool results System One says are no longer needed, and it asks System One while
showing it the whole conversation. User and assistant text stays verbatim and
in order.

The repository is both an npm package (`src/`) and a Claude Code plugin
(`hooks/`, `.claude-plugin/`) that uses the package to replace Claude Code's
built-in compaction summary with the original messages.

## How it works

1. Every `tool_use` is paired with its `tool_result` by `tool_use_id`. Calls in
   the first message or in the newest `preserveRecentMessages` messages are
   pinned and never touched.
2. The **state** sent to System One is the whole conversation so far, oldest first,
   with every tool result replaced by a short note (`ok, 4213 chars (omitted)`).
   Tool inputs are included, texts are included, nothing is summarized.
3. The state is fitted into `maxStateTokens` (25k by default) in stages, each
   applied only if the previous one was not enough: tool inputs truncated to
   1000, then 200, then 60 characters; long texts abridged to head + tail,
   oldest non-pinned messages first; old non-pinned messages collapsed to a
   `[… N chars omitted …]` note; old tool calls reduced to one line each
   (`t12 Read file_path=src/a.ts → ok 480ch`); old call-less messages left
   out; runs of old call-only messages folded into one entry. If it still
   does not fit, compaction throws. Tokens are estimated without a tokenizer (a
   word per six letters, half a token per digit, ~one per other symbol),
   calibrated to land a little above the counts Jev reports.
4. For every non-pinned call System One gets two `noul` questions: should the **call**
   stay (knowing it was made, with its input, still matters), and should the
   **result** stay verbatim (its contents are still needed and re-running the
   tool would not do). A third question is asked once per message either of
   those sits in: whether it is where the user states a standing rule,
   constraint or preference, or names work still not done.
5. Questions are split into as many requests as needed so state plus questions
   stays under `maxRequestTokens` (30k by default, under Jev's 32k request
   limit). The same full state is resent with every request; requests run
   concurrently and their answers are merged.
6. Decisions per call, against `keepThreshold`:
   - the message is pinned, or scores `≥ protectThreshold` on that third
     question → keep call and result, whatever the two keep scores say;
   - `keepResult ≥ threshold` → keep call and result;
   - else `keepCall ≥ threshold` → keep the call, truncate the result to its
     first `truncateHeadChars` characters plus a one-line note;
   - else → remove the call together with its result.

   An `archive` callback is offered every dropped output before it goes. The
   path it returns is cited in the marker left behind, so the output can be
   read back rather than re-run; a dropped call then leaves one line naming
   the tool, its input and that file. Return `undefined`, or pass no callback,
   and the output is deleted with nothing left pointing at it.
7. The message list is rebuilt: a message that loses all its content is
   removed, untouched messages are returned as the same objects, and no result
   is ever left without its call.

System One failures, malformed answers, a missing key, or a history that cannot be
fitted throw; the caller (or the Claude Code hook) decides what to fall back to.

## Install and usage

```sh
npm install fast-systemone-compaction
export TYPESAFE_API_KEY=...
```

```ts
import { compactMessages, reductionRatio, type Message } from 'fast-systemone-compaction';

const transcript: Message[] = [
  { role: 'user', text: 'Fix the failing test. Never edit src/generated.', toolUses: [] },
  {
    role: 'assistant',
    text: '',
    toolUses: [{ tool_use_id: 'toolu_1', tool: 'Read', input: { file_path: 'src/a.ts' } }],
  },
  { role: 'user', text: '', toolUses: [], toolResults: [{ tool_use_id: 'toolu_1', text: '…file…' }] },
  // …
];

const result = await compactMessages(transcript, { preserveRecentMessages: 4 });
console.log(result.messages, result.decisions, result.stats);
if (reductionRatio(result) < 0.25) {
  // not worth it: keep the original transcript, or summarize instead
}
```

`Message` is a subset of Claude Code's `SessionMessage`, so a session transcript
can be passed in as is.

To bring your own transport, implement `SystemOneAsker` (one `ask(state, questions)`
method) and call `compact(messages, asker, options)`; `buildSystemOneRequest` and
`parseSystemOneResponse` give you the HTTP request body and response validation.
The building blocks (`collectToolCalls`, `fitState`, `batchCalls`,
`decideCall`, `applyDecisions`) are exported too.

`apiKey` defaults to `process.env.TYPESAFE_API_KEY`. Never commit the key or
put it in a source file.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `apiKey` | `TYPESAFE_API_KEY` | TypeSafe API key (`compactMessages`/`SystemOneClient`) |
| `model` | `jev-latest` | Model name sent with every System One request |
| `baseUrl` | `https://api.typesafe.ai/v1/systemone` | System One endpoint |
| `fetch` | native `fetch` | Injectable fetch implementation for tests |
| `goal` | last 3 user prompts | Ongoing task description included in the state |
| `keepThreshold` | `0.5` | Minimum keep probability for a call or result to stay |
| `protectThreshold` | `0.7` | Minimum probability a message states a standing constraint; a call in one is never dropped |
| `preserveRecentMessages` | `6` | Newest messages never touched (the first is always kept) |
| `maxStateTokens` | `25000` | Estimated token ceiling for the state |
| `maxRequestTokens` | `30000` | Estimated ceiling for state plus one batch of questions |
| `truncateHeadChars` | `300` | Characters of a dropped tool result retained before its note |
| `archive` | unset | Callback offered every dropped output; the path it returns is cited in the marker |

`trimOutput(input, asker, options)` is the same idea for one command's output
rather than a transcript: it chunks the text, asks System One which chunks the
agent still needs, and collapses the rest into a marker. It takes `minChars`
and `chunkLines` beside the budgets above, and returns the trimmed output with
the per-chunk scores. The plugin's `bashOutput` option is the hook that uses
it.

`result.stats` reports message and character counts before and after, the
per-reason decision counts, the state size in estimated tokens, which fitting
stage was needed, and the number of requests.

## Limitations

- Only tool calls and results are candidates; text messages are never removed
  or shortened in the output (they are only abridged in the state System One sees).
- Token sizes are estimates from character counts, not a tokenizer.
- Calibration is at the request level; a probability is not a proof that a
  result is safe to delete. The assistant can always re-run the tool.
- The full state is repeated with every request, so a history near the state
  ceiling costs one request per handful of questions.

## Claude Code plugin

The repository root is a Claude Code function-hook plugin: `hooks/fast-systemone.ts`
is a thin adapter that feeds `session.compact` transcripts through `src/` and
falls back to Claude Code's built-in summary on errors or insufficient
reduction. See [`hooks/README.md`](hooks/README.md) for configuration and the
Claude Code 2.1.274 type reference.

### Install in Claude Code

Function hooks are an early-access Claude Code feature (2.1.274+), so the
opt-in flag must be set wherever Claude Code runs, e.g. in `~/.claude/settings.json`:

```json
{ "env": { "CLAUDE_CODE_ENABLE_FUNCTION_HOOKS": "1", "TYPESAFE_API_KEY": "<your key>" } }
```

Then add this repository as a plugin marketplace and install the plugin,
either from the shell or as slash commands inside a session:

```sh
claude plugin marketplace add poindexter12/fast-systemone-compaction
claude plugin install fast-systemone-compaction@fast-systemone-compaction
```

The install prompts for the plugin options (API key, thresholds, `truncateHeadChars`,
…); leave them at their defaults to use `TYPESAFE_API_KEY` from the environment.
Restart Claude Code or run `/reload-plugins`. From then on `/compact` (and
auto-compaction) goes through System One: the toast reads
`fast-systemone-compaction: kept N/M messages, no summary (…)` when the pruned history
replaced the built-in summary, or `fallback to built-in summary (…)` when System One
could not remove enough (short sessions, or when it fails).

Turning on the `bashOutput` option adds opt-in trimming of long Bash output at
the moment the command returns, described in `hooks/README.md`. It is off by
default because it costs a round trip per long output.

To run from a checkout without installing: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .`
from the repository root. No publishing step is required; the marketplace is
just the repo's `.claude-plugin/marketplace.json`.

## omp plugin

`omp/` is an [oh-my-pi](https://omp.sh) extension. On `session_before_compact` it runs the same library over the messages omp was about to summarize and replaces omp's summary with those messages verbatim. Scoring uses omp's built-in judge (the `judge` model role: native System One when that role has it, otherwise the text bridge), so this plugin does not read `TYPESAFE_API_KEY`.

omp can only substitute a summary string, not the message list, so the kept span is rendered as text. The newest messages omp already held back stay real messages.

```yaml
# ~/.omp/agent/config.yml
extensions:
  - /path/to/fast-systemone-compaction/omp
```

`omp/package.json` declares `omp.extensions` and two `omp.settings` numbers: `keepThreshold` (0.5) and `truncateHeadChars` (300). Install the `omp/` directory with omp's plugin installer, then set them under Settings → Plugins. The extension reads the saved values from `~/.omp/plugins/omp-plugins.lock.json`, with `.omp/plugin-overrides.json` winning for the same key. On Linux, after `omp config migrate`, the lockfile is under `$XDG_DATA_HOME/omp/plugins` instead. An `extensions:` path that was never installed still runs, using those defaults. The verbatim result is always stored. omp's trigger (the token limit when one is set, otherwise the percentage) and the same 80% recovery line decide what happens next. Still above that line, the extension starts a second compaction after the first pass finishes and stays out of it, so the method order summarizes the history that already keeps the verbatim result. A failed judge request leaves the first pass to omp.

## Development

```sh
npm install
npm run typecheck        # library + hook + omp extension
npm test
npm run build
npm run validate:plugin  # claude plugin validate
TYPESAFE_API_KEY="$(cat ~/.typesafe_key)" npm run demo
```

The unit tests use a fake System One and never contact TypeSafe. The demo is the live
network check.

## Animated demo (macOS)

`demo/SystemOneDemo` is a small native SwiftUI app that plays a scripted, dramatized
version of the compaction flow inside a Claude Code-style terminal: the tool
calls of a canned transcript are scored, results and calls System One lets go turn red
and collapse away, and the rest stays verbatim. It never calls the API; it
exists to be screen recorded.

```sh
demo/SystemOneDemo/build.sh   # builds demo/SystemOneDemo/build/SystemOneDemo.app and launches it
```

Press space in the app to replay from the start.
