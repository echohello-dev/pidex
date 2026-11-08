import { describe, expect, it, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { TranscriptRow } from '../../src/renderer/components/WorkbenchControls';
import type { Entry } from '../../src/renderer/timeline';

const toolEntry: Extract<Entry, { kind: 'tool' }> = {
  key: 'tool-1',
  kind: 'tool',
  toolId: 'call_1',
  tool: 'edit',
  args: '/repo/src/app.ts',
  input: '/repo/src/app.ts\n\nOld:\nconst before = 1;\n\nNew:\nconst after = 2;',
  output: 'Edited /repo/src/app.ts',
  running: false,
  ok: true,
};

describe('<TranscriptRow> tool card', () => {
  beforeEach(() => cleanup());

  it('shows input and output as separate labelled sections when expanded', () => {
    const expanded = new Map<string, boolean>([[toolEntry.key, true]]);
    const { container } = render(
      <TranscriptRow entry={toolEntry} expanded={expanded} />,
    );
    const headings = [...container.querySelectorAll('.wb-tool-section h3')].map(
      (h) => h.textContent,
    );
    expect(headings).toEqual(['Input', 'Output']);
    expect(container.textContent).toContain('const before = 1;');
    expect(container.textContent).toContain('const after = 2;');
    expect(container.textContent).toContain('Edited /repo/src/app.ts');
    expect(container.textContent).toContain('Done');
  });

  it('shows running state and waiting output while a tool runs', () => {
    const running: Extract<Entry, { kind: 'tool' }> = {
      ...toolEntry,
      key: 'tool-2',
      tool: 'bash',
      args: 'sleep 1',
      input: 'sleep 1',
      output: '',
      running: true,
    };
    const expanded = new Map<string, boolean>([[running.key, true]]);
    const { container } = render(
      <TranscriptRow entry={running} expanded={expanded} />,
    );
    expect(container.textContent).toContain('Running');
    expect(container.textContent).toContain('Waiting for output');
  });
});
