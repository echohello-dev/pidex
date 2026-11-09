import { describe, expect, it } from 'vitest';
import {
  sessionExportFilename,
  sessionExportMarkdown,
} from '../../src/renderer/export-session';
import type { Entry } from '../../src/renderer/timeline';

const exportedAt = new Date('2026-11-08T01:02:03.000Z');

const bashDone: Extract<Entry, { kind: 'tool' }> = {
  key: 'tool-1',
  kind: 'tool',
  toolId: 'call_1',
  tool: 'bash',
  args: 'npm test',
  input: 'npm test',
  output: '3 passed',
  running: false,
  ok: true,
};

describe('sessionExportMarkdown', () => {
  it('writes the full conversation with context and tool input', () => {
    const markdown = sessionExportMarkdown({
      title: 'Fix the export',
      cwd: '/repo/app',
      model: 'anthropic/claude-test',
      exportedAt,
      entries: [
        { key: 'u1', kind: 'user', text: 'please fix it' },
        {
          key: 'a1',
          kind: 'assistant',
          text: 'On it.',
          thinking: 'check the tests first',
          streaming: false,
        },
        bashDone,
      ],
    });
    expect(markdown).toBe(
      [
        '# Fix the export',
        '',
        'Exported from pidex at 2026-11-08T01:02:03.000Z.',
        '',
        'It ran in `/repo/app`.',
        '',
        'It used `anthropic/claude-test`.',
        '',
        '## Continue elsewhere',
        '',
        'This file is portable context, not a restorable Pi session archive.',
        '',
        '- Same folder (`/repo/app`): open that root in Pidex, go to Sessions, select this session, and choose Resume. Choose Resume in new fork when continuing from an earlier entry.',
        '- New folder: open the destination folder as a root in Pidex, start a new session there, and share this file as context for the first message. Attach it or paste its contents.',
        '- Saved history stays with the original folder, so Resume will not find this session under a new folder.',
        '',
        '## You',
        '',
        'please fix it',
        '',
        '## Pi',
        '',
        'On it.',
        '',
        '### Thinking',
        '',
        'check the tests first',
        '',
        '## bash / npm test (Done)',
        '',
        '### Input',
        '',
        '```',
        'npm test',
        '```',
        '',
        '### Output',
        '',
        '```',
        '3 passed',
        '```',
        '',
      ].join('\n'),
    );
  });

  it('marks failed and running tools with the card wording', () => {
    const failed = sessionExportMarkdown({
      title: 'T',
      cwd: '',
      model: '',
      exportedAt,
      entries: [{ ...bashDone, key: 'f', ok: false, output: 'boom' }],
    });
    expect(failed).toContain('## bash / npm test (Failed)');
    const running = sessionExportMarkdown({
      title: 'T',
      cwd: '',
      model: '',
      exportedAt,
      entries: [{ ...bashDone, key: 'r', running: true, output: '' }],
    });
    expect(running).toContain('## bash / npm test (Running)');
  });

  it('keeps an empty input and output readable', () => {
    const markdown = sessionExportMarkdown({
      title: 'T',
      cwd: '',
      model: '',
      exportedAt,
      entries: [{ ...bashDone, key: 'e', input: '', output: '' }],
    });
    expect(markdown).toContain('### Input\n\nNo input.');
    expect(markdown).toContain('### Output\n\nNo output.');
  });

  it('widens the fence when the output holds backticks', () => {
    const markdown = sessionExportMarkdown({
      title: 'T',
      cwd: '',
      model: '',
      exportedAt,
      entries: [
        { ...bashDone, key: 'b', output: 'before\n```\ncode\n```\nafter' },
      ],
    });
    expect(markdown).toContain('\n````\nbefore\n```\ncode\n```\nafter\n````');
  });

  it('guides a reader to resume or hand off in a new folder', () => {
    const markdown = sessionExportMarkdown({
      title: 'T',
      cwd: '/repo/app',
      model: '',
      exportedAt,
      entries: [{ key: 'u1', kind: 'user', text: 'hi' }],
    });
    expect(markdown).toContain('## Continue elsewhere');
    expect(markdown).toContain('not a restorable Pi session archive');
    expect(markdown).toContain(
      'Saved history stays with the original folder',
    );
    expect(markdown).toContain('start a new session there');
  });

  it('keeps the handoff generic when the folder is unknown', () => {
    const markdown = sessionExportMarkdown({
      title: 'T',
      cwd: '  ',
      model: '',
      exportedAt,
      entries: [{ key: 'u1', kind: 'user', text: 'hi' }],
    });
    expect(markdown).toContain('open the original root in Pidex');
    expect(markdown).not.toContain('Same folder (`');
  });

  it('handles an empty selection and a blank title', () => {
    const markdown = sessionExportMarkdown({
      title: '  ',
      cwd: '',
      model: '',
      exportedAt,
      entries: [],
    });
    expect(markdown).toContain('# Untitled session');
    expect(markdown).toContain('No messages in this selection.');
    expect(markdown).not.toContain('It ran in');
    expect(markdown).not.toContain('It used');
    expect(markdown).not.toContain('Continue elsewhere');
  });
});

describe('sessionExportFilename', () => {
  it('builds the name from the title and export day', () => {
    expect(sessionExportFilename('Fix: the Bug!', exportedAt)).toBe(
      'pidex-fix-the-bug-2026-11-08.md',
    );
  });

  it('falls back when the title has no usable words', () => {
    expect(sessionExportFilename('!!!', exportedAt)).toBe(
      'pidex-session-2026-11-08.md',
    );
    expect(sessionExportFilename('', exportedAt)).toBe(
      'pidex-session-2026-11-08.md',
    );
  });
});
