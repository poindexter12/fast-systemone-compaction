import { describe, expect, it } from 'vitest';
import { askerFromJudge } from '../src/judge-asker.js';
import { fromAgentMessages, renderVerbatim } from '../src/agent-transcript.js';
import { compact } from '../src/compact.js';
import type { SystemOneAsker } from '../src/types.js';

describe('omp transcript', () => {
  it('pairs tool calls with the following toolResult message', () => {
    const messages = fromAgentMessages([
      { role: 'user', content: [{ type: 'text', text: 'Read a.ts' }] },
      {
        role: 'assistant',
        content: [{ type: 'toolCall', id: 'c1', name: 'Read', arguments: { file_path: 'a.ts' } }],
      },
      { role: 'toolResult', toolCallId: 'c1', toolName: 'Read', content: [{ type: 'text', text: 'export const a = 1;' }], isError: false },
      { role: 'bashExecution', content: 'ignored' },
    ]);
    expect(messages).toEqual([
      { role: 'user', text: 'Read a.ts', toolUses: [] },
      { role: 'assistant', text: '', toolUses: [{ tool_use_id: 'c1', tool: 'Read', input: { file_path: 'a.ts' } }] },
      { role: 'user', text: '', toolUses: [], toolResults: [{ tool_use_id: 'c1', text: 'export const a = 1;', isError: false }] },
    ]);
  });

  it('renders kept messages verbatim and omits empty ones', () => {
    const text = renderVerbatim([
      { role: 'user', text: 'Keep this exact.', toolUses: [] },
      { role: 'assistant', text: '', toolUses: [] },
    ]);
    expect(text).toContain('Keep this exact.');
    expect(text).not.toContain('## assistant');
  });

  it('scores through a judge and keeps the answer text', async () => {
    const judge = askerFromJudge({
      async judge(request) {
        const answers: Record<string, { type: 'noul'; noul: number }> = {};
        for (const id of Object.keys(request.questions)) answers[id] = { type: 'noul', noul: 0 };
        return { answers };
      },
    });
    const messages = fromAgentMessages([
      { role: 'user', content: 'Fix the test. Do not touch generated.' },
      { role: 'assistant', content: [{ type: 'toolCall', id: 'c1', name: 'Read', arguments: { file_path: 'old.ts' } }] },
      { role: 'toolResult', toolCallId: 'c1', content: [{ type: 'text', text: 'stale file body' }] },
      { role: 'assistant', content: 'Done.' },
    ]);
    const result = await compact(messages, judge as SystemOneAsker, { preserveRecentMessages: 0 });
    expect(result.stats.callsDropped).toBe(1);
    const rendered = renderVerbatim(result.messages);
    expect(rendered).toContain('Fix the test. Do not touch generated.');
    expect(rendered).toContain('Done.');
    expect(rendered).not.toContain('stale file body');
  });
});
