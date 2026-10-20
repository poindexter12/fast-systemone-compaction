import type {
  On,
  PluginOptions,
  Register,
  SessionCompactTrigger,
  SessionMessage,
  ToolResultSummary,
  ToolUseSummary,
  TurnCompleteInput,
} from 'claude-code';

import { compact, reductionRatio, resolveOptions } from '../src/compact.js';
import { trimOutput } from '../src/output.js';
import { buildSystemOneRequest, DEFAULT_MODEL, parseSystemOneResponse } from '../src/request.js';
import { goalFromMessages } from '../src/state.js';
import type {
  ArchiveResult,
  CompactOptions,
  CompactResult,
  SystemOneAsker,
  Message,
  ToolResult,
  ToolUse,
} from '../src/types.js';

const HOOK_DEFAULTS = {
  archiveResults: true,
  bashOutput: false,
  bashOutputMinChars: 4_000,
  bashOutputChunkLines: 20,
  compactAtPercent: 60,
  minReductionRatio: 0.25,
  model: DEFAULT_MODEL,
};

export type HookFetchInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

export type HookFetchResponse = {
  status: number;
  ok: boolean;
  text: string;
};

/** The shape of `$.http.fetch`, so the hook can be driven without an engine. */
export type HookFetch = (url: string, init?: HookFetchInit) => Promise<HookFetchResponse>;

export type HookConfig = CompactOptions & {
  apiKey?: string;
  archiveResults: boolean;
  bashOutput: boolean;
  bashOutputMinChars: number;
  bashOutputChunkLines: number;
  baseUrl?: string;
  compactAtPercent: number;
  minReductionRatio: number;
  model: string;
};

function optionNumber(options: PluginOptions, key: string, fallback: number): number {
  const value = options[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function optionString(options: PluginOptions, key: string): string | undefined {
  const value = options[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function optionBoolean(options: PluginOptions, key: string, fallback: boolean): boolean {
  const value = options[key];
  return typeof value === 'boolean' ? value : fallback;
}

/** Reads the plugin's `userConfig` values; anything missing takes the defaults. */
export function resolveHookConfig(options: PluginOptions): HookConfig {
  const numbers: Partial<Omit<CompactOptions, 'goal'>> = {};
  for (const key of [
    'keepThreshold',
    'preserveRecentMessages',
    'maxStateTokens',
    'maxRequestTokens',
    'maxRequestChars',
    'truncateHeadChars',
  ] as const) {
    const value = options[key];
    if (typeof value === 'number' && Number.isFinite(value)) numbers[key] = value;
  }
  const config: HookConfig = {
    ...numbers,
    archiveResults:
      typeof options['archiveResults'] === 'boolean'
        ? options['archiveResults']
        : HOOK_DEFAULTS.archiveResults,
    bashOutput: optionBoolean(options, 'bashOutput', HOOK_DEFAULTS.bashOutput),
    bashOutputMinChars: optionNumber(
      options,
      'bashOutputMinChars',
      HOOK_DEFAULTS.bashOutputMinChars,
    ),
    bashOutputChunkLines: optionNumber(
      options,
      'bashOutputChunkLines',
      HOOK_DEFAULTS.bashOutputChunkLines,
    ),
    compactAtPercent: optionNumber(options, 'compactAtPercent', HOOK_DEFAULTS.compactAtPercent),
    minReductionRatio: optionNumber(
      options,
      'minReductionRatio',
      HOOK_DEFAULTS.minReductionRatio,
    ),
    model: optionString(options, 'model') ?? HOOK_DEFAULTS.model,
  };
  const apiKey = optionString(options, 'apiKey');
  if (apiKey) config.apiKey = apiKey;
  const baseUrl = optionString(options, 'baseUrl');
  if (baseUrl) config.baseUrl = baseUrl;
  const goal = optionString(options, 'goal');
  if (goal) config.goal = goal;
  return config;
}

/**
 * A `SystemOneAsker` over the engine's `$.http.fetch`. `baseUrl` overrides the
 * System One endpoint; unset keeps TypeSafe's.
 */
export function systemOneAsker(
  fetchFn: HookFetch,
  apiKey: string,
  model: string,
  baseUrl?: string,
): SystemOneAsker {
  return {
    async ask(state, questions) {
      const request = buildSystemOneRequest({ apiKey, model, baseUrl }, state, questions);
      const response = await fetchFn(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
      return parseSystemOneResponse(response.status, response.ok, response.text);
    },
  };
}

function toolUseSummary(tool: ToolUse): ToolUseSummary {
  const summary: ToolUseSummary = {
    tool_use_id: tool.tool_use_id,
    tool: tool.tool,
    input: tool.input,
  };
  if (tool.text !== undefined) summary.text = tool.text;
  if (tool.isError) summary.isError = true;
  return summary;
}

function toolResultSummary(result: ToolResult): ToolResultSummary {
  return {
    tool_use_id: result.tool_use_id,
    text: result.text,
    isError: result.isError ?? false,
  };
}

/**
 * Maps the library's output back onto session messages. Whatever came back
 * unchanged (a message, a tool use, a tool result) is the engine's own object,
 * handle included; anything rebuilt is a fresh message without a handle, so the
 * engine takes the edited content instead of its original.
 */
export function toSessionMessages(
  input: readonly SessionMessage[],
  output: readonly Message[],
): SessionMessage[] {
  const messages = new Map<Message, SessionMessage>();
  const uses = new Map<ToolUse, ToolUseSummary>();
  const results = new Map<ToolResult, ToolResultSummary>();
  for (const message of input) {
    messages.set(message, message);
    for (const tool of message.toolUses) uses.set(tool, tool);
    for (const result of message.toolResults ?? []) results.set(result, result);
  }
  return output.map((message) => {
    const own = messages.get(message);
    if (own) return own;
    const rebuilt: SessionMessage = {
      role: message.role,
      text: message.text,
      toolUses: message.toolUses.map((tool) => uses.get(tool) ?? toolUseSummary(tool)),
    };
    if (message.toolResults && message.toolResults.length > 0) {
      rebuilt.toolResults = message.toolResults.map(
        (result) => results.get(result) ?? toolResultSummary(result),
      );
    }
    return rebuilt;
  });
}

export type SessionCompaction = {
  result: CompactResult;
  messages: SessionMessage[];
};

/** Runs the library over a session transcript; throws when the key is missing or System One fails. */
export async function compactSession(
  messages: readonly SessionMessage[],
  config: HookConfig,
  fetchFn: HookFetch,
  archive?: ArchiveWriter,
): Promise<SessionCompaction> {
  if (!config.apiKey) throw new Error('TYPESAFE_API_KEY is not configured');
  const result = await compact(
    messages,
    systemOneAsker(fetchFn, config.apiKey, config.model, config.baseUrl),
    archive ? { ...config, archive: archive.cite } : config,
  );
  if (archive) await archive.flush();
  return { result, messages: toSessionMessages(messages, result.messages) };
}

const ARCHIVE_DIR = '.claude/fast-systemone-compaction';

/**
 * Matches output carrying credentials. Only the output is examined, because
 * archiving is offered a tool result and never the command that produced it.
 */
const SECRET_OUTPUT =
  /-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(aws_secret_access_key|api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[=:]\s*\S|:\/\/[^\s:@/]+:[^\s:@/]+@/i;

/** True when the output looks like it carries credentials. */
export function looksSecret(output: string): boolean {
  return SECRET_OUTPUT.test(output.slice(0, 20_000));
}

/**
 * Matches a command whose output is likely to carry credentials whatever the
 * output itself looks like. Only Bash trimming can check this: compaction is
 * offered a tool result long after the command that produced it.
 */
const SECRET_COMMAND =
  /(^|[|;&]\s*)(printenv|env)\b|\.env\b|\b(secret|secrets|credential|credentials|password|token|keychain|netrc|id_rsa|private[_-]?key)\b/i;

/** True when the command looks like it asks for credentials. */
export function looksSecretCommand(command: string): boolean {
  return SECRET_COMMAND.test(command);
}

type ArchiveFs = {
  fs: {
    exists: (path: string) => Promise<boolean>;
    write: (path: string, text: string) => Promise<void>;
  };
};

/** Writes archived output, creating the directory's `.gitignore` on first use. */
async function writeArchived($: ArchiveFs, files: Iterable<[string, string]>): Promise<void> {
  const entries = [...files];
  if (entries.length === 0) return;
  const ignorePath = `${ARCHIVE_DIR}/.gitignore`;
  if (!(await $.fs.exists(ignorePath))) await $.fs.write(ignorePath, '*\n');
  for (const [path, text] of entries) await $.fs.write(path, text);
}

export type ArchiveWriter = {
  /** Names the file a dropped output will be written to, for its marker. */
  cite: ArchiveResult;
  /** Writes the files named so far. */
  flush: () => Promise<void>;
};

/**
 * Saves the tool output compaction drops, so a detail buried in one can be read
 * back later instead of being lost. Paths are collected first and written on
 * flush, so a compaction the caller discards leaves nothing behind.
 * Credentials are never written.
 */
export function archiveWriter($: ArchiveFs): ArchiveWriter {
  const pending = new Map<string, string>();
  return {
    cite(toolUseId, text) {
      if (!text || looksSecret(text)) return undefined;
      const path = `${ARCHIVE_DIR}/result-${toolUseId}.txt`;
      pending.set(path, text);
      return path;
    },
    async flush() {
      await writeArchived($, pending);
      pending.clear();
    },
  };
}

function percent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

/**
 * The one-line outcome of a compaction that stood. A `precompute` dispatch
 * installs nothing: the engine keeps the result only for the compaction that
 * comes, and only if the conversation it ran over still leads. Reporting it as
 * a compaction that landed would claim a reduction the session has not had.
 */
export function outcomeNotice(
  trigger: SessionCompactTrigger,
  kept: number,
  total: number,
  result: CompactResult,
): string {
  const counts = `${kept}/${total} messages, no summary`;
  return trigger === 'precompute'
    ? `precomputed ${counts}; installed only if this conversation still leads (${summarize(result)})`
    : `kept ${counts} (${summarize(result)})`;
}

export function summarize(result: CompactResult): string {
  const { stats } = result;
  const parts = [
    stats.kept > 0 ? `${stats.kept} kept` : '',
    stats.resultsDropped > 0 ? `${stats.resultsDropped} results truncated` : '',
    stats.callsDropped > 0 ? `${stats.callsDropped} call_dropped` : '',
    stats.pinned > 0 ? `${stats.pinned} pinned` : '',
  ].filter(Boolean);
  return `${percent(reductionRatio(result))} reduction; ${
    parts.join(', ') || 'no tool calls'
  }; state ~${stats.stateTokens} tokens (${stats.stateStage}) in ${stats.requests} request(s)`;
}

const UI_LOG_MAX_CHARS = 4096;

export function decisionLog(result: CompactResult): string {
  return result.decisions
    .filter((d) => d.reason !== 'pinned')
    .map(
      (d) =>
        `${d.id}:${d.tool}:${d.action}/call=${d.keepCall.toFixed(2)}/result=${d.keepResult.toFixed(2)}`,
    )
    .join(' ');
}

export function decisionLogLines(
  result: CompactResult,
  maxChars: number = UI_LOG_MAX_CHARS,
): string[] {
  const entries = decisionLog(result).split(' ').filter(Boolean);
  if (entries.length === 0) return ['decisions: (none)'];
  const chunks: string[] = [];
  let current = '';
  for (const entry of entries) {
    const next = current ? `${current} ${entry}` : entry;
    if (current && next.length > maxChars - 24) {
      chunks.push(current);
      current = entry;
    } else current = next;
  }
  chunks.push(current);
  return chunks.map((chunk, index) =>
    chunks.length === 1
      ? `decisions: ${chunk}`
      : `decisions (${index + 1}/${chunks.length}): ${chunk}`,
  );
}

async function getApiKey(
  $: {
    env: { get: (name: string) => Promise<string | undefined> };
    settings: { read: () => Promise<Readonly<Record<string, unknown>>> };
  },
  config: HookConfig,
): Promise<string | undefined> {
  if (config.apiKey) return config.apiKey;
  const fromEnv = await $.env.get('TYPESAFE_API_KEY');
  if (fromEnv) return fromEnv;
  const settings = await $.settings.read();
  const env = settings['env'];
  if (env && typeof env === 'object') {
    const value = (env as Record<string, unknown>)['TYPESAFE_API_KEY'];
    if (typeof value === 'string' && value) return value;
  }
  return undefined;
}

function notify(
  $: {
    ui: {
      log: (text: string) => void;
      toast: (text: string, options?: { timeoutMs?: number }) => void;
    };
  },
  text: string,
): void {
  $.ui.log(text);
  $.ui.toast(text, { timeoutMs: 15_000 });
}

export const register: Register = (on: On, options: PluginOptions) => {
  const configured = resolveHookConfig(options);
  let compacting = false;

  if (configured.bashOutput) {
    on('tool.call', { tool: 'Bash' }, async ($, event, next) => {
      const answer = await next(event);
      try {
        if (answer.deny !== undefined || answer.isError || !answer.result) return answer;
        const record = answer.result;
        // Output the engine already spilled to a file is not in the context to
        // begin with, so there is nothing to save by trimming it.
        if (record.persistedOutputPath) return answer;
        // stdout only, the whole way through: the threshold, what is trimmed
        // and what is archived. stderr is where a failure announces itself and
        // is rarely long, so it is never touched and never counted.
        const stdout = record.stdout ?? '';
        if (stdout.length <= configured.bashOutputMinChars) return answer;
        const apiKey = await getApiKey($, configured);
        if (!apiKey) return answer;
        // Secret output is still trimmed, but nothing is written: the marker
        // tells the agent to re-run the command rather than naming a file that
        // would outlive the session.
        const secret = looksSecretCommand(event.command) || looksSecret(stdout);
        const path = secret
          ? undefined
          : `${ARCHIVE_DIR}/bash-${event.tool_use_id ?? Date.now()}.txt`;
        const trimmed = await trimOutput(
          {
            command: event.command,
            goal: configured.goal ?? goalFromMessages(await $.session.messages()),
            output: stdout,
            fullOutputPath: path,
          },
          systemOneAsker(
            async (url, init) => {
              const response = await $.http.fetch(url, init);
              return { status: response.status, ok: response.ok, text: response.text };
            },
            apiKey,
            configured.model,
            configured.baseUrl,
          ),
          {
            minChars: configured.bashOutputMinChars,
            chunkLines: configured.bashOutputChunkLines,
            keepThreshold: configured.keepThreshold,
            maxStateTokens: configured.maxStateTokens,
            maxRequestTokens: configured.maxRequestTokens,
            maxRequestChars: configured.maxRequestChars,
          },
        );
        if (!trimmed.trimmed) return answer;
        // Written only now, so output that came back untrimmed leaves nothing.
        if (path) await writeArchived($, [[path, stdout]]);
        const scores = trimmed.scores.map((score) => score.toFixed(2)).join(',');
        $.ui.log(
          `bash output: kept ${trimmed.kept}/${trimmed.chunks} chunks (${trimmed.charsBefore}→${trimmed.charsAfter} chars) scores=${scores}`,
        );
        $.ui.toast(
          `trimmed Bash output ${trimmed.charsBefore}→${trimmed.charsAfter} chars`,
          { timeoutMs: 8_000 },
        );
        return { result: { ...record, stdout: trimmed.output } };
      } catch (error) {
        $.ui.log(
          `bash output trim skipped (${error instanceof Error ? error.message : String(error)})`,
        );
        return answer;
      }
    });
  }

  on('session.compact', async ($, event, next) => {
    try {
      const config = { ...configured, apiKey: await getApiKey($, configured) };
      const { result, messages } = await compactSession(
        event.messages,
        config,
        async (url, init) => {
          const response = await $.http.fetch(url, init);
          return { status: response.status, ok: response.ok, text: response.text };
        },
        config.archiveResults ? archiveWriter($) : undefined,
      );
      for (const line of decisionLogLines(result)) $.ui.log(line);
      if (reductionRatio(result) < config.minReductionRatio) {
        notify(
          $,
          `fallback to built-in summary (below ${percent(config.minReductionRatio)} minimum: ${summarize(result)})`,
        );
        return next(event);
      }
      notify($, outcomeNotice(event.trigger, messages.length, event.messages.length, result));
      return { messages };
    } catch (error) {
      notify(
        $,
        `fallback to built-in summary (${error instanceof Error ? error.message : String(error)})`,
      );
      return next(event);
    }
  });

  on('turn.complete', async ($, event: TurnCompleteInput, next) => {
    if (compacting) return next(event);
    try {
      const { context } = await $.session.usage();
      if ((context.percent ?? 0) < configured.compactAtPercent) return next(event);
      compacting = true;
      await $.session.compact();
    } catch (error) {
      $.ui.log(
        `auto-compact skipped (${error instanceof Error ? error.message : String(error)})`,
      );
    } finally {
      compacting = false;
    }
    return next(event);
  });
};

export { resolveOptions };
