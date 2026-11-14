import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { HistoryExport } from '../../src/renderer/components/HistoryExport';
import { sessionExportMarkdown, type SessionExportInput } from '../../src/renderer/export-session';

const input: Omit<SessionExportInput, 'exportedAt'> = {
  title: 'Recover the parser', cwd: '/code/api', model: 'test-model',
  source: {
    sessionId: 'parser', archivePath: '/sessions/parser.jsonl',
    entryId: 'earlier', archiveTipId: 'latest', canContinue: true,
  },
  entries: [
    { key: 'u', kind: 'user', text: 'Fix the parser' },
    { key: 'a', kind: 'assistant', text: 'Use a buffered parser', thinking: 'Check boundaries', streaming: false },
    { key: 't', kind: 'tool', toolId: 't', tool: 'bash', args: 'bun test', input: 'bun test', output: 'failed', running: false, ok: false },
  ],
};
const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
const createDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
const revokeDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
function clipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true, value: { writeText },
  });
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
  else Reflect.deleteProperty(navigator, 'clipboard');
  for (const [key, descriptor] of [
    ['createObjectURL', createDescriptor], ['revokeObjectURL', revokeDescriptor],
  ] as const) {
    if (descriptor) Object.defineProperty(URL, key, descriptor);
    else Reflect.deleteProperty(URL, key);
  }
});

describe('<HistoryExport>', () => {
  it('copies the same complete Markdown handoff as Export and allows copying again', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const exportedAt = new Date('2026-11-12T01:02:03Z');
    vi.setSystemTime(exportedAt);
    const writeText = vi.fn().mockResolvedValue(undefined);
    clipboard(writeText);
    const { getByRole } = render(<HistoryExport input={input} />);
    fireEvent.click(getByRole('button', { name: 'Copy context' }));
    expect(writeText).toHaveBeenCalledWith(sessionExportMarkdown({ ...input, exportedAt }));
    expect(writeText.mock.calls[0][0]).toContain('- Selected entry `earlier`.');
    expect(writeText.mock.calls[0][0]).toContain('and choose Resume in new fork.');
    await waitFor(() => expect(getByRole('status').textContent).toContain('Paste it into a new session'));
    fireEvent.click(getByRole('button', { name: 'Copy context' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
  });

  it('disables both actions until readable history is supplied, including empty history', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    clipboard(writeText);
    const { getByRole, rerender } = render(<HistoryExport input={null} />);
    expect(getByRole('button', { name: 'Copy context' })).toBeDisabled();
    expect(getByRole('button', { name: 'Export' })).toBeDisabled();
    fireEvent.click(getByRole('button', { name: 'Copy context' }));
    expect(writeText).not.toHaveBeenCalled();
    rerender(<HistoryExport input={{ ...input, entries: [] }} />);
    expect(getByRole('button', { name: 'Export' })).toBeEnabled();
    fireEvent.click(getByRole('button', { name: 'Copy context' }));
    await waitFor(() => expect(getByRole('status')).toBeTruthy());
    expect(writeText.mock.calls[0][0]).toContain('No messages in this selection.');
  });

  it('prevents duplicate pending copies and keeps clipboard failures retryable', async () => {
    let reject!: (error: Error) => void;
    const writeText = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((_resolve, fail) => { reject = fail; }))
      .mockResolvedValue(undefined);
    clipboard(writeText);
    const { getByRole, queryByRole } = render(<HistoryExport input={input} />);
    fireEvent.click(getByRole('button', { name: 'Copy context' }));
    expect(getByRole('button', { name: 'Copy context' })).toBeDisabled();
    expect(getByRole('button', { name: 'Export' })).toBeEnabled();
    fireEvent.click(getByRole('button', { name: 'Copy context' }));
    expect(writeText).toHaveBeenCalledTimes(1);
    reject(new Error('Clipboard denied'));
    await waitFor(() => expect(getByRole('alert').textContent).toContain('Try again or use Export'));
    fireEvent.click(getByRole('button', { name: 'Copy context' }));
    await waitFor(() => expect(getByRole('status')).toBeTruthy());
    expect(queryByRole('alert')).toBeNull();
  });

  it('offers Export when the clipboard API is unavailable', async () => {
    Reflect.deleteProperty(navigator, 'clipboard');
    const { getByRole } = render(<HistoryExport input={input} />);
    fireEvent.click(getByRole('button', { name: 'Copy context' }));
    await waitFor(() => expect(getByRole('alert')).toBeTruthy());
    expect(getByRole('button', { name: 'Export' })).toBeEnabled();
  });

  it('downloads the selected history and exact source identifiers as a Markdown file', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    const create = vi.fn().mockReturnValue('blob:history');
    const revoke = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toMatch(/^pidex-recover-the-parser-\d{4}-\d{2}-\d{2}\.md$/);
      expect(this.href).toBe('blob:history');
    });
    const { getByRole } = render(<HistoryExport input={input} />);
    fireEvent.click(getByRole('button', { name: 'Export' }));
    expect(click).toHaveBeenCalledOnce();
    expect(create.mock.calls[0][0].type).toBe('text/markdown');
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(create.mock.calls[0][0]);
    });
    expect(text).toContain('- Pi session `parser`.');
    expect(text).toContain('- Source archive `/sessions/parser.jsonl`.');
    expect(text).toContain('- Selected entry `earlier`.');
    expect(text).toContain('- Archive tip at export `latest`.');
    expect(text).toContain('and choose Resume in new fork.');
    vi.advanceTimersByTime(1000);
    expect(revoke).toHaveBeenCalledWith('blob:history');
  });
});
