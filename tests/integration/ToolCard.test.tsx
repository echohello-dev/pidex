import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
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

  it('copies the exact output text and shows Copied', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const expanded = new Map<string, boolean>([[toolEntry.key, true]]);
    const { getByRole } = render(
      <TranscriptRow entry={toolEntry} expanded={expanded} />,
    );
    fireEvent.click(getByRole('button', { name: 'Copy output' }));
    expect(writeText).toHaveBeenCalledWith('Edited /repo/src/app.ts');
    await vi.waitFor(() =>
      expect(getByRole('button', { name: 'Copy output' }).textContent).toBe(
        'Copied',
      ),
    );
  });

  it('truncates long output and expands on Show more', () => {
    const longOutput = `start-${'x'.repeat(2500)}-end-marker`;
    const longEntry: Extract<Entry, { kind: 'tool' }> = {
      ...toolEntry,
      key: 'tool-3',
      output: longOutput,
    };
    const expanded = new Map<string, boolean>([[longEntry.key, true]]);
    const { container, getByRole } = render(
      <TranscriptRow entry={longEntry} expanded={expanded} />,
    );
    expect(container.textContent).not.toContain('end-marker');
    fireEvent.click(getByRole('button', { name: 'Show more' }));
    expect(container.textContent).toContain('end-marker');
    fireEvent.click(getByRole('button', { name: 'Show less' }));
    expect(container.textContent).not.toContain('end-marker');
  });

  it('renders edit input as a diff with added, removed, and context lines', () => {
    const editEntry: Extract<Entry, { kind: 'tool' }> = {
      ...toolEntry,
      key: 'tool-diff-edit',
      oldText: 'const keep = 0;\nconst before = 1;',
      newText: 'const keep = 0;\nconst after = 2;',
    };
    const expanded = new Map<string, boolean>([[editEntry.key, true]]);
    const { container } = render(
      <TranscriptRow entry={editEntry} expanded={expanded} />,
    );
    const del = container.querySelector('.wb-tool-diff-line--del');
    const add = container.querySelector('.wb-tool-diff-line--add');
    const context = container.querySelector('.wb-tool-diff-line--context');
    expect(del?.textContent).toContain('-');
    expect(del?.textContent).toContain('const before = 1;');
    expect(add?.textContent).toContain('+');
    expect(add?.textContent).toContain('const after = 2;');
    expect(context?.textContent).toContain('const keep = 0;');
  });

  it('renders write input as added lines', () => {
    const writeEntry: Extract<Entry, { kind: 'tool' }> = {
      ...toolEntry,
      key: 'tool-diff-write',
      tool: 'write',
      args: '/repo/new.ts',
      input: '/repo/new.ts\n\nexport const a = 1;\nexport const b = 2;',
      oldText: '',
      newText: 'export const a = 1;\nexport const b = 2;',
      output: 'Wrote /repo/new.ts',
    };
    const expanded = new Map<string, boolean>([[writeEntry.key, true]]);
    const { container } = render(
      <TranscriptRow entry={writeEntry} expanded={expanded} />,
    );
    const added = [...container.querySelectorAll('.wb-tool-diff-line--add')];
    expect(added).toHaveLength(2);
    expect(added[0]?.textContent).toContain('export const a = 1;');
    expect(container.querySelector('.wb-tool-diff-line--del')).toBeNull();
  });

  it('copies the exact plain input text from a diff card', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const editEntry: Extract<Entry, { kind: 'tool' }> = {
      ...toolEntry,
      key: 'tool-diff-copy',
      oldText: 'const before = 1;',
      newText: 'const after = 2;',
    };
    const expanded = new Map<string, boolean>([[editEntry.key, true]]);
    const { getByRole } = render(
      <TranscriptRow entry={editEntry} expanded={expanded} />,
    );
    fireEvent.click(getByRole('button', { name: 'Copy input' }));
    expect(writeText).toHaveBeenCalledWith(toolEntry.input);
    await vi.waitFor(() =>
      expect(getByRole('button', { name: 'Copy input' }).textContent).toBe(
        'Copied',
      ),
    );
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

  it('shows interrupted calls with partial output and no success claim', () => {
    const entry = { ...toolEntry, interrupted: true, output: 'Partial progress' };
    const { container, getByText } = render(
      <TranscriptRow entry={entry} expanded={new Map([[entry.key, true]])} />,
    );
    expect(getByText('Interrupted')).toBeTruthy();
    expect(container.querySelector('summary')?.textContent).not.toContain('Done');
    expect(container.textContent).toContain('check before retrying');
    expect(container.querySelectorAll('.wb-tool-section pre')[1]?.textContent).toBe('Partial progress');
    expect(container.querySelector('summary img')?.getAttribute('src')).not.toContain('/check.svg');
  });
});
