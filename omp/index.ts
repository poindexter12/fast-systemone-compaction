/**
 * omp extension: replaces compaction's summary with the verbatim messages this
 * library kept. Scoring goes through omp's built-in judge (the `judge` model
 * role), not a TypeSafe key of our own.
 *
 * Install by pointing omp at this directory (`extensions:` or `omp plugin`).
 * The manifest entry is `omp.extensions` in `omp/package.json`.
 */
import { journalJudgmentUsage, resolveJudge } from '@oh-my-pi/pi-coding-agent/judgment';
import { settings } from '@oh-my-pi/pi-coding-agent/config/settings';
import { fromAgentMessages, renderVerbatim } from '../src/agent-transcript.js';
import { compact } from '../src/compact.js';
import { askerFromJudge } from '../src/judge-asker.js';
import { estimateTokens } from '../src/state.js';
import { clearsOmpThreshold, ompTriggerTokens } from '../src/omp-threshold.js';
import { loadOmpPluginSettings } from '../src/plugin-settings.js';
import type { AgentTranscriptMessage } from '../src/agent-transcript.js';

interface CompactEvent {
  preparation: {
    messagesToSummarize: readonly AgentTranscriptMessage[];
    turnPrefixMessages: readonly AgentTranscriptMessage[];
    firstKeptEntryId: string;
    tokensBefore: number;
    settings?: { thresholdTokens?: number; thresholdPercent?: number };
  };
  signal: AbortSignal;
}

interface CompactCtx {
  ui: { notify(message: string, level: 'info' | 'warning' | 'error'): void };
  cwd: string;
  modelRegistry: unknown;
  model: { contextWindow?: number } | undefined;
  sessionManager: unknown;
  /** Present on omp's extension context. Starts another compaction pass. */
  compact?(): Promise<void>;
}

interface ExtensionApi {
  on(
    event: 'session_before_compact',
    handler: (event: CompactEvent, ctx: CompactCtx) => Promise<{ compaction: { summary: string; firstKeptEntryId: string; tokensBefore: number } } | undefined>,
  ): void;
  on(event: 'session_compact', handler: (event: { fromExtension: boolean }, ctx: CompactCtx) => void): void;
}

export default function fastSystemOneCompaction(pi: ExtensionApi): void {
  /** The next before-hook is the follow-up pass and must not replace omp's summary. */
  let yieldNext = false;
  /** The verbatim result just committed is still above omp's recovery line. */
  let followUp = false;

  pi.on('session_before_compact', async (event, ctx) => {
    if (yieldNext) {
      yieldNext = false;
      ctx.ui.notify('fast-systemone-compaction: running omp compaction on the kept history', 'info');
      return undefined;
    }

    const source = [...event.preparation.messagesToSummarize, ...event.preparation.turnPrefixMessages];
    const messages = fromAgentMessages(source);
    if (messages.length === 0) return undefined;

    const judge = resolveJudge({
      settings,
      registry: ctx.modelRegistry,
      sessionModel: ctx.model,
      purpose: 'compaction',
      onUsage: journalJudgmentUsage(ctx.sessionManager),
    });

    const options = await loadOmpPluginSettings(ctx.cwd);
    try {
      const result = await compact(messages, askerFromJudge(judge, event.signal), {
        preserveRecentMessages: 0,
        keepThreshold: options.keepThreshold,
        truncateHeadChars: options.truncateHeadChars,
      });
      const summary = renderVerbatim(result.messages);
      const spanBefore = estimateTokens(renderVerbatim(messages));
      const tokensAfter = Math.max(0, event.preparation.tokensBefore - spanBefore + estimateTokens(summary));
      const trigger = ompTriggerTokens(ctx.model?.contextWindow ?? 0, event.preparation.settings ?? {});
      followUp = trigger !== undefined && !clearsOmpThreshold(tokensAfter, trigger);
      ctx.ui.notify(
        `fast-systemone-compaction: kept ${result.stats.messagesAfter}/${result.stats.messagesBefore} messages verbatim`,
        'info',
      );
      return {
        compaction: {
          summary,
          firstKeptEntryId: event.preparation.firstKeptEntryId,
          tokensBefore: event.preparation.tokensBefore,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      ctx.ui.notify(`fast-systemone-compaction: ${message}; using omp's summary`, 'error');
      return undefined;
    }
  });

  pi.on('session_compact', (event, ctx) => {
    if (!event.fromExtension || !followUp) return;
    followUp = false;
    if (!ctx.compact) return;
    yieldNext = true;
    // session_compact runs inside the pass that is still marked compacting.
    // Wait until that pass finishes, then start omp's method order. The kept
    // summary is already stored, so the next pass summarizes that history.
    const start = ctx.compact.bind(ctx);
    setTimeout(() => {
      void start().catch((error: unknown) => {
        yieldNext = false;
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.notify(`fast-systemone-compaction: follow-up compaction failed (${message})`, 'error');
      });
    }, 0);
  });
}
