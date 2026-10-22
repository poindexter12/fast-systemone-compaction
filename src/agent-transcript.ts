import type { Message, ToolResult, ToolUse } from './types.js';

/** One content block of an omp agent message, only the fields compaction reads. */
export interface AgentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  arguments?: Record<string, unknown>;
  toolCallId?: string;
  toolName?: string;
  content?: readonly AgentBlock[];
  isError?: boolean;
}

/** One omp agent message. Tool results are their own `toolResult` role. */
export interface AgentTranscriptMessage {
  role: string;
  content?: string | readonly AgentBlock[];
  toolCallId?: string;
  toolName?: string;
  isError?: boolean;
}

function textOf(content: string | readonly AgentBlock[] | undefined): string {
  if (typeof content === 'string') return content;
  if (!content) return '';
  return content
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n');
}

function toolUsesOf(content: string | readonly AgentBlock[] | undefined): ToolUse[] {
  if (!Array.isArray(content)) return [];
  return content
    .filter((block) => block.type === 'toolCall' && typeof block.id === 'string' && typeof block.name === 'string')
    .map((block) => ({
      tool_use_id: block.id as string,
      tool: block.name as string,
      input: block.arguments ?? {},
    }));
}

function toolResultOf(message: AgentTranscriptMessage): ToolResult | undefined {
  if (message.role !== 'toolResult' || typeof message.toolCallId !== 'string') return undefined;
  const nested = Array.isArray(message.content) ? textOf(message.content) : textOf(message.content);
  return { tool_use_id: message.toolCallId, text: nested, isError: message.isError === true };
}

/**
 * Maps omp agent messages onto the library's `Message`s. A `toolResult`
 * message becomes a user message carrying that result. Anything that is not
 * user, assistant, or toolResult is skipped.
 */
export function fromAgentMessages(messages: readonly AgentTranscriptMessage[]): Message[] {
  const out: Message[] = [];
  for (const message of messages) {
    if (message.role === 'toolResult') {
      const result = toolResultOf(message);
      if (result) out.push({ role: 'user', text: '', toolUses: [], toolResults: [result] });
      continue;
    }
    if (message.role !== 'user' && message.role !== 'assistant') continue;
    out.push({
      role: message.role,
      text: textOf(message.content),
      toolUses: toolUsesOf(message.content),
    });
  }
  return out;
}

function fence(value: unknown): string {
  return `\`\`\`\n${typeof value === 'string' ? value : JSON.stringify(value)}\n\`\`\``;
}

/**
 * Renders kept messages as verbatim text. omp's compaction hook can only
 * replace the summarized span with a string, so this is that string: original
 * wording, dropped tool calls absent, truncated results already marked.
 */
export function renderVerbatim(messages: readonly Message[]): string {
  const parts: string[] = [
    'Verbatim compaction. Nothing below was summarized. Tool calls the judge dropped are gone; a truncated result keeps its head and says so.',
  ];
  for (const message of messages) {
    const lines: string[] = [`## ${message.role}`];
    if (message.text) lines.push(message.text);
    for (const call of message.toolUses) {
      lines.push(`### ${call.tool} (${call.tool_use_id})`, fence(call.input));
    }
    for (const result of message.toolResults ?? []) {
      lines.push(`### result ${result.tool_use_id}${result.isError ? ' (error)' : ''}`, result.text);
    }
    if (lines.length > 1) parts.push(lines.join('\n'));
  }
  return parts.join('\n\n');
}
