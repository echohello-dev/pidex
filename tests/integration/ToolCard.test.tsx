import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { TOOL_TEXT_PREVIEW_LIMIT, TranscriptRow } from '../../src/renderer/components/WorkbenchControls';
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
    const { container, getByRole } = render(
      <TranscriptRow entry={toolEntry} expanded={expanded} />,
    );
    fireEvent.click(getByRole('button', { name: 'Input details' }));
    const headings = [...container.querySelectorAll('.wb-tool-section h3')].map(
      (h) => h.querySelector('button')?.getAttribute('aria-label'),
    );
    expect(headings).toEqual(['Input details', 'Output details']);
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
    const { container, getByRole } = render(
      <TranscriptRow entry={editEntry} expanded={expanded} />,
    );
    fireEvent.click(getByRole('button', { name: 'Input details' }));
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
    const { container, getByRole } = render(
      <TranscriptRow entry={writeEntry} expanded={expanded} />,
    );
    fireEvent.click(getByRole('button', { name: 'Input details' }));
    const added = [...container.querySelectorAll('.wb-tool-diff-line--add')];
    expect(added).toHaveLength(2);
    expect(added[0]?.textContent).toContain('export const a = 1;');
    expect(container.querySelector('.wb-tool-diff-line--del')).toBeNull();
  });

  it.each(['edit', 'write'])('bounds a single long %s line and preserves full inspection and copying', async (tool) => {
    const oldText = tool === 'edit' ? `before-${'x'.repeat(5000)}-old-end` : '';
    const newText = `after-${'y'.repeat(5000)}-new-end`;
    const input = tool === 'edit'
      ? `${toolEntry.args}\n\nOld:\n${oldText}\n\nNew:\n${newText}`
      : `${toolEntry.args}\n\n${newText}`;
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const entry = { ...toolEntry, tool, input, oldText, newText };
    const { container, getByRole, queryByText } = render(
      <TranscriptRow entry={entry} expanded={new Map([[entry.key, true]])} />,
    );
    fireEvent.click(getByRole('button', { name: 'Input details' }));
    const diff = container.querySelector('.wb-tool-diff')!;
    expect(diff.textContent?.length).toBe(TOOL_TEXT_PREVIEW_LIMIT);
    expect(diff.textContent).not.toContain('-new-end');
    expect(diff.textContent).not.toContain('-old-end');
    expect(queryByText('Input preview shortened. Show more or copy the full input.')).toBeTruthy();

    fireEvent.click(getByRole('button', { name: 'Copy input' }));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(input));
    fireEvent.click(getByRole('button', { name: 'Show more' }));
    expect(diff.textContent).toContain(newText);
    if (oldText) expect(diff.textContent).toContain(oldText);
    expect(queryByText('Input preview shortened. Show more or copy the full input.')).toBeNull();
    fireEvent.click(getByRole('button', { name: 'Show less' }));
    expect(diff.textContent?.length).toBe(TOOL_TEXT_PREVIEW_LIMIT);
  });

  it('bounds multiple diff rows including the final partial row', () => {
    const lines = Array.from({ length: 4 }, (_, index) => `${index}-${'x'.repeat(700)}`);
    const entry = { ...toolEntry, oldText: '', newText: lines.join('\n') };
    const { container, getByRole } = render(
      <TranscriptRow entry={entry} expanded={new Map([[entry.key, true]])} />,
    );
    fireEvent.click(getByRole('button', { name: 'Input details' }));
    const diff = container.querySelector('.wb-tool-diff')!;
    expect(diff.textContent?.length).toBe(TOOL_TEXT_PREVIEW_LIMIT);
    const rows = diff.querySelectorAll('.wb-tool-diff-line');
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toBe(`+${lines[0]}`);
    expect(rows[2].textContent).toMatch(/^\+2-x+$/);
    expect(rows[2].textContent?.length).toBeLessThan(lines[2].length);
    fireEvent.click(getByRole('button', { name: 'Show more' }));
    expect(diff.querySelectorAll('.wb-tool-diff-line')).toHaveLength(4);
    expect(diff.textContent).toContain(lines[3]);
  });

  it.each([TOOL_TEXT_PREVIEW_LIMIT - 1, TOOL_TEXT_PREVIEW_LIMIT])('does not shorten a %i-character diff because of input path or labels', (length) => {
    const newText = 'x'.repeat(length - 1);
    const entry = { ...toolEntry, input: `${toolEntry.args}\n\n${newText}`, oldText: '', newText };
    const { container, getByRole, queryByRole } = render(
      <TranscriptRow entry={entry} expanded={new Map([[entry.key, true]])} />,
    );
    fireEvent.click(getByRole('button', { name: 'Input details' }));
    expect(container.querySelector('.wb-tool-diff')?.textContent).toBe(`+${newText}`);
    expect(queryByRole('button', { name: 'Show more' })).toBeNull();
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
    expect(container.querySelector('.wb-tool-section pre')?.textContent).toBe('Partial progress');
    expect(container.querySelector('summary img')?.getAttribute('src')).not.toContain('/check.svg');
  });

  it('opens output first and toggles input and output independently', () => {
    const { getByRole, queryByText } = render(
      <TranscriptRow entry={toolEntry} expanded={new Map([[toolEntry.key, true]])} />,
    );
    const input = getByRole('button', { name: 'Input details' });
    const output = getByRole('button', { name: 'Output details' });
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(output.getAttribute('aria-expanded')).toBe('true');
    const inputBody = document.getElementById(input.getAttribute('aria-controls')!)!;
    expect(inputBody.hidden).toBe(true);
    fireEvent.click(input);
    expect(inputBody.hidden).toBe(false);
    expect(inputBody.textContent).toBe(toolEntry.input);
    fireEvent.click(output);
    expect(queryByText(toolEntry.output)).toBeNull();
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById(output.getAttribute('aria-controls')!)?.hidden).toBe(true);
  });

  it('keeps closed output hidden during streaming and reveals the latest result', () => {
    const expanded = new Map([[toolEntry.key, true]]);
    const running = { ...toolEntry, running: true, output: '' };
    const { getByRole, queryByText, rerender } = render(
      <TranscriptRow entry={running} expanded={expanded} />,
    );
    expect(queryByText('Waiting for output…')).toBeTruthy();
    fireEvent.click(getByRole('button', { name: 'Output details' }));
    rerender(<TranscriptRow entry={{ ...running, output: 'Partial output' }} expanded={expanded} />);
    expect(queryByText('Partial output')).toBeNull();
    rerender(<TranscriptRow entry={toolEntry} expanded={expanded} />);
    expect(queryByText(toolEntry.output)).toBeNull();
    fireEvent.click(getByRole('button', { name: 'Output details' }));
    expect(queryByText(toolEntry.output)).toBeTruthy();
  });

  it('restores section choices after remounting without changing other cards', () => {
    const expanded = new Map([[toolEntry.key, true]]);
    const first = render(<TranscriptRow entry={toolEntry} expanded={expanded} />);
    fireEvent.click(first.getByRole('button', { name: 'Input details' }));
    fireEvent.click(first.getByRole('button', { name: 'Output details' }));
    first.unmount();
    const restored = render(<TranscriptRow entry={toolEntry} expanded={expanded} />);
    expect(restored.getByRole('button', { name: 'Input details' }).getAttribute('aria-expanded')).toBe('true');
    expect(restored.getByRole('button', { name: 'Output details' }).getAttribute('aria-expanded')).toBe('false');
    restored.unmount();
    const other = render(<TranscriptRow entry={{ ...toolEntry, key: 'other' }} expanded={new Map([...expanded, ['other', true]])} />);
    expect(other.getByRole('button', { name: 'Input details' }).getAttribute('aria-expanded')).toBe('false');
    expect(other.getByRole('button', { name: 'Output details' }).getAttribute('aria-expanded')).toBe('true');
  });

  it('shows empty input and output explanations when their sections are open', () => {
    const { getByRole, getByText } = render(
      <TranscriptRow entry={{ ...toolEntry, input: '', output: '' }} expanded={new Map([[toolEntry.key, true]])} />,
    );
    expect(getByText('No output.')).toBeTruthy();
    fireEvent.click(getByRole('button', { name: 'Input details' }));
    expect(getByText('No input.')).toBeTruthy();
  });
});
