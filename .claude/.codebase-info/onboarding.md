# Onboarding

*Last Updated: 2026-10-23*

## Getting to green

```bash
npm ci                     # a fresh clone has no node_modules; typecheck and test both need it
npm run typecheck          # library, then hooks, then the omp extension
npm test                   # vitest, 9 suites, offline
npm run validate:plugin    # needs the `claude` CLI on PATH
```

Those three are the gates (`.claude/rules/verification.md`); run all three and report what each one
said. `mise` will install the pinned Node on entry if you use it (`.mise.toml`, `auto_install =
true`).

Nothing here needs a TypeSafe key, and nothing needs either host installed: Claude Code's engine
API comes from `types/claude-code.d.ts` and omp's from `omp/host.d.ts`, both ambient declarations.
Only `npm run demo` needs a key, and it is the single code path that reaches the network.

## Common tasks

| Task | Where to start |
|---|---|
| Change what gets kept, dropped or truncated | `src/compact.ts` (`decideCall`, `applyDecisions`) or `src/state.ts` (`fitState`) — never the hook |
| Add a tuning option | `CompactOptions` + `ResolvedCompactOptions` in `src/types.ts`, `DEFAULT_OPTIONS` and `resolveOptions` in `src/compact.ts`, the key list in `resolveHookConfig`, and `userConfig` in `.claude-plugin/plugin.json`. Then `npm run validate:plugin` |
| Change how the state is shaped or shrunk | `src/state.ts`; add a case to the `state fitting` describe block, which pins most stage names (`inputs<=60` and `old messages left out` are not individually asserted yet) |
| Change the request or response shape | `src/request.ts` and the `SystemOne*` types; keep `Jev` out of the names |
| Change host behaviour (when to compact, when to fall back) | `hooks/fast-systemone.ts` for Claude Code, `omp/index.ts` for omp; never `src/` |
| Change what omp sees after compaction | `renderVerbatim` in `src/agent-transcript.ts`; the follow-up pass is the two flags in `omp/index.ts`, pinned by `tests/omp-extension.test.ts` |
| Add a second host adapter | bring a `SystemOneAsker` and a `Message` mapping, as `src/judge-asker.ts` and `src/agent-transcript.ts` do; nothing in `src/` should learn about the host |
| Find what calls what | the graph: `graphify explain "<symbol>"`, `graphify path "<a>" "<b>"` |
| Check the estimator against reality | `npm run demo` with `TYPESAFE_API_KEY` set; the response `usage` is what the estimate was calibrated against |

Before starting anything, read the current behaviour through its callers and tests and say what you
found. "This already works, here is where" is a better answer than a change
(`.claude/rules/surgical-scope.md`).

## Known state, so you do not re-derive it

- **The macOS demo does not build with a bare `swiftc`.** `demo/SystemOneDemo/build.sh` fails with
  `SwiftUIMacros.StateMacro could not be found`. This was verified pre-existing by building
  `origin/main`'s copy in a clean directory and getting identical errors at the same lines; it is
  not something a recent change broke. SwiftUI macro plugins need a real Xcode toolchain, not the
  command-line tools alone. The demo is optional and no gate touches it.
- **`fast-systemone-compaction` is not published on npm**, so the README's install line is
  aspirational. Upstream holds the old name `fast-jev-compaction` at 0.4.1, which is why this fork
  renamed rather than kept it.
- **One version, 0.4.0, covers the package and the plugin**, and `tests/version.test.ts` enforces
  it. The 0.2.0-against-0.3.0 split this file used to warn about came from upstream and is gone.
- **The local directory is still named `fast-jev-compaction`** even though the repo and package are
  not. Harmless, but it is why `graphify-out/GRAPH_REPORT.md` has the old name in its title line.
- **`npm run validate:plugin` cannot run in CI** (no `claude` CLI on a runner), so it is a local
  gate. CI runs typecheck, test and build on Node 24 and 26.
- **After the rename, an installed copy of the plugin needs its marketplace re-added** before Claude
  Code will see this repo under the new name.
- **`@oh-my-pi/pi-coding-agent` is not installed and is not meant to be.** `omp/host.d.ts` declares
  the slices `omp/index.ts` uses. A green `typecheck:omp` therefore says the extension agrees with
  *those declarations*, not with the real omp; the only check against the real thing is pointing a
  live omp at `omp/` via `extensions:` in `~/.omp/agent/config.yml`.
- **No graphify post-commit hook is installed** (`graphify hook status` says so), so the graph in
  `graphify-out/` goes stale on every commit until someone runs `graphify update .`. Check
  `graphify-out/GRAPH_REPORT.md`'s commit against `git rev-parse HEAD` before trusting it.

## Git

`main` tracks `origin` (`poindexter12/fast-systemone-compaction`), so branch before working. Always
`git fetch origin` and branch from `origin/main`, never from a stale local `main`. `upstream` is
`tamaratran/fast-jev-compaction` and is fetched only when deliberately pulling its changes in.

Commits are atomic and one-hat (`.claude/rules/atomic-commits.md`): a library change, a hook change
and a README update are three commits. Stage per path; never blind-add the tree, because
`package-lock.json` and `demo/SystemOneDemo/build` should not ride along. Commit only when asked and
push only when asked.

If `git fetch origin` reports an access-rights error, the 1Password SSH agent is probably locked
rather than the remote being wrong: `ssh -T git@personal-github` will say whether the key is
available. Do not report the remote as current while a fetch is failing.
