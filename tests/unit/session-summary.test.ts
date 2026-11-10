import { describe, expect, it } from 'vitest';
import { sessionSummary } from '../../src/renderer/session-summary';
import type { Entry } from '../../src/renderer/timeline';

const tool: Extract<Entry, { kind: 'tool' }> = {
  key: 'tool', kind: 'tool', toolId: 'call', tool: 'bash', args: 'bun test',
  input: 'bun test', output: '', running: false, ok: true,
};

describe('sessionSummary', () => {
  it('counts each outcome using the same precedence as tool cards', () => {
    const summary = sessionSummary([
      { key: 'u', kind: 'user', text: 'Fix the tests' },
      { key: 'a', kind: 'assistant', text: 'Checking.', thinking: '', streaming: false },
      tool,
      { ...tool, key: 'failed', tool: 'read', ok: false },
      { ...tool, key: 'running', running: true, interrupted: true },
      { ...tool, key: 'interrupted', interrupted: true, ok: false },
    ]);
    expect(summary.messages).toBe(2);
    expect(summary.users).toBe(1);
    expect(summary.assistants).toBe(1);
    expect(summary.tools).toEqual({ total: 4, done: 1, failed: 1, running: 1, interrupted: 1 });
    expect(summary.toolsUsed).toEqual(['bash', 'read']);
  });

  it('excerpts the latest text without including thinking or tool output', () => {
    const summary = sessionSummary([
      { key: 'u1', kind: 'user', text: 'Old request' },
      { key: 'u2', kind: 'user', text: '\n Latest\t request  ' },
      { key: 'a', kind: 'assistant', text: `Latest reply ${'x'.repeat(300)}`, thinking: 'Private reasoning', streaming: false },
      { key: 'thinking', kind: 'assistant', text: '', thinking: 'Later reasoning', streaming: false },
      { ...tool, output: 'Tool result is not a reply' },
    ]);
    expect(summary.latestRequest).toBe('Latest request');
    expect(summary.latestReply).toHaveLength(240);
    expect(summary.latestReply).toBe(`Latest reply ${'x'.repeat(224)}...`);
  });

  it('handles empty and tool-only selections without inventing message text', () => {
    expect(sessionSummary([])).toEqual({
      messages: 0, users: 0, assistants: 0,
      tools: { total: 0, done: 0, failed: 0, running: 0, interrupted: 0 },
      toolsUsed: [], latestRequest: '', latestReply: '',
    });
    const summary = sessionSummary([tool]);
    expect(summary.messages).toBe(0);
    expect(summary.tools.total).toBe(1);
    expect(summary.latestRequest).toBe('');
    expect(summary.latestReply).toBe('');
  });
});
