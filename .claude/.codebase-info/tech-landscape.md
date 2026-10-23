# Tech landscape

*Last Updated: 2026-10-23*

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Language | TypeScript 5.7, strict | ESM throughout (`"type": "module"`); relative imports carry the `.js` extension |
| Runtime | Node 24 and 26 | `engines.node` is `>=24`; CI runs both. Node 18 and 22 were dropped deliberately |
| Runtime deps | none | the published package has zero dependencies |
| Dev deps | `typescript`, `vitest` 2, `tsx`, `@types/node` | four, and a new one needs a nameable gap |
| Tests | vitest over `tests/` | nine suites, 88 tests; all offline, neither host installed |
| Build | `tsc` to `dist/` | `declaration` + `declarationMap` + `sourceMap`, `noEmitOnError` |
| Toolchain pin | `.mise.toml` | `node = "26"`, `auto_install = true` |
| CI | GitHub Actions | `.github/workflows/ci.yml`, matrix over Node 24 and 26 |
| Demo (optional) | Swift / SwiftUI, macOS | `demo/SystemOneDemo/`, built by `build.sh`, needs a real Xcode toolchain |

The long-term intent is a rewrite in Rust or Go, so TypeScript tooling investment is kept
deliberately light: no linter, no formatter, no bundler, no framework.

## Three TypeScript projects, three configs

A single `tsc --noEmit` checks only the library. All three parts matter:

| Config | Covers | Shape |
|---|---|---|
| `tsconfig.json` | `src/**/*.ts` | `NodeNext` module + resolution, emits to `dist/`, `rootDir: src` |
| `tsconfig.hooks.json` | `hooks/`, `types/` | `noEmit`, `moduleResolution: bundler`, `types: []`, `noUncheckedIndexedAccess`, and a `paths` mapping of `claude-code` to `types/claude-code.d.ts` |
| `tsconfig.omp.json` | `omp/`, `src/` | extends `tsconfig.json` with `noEmit` and `rootDir: .`; the omp host types come from the ambient declarations in `omp/host.d.ts`, so it passes with omp uninstalled |

`npm run typecheck` runs all three, in that order (`tsc --noEmit`, then `typecheck:hooks`, then
`typecheck:omp`). Never substitute a bare `tsc --noEmit` for it.

## Commands

| Command | What it does |
|---|---|
| `npm run typecheck` | `tsc --noEmit`, then `typecheck:hooks`, then `typecheck:omp`; all three projects |
| `npm test` | `vitest run` over `tests/`; offline, no key needed |
| `npm run validate:plugin` | `claude plugin validate .claude-plugin/plugin.json`; needs the `claude` CLI, so it is a local-only gate |
| `npm run build` | `tsc` to `dist/` |
| `npm run demo` | `tsx examples/demo.ts`; the only path that reaches the network, needs `TYPESAFE_API_KEY` |

The first three are the verification gates (`.claude/rules/verification.md`). `npm run demo` is a
manual live check, never part of the gate set.

CI runs typecheck, test and build on Node 24 and 26. It deliberately omits `validate:plugin`,
because no runner has the `claude` CLI, and it needs no secrets: the suites drive a fake System One,
so a test that wants `TYPESAFE_API_KEY` is a defect in the test rather than a missing CI secret.

## Source of truth

| Question | File |
|---|---|
| Package name, version, scripts, engines | `package.json` |
| Plugin name, version, and every `userConfig` key the install prompt shows | `.claude-plugin/plugin.json` |
| Which omp extension loads, and the two settings omp's Plugins tab shows | `omp/package.json` (`omp.extensions`, `omp.settings`) |
| Marketplace owner and install spec | `.claude-plugin/marketplace.json` |
| Which hook module loads | `hooks/hooks.json` |
| Claude Code's engine API surface, as this repo uses it | `types/claude-code.d.ts` (hand-maintained) |
| Default option values | `DEFAULT_OPTIONS` in `src/compact.ts`, mirrored as `default` in `plugin.json` |
| omp settings defaults, and where omp saves them | `OMP_PLUGIN_DEFAULTS` and `ompPluginsDir` in `src/plugin-settings.ts`, mirrored as `default` in `omp/package.json` |
| Host policy defaults | `HOOK_DEFAULTS` in `hooks/fast-systemone.ts` |
| Local toolchain | `.mise.toml` |

One version covers both artifacts, currently 0.4.0, written at five sites across four files:
`package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` under
`plugins[0]`, and `package-lock.json`, which mirrors it twice. `tests/version.test.ts` fails if
they disagree. `.claude/rules/fork-topology.md` owns the policy; bring the lockfile along with
`npm install --package-lock-only` rather than editing it, and read its diff, because it also
mirrors `engines` and can be stale there independently.

The `userConfig` keys in `plugin.json` are read by name in `resolveHookConfig`, so renaming one
breaks the install prompt silently. That is why `validate:plugin` is a gate.

## Secrets

The TypeSafe key is never in the tree. It comes from the plugin's `apiKey` option, the
`TYPESAFE_API_KEY` environment variable, or `env.TYPESAFE_API_KEY` in Claude Code settings, resolved
in that order by `getApiKey` in `hooks/fast-systemone.ts`. `.mise.toml` deliberately does not manage
it. Do not write it into a source file, a fixture, a committed settings file, or a manifest default.

## External services

One, and only from two places: `POST https://api.typesafe.ai/v1/systemone`, reached by
`SystemOneClient` (`src/client.ts`, global `fetch`) and by the Claude Code hook's `systemOneAsker`
over the engine's `$.http.fetch`. `baseUrl` redirects both. Nothing else in the repo makes a network
call of its own: the omp extension scores through omp's built-in judge, so whatever request that
makes is omp's, made with omp's credentials, and `TYPESAFE_API_KEY` is never read on that path.

## The omp host dependency

`@oh-my-pi/pi-coding-agent` is imported by `omp/index.ts` and is deliberately *not* in
`package.json`: it is a peer provided by the host at runtime, and `omp/host.d.ts` declares the two
module slices this repo uses (`/judgment`, `/config/settings`) so the tree typechecks and the suites
run without installing omp. Those ambient declarations are hand-maintained, the same arrangement as
`types/claude-code.d.ts`, and carry the same risk: they can drift from the real API without anything
failing locally.
