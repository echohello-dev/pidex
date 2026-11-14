import { describe, expect, it } from 'vitest';
import {
  sessionExportFilename,
  sessionExportMarkdown,
} from '../../src/renderer/export-session';
import { entriesFromMessages, type Entry } from '../../src/renderer/timeline';

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

const source = {
  sessionId: 'parser-session', archivePath: '/sessions/parser.jsonl',
  entryId: 'selected-entry', archiveTipId: 'selected-entry', canContinue: true,
};

describe('sessionExportMarkdown', () => {
  it('identifies the exact saved archive tip and explains that the snapshot can advance', () => {
    const markdown = sessionExportMarkdown({
      title: 'Parser', cwd: '/repo', model: '', exportedAt, source,
      entries: [{ key: 'u', kind: 'user', text: 'Fix the parser' }],
    });
    expect(markdown).toContain('- Pi session `parser-session`.');
    expect(markdown).toContain('- Source archive `/sessions/parser.jsonl`.');
    expect(markdown).toContain('- Selected entry `selected-entry` (archive tip).');
    expect(markdown).toContain('- Archive tip at export `selected-entry`.');
    expect(markdown).toContain('select entry `selected-entry`, and choose Resume.');
    expect(markdown).toContain('If the archive has advanced');
    expect(markdown).toContain('The archive may change before you return.');
  });

  it('distinguishes a selected ancestor or alternate branch from the archive tip', () => {
    const markdown = sessionExportMarkdown({
      title: 'Parser', cwd: '/repo', model: '', exportedAt,
      source: { ...source, entryId: 'earlier-entry' },
      entries: [{ key: 'u', kind: 'user', text: 'Fix the parser' }],
    });
    expect(markdown).toContain('- Selected entry `earlier-entry`.');
    expect(markdown).toContain('- Archive tip at export `selected-entry`.');
    expect(markdown).toContain('select entry `earlier-entry`, and choose Resume in new fork.');
    expect(markdown).not.toContain('`earlier-entry` (archive tip)');
  });

  it('preserves readable history identifiers without promising unsafe continuation', () => {
    const markdown = sessionExportMarkdown({
      title: 'Legacy parser', cwd: '/repo', model: '', exportedAt,
      source: { ...source, canContinue: false },
      entries: [{ key: 'u', kind: 'user', text: 'Fix the parser' }],
    });
    expect(markdown).toContain('## Saved selection');
    expect(markdown).toContain('Pidex could not validate it for continuation');
    expect(markdown).toContain('Use this file as context in a new session');
    expect(markdown).not.toContain('and choose Resume');
  });

  it('records an empty archive without inventing an entry or offering continuation', () => {
    const markdown = sessionExportMarkdown({
      title: 'Empty', cwd: '/repo', model: '', exportedAt, entries: [],
      source: { ...source, entryId: null, archiveTipId: null },
    });
    expect(markdown).toContain('- Pi session `parser-session`.');
    expect(markdown).toContain('no selected conversation entry');
    expect(markdown).toContain('no conversation tip');
    expect(markdown).not.toContain('Continue elsewhere');
  });

  it('keeps backticks and line breaks in archive identifiers inside readable inline code', () => {
    const markdown = sessionExportMarkdown({
      title: 'Parser', cwd: '', model: '', exportedAt, entries: [],
      source: { ...source, archivePath: '/sessions/a`b\n# pretend-heading.jsonl', sessionId: '`parser`' },
    });
    expect(markdown).toContain('- Source archive ``/sessions/a`b # pretend-heading.jsonl``.');
    expect(markdown).toContain('- Pi session `` `parser` ``.');
    expect(markdown).not.toContain('\n# pretend-heading');
  });

  it('exports image result notices and accompanying text without inline image data', () => {
    const markdown = sessionExportMarkdown({
      title: 'Inspect an image', cwd: '/repo/app', model: '', exportedAt,
      entries: entriesFromMessages([
        { role: 'assistant', content: [{ type: 'toolCall', id: 'read', name: 'read', arguments: { path: 'view.png' } }] },
        { role: 'toolResult', toolCallId: 'read', content: [
          { type: 'text', text: 'The current screen' },
          { type: 'image', mimeType: 'image/png', data: 'aW1hZ2U=' },
        ] },
      ]),
    });
    expect(markdown).toContain('The current screen');
    expect(markdown).toContain('Image 1 (image/png). Image data is omitted from text copies and exports.');
    expect(markdown).not.toContain('No output.');
    expect(markdown).not.toContain('aW1hZ2U=');
    expect(markdown).not.toContain('data:image');
  });

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
        '## Summary',
        '',
        '- 2 messages: 1 from you, 1 from Pi.',
        '- 1 tool call: 1 done, 0 failed, 0 running.',
        '- Tools used: bash.',
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

  it('counts interrupted tools separately and retains their partial output', () => {
    const markdown = sessionExportMarkdown({
      title: 'Interrupted build', cwd: '/repo/app', model: '', exportedAt,
      entries: [bashDone, { ...bashDone, key: 'interrupted', interrupted: true, output: 'Building...' }],
    });
    expect(markdown).toContain('2 tool calls: 1 done, 0 failed, 0 running, 1 interrupted.');
    expect(markdown).toContain('## bash / npm test (Interrupted)');
    expect(markdown).toContain('Building...');
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

  it('summarises tool outcomes and distinct tools in first-use order', () => {
    const markdown = sessionExportMarkdown({
      title: 'T',
      cwd: '',
      model: '',
      exportedAt,
      entries: [
        { key: 'u1', kind: 'user', text: 'hi' },
        { ...bashDone, key: 't1' },
        { ...bashDone, key: 't2', tool: 'read', ok: false, output: 'boom' },
        { ...bashDone, key: 't3', tool: 'bash', running: true, output: '' },
      ],
    });
    expect(markdown).toContain(
      '- 1 message: 1 from you, 0 from Pi.',
    );
    expect(markdown).toContain(
      '- 3 tool calls: 1 done, 1 failed, 1 running.',
    );
    expect(markdown).toContain('- Tools used: bash, read.');
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
    expect(markdown).not.toContain('## Summary');
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
