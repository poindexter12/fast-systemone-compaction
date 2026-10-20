# Graph Report - fast-jev-compaction  (2026-10-20)

## Corpus Check
- 40 files · ~85,929 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .toml 1, .plist 1)

## Summary
- 865 nodes · 1231 edges · 32 communities (20 shown, 12 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 72 edges (avg confidence: 0.94)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e1e15c3e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Claude Code Agent SDK Types
- fast-systemone.ts
- NPM Package Manifest
- Swift Demo App Shell
- Demo and Library Entry Points
- compact.ts
- types.ts
- state.ts
- Demo Chunk Rendering Model
- Library TypeScript Config
- Hooks TypeScript Config
- Project README Docs
- Demo Animation and Scrolling
- SystemOneAsker
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
- Architecture
- output.ts
- estimateTokens

## God Nodes (most connected - your core abstractions)
1. `Demo` - 20 edges
2. `trimOutputAttempt()` - 19 edges
3. `fitState()` - 19 edges
4. `compact()` - 18 edges
5. `Chunk` - 16 edges
6. `register()` - 16 edges
7. `ChunkView` - 14 edges
8. `SystemOneAsker` - 14 edges
9. `compilerOptions` - 12 edges
10. `compilerOptions` - 12 edges

## Surprising Connections (you probably didn't know these)
- `Source of truth` --references--> `resolveHookConfig()`  [INFERRED]
  .claude/.codebase-info/tech-landscape.md → hooks/fast-systemone.ts
- `The hook, and what happens when it fails` --references--> `compactSession()`  [INFERRED]
  .claude/.codebase-info/architecture.md → hooks/fast-systemone.ts
- `The two budgets` --references--> `resolveOptions()`  [INFERRED]
  .claude/.codebase-info/architecture.md → src/compact.ts
- `The decision ladder` --references--> `decideCall()`  [INFERRED]
  .claude/.codebase-info/architecture.md → src/compact.ts
- `Endpoint routing` --references--> `buildSystemOneRequest()`  [INFERRED]
  .claude/.codebase-info/architecture.md → src/request.ts

## Import Cycles
- None detected.

## Communities (32 total, 12 thin omitted)

### Community 0 - "Claude Code Agent SDK Types"
Cohesion: 0.00
Nodes (443): AgentCallRecord, AgentInfo, AgentLoop, AgentOfferInput, AgentOfferResult, AgentSpawnArgs, AgentSpawnInput, AgentSpawnResult (+435 more)

### Community 1 - "fast-systemone.ts"
Cohesion: 0.07
Nodes (44): Archiving what is dropped, Error handling: the library throws, the hook decides, Invariants, Logging and observability, Patterns and conventions, Style conventions, Testing, Secrets (+36 more)

### Community 2 - "NPM Package Manifest"
Cohesion: 0.06
Nodes (28): description, devDependencies, tsx, @types/node, typescript, vitest, engines, node (+20 more)

### Community 3 - "Swift Demo App Shell"
Cohesion: 0.13
Nodes (17): AppKit, ContextMeter, .body, .color, Palette, RootView, Spinner, .body (+9 more)

### Community 4 - "Demo and Library Entry Points"
Cohesion: 0.07
Nodes (9): messages, call(), fileA, fileB, fit, message(), result(), Seen (+1 more)

### Community 5 - "compact.ts"
Cohesion: 0.16
Nodes (21): Common tasks, Option resolution, applyDecisions(), askBatch(), batchCalls(), compact(), count(), decideCall() (+13 more)

### Community 6 - "types.ts"
Cohesion: 0.14
Nodes (20): systemOneAsker(), Install and usage, buildSystemOneRequest(), parseSystemOneResponse(), SystemOneRequest, CallAction, ChoiceAnswer, ChoiceQuestion (+12 more)

### Community 7 - "state.ts"
Cohesion: 0.17
Nodes (21): abridge(), callsByMessage(), collectToolCalls(), compactCall(), fitState(), goalFromMessages(), historyEntries(), INPUT_CHARS (+13 more)

### Community 8 - "Demo Chunk Rendering Model"
Cohesion: 0.14
Nodes (16): CallScore, Chunk, .badgeLabel, .isText, .verdict, Role, assistant, toolHeader (+8 more)

### Community 9 - "Library TypeScript Config"
Cohesion: 0.13
Nodes (14): compilerOptions, declaration, declarationMap, module, moduleResolution, noEmitOnError, outDir, rootDir (+6 more)

### Community 10 - "Hooks TypeScript Config"
Cohesion: 0.13
Nodes (14): compilerOptions, baseUrl, lib, module, moduleResolution, noEmit, noUncheckedIndexedAccess, paths (+6 more)

### Community 11 - "Project README Docs"
Cohesion: 0.15
Nodes (11): Configuration, fast-systemone-compaction Claude Code mod, Scope and caveat, Animated demo (macOS), Claude Code plugin, Development, fast-systemone-compaction, How it works (+3 more)

### Community 12 - "Demo Animation and Scrolling"
Cohesion: 0.16
Nodes (5): Demo, FrameKey, .body, ScrollRequest, .body

### Community 13 - "SystemOneAsker"
Cohesion: 0.21
Nodes (8): Options, SystemOneClient, compactMessages(), CompactMessagesOptions, CompactResult, Message, SystemOneAsker, PluginOptions

### Community 14 - "Chunk View Component"
Cohesion: 0.29
Nodes (7): ChunkView, .badge, .body, .content, .shownText, .tint, .toolTitle

### Community 15 - "Tech landscape"
Cohesion: 0.11
Nodes (14): Documents, fast-systemone-compaction : codebase map, How to use and maintain this map, Structure, Getting to green, Git, Known state, so you do not re-derive it, Onboarding (+6 more)

### Community 17 - "Demo Phase States"
Cohesion: 0.29
Nodes (7): Phase, collapsing, done, idle, scanning, typing, waiting

### Community 29 - "Architecture"
Cohesion: 0.20
Nodes (10): Architecture, Endpoint routing, Pinning, The compaction pipeline, The decision ladder, The hook, and what happens when it fails, The state-fitting ladder, The two budgets (+2 more)

### Community 30 - "output.ts"
Cohesion: 0.16
Nodes (21): REQUEST_OVERHEAD_CHARS, REQUEST_OVERHEAD_TOKENS, batches(), chunkOutput(), estimateOutputTokens(), finite(), looksBinary(), looksStructured() (+13 more)

### Community 31 - "estimateTokens"
Cohesion: 0.28
Nodes (5): SystemOneClientOptions, trimOutput(), estimateTokens(), ask(), estimateOutputTokens()

## Knowledge Gaps
- **33 isolated node(s):** `AppKit`, `SwiftUI`, `user`, `assistant`, `toolHeader` (+28 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 637 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `NPM Package Manifest` to `fast-systemone.ts`, `Demo and Library Entry Points`, `estimateTokens`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `trimOutputAttempt()` (e.g. with `questionFor()` and `.ask()`) actually correct?**
  _`trimOutputAttempt()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `AppKit`, `SwiftUI`, `user` to the rest of the system?**
  _33 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Claude Code Agent SDK Types` be split into smaller, more focused modules?**
  _Cohesion score 0.004424778761061947 - nodes in this community are weakly interconnected._
- **Why does `PluginOptions` connect `SystemOneAsker` to `Claude Code Agent SDK Types`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `fitState()` (e.g. with `The state-fitting ladder` and `Common tasks`) actually correct?**
  _`fitState()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **Should `fast-systemone.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07013574660633484 - nodes in this community are weakly interconnected._