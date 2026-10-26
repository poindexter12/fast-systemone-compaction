# Graph Report - fast-jev-compaction  (2026-10-25)

## Corpus Check
- 53 files · ~93,573 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .toml 1, .plist 1)

## Summary
- 964 nodes · 1432 edges · 38 communities (25 shown, 13 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 99 edges (avg confidence: 0.94)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8a9df94a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Claude Code Host Types
- Hook Session Compaction
- npm Package Manifest
- SwiftUI Demo App
- Library Integration Tests
- Compaction Pipeline Docs
- Compaction Type Definitions
- Compaction State Builder
- Demo Transcript Chunks
- Library TypeScript Config
- Hook TypeScript Config
- READMEs and Install Guide
- Demo Animation Playback
- Token Estimation and Budgets
- Demo Chunk View
- Codebase Map Docs
- URL Search Params
- Demo Animation Phases
- Demo Build Script
- Abort Signal API
- URL API
- Abort Controller
- Engine Interfaces
- Text Decoder
- Text Encoder
- Test Describe Blocks
- Test Cases
- omp Compaction Extension
- Bash Output Trimming
- System One Client
- omp Extension Manifest
- omp TypeScript Config
- omp Host Declarations
- Settings
- CI Workflow
- Demo Script and Boundary

## God Nodes (most connected - your core abstractions)
1. `Demo` - 20 edges
2. `fitState()` - 20 edges
3. `trimOutputAttempt()` - 19 edges
4. `compact()` - 18 edges
5. `register()` - 17 edges
6. `SystemOneAsker` - 17 edges
7. `Chunk` - 16 edges
8. `Install and usage` - 15 edges
9. `ChunkView` - 14 edges
10. `fastSystemOneCompaction()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `The two budgets` --references--> `resolveOptions()`  [INFERRED]
  .claude/.codebase-info/architecture.md → src/compact.ts
- `Endpoint routing` --references--> `buildSystemOneRequest()`  [INFERRED]
  .claude/.codebase-info/architecture.md → src/request.ts
- `Common tasks` --references--> `resolveHookConfig()`  [INFERRED]
  .claude/.codebase-info/onboarding.md → hooks/fast-systemone.ts
- `Testing` --references--> `resolveHookConfig()`  [INFERRED]
  .claude/.codebase-info/patterns.md → hooks/fast-systemone.ts
- `Source of truth` --references--> `resolveHookConfig()`  [INFERRED]
  .claude/.codebase-info/tech-landscape.md → hooks/fast-systemone.ts

## Import Cycles
- None detected.

## Communities (38 total, 13 thin omitted)

### Community 0 - "Claude Code Host Types"
Cohesion: 0.00
Nodes (443): AgentCallRecord, AgentInfo, AgentLoop, AgentOfferInput, AgentOfferResult, AgentSpawnArgs, AgentSpawnInput, AgentSpawnResult (+435 more)

### Community 1 - "Hook Session Compaction"
Cohesion: 0.08
Nodes (42): Archiving what is dropped, The hook, and what happens when it fails, Logging and observability, Secrets, ArchiveFs, archiveWriter, compactSession(), decisionLog() (+34 more)

### Community 2 - "npm Package Manifest"
Cohesion: 0.09
Nodes (25): description, devDependencies, tsx@^4.19.2, @types/node@^22.10.2, typescript@^5.7.2, vitest@^2.1.8, engines, node (+17 more)

### Community 3 - "SwiftUI Demo App"
Cohesion: 0.13
Nodes (17): AppKit, ContextMeter, .body, .color, Palette, RootView, Spinner, .body (+9 more)

### Community 4 - "Library Integration Tests"
Cohesion: 0.22
Nodes (11): Options, SystemOneClient, compactMessages(), call(), fileA, fileB, fit, message() (+3 more)

### Community 5 - "Compaction Pipeline Docs"
Cohesion: 0.16
Nodes (28): Pinning, The compaction pipeline, The decision ladder, Common tasks, Error handling: the library throws, the hook decides, Invariants, Patterns and conventions, Style conventions (+20 more)

### Community 6 - "Compaction Type Definitions"
Cohesion: 0.13
Nodes (16): Option resolution, ArchiveResult, CallAction, CallAnswer, CallDecision, ChoiceAnswer, ChoiceQuestion, CompactOptions (+8 more)

### Community 7 - "Compaction State Builder"
Cohesion: 0.20
Nodes (14): callsByMessage(), compactCall(), goalFromMessages(), historyEntries(), INPUT_CHARS, inputText(), mergeCallRuns(), resultNote() (+6 more)

### Community 8 - "Demo Transcript Chunks"
Cohesion: 0.14
Nodes (16): CallScore, Chunk, .badgeLabel, .isText, .verdict, Role, assistant, toolHeader (+8 more)

### Community 9 - "Library TypeScript Config"
Cohesion: 0.13
Nodes (14): compilerOptions, declaration, declarationMap, module, moduleResolution, noEmitOnError, outDir, rootDir (+6 more)

### Community 10 - "Hook TypeScript Config"
Cohesion: 0.13
Nodes (14): compilerOptions, baseUrl, lib, module, moduleResolution, noEmit, noUncheckedIndexedAccess, paths (+6 more)

### Community 11 - "READMEs and Install Guide"
Cohesion: 0.14
Nodes (12): Configuration, fast-systemone-compaction Claude Code mod, Scope and caveat, Animated demo (macOS), Claude Code plugin, Development, fast-systemone-compaction, How it works (+4 more)

### Community 12 - "Demo Animation Playback"
Cohesion: 0.16
Nodes (5): Demo, FrameKey, .body, ScrollRequest, .body

### Community 13 - "Token Estimation and Budgets"
Cohesion: 0.15
Nodes (10): Architecture, Endpoint routing, The state-fitting ladder, The two budgets, Three artifacts, one tree, Why a hand-rolled token estimate, estimateTokens(), SystemOneAsker (+2 more)

### Community 14 - "Demo Chunk View"
Cohesion: 0.29
Nodes (7): ChunkView, .badge, .body, .content, .shownText, .tint, .toolTitle

### Community 15 - "Codebase Map Docs"
Cohesion: 0.10
Nodes (15): Documents, fast-systemone-compaction : codebase map, How to use and maintain this map, Structure, Getting to green, Git, Known state, so you do not re-derive it, Onboarding (+7 more)

### Community 17 - "Demo Animation Phases"
Cohesion: 0.29
Nodes (7): Phase, collapsing, done, idle, scanning, typing, waiting

### Community 29 - "omp Compaction Extension"
Cohesion: 0.06
Nodes (41): The omp extension, and the two passes it takes, Where its two numbers come from, Why a follow-up pass exists, Testing, CompactCtx, CompactEvent, ExtensionApi, fastSystemOneCompaction() (+33 more)

### Community 30 - "Bash Output Trimming"
Cohesion: 0.15
Nodes (23): REQUEST_OVERHEAD_CHARS, REQUEST_OVERHEAD_TOKENS, batches(), chunkOutput(), estimateOutputTokens(), finite(), looksBinary(), looksStructured() (+15 more)

### Community 31 - "System One Client"
Cohesion: 0.18
Nodes (15): systemOneAsker(), SystemOneClientOptions, JudgeLike, CompactMessagesOptions, buildSystemOneRequest(), parseSystemOneResponse(), SystemOneRequest, abridge() (+7 more)

### Community 32 - "omp Extension Manifest"
Cohesion: 0.11
Nodes (18): description, default, description, max, min, type, name, omp (+10 more)

### Community 33 - "omp TypeScript Config"
Cohesion: 0.29
Nodes (6): ./tsconfig.json, compilerOptions, noEmit, rootDir, extends, include

### Community 34 - "omp Host Declarations"
Cohesion: 0.40
Nodes (3): JudgeLike, @oh-my-pi/pi-coding-agent/config/settings, @oh-my-pi/pi-coding-agent/judgment

### Community 36 - "CI Workflow"
Cohesion: 0.08
Nodes (24): concurrency, cancel-in-progress, group, name, runs-on, steps, strategy, jobs (+16 more)

### Community 37 - "Demo Script and Boundary"
Cohesion: 0.25
Nodes (3): messages, Message, PluginOptions

## Knowledge Gaps
- **32 isolated node(s):** `AppKit`, `SwiftUI`, `user`, `assistant`, `toolHeader` (+27 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 669 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `omp Compaction Extension` to `Hook Session Compaction`, `npm Package Manifest`, `Library Integration Tests`, `Token Estimation and Budgets`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `fitState()` (e.g. with `Pinning` and `The state-fitting ladder`) actually correct?**
  _`fitState()` has 8 INFERRED edges - model-reasoned connections that need verification._
- **What connects `AppKit`, `SwiftUI`, `user` to the rest of the system?**
  _32 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Claude Code Host Types` be split into smaller, more focused modules?**
  _Cohesion score 0.004424778761061947 - nodes in this community are weakly interconnected._
- **Why does `Install and usage` connect `Compaction Pipeline Docs` to `Demo Script and Boundary`, `READMEs and Install Guide`, `Token Estimation and Budgets`, `omp Compaction Extension`, `System One Client`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `trimOutputAttempt()` (e.g. with `questionFor()` and `.ask()`) actually correct?**
  _`trimOutputAttempt()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `Hook Session Compaction` be split into smaller, more focused modules?**
  _Cohesion score 0.08309178743961353 - nodes in this community are weakly interconnected._