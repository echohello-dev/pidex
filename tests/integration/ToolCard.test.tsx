import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { act, render, cleanup, fireEvent } from '@testing-library/react';
import { TOOL_TEXT_PREVIEW_LIMIT, TranscriptRow } from '../../src/renderer/components/WorkbenchControls';
import { entriesFromMessages, type Entry } from '../../src/renderer/timeline';

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
  afterEach(() => vi.useRealTimers());

  it('loads images on demand, keeps them independent and restores disclosure after row recycling', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const [entry] = entriesFromMessages([
      { role: 'assistant', content: [{ type: 'toolCall', id: 'image', name: 'read' }] },
      { role: 'toolResult', toolCallId: 'image', content: [
        { type: 'text', text: 'Screen capture' },
        { type: 'image', mimeType: 'image/png', data: 'aW1hZ2U=' },
        { type: 'image', mimeType: 'image/png', data: 'c2Vjb25k' },
      ] },
    ]);
    const expanded = new Map([[entry.key, true]]);
    const view = render(<TranscriptRow entry={entry} expanded={expanded} />);
    expect(view.queryByRole('img', { name: /Tool output image/ })).toBeNull();
    expect(view.getByRole('button', { name: 'Show image 1' })).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(view.getByRole('button', { name: 'Show image 1' }));
    expect(view.getByRole('img', { name: 'Tool output image 1' })).toHaveAttribute('src', 'data:image/png;base64,aW1hZ2U=');
    expect(view.queryByRole('img', { name: 'Tool output image 2' })).toBeNull();
    fireEvent.click(view.getByRole('button', { name: 'Copy output' }));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledExactlyOnceWith(
      'Screen capture\nImage 1 (image/png). Image data is omitted from text copies and exports.\nImage 2 (image/png). Image data is omitted from text copies and exports.',
    ));
    fireEvent.click(view.getByRole('button', { name: 'Output details' }));
    expect(view.container.querySelector('img[alt="Tool output image 1"]')).toBeNull();
    fireEvent.click(view.getByRole('button', { name: 'Output details' }));
    expect(view.getByRole('img', { name: 'Tool output image 1' })).toBeTruthy();
    view.unmount();
    const recycled = render(<TranscriptRow entry={entry} expanded={expanded} />);
    expect(recycled.getByRole('img', { name: 'Tool output image 1' })).toBeTruthy();
    fireEvent.click(recycled.getByRole('button', { name: 'Hide image 1' }));
    expect(recycled.queryByRole('img', { name: 'Tool output image 1' })).toBeNull();
    expect(recycled.getByText('Screen capture', { exact: false })).toBeTruthy();
  });

  it('explains a broken image and allows a replacement streamed image to load', () => {
    const entry = {
      ...toolEntry, output: 'Screenshot follows',
      images: [{ number: 1, source: 'data:image/png;base64,YnJva2Vu' }],
    };
    const expanded = new Map([[entry.key, true]]);
    const view = render(<TranscriptRow entry={entry} expanded={expanded} />);
    fireEvent.click(view.getByRole('button', { name: 'Show image 1' }));
    fireEvent.error(view.getByRole('img', { name: 'Tool output image 1' }));
    expect(view.getByRole('status').textContent).toContain('Image 1 could not be displayed.');
    expect(view.getByText('Screenshot follows')).toBeTruthy();
    view.rerender(<TranscriptRow entry={{
      ...entry, images: [{ number: 1, source: 'data:image/png;base64,cmVwbGFjZW1lbnQ=' }],
    }} expanded={expanded} />);
    expect(view.queryByRole('status')).toBeNull();
    expect(view.getByRole('img', { name: 'Tool output image 1' })).toHaveAttribute('src', 'data:image/png;base64,cmVwbGFjZW1lbnQ=');
  });

  it('explains unsupported image results without mounting a preview', () => {
    const [entry] = entriesFromMessages([
      { role: 'assistant', content: [{ type: 'toolCall', id: 'image', name: 'read' }] },
      { role: 'toolResult', toolCallId: 'image', content: [{ type: 'image', mimeType: 'image/svg+xml', data: 'PHN2Zz4=' }] },
    ]);
    const view = render(<TranscriptRow entry={entry} expanded={new Map([[entry.key, true]])} />);
    expect(view.getByText(/Image 1 cannot be previewed/)).toBeTruthy();
    expect(view.queryByText('No output.')).toBeNull();
    expect(view.queryByRole('button', { name: 'Show image 1' })).toBeNull();
  });

  it.each(['input', 'output'] as const)('reports a failed %s copy while collapsed and allows retrying the complete text', async (section) => {
    const writeText = vi.fn().mockRejectedValueOnce(new Error('Clipboard denied')).mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const entry = { ...toolEntry, oldText: 'before', newText: 'after', output: 'x'.repeat(3000) };
    const { getByRole, queryByRole } = render(
      <TranscriptRow entry={entry} expanded={new Map([[entry.key, true]])} />,
    );
    if (section === 'output') fireEvent.click(getByRole('button', { name: 'Output details' }));
    const button = getByRole('button', { name: `Copy ${section}` });
    fireEvent.click(button);
    await vi.waitFor(() => expect(getByRole('alert').textContent).toBe(`Could not copy ${section}. Try Copy again.`));
    expect(button).toHaveAccessibleDescription(`Could not copy ${section}. Try Copy again.`);
    expect(button.closest('.wb-tool-section')?.querySelector('pre, .wb-tool-diff')).toBeNull();
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await vi.waitFor(() => expect(button.textContent).toBe('Copied'));
    expect(queryByRole('alert')).toBeNull();
    expect(getByRole('status').textContent).toBe(`${section === 'input' ? 'Input' : 'Output'} copied.`);
    expect(writeText.mock.calls.map(([text]) => text)).toEqual([entry[section], entry[section]]);
  });

  it('explains a missing clipboard API and keeps input feedback independent of output', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    const { getByRole, getByText } = render(
      <TranscriptRow entry={toolEntry} expanded={new Map([[toolEntry.key, true]])} />,
    );
    fireEvent.click(getByRole('button', { name: 'Copy output' }));
    await vi.waitFor(() => expect(getByRole('alert')).toBeTruthy());
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    fireEvent.click(getByRole('button', { name: 'Copy input' }));
    await vi.waitFor(() => expect(getByText('Input copied.')).toBeTruthy());
    expect(getByRole('alert').textContent).toContain('Could not copy output.');
    expect(writeText).toHaveBeenCalledExactlyOnceWith(toolEntry.input);
  });

  it('announces pending copying and prevents repeated writes until it settles', async () => {
    let complete!: () => void;
    const writeText = vi.fn(() => new Promise<void>((resolve) => { complete = resolve; }));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { getByRole } = render(
      <TranscriptRow entry={toolEntry} expanded={new Map([[toolEntry.key, true]])} />,
    );
    const button = getByRole('button', { name: 'Copy output' });
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(button.textContent).toBe('Copying…');
    expect(getByRole('status').textContent).toBe('Copying output…');
    fireEvent.click(button);
    expect(writeText).toHaveBeenCalledTimes(1);
    await act(async () => complete());
    expect(button).toBeEnabled();
    expect(button.textContent).toBe('Copied');
  });

  it.each(['resolve', 'reject'])('ignores a superseded clipboard %s after streamed output changes', async (settlement) => {
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const writeText = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((done, fail) => { resolve = done; reject = fail; }))
      .mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const view = render(<TranscriptRow entry={toolEntry} expanded={new Map([[toolEntry.key, true]])} />);
    const button = view.getByRole('button', { name: 'Copy output' });
    fireEvent.click(button);
    view.rerender(<TranscriptRow entry={{ ...toolEntry, output: 'New streamed text' }} expanded={new Map([[toolEntry.key, true]])} />);
    expect(button).toBeEnabled();
    expect(button.textContent).toBe('Copy');
    expect(view.queryByRole('status')).toBeNull();
    fireEvent.click(button);
    await vi.waitFor(() => expect(button.textContent).toBe('Copied'));
    await act(async () => settlement === 'resolve' ? resolve() : reject(new Error('Old failure')));
    expect(button.textContent).toBe('Copied');
    expect(view.queryByRole('alert')).toBeNull();
    expect(writeText.mock.calls.map(([text]) => text)).toEqual([toolEntry.output, 'New streamed text']);
  });

  it('clears previous feedback on text changes and cancels the previous success timeout', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const expanded = new Map([[toolEntry.key, true]]);
    const view = render(<TranscriptRow entry={toolEntry} expanded={expanded} />);
    const button = view.getByRole('button', { name: 'Copy output' });
    await act(async () => { fireEvent.click(button); });
    expect(button.textContent).toBe('Copied');
    act(() => vi.advanceTimersByTime(1000));
    view.rerender(<TranscriptRow entry={{ ...toolEntry, output: 'Updated result' }} expanded={expanded} />);
    expect(button.textContent).toBe('Copy');
    expect(view.queryByRole('status')).toBeNull();
    await act(async () => { fireEvent.click(button); });
    act(() => vi.advanceTimersByTime(500));
    expect(button.textContent).toBe('Copied');
    act(() => vi.advanceTimersByTime(1000));
    expect(button.textContent).toBe('Copy');
    expect(view.queryByRole('status')).toBeNull();
  });

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

  it('inspects a failed output ending, expands the full result and copies it exactly', async () => {
    const output = `build-start\n${'Compiling module…\n'.repeat(200)}ERROR: build failed\n`;
    const entry = { ...toolEntry, tool: 'bash', input: 'bun run build', output, ok: false };
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText }, configurable: true,
    });
    const { container, getByRole, getByText, queryByRole } = render(
      <TranscriptRow entry={entry} expanded={new Map([[entry.key, true]])} />,
    );
    const result = () => container.querySelector('pre')!;
    expect(getByText('Failed')).toBeTruthy();
    expect(result().textContent).toBe(output.slice(0, TOOL_TEXT_PREVIEW_LIMIT));
    expect(getByText(`Showing first 2,000 of ${output.length.toLocaleString('en-AU')} characters.`)).toBeTruthy();
    fireEvent.click(getByRole('button', { name: 'Show end' }));
    expect(result().textContent).toBe(output.slice(-TOOL_TEXT_PREVIEW_LIMIT));
    expect(result().textContent).toContain('ERROR: build failed');
    expect(getByText(`Showing last 2,000 of ${output.length.toLocaleString('en-AU')} characters.`)).toBeTruthy();
    fireEvent.click(getByRole('button', { name: 'Copy output' }));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(output));
    fireEvent.click(getByRole('button', { name: 'Show more' }));
    expect(result().textContent).toBe(output);
    expect(queryByRole('button', { name: 'Show beginning' })).toBeNull();
    fireEvent.click(getByRole('button', { name: 'Show less' }));
    expect(result().textContent).toBe(output.slice(-TOOL_TEXT_PREVIEW_LIMIT));
    fireEvent.click(getByRole('button', { name: 'Show beginning' }));
    expect(result().textContent).toBe(output.slice(0, TOOL_TEXT_PREVIEW_LIMIT));
    expect(result().scrollTop).toBe(0);
  });

  it('follows appended output in the end preview and keeps that choice through row recycling', () => {
    const expanded = new Map([[toolEntry.key, true]]);
    const entry = { ...toolEntry, running: true, output: 'progress\n'.repeat(400) };
    const view = render(<TranscriptRow entry={entry} expanded={expanded} />);
    fireEvent.click(view.getByRole('button', { name: 'Show end' }));
    const next = { ...entry, output: `${entry.output}Latest progress\n` };
    view.rerender(<TranscriptRow entry={next} expanded={expanded} />);
    expect(view.container.querySelector('pre')?.textContent).toBe(next.output.slice(-TOOL_TEXT_PREVIEW_LIMIT));
    fireEvent.click(view.getByRole('button', { name: 'Output details' }));
    const done = { ...next, running: false, output: `${next.output}Finished\n` };
    view.rerender(<TranscriptRow entry={done} expanded={expanded} />);
    expect(view.container.querySelector('pre')).toBeNull();
    view.unmount();
    const restored = render(<TranscriptRow entry={done} expanded={expanded} />);
    fireEvent.click(restored.getByRole('button', { name: 'Output details' }));
    expect(restored.container.querySelector('pre')?.textContent).toBe(done.output.slice(-TOOL_TEXT_PREVIEW_LIMIT));
    restored.unmount();
    const other = render(<TranscriptRow entry={{ ...done, key: 'other' }} expanded={new Map([...expanded, ['other', true]])} />);
    expect(other.container.querySelector('pre')?.textContent).toBe(done.output.slice(0, TOOL_TEXT_PREVIEW_LIMIT));
  });

  it.each([TOOL_TEXT_PREVIEW_LIMIT - 1, TOOL_TEXT_PREVIEW_LIMIT])('shows %i output characters in full without preview controls', (length) => {
    const output = 'x'.repeat(length);
    const { container, queryByRole } = render(
      <TranscriptRow entry={{ ...toolEntry, output }} expanded={new Map([[toolEntry.key, true]])} />,
    );
    expect(container.querySelector('pre')?.textContent).toBe(output);
    expect(queryByRole('button', { name: 'Show end' })).toBeNull();
    expect(queryByRole('button', { name: 'Show more' })).toBeNull();
  });

  it('keeps long input at the beginning when output uses an end preview', () => {
    const input = `input-start-${'i'.repeat(3000)}-input-end`;
    const output = `output-start-${'o'.repeat(3000)}-output-end`;
    const { container, getByRole, getAllByRole } = render(
      <TranscriptRow entry={{ ...toolEntry, input, output }} expanded={new Map([[toolEntry.key, true]])} />,
    );
    fireEvent.click(getByRole('button', { name: 'Show end' }));
    fireEvent.click(getByRole('button', { name: 'Input details' }));
    expect([...container.querySelectorAll('pre')].map((pre) => pre.textContent)).toEqual([
      input.slice(0, TOOL_TEXT_PREVIEW_LIMIT), output.slice(-TOOL_TEXT_PREVIEW_LIMIT),
    ]);
    expect(getAllByRole('button', { name: 'Show beginning' })).toHaveLength(1);
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
