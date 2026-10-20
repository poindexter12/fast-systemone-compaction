import { noulAnswer } from './request.js';
import { collectToolCalls, estimateTokens, fitState } from './state.js';
import { wellFormedEnd } from './text.js';
import type {
  ArchiveResult,
  CallAnswer,
  CallDecision,
  CompactOptions,
  CompactResult,
  CompactionState,
  FittedState,
  SystemOneAsker,
  SystemOneQuestions,
  Message,
  ResolvedCompactOptions,
  ToolCall,
  ToolUse,
} from './types.js';

export const DEFAULT_OPTIONS: ResolvedCompactOptions = {
  goal: '',
  keepThreshold: 0.5,
  preserveRecentMessages: 6,
  maxStateTokens: 25_000,
  maxRequestTokens: 30_000,
  maxRequestChars: Number.POSITIVE_INFINITY,
  maxStateChars: Number.POSITIVE_INFINITY,
  truncateHeadChars: 300,
};

/** Tokens the request envelope (`model`, key names) adds around state and questions. */
export const REQUEST_OVERHEAD_TOKENS = 20;
/** Characters of that same envelope; `{"model":"jev-latest","state":"","questions":{}}` is 48. */
export const REQUEST_OVERHEAD_CHARS = 50;
/**
 * Room one call's pair of questions needs. The longest tool name seen so far
 * (a 49-character MCP name) costs 156 tokens in 493 characters.
 */
const MIN_QUESTIONS_TOKENS = 160;
const MIN_QUESTIONS_CHARS = 500;

function finite(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function resolveOptions(options: CompactOptions = {}): ResolvedCompactOptions {
  const maxRequestTokens = Math.max(
    1,
    finite(options.maxRequestTokens, DEFAULT_OPTIONS.maxRequestTokens),
  );
  const maxRequestChars = Math.max(
    1,
    finite(options.maxRequestChars, DEFAULT_OPTIONS.maxRequestChars),
  );
  return {
    goal: options.goal ?? DEFAULT_OPTIONS.goal,
    keepThreshold: finite(options.keepThreshold, DEFAULT_OPTIONS.keepThreshold),
    preserveRecentMessages: Math.max(
      0,
      Math.floor(
        finite(options.preserveRecentMessages, DEFAULT_OPTIONS.preserveRecentMessages),
      ),
    ),
    // Clamped to what the request budget leaves for one batch of questions, so
    // raising the request cap alone truncates harder instead of throwing.
    maxStateTokens: Math.max(
      1,
      Math.min(
        finite(options.maxStateTokens, DEFAULT_OPTIONS.maxStateTokens),
        maxRequestTokens - REQUEST_OVERHEAD_TOKENS - MIN_QUESTIONS_TOKENS,
      ),
    ),
    maxRequestTokens,
    maxRequestChars,
    maxStateChars: Math.max(
      1,
      maxRequestChars - REQUEST_OVERHEAD_CHARS - MIN_QUESTIONS_CHARS,
    ),
    truncateHeadChars: Math.max(
      0,
      Math.floor(finite(options.truncateHeadChars, DEFAULT_OPTIONS.truncateHeadChars)),
    ),
  };
}

/** The two `noul` questions asked about one call: keep the call, keep its result. */
export function questionsFor(call: ToolCall): SystemOneQuestions {
  return {
    [`call_${call.id}`]: {
      type: 'noul',
      instructions: `Tool call ${call.id} (${call.tool}) should stay in the history: knowing this call was made, with its input, still matters for what the assistant does next`,
    },
    [`result_${call.id}`]: {
      type: 'noul',
      instructions: `The full output of tool call ${call.id} (${call.tool}, ${call.resultChars} chars) should stay in the history verbatim: the assistant still needs its contents and re-running the tool would not do`,
    },
  };
}

/**
 * Splits the candidate calls into batches whose questions, together with the
 * (always complete) state, fit one request. Both budgets have to hold: the
 * estimated tokens and, when the endpoint caps bytes, the exact characters.
 */
export function batchCalls(
  calls: readonly ToolCall[],
  state: Pick<FittedState, 'tokens' | 'chars'>,
  options: Pick<ResolvedCompactOptions, 'maxRequestTokens' | 'maxRequestChars'>,
): ToolCall[][] {
  const tokenBudget = options.maxRequestTokens - state.tokens - REQUEST_OVERHEAD_TOKENS;
  const charBudget = options.maxRequestChars - state.chars - REQUEST_OVERHEAD_CHARS;
  const batches: ToolCall[][] = [];
  let current: ToolCall[] = [];
  let currentTokens = 0;
  let currentChars = 0;
  for (const call of calls) {
    const json = JSON.stringify(questionsFor(call));
    const tokens = estimateTokens(json);
    const chars = json.length;
    if (
      current.length > 0 &&
      (currentTokens + tokens > tokenBudget || currentChars + chars > charBudget)
    ) {
      batches.push(current);
      current = [];
      currentTokens = 0;
      currentChars = 0;
    }
    if (current.length === 0 && tokens > tokenBudget) {
      throw new Error(
        `state leaves no room for questions (~${state.tokens} of ${options.maxRequestTokens} tokens)`,
      );
    }
    if (current.length === 0 && chars > charBudget) {
      throw new Error(
        `state leaves no room for questions (${state.chars} of ${options.maxRequestChars} chars)`,
      );
    }
    current.push(call);
    currentTokens += tokens;
    currentChars += chars;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

export function decideCall(
  call: Pick<ToolCall, 'id' | 'tool' | 'pinned'>,
  answer: CallAnswer,
  options: Pick<ResolvedCompactOptions, 'keepThreshold'>,
): CallDecision {
  const base = { id: call.id, tool: call.tool, ...answer };
  if (call.pinned) return { ...base, action: 'keep', reason: 'pinned' };
  if (answer.keepResult >= options.keepThreshold) {
    return { ...base, action: 'keep', reason: 'kept' };
  }
  if (answer.keepCall >= options.keepThreshold) {
    return { ...base, action: 'drop_result', reason: 'result_dropped' };
  }
  return { ...base, action: 'drop_call', reason: 'call_dropped' };
}

async function askBatch(
  asker: SystemOneAsker,
  state: CompactionState,
  batch: readonly ToolCall[],
): Promise<Map<string, CallAnswer>> {
  const questions: SystemOneQuestions = Object.assign({}, ...batch.map(questionsFor));
  const { answers } = await asker.ask(state, questions);
  return new Map(
    batch.map((call) => [
      call.id,
      {
        keepCall: noulAnswer(answers, `call_${call.id}`),
        keepResult: noulAnswer(answers, `result_${call.id}`),
      },
    ]),
  );
}

function truncatedResultText(
  text: string,
  isError: boolean,
  headChars: number,
  archivedPath?: string,
): string {
  if (text.length <= headChars + 120) return text;
  const end = wellFormedEnd(text, headChars);
  const head = end > 0 ? `${text.slice(0, end)}\n` : '';
  const where = archivedPath
    ? `; full output: ${archivedPath} (Read or grep it if needed)`
    : '; re-run the tool if needed';
  return `${head}[fast-systemone-compaction truncated ${text.length - end} chars of this tool result${
    isError ? ' (error)' : ''
  }${where}]`;
}

/**
 * One line standing in for a dropped call, naming the tool, its input and the
 * file holding the output. Only used when the output was archived, so the note
 * always carries somewhere to read it back from.
 */
function droppedCallNote(tool: ToolUse, archivedPath: string): string {
  let input = '';
  try {
    input = JSON.stringify(tool.input);
  } catch {
    input = '{}';
  }
  if (input.length > 160) input = `${wellFormedEnd(input, 159) > 0 ? input.slice(0, wellFormedEnd(input, 159)) : ''}\u2026`;
  return `[fast-systemone-compaction removed the ${tool.tool} call ${input}; full output: ${archivedPath} (Read or grep it if needed)]`;
}

/**
 * Rebuilds the conversation from the decisions. A dropped call disappears
 * together with its result; a dropped result keeps a bounded head and note.
 * Messages that lose all their content are removed; untouched messages are
 * returned as the same objects they came in as. When `archive` saves a dropped
 * output, the marker left behind cites the file it went to.
 */
export function applyDecisions(
  messages: readonly Message[],
  decisions: readonly CallDecision[],
  calls: readonly ToolCall[],
  headChars: number,
  archive?: ArchiveResult,
): Message[] {
  const byId = new Map(calls.map((call) => [call.id, call]));
  const actions = new Map<string, CallDecision['action']>();
  for (const decision of decisions) {
    const call = byId.get(decision.id);
    if (call && decision.action !== 'keep') actions.set(call.tool_use_id, decision.action);
  }
  const kept: Message[] = [];
  for (const message of messages) {
    const touched =
      message.toolUses.some((tool) => actions.has(tool.tool_use_id)) ||
      (message.toolResults ?? []).some((result) => actions.has(result.tool_use_id));
    if (!touched) {
      kept.push(message);
      continue;
    }
    // A dropped call whose output was archived leaves one line naming it and
    // the file, so a detail inside it can still be recovered.
    const notes = message.toolUses
      .filter((tool) => actions.get(tool.tool_use_id) === 'drop_call')
      .map((tool) => {
        const path = archive?.(tool.tool_use_id, tool.text ?? '');
        return path ? droppedCallNote(tool, path) : '';
      })
      .filter(Boolean);
    const toolUses = message.toolUses
      .filter((tool) => actions.get(tool.tool_use_id) !== 'drop_call')
      .map((tool) => {
        if (actions.get(tool.tool_use_id) !== 'drop_result') return tool;
        const text = truncatedResultText(
          tool.text ?? '',
          tool.isError ?? false,
          headChars,
          archive?.(tool.tool_use_id, tool.text ?? ''),
        );
        if ((tool.text ?? '') === text) return tool;
        const copy: ToolUse = {
          tool_use_id: tool.tool_use_id,
          tool: tool.tool,
          input: tool.input,
          text,
        };
        if (tool.isError) copy.isError = true;
        return copy;
      });
    const toolResults = (message.toolResults ?? [])
      .filter((result) => actions.get(result.tool_use_id) !== 'drop_call')
      .map((result) => {
        if (actions.get(result.tool_use_id) !== 'drop_result') return result;
        const text = truncatedResultText(
          result.text,
          result.isError ?? false,
          headChars,
          archive?.(result.tool_use_id, result.text),
        );
        return text === result.text
          ? result
          : {
              tool_use_id: result.tool_use_id,
              text,
              isError: result.isError,
            };
      });
    if (
      !message.toolUses.some(
        (tool) => actions.get(tool.tool_use_id) === 'drop_call',
      ) &&
      !(message.toolResults ?? []).some(
        (result) => actions.get(result.tool_use_id) === 'drop_call',
      ) &&
      toolUses.every((tool, index) => tool === message.toolUses[index]) &&
      toolResults.every(
        (result, index) => result === message.toolResults?.[index],
      )
    ) {
      kept.push(message);
      continue;
    }
    const text = notes.length > 0 ? [message.text, ...notes].filter(Boolean).join('\n') : message.text;
    if (text.trim().length === 0 && toolUses.length === 0 && toolResults.length === 0) {
      continue;
    }
    const rebuilt: Message = { role: message.role, text, toolUses };
    if (toolResults.length > 0) rebuilt.toolResults = toolResults;
    kept.push(rebuilt);
  }
  return kept;
}

/** Characters of text, tool input and tool output a message holds. */
export function messageChars(message: Message): number {
  let total = message.text.length;
  for (const tool of message.toolUses) {
    try {
      total += JSON.stringify(tool.input).length;
    } catch {
      total += 20;
    }
  }
  for (const result of message.toolResults ?? []) total += result.text.length;
  return total;
}

export function reductionRatio(result: Pick<CompactResult, 'stats'>): number {
  const { charsBefore, charsAfter } = result.stats;
  return charsBefore === 0 ? 0 : (charsBefore - charsAfter) / charsBefore;
}

function count(decisions: readonly CallDecision[], reason: CallDecision['reason']): number {
  return decisions.filter((decision) => decision.reason === reason).length;
}

/**
 * Compacts a transcript by asking System One, for every tool call outside the pinned
 * first and newest messages, whether the call and whether its result must
 * stay. The whole history (results omitted, fitted into `maxStateTokens` and,
 * when set, `maxRequestChars`) is sent as state with every batch of questions. Throws when System One fails or the
 * history cannot be fitted; the caller decides whether to fall back.
 */
export async function compact(
  messages: readonly Message[],
  asker: SystemOneAsker,
  options: CompactOptions = {},
): Promise<CompactResult> {
  const started = Date.now();
  const resolved = resolveOptions(options);
  const calls = collectToolCalls(messages, resolved.preserveRecentMessages);
  const candidates = calls.filter((call) => !call.pinned);
  const charsBefore = messages.reduce((sum, message) => sum + messageChars(message), 0);

  let fitted: { tokens: number; stage: string } = { tokens: 0, stage: '' };
  let batches: ToolCall[][] = [];
  const answers = new Map<string, CallAnswer>();
  if (candidates.length > 0) {
    const state = fitState(messages, calls, resolved);
    fitted = state;
    batches = batchCalls(candidates, state, resolved);
    const answered = await Promise.all(
      batches.map((batch) => askBatch(asker, state.state, batch)),
    );
    for (const map of answered) for (const [id, answer] of map) answers.set(id, answer);
  }

  const decisions = calls.map((call) =>
    decideCall(call, answers.get(call.id) ?? { keepCall: 1, keepResult: 1 }, resolved),
  );
  const kept = applyDecisions(
    messages,
    decisions,
    calls,
    resolved.truncateHeadChars,
    options.archive,
  );
  return {
    messages: kept,
    decisions,
    stats: {
      messagesBefore: messages.length,
      messagesAfter: kept.length,
      charsBefore,
      charsAfter: kept.reduce((sum, message) => sum + messageChars(message), 0),
      calls: calls.length,
      kept: count(decisions, 'kept'),
      resultsDropped: count(decisions, 'result_dropped'),
      callsDropped: count(decisions, 'call_dropped'),
      pinned: count(decisions, 'pinned'),
      stateTokens: fitted.tokens,
      stateStage: fitted.stage,
      requests: batches.length,
      ms: Date.now() - started,
    },
  };
}
