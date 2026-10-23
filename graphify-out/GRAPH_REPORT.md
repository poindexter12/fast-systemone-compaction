# Graph Report - fast-jev-compaction  (2026-10-23)

## Corpus Check
- 52 files · ~92,168 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .toml 1, .plist 1)

## Summary
- 963 nodes · 1423 edges · 36 communities (23 shown, 13 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 90 edges (avg confidence: 0.94)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cb9bedda`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Claude Code Agent SDK Types
- fast-systemone.ts
- package.json
- Swift Demo App Shell
- fast-systemone-compaction.test.ts
- compact.ts
- SystemOneAsker
- state.ts
- Demo Chunk Rendering Model
- Library TypeScript Config
- Hooks TypeScript Config
- fast-systemone-compaction
- Demo Animation and Scrolling
- estimateTokens
- Chunk View Component
- Tech landscape
- URL Query Parameters
- Demo Phase States
- Demo Build Script
- Abort Signal Handling
- URL Object
- Abort Controller
- Engine Interfaces
- Text Decoding
- Text Encoding
- Test Suite Describe
- Test Case Helper
- omp/index.ts
- output.ts
- types.ts
- keepThreshold
- tsconfig.omp.json
- host.d.ts
- settings

## God Nodes (most connected - your core abstractions)
1. `Demo` - 20 edges
2. `trimOutputAttempt()` - 19 edges
3. `fitState()` - 19 edges
4. `compact()` - 18 edges
5. `SystemOneAsker` - 17 edges
6. `Chunk` - 16 edges
7. `register()` - 16 edges
8. `ChunkView` - 14 edges
9. `fastSystemOneCompaction()` - 14 edges
10. `estimateTokens()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `The two budgets` --references--> `resolveOptions()`  [INFERRED]
  .claude/.codebase-info/architecture.md → src/compact.ts
- `The decision ladder` --references--> `decideCall()`  [INFERRED]
  .claude/.codebase-info/architecture.md → src/compact.ts
- `Endpoint routing` --references--> `buildSystemOneRequest()`  [INFERRED]
  .claude/.codebase-info/architecture.md → src/request.ts
- `Why a hand-rolled token estimate` --references--> `estimateTokens()`  [INFERRED]
  .claude/.codebase-info/architecture.md → src/state.ts
- `Three artifacts, one tree` --references--> `SystemOneAsker`  [INFERRED]
  .claude/.codebase-info/architecture.md → src/types.ts

## Import Cycles
- None detected.

## Communities (36 total, 13 thin omitted)

### Community 0 - "Claude Code Agent SDK Types"
Cohesion: 0.00
Nodes (443): AgentCallRecord, AgentInfo, AgentLoop, AgentOfferInput, AgentOfferResult, AgentSpawnArgs, AgentSpawnInput, AgentSpawnResult (+435 more)

### Community 1 - "fast-systemone.ts"
Cohesion: 0.07
Nodes (42): Archiving what is dropped, The hook, and what happens when it fails, Logging and observability, Testing, Secrets, ArchiveFs, archiveWriter, compactSession() (+34 more)

### Community 2 - "package.json"
Cohesion: 0.08
Nodes (25): description, devDependencies, tsx, @types/node, typescript, vitest, engines, node (+17 more)

### Community 3 - "Swift Demo App Shell"
Cohesion: 0.13
Nodes (17): AppKit, ContextMeter, .body, .color, Palette, RootView, Spinner, .body (+9 more)

### Community 4 - "fast-systemone-compaction.test.ts"
Cohesion: 0.07
Nodes (9): messages, call(), fileA, fileB, fit, message(), result(), Seen (+1 more)

### Community 5 - "compact.ts"
Cohesion: 0.16
Nodes (24): Error handling: the library throws, the hook decides, Invariants, Patterns and conventions, Style conventions, Install and usage, applyDecisions(), askBatch(), batchCalls() (+16 more)

### Community 6 - "SystemOneAsker"
Cohesion: 0.24
Nodes (7): Common tasks, Option resolution, CompactOptions, Message, ResolvedCompactOptions, SystemOneAsker, PluginOptions

### Community 7 - "state.ts"
Cohesion: 0.19
Nodes (19): abridge(), callsByMessage(), compactCall(), fitState(), goalFromMessages(), historyEntries(), INPUT_CHARS, inputText() (+11 more)

### Community 8 - "Demo Chunk Rendering Model"
Cohesion: 0.14
Nodes (16): CallScore, Chunk, .badgeLabel, .isText, .verdict, Role, assistant, toolHeader (+8 more)

### Community 9 - "Library TypeScript Config"
Cohesion: 0.13
Nodes (14): compilerOptions, declaration, declarationMap, module, moduleResolution, noEmitOnError, outDir, rootDir (+6 more)

### Community 10 - "Hooks TypeScript Config"
Cohesion: 0.13
Nodes (14): compilerOptions, baseUrl, lib, module, moduleResolution, noEmit, noUncheckedIndexedAccess, paths (+6 more)

### Community 11 - "fast-systemone-compaction"
Cohesion: 0.14
Nodes (12): Configuration, fast-systemone-compaction Claude Code mod, Scope and caveat, Animated demo (macOS), Claude Code plugin, Development, fast-systemone-compaction, How it works (+4 more)

### Community 12 - "Demo Animation and Scrolling"
Cohesion: 0.16
Nodes (5): Demo, FrameKey, .body, ScrollRequest, .body

### Community 13 - "estimateTokens"
Cohesion: 0.24
Nodes (7): Options, SystemOneClient, SystemOneClientOptions, compactMessages(), CompactMessagesOptions, estimateTokens(), CompactResult

### Community 14 - "Chunk View Component"
Cohesion: 0.29
Nodes (7): ChunkView, .badge, .body, .content, .shownText, .tint, .toolTitle

### Community 15 - "Tech landscape"
Cohesion: 0.07
Nodes (24): Architecture, Endpoint routing, Pinning, The compaction pipeline, The decision ladder, The state-fitting ladder, The two budgets, Three artifacts, one tree (+16 more)

### Community 17 - "Demo Phase States"
Cohesion: 0.29
Nodes (7): Phase, collapsing, done, idle, scanning, typing, waiting

### Community 29 - "omp/index.ts"
Cohesion: 0.06
Nodes (41): The omp extension, and the two passes it takes, Where its two numbers come from, Why a follow-up pass exists, CompactCtx, CompactEvent, ExtensionApi, fastSystemOneCompaction(), notify() (+33 more)

### Community 30 - "output.ts"
Cohesion: 0.11
Nodes (26): finite(), REQUEST_OVERHEAD_CHARS, REQUEST_OVERHEAD_TOKENS, resolveOptions(), batches(), chunkOutput(), estimateOutputTokens(), finite() (+18 more)

### Community 31 - "types.ts"
Cohesion: 0.15
Nodes (19): systemOneAsker(), JudgeLike, buildSystemOneRequest(), parseSystemOneResponse(), SystemOneRequest, CallAction, ChoiceAnswer, ChoiceQuestion (+11 more)

### Community 32 - "keepThreshold"
Cohesion: 0.11
Nodes (18): description, default, description, max, min, type, name, omp (+10 more)

### Community 33 - "tsconfig.omp.json"
Cohesion: 0.29
Nodes (6): ./tsconfig.json, compilerOptions, noEmit, rootDir, extends, include

### Community 34 - "host.d.ts"
Cohesion: 0.40
Nodes (3): JudgeLike, @oh-my-pi/pi-coding-agent/config/settings, @oh-my-pi/pi-coding-agent/judgment

## Knowledge Gaps
- **35 isolated node(s):** `AppKit`, `SwiftUI`, `user`, `assistant`, `toolHeader` (+30 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 681 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `omp/index.ts` to `fast-systemone.ts`, `package.json`, `fast-systemone-compaction.test.ts`, `output.ts`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `trimOutputAttempt()` (e.g. with `questionFor()` and `.ask()`) actually correct?**
  _`trimOutputAttempt()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `AppKit`, `SwiftUI`, `user` to the rest of the system?**
  _35 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Claude Code Agent SDK Types` be split into smaller, more focused modules?**
  _Cohesion score 0.004424778761061947 - nodes in this community are weakly interconnected._
- **Why does `SystemOneAsker` connect `SystemOneAsker` to `fast-systemone.ts`, `fast-systemone-compaction.test.ts`, `compact.ts`, `estimateTokens`, `Tech landscape`, `omp/index.ts`, `output.ts`, `types.ts`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `fitState()` (e.g. with `The state-fitting ladder` and `Common tasks`) actually correct?**
  _`fitState()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **Should `fast-systemone.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07183673469387755 - nodes in this community are weakly interconnected._