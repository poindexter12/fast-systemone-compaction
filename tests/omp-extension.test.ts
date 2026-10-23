/**
 * The omp extension's two handlers. `omp/index.ts` imports omp's judge and
 * settings at module scope from `@oh-my-pi/pi-coding-agent`, which is not a
 * dependency of this repo (`omp/host.d.ts` only declares it), so both modules
 * are stubbed here. `loadOmpPluginSettings` is stubbed too: the real one reads
 * omp's lockfile out of `$HOME`, and a handler test must not depend on the
 * machine it runs on. The merge itself is covered by `plugin-settings.test.ts`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fastSystemOneCompaction from '../omp/index.js';
import { OMP_PLUGIN_DEFAULTS } from '../src/plugin-settings.js';
import type { AgentTranscriptMessage } from '../src/agent-transcript.js';
import type { OmpPluginSettings } from '../src/plugin-settings.js';

/** Hoisted so the module mocks below, which run before the imports, can reach it. */
const host = vi.hoisted(() => ({
  /** Probability the stub judge answers the per-call questions with. */
  answer: 0.9,
  /**
   * Probability the stub judge answers the per-message protect questions with.
   * Low by default: the fixtures are tool traffic, not standing constraints, and
   * a protect answer over `protectThreshold` would veto every drop under test.
   */
  protectAnswer: 0,
  /** When set, the judge throws this message instead of answering. */
  failWith: undefined as string | undefined,
  judgeRequests: 0,
  resolveJudgeDeps: [] as Record<string, unknown>[],
  settings: { keepThreshold: 0.5, truncateHeadChars: 300 } as OmpPluginSettings,
  settingsLoadedFrom: [] as string[],
}));

vi.mock('@oh-my-pi/pi-coding-agent/judgment', () => ({
  resolveJudge: (deps: Record<string, unknown>) => {
    host.resolveJudgeDeps.push(deps);
    return {
      async judge(request: { questions: Record<string, unknown> }) {
        host.judgeRequests += 1;
        if (host.failWith) throw new Error(host.failWith);
        return {
          answers: Object.fromEntries(
            Object.keys(request.questions).map((name) => [
              name,
              { type: 'noul' as const, noul: name.startsWith('protect_') ? host.protectAnswer : host.answer },
            ]),
          ),
        };
      },
    };
  },
  journalJudgmentUsage: (manager: unknown) => ({ usageFor: manager }),
}));

vi.mock('@oh-my-pi/pi-coding-agent/config/settings', () => ({ settings: { stub: 'omp settings' } }));

vi.mock('../src/plugin-settings.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/plugin-settings.js')>();
  return {
    ...actual,
    loadOmpPluginSettings: async (cwd: string) => {
      host.settingsLoadedFrom.push(cwd);
      return host.settings;
    },
  };
});

interface Compaction {
  compaction: { summary: string; firstKeptEntryId: string; tokensBefore: number };
}

type BeforeHandler = (event: unknown, ctx: unknown) => Promise<Compaction | undefined>;
type CompactHandler = (event: { fromExtension: boolean }, ctx: unknown) => void;

/** Installs the extension against a recording `pi` and hands back both handlers. */
function install(): { before: BeforeHandler; compacted: CompactHandler } {
  const handlers: Record<string, unknown> = {};
  const pi = {
    on(event: string, handler: unknown) {
      handlers[event] = handler;
    },
  } as unknown as Parameters<typeof fastSystemOneCompaction>[0];
  fastSystemOneCompaction(pi);
  return {
    before: handlers.session_before_compact as BeforeHandler,
    compacted: handlers.session_compact as CompactHandler,
  };
}

interface FakeCtx {
  ui: { notify(message: string, level: string): void };
  cwd: string;
  modelRegistry: unknown;
  model: { contextWindow?: number } | undefined;
  sessionManager: unknown;
  compact?(): Promise<void>;
}

function makeCtx(options: { contextWindow?: number; compact?: 'ok' | 'rejects' | 'absent' } = {}) {
  const notices: { message: string; level: string }[] = [];
  const started: true[] = [];
  const ctx: FakeCtx = {
    ui: { notify: (message, level) => void notices.push({ message, level }) },
    cwd: '/project',
    modelRegistry: { stub: 'registry' },
    model: { contextWindow: options.contextWindow ?? 1000 },
    sessionManager: { stub: 'sessions' },
  };
  if (options.compact !== 'absent') {
    ctx.compact = async () => {
      started.push(true);
      if (options.compact === 'rejects') throw new Error('omp refused');
    };
  }
  return { ctx, notices, started };
}

const span: AgentTranscriptMessage[] = [
  { role: 'user', content: 'Fix the failing test. Leave generated files alone.' },
  { role: 'assistant', content: [{ type: 'toolCall', id: 't1', name: 'Read', arguments: { file_path: 'a.ts' } }] },
  { role: 'toolResult', toolCallId: 't1', content: [{ type: 'text', text: 'the body of a.ts' }] },
];

/** `tokensBefore` dwarfs the span, so the kept history stays above omp's line. */
function makeEvent(preparation: Record<string, unknown> = {}) {
  return {
    preparation: {
      messagesToSummarize: span,
      turnPrefixMessages: [],
      firstKeptEntryId: 'entry-9',
      tokensBefore: 90_000,
      settings: { thresholdTokens: 500 },
      ...preparation,
    },
    signal: new AbortController().signal,
  };
}

/** Two macrotask rounds: enough for the deferred follow-up and its rejection handler. */
async function flush() {
  for (let round = 0; round < 2; round += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  host.answer = 0.9;
  host.protectAnswer = 0;
  host.failWith = undefined;
  host.judgeRequests = 0;
  host.resolveJudgeDeps = [];
  host.settings = { ...OMP_PLUGIN_DEFAULTS };
  host.settingsLoadedFrom = [];
});

describe('omp extension: replacing the summary', () => {
  it('returns the kept messages verbatim, under omp s own entry id and token count', async () => {
    const { before } = install();
    const { ctx, notices } = makeCtx();

    const result = await before(makeEvent(), ctx);

    expect(result?.compaction.firstKeptEntryId).toBe('entry-9');
    expect(result?.compaction.tokensBefore).toBe(90_000);
    expect(result?.compaction.summary).toContain('Verbatim compaction.');
    expect(result?.compaction.summary).toContain('Fix the failing test. Leave generated files alone.');
    expect(result?.compaction.summary).toContain('the body of a.ts');
    expect(notices).toEqual([
      { message: 'fast-systemone-compaction: kept 3/3 messages verbatim', level: 'info' },
    ]);
  });

  it('scores the summarized span followed by the turn prefix', async () => {
    const { before } = install();
    const { ctx } = makeCtx();

    const result = await before(
      makeEvent({
        messagesToSummarize: [{ role: 'user', content: 'older turn' }],
        turnPrefixMessages: [{ role: 'user', content: 'newer prefix' }],
      }),
      ctx,
    );

    const summary = result?.compaction.summary ?? '';
    expect(summary.indexOf('older turn')).toBeGreaterThan(-1);
    expect(summary.indexOf('newer prefix')).toBeGreaterThan(summary.indexOf('older turn'));
  });

  it('resolves the judge through omp rather than a key of its own', async () => {
    const { before } = install();
    const { ctx } = makeCtx();

    await before(makeEvent(), ctx);

    expect(host.resolveJudgeDeps).toHaveLength(1);
    expect(host.resolveJudgeDeps[0]).toMatchObject({
      settings: { stub: 'omp settings' },
      registry: { stub: 'registry' },
      sessionModel: { contextWindow: 1000 },
      purpose: 'compaction',
      onUsage: { usageFor: { stub: 'sessions' } },
    });
    expect(host.judgeRequests).toBe(1);
  });

  it('drops a call the stored keepThreshold scores below, reading settings from the session cwd', async () => {
    const { before } = install();
    const { ctx } = makeCtx();
    host.settings = { keepThreshold: 0.95, truncateHeadChars: 300 };

    const result = await before(makeEvent(), ctx);

    expect(host.settingsLoadedFrom).toEqual(['/project']);
    expect(result?.compaction.summary).toContain('Fix the failing test. Leave generated files alone.');
    expect(result?.compaction.summary).not.toContain('the body of a.ts');
  });

  it('keeps omp s own summary when the judge fails', async () => {
    const { before, compacted } = install();
    const { ctx, notices, started } = makeCtx();
    host.failWith = 'judge unavailable';

    expect(await before(makeEvent(), ctx)).toBeUndefined();
    expect(notices).toEqual([
      { message: "fast-systemone-compaction: judge unavailable; using omp's summary", level: 'error' },
    ]);

    compacted({ fromExtension: true }, ctx);
    await flush();
    expect(started).toHaveLength(0);
  });

  it('leaves the span alone when nothing in it maps to a message', async () => {
    const { before } = install();
    const { ctx, notices } = makeCtx();

    const result = await before(
      makeEvent({ messagesToSummarize: [{ role: 'bashExecution', content: 'ignored' }] }),
      ctx,
    );

    expect(result).toBeUndefined();
    expect(host.judgeRequests).toBe(0);
    expect(notices).toEqual([]);
  });
});

describe('omp extension: the follow-up pass', () => {
  it('defers another pass, yields that one to omp, and compacts again after it', async () => {
    const { before, compacted } = install();
    const { ctx, notices, started } = makeCtx();

    expect(await before(makeEvent(), ctx)).toBeDefined();

    compacted({ fromExtension: true }, ctx);
    expect(started).toHaveLength(0);
    await flush();
    expect(started).toHaveLength(1);

    expect(await before(makeEvent(), ctx)).toBeUndefined();
    expect(notices.at(-1)).toEqual({
      message: 'fast-systemone-compaction: running omp compaction on the kept history',
      level: 'info',
    });

    expect(await before(makeEvent(), ctx)).toBeDefined();
  });

  it('weighs what the span lost, not the window alone, before asking for one', async () => {
    const { before, compacted } = install();
    const { ctx, started } = makeCtx();
    host.settings = { keepThreshold: 0.95, truncateHeadChars: 300 };
    const bulky: AgentTranscriptMessage[] = [
      { role: 'user', content: 'Read the file.' },
      {
        role: 'assistant',
        content: [{ type: 'toolCall', id: 't1', name: 'Read', arguments: { file_path: 'big.ts' } }],
      },
      {
        role: 'toolResult',
        toolCallId: 't1',
        content: [{ type: 'text', text: Array.from({ length: 600 }, () => 'lorem').join(' ') }],
      },
    ];

    // The span is ~600 of the window's 700 tokens and the judge drops all of
    // it, so what remains clears omp's line at 80% of a 500-token trigger.
    expect(await before(makeEvent({ messagesToSummarize: bulky, tokensBefore: 700 }), ctx)).toBeDefined();

    compacted({ fromExtension: true }, ctx);
    await flush();
    expect(started).toHaveLength(0);
  });

  it('asks for no follow-up when omp reports no usable trigger', async () => {
    const { before, compacted } = install();
    const { ctx, started } = makeCtx({ contextWindow: 0 });

    expect(await before(makeEvent(), ctx)).toBeDefined();

    compacted({ fromExtension: true }, ctx);
    await flush();
    expect(started).toHaveLength(0);
  });

  it('ignores a compaction omp ran by itself', async () => {
    const { before, compacted } = install();
    const { ctx, started } = makeCtx();

    expect(await before(makeEvent(), ctx)).toBeDefined();

    compacted({ fromExtension: false }, ctx);
    await flush();
    expect(started).toHaveLength(0);
    expect(await before(makeEvent(), ctx)).toBeDefined();
  });

  it('does not yield the next pass when the host cannot start one', async () => {
    const { before, compacted } = install();
    const { ctx } = makeCtx({ compact: 'absent' });

    expect(await before(makeEvent(), ctx)).toBeDefined();
    compacted({ fromExtension: true }, ctx);
    await flush();

    expect(await before(makeEvent(), ctx)).toBeDefined();
  });

  it('takes the yield back when the follow-up pass fails', async () => {
    const { before, compacted } = install();
    const { ctx, notices, started } = makeCtx({ compact: 'rejects' });

    expect(await before(makeEvent(), ctx)).toBeDefined();
    compacted({ fromExtension: true }, ctx);
    await flush();

    expect(started).toHaveLength(1);
    expect(notices.at(-1)).toEqual({
      message: 'fast-systemone-compaction: follow-up compaction failed (omp refused)',
      level: 'error',
    });
    expect(await before(makeEvent(), ctx)).toBeDefined();
  });
});
