import { describe, expect, it } from 'vitest';
import { entriesFromMessages, applyEvent } from '../../src/renderer/timeline';
import type { Entry } from '../../src/renderer/timeline';

describe('entriesFromMessages', () => {
  it('returns no entries for empty input', () => {
    expect(entriesFromMessages([])).toEqual([]);
  });

  it('creates a user entry from a user message', () => {
    const messages = [
      {
        role: 'user',
        content: [{ type: 'text', text: 'hello world' }],
      },
    ];
    const entries = entriesFromMessages(messages);
    expect(entries).toHaveLength(1);
    const entry = entries[0];
    expect(entry?.kind).toBe('user');
    if (entry?.kind === 'user') {
      expect(entry.text).toBe('hello world');
    }
  });

  it('builds assistant entry with text only when no thinking', () => {
    const messages = [
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'hi back' }],
      },
    ];
    const [entry] = entriesFromMessages(messages);
    expect(entry?.kind).toBe('assistant');
    if (entry?.kind === 'assistant') {
      expect(entry.text).toBe('hi back');
      expect(entry.thinking).toBe('');
      expect(entry.streaming).toBe(false);
    }
  });

  it('concatenates thinking and text separately', () => {
    const messages = [
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'let me think' },
          { type: 'text', text: 'answer one' },
          { type: 'thinking', thinking: ' and more' },
          { type: 'text', text: ' + two' },
        ],
      },
    ];
    const [entry] = entriesFromMessages(messages);
    if (entry?.kind === 'assistant') {
      expect(entry.thinking).toBe('let me think\n and more');
      expect(entry.text).toBe('answer one\n + two');
    } else {
      expect.fail('expected assistant entry');
    }
  });

  it('attaches tool call to tool entry and binds tool result', () => {
    const messages = [
      {
        role: 'assistant',
        content: [
          { type: 'toolCall', id: 'call_1', name: 'bash', arguments: { command: 'ls' } },
        ],
      },
      {
        role: 'toolResult',
        toolCallId: 'call_1',
        toolName: 'bash',
        content: [{ type: 'text', text: 'file.txt\n' }],
      },
    ];
    const entries = entriesFromMessages(messages);
    expect(entries).toHaveLength(1);
    const entry = entries[0];
    expect(entry?.kind).toBe('tool');
    if (entry?.kind === 'tool') {
      expect(entry.toolId).toBe('call_1');
      expect(entry.tool).toBe('bash');
      expect(entry.args).toBe('ls');
      expect(entry.output).toBe('file.txt\n');
      expect(entry.ok).toBe(true);
      expect(entry.running).toBe(false);
    }
  });

  it('marks tool entry not-ok when toolResult.isError is true', () => {
    const messages = [
      {
        role: 'assistant',
        content: [
          { type: 'toolCall', id: 'call_x', name: 'read', arguments: { path: '/nope' } },
        ],
      },
      {
        role: 'toolResult',
        toolCallId: 'call_x',
        toolName: 'read',
        isError: true,
        content: [{ type: 'text', text: 'not found' }],
      },
    ];
    const [entry] = entriesFromMessages(messages);
    if (entry?.kind === 'tool') {
      expect(entry.ok).toBe(false);
      expect(entry.output).toBe('not found');
    } else {
      expect.fail('expected tool entry');
    }
  });

  it('interleaves user, assistant, tool, toolResult entries', () => {
    const messages = [
      { role: 'user', content: [{ type: 'text', text: 'do it' }] },
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'on it' },
          { type: 'text', text: 'sure' },
          { type: 'toolCall', id: 'tc1', name: 'bash', arguments: { command: 'pwd' } },
        ],
      },
      { role: 'toolResult', toolCallId: 'tc1', toolName: 'bash', content: [{ type: 'text', text: '/tmp' }] },
      { role: 'user', content: [{ type: 'text', text: 'thanks' }] },
    ];
    const entries = entriesFromMessages(messages);
    expect(entries.map(e => e.kind)).toEqual(['user', 'assistant', 'tool', 'user']);
  });
});

describe('applyEvent', () => {
  const empty: Entry[] = [];

  it('agent_start sets running', () => {
    const { running } = applyEvent(empty, { type: 'agent_start' });
    expect(running).toBe(true);
  });

  it('agent_end clears running', () => {
    const { running } = applyEvent(empty, { type: 'agent_end' });
    expect(running).toBe(false);
  });

  it('message_start (assistant) pushes a streaming assistant entry', () => {
    const { entries } = applyEvent(empty, {
      type: 'message_start',
      message: { role: 'assistant', content: [] },
    });
    expect(entries).toHaveLength(1);
    const entry = entries[0];
    expect(entry?.kind).toBe('assistant');
    if (entry?.kind === 'assistant') {
      expect(entry.streaming).toBe(true);
      expect(entry.text).toBe('');
      expect(entry.thinking).toBe('');
    }
  });

  it('message_start (user) is ignored', () => {
    const { entries } = applyEvent(empty, {
      type: 'message_start',
      message: { role: 'user', content: [] },
    });
    expect(entries).toEqual([]);
  });

  it('text_delta appends to the last streaming assistant', () => {
    const seeded: Entry[] = [
      { key: 'a', kind: 'assistant', text: '', thinking: '', streaming: true },
    ];
    const { entries } = applyEvent(seeded, {
      type: 'message_update',
      assistantMessageEvent: { type: 'text_delta', delta: 'hello ' },
    });
    const entry = entries[0];
    if (entry?.kind === 'assistant') {
      expect(entry.text).toBe('hello ');
    } else {
      expect.fail('expected assistant');
    }
  });

  it('multiple text_deltas accumulate in order', () => {
    let entries: Entry[] = [
      { key: 'a', kind: 'assistant', text: '', thinking: '', streaming: true },
    ];
    for (const delta of ['one', ' two', ' three']) {
      entries = applyEvent(entries, {
        type: 'message_update',
        assistantMessageEvent: { type: 'text_delta', delta },
      }).entries;
    }
    const entry = entries[0];
    if (entry?.kind === 'assistant') {
      expect(entry.text).toBe('one two three');
    } else {
      expect.fail('expected assistant');
    }
  });

  it('thinking_delta appends to thinking field separately', () => {
    const seeded: Entry[] = [
      { key: 'a', kind: 'assistant', text: '', thinking: '', streaming: true },
    ];
    const { entries } = applyEvent(seeded, {
      type: 'message_update',
      assistantMessageEvent: { type: 'thinking_delta', delta: 'hmm' },
    });
    const entry = entries[0];
    if (entry?.kind === 'assistant') {
      expect(entry.thinking).toBe('hmm');
      expect(entry.text).toBe('');
    } else {
      expect.fail('expected assistant');
    }
  });

  it('message_end flips streaming to false on the last streaming assistant', () => {
    const seeded: Entry[] = [
      { key: 'a', kind: 'assistant', text: 'done', thinking: '', streaming: true },
    ];
    const { entries } = applyEvent(seeded, { type: 'message_end' });
    const entry = entries[0];
    if (entry?.kind === 'assistant') {
      expect(entry.streaming).toBe(false);
      expect(entry.text).toBe('done');
    } else {
      expect.fail('expected assistant');
    }
  });

  it('tool_execution_start pushes a running tool entry', () => {
    const { entries } = applyEvent(empty, {
      type: 'tool_execution_start',
      toolCallId: 'call_1',
      toolName: 'bash',
      args: { command: 'ls' },
    });
    expect(entries).toHaveLength(1);
    const entry = entries[0];
    if (entry?.kind === 'tool') {
      expect(entry.tool).toBe('bash');
      expect(entry.args).toBe('ls');
      expect(entry.running).toBe(true);
    } else {
      expect.fail('expected tool');
    }
  });

  it('tool_execution_update patches partial output', () => {
    const seeded: Entry[] = [
      {
        key: 't',
        kind: 'tool',
        toolId: 'c1',
        tool: 'bash',
        args: 'ls',
        output: '',
        running: true,
        ok: true,
      },
    ];
    const { entries } = applyEvent(seeded, {
      type: 'tool_execution_update',
      toolCallId: 'c1',
      partialResult: { content: [{ type: 'text', text: 'partial' }] },
    });
    const entry = entries[0];
    if (entry?.kind === 'tool') {
      expect(entry.output).toBe('partial');
      expect(entry.running).toBe(true);
    } else {
      expect.fail('expected tool');
    }
  });

  it('tool_execution_end finalises output and ok flag', () => {
    const seeded: Entry[] = [
      {
        key: 't',
        kind: 'tool',
        toolId: 'c1',
        tool: 'bash',
        args: 'ls',
        output: '',
        running: true,
        ok: true,
      },
    ];
    const { entries } = applyEvent(seeded, {
      type: 'tool_execution_end',
      toolCallId: 'c1',
      isError: true,
      result: { content: [{ type: 'text', text: 'failed' }] },
    });
    const entry = entries[0];
    if (entry?.kind === 'tool') {
      expect(entry.output).toBe('failed');
      expect(entry.running).toBe(false);
      expect(entry.ok).toBe(false);
    } else {
      expect.fail('expected tool');
    }
  });

  it('tool events for an unknown toolCallId do not mutate entries', () => {
    const seeded: Entry[] = [];
    const { entries } = applyEvent(seeded, {
      type: 'tool_execution_update',
      toolCallId: 'unknown',
      partialResult: { content: [{ type: 'text', text: 'orphan' }] },
    });
    expect(entries).toEqual(seeded);
  });

  it('end-to-end: assistant streams text then a tool runs and finishes', () => {
    let entries: Entry[] = [];
    entries = applyEvent(entries, { type: 'agent_start' }).entries;
    entries = applyEvent(entries, {
      type: 'message_start',
      message: { role: 'assistant' },
    }).entries;
    entries = applyEvent(entries, {
      type: 'message_update',
      assistantMessageEvent: { type: 'text_delta', delta: 'I will run pwd' },
    }).entries;
    entries = applyEvent(entries, {
      type: 'message_update',
      assistantMessageEvent: { type: 'text_delta', delta: ' for you' },
    }).entries;
    entries = applyEvent(entries, { type: 'message_end' }).entries;
    entries = applyEvent(entries, {
      type: 'tool_execution_start',
      toolCallId: 't1',
      toolName: 'bash',
      args: { command: 'pwd' },
    }).entries;
    entries = applyEvent(entries, {
      type: 'tool_execution_update',
      toolCallId: 't1',
      partialResult: { content: [{ type: 'text', text: '/home' }] },
    }).entries;
    entries = applyEvent(entries, {
      type: 'tool_execution_end',
      toolCallId: 't1',
      result: { content: [{ type: 'text', text: '/home/user' }] },
    }).entries;
    entries = applyEvent(entries, { type: 'agent_end' }).entries;

    expect(entries).toHaveLength(2);
    const assistant = entries[0];
    const tool = entries[1];
    if (assistant?.kind === 'assistant') {
      expect(assistant.text).toBe('I will run pwd for you');
      expect(assistant.streaming).toBe(false);
    } else {
      expect.fail('expected assistant');
    }
    if (tool?.kind === 'tool') {
      expect(tool.output).toBe('/home/user');
      expect(tool.running).toBe(false);
      expect(tool.ok).toBe(true);
    } else {
      expect.fail('expected tool');
    }
  });
});