import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { HistorySummary } from '../../src/renderer/components/HistorySummary';
import type { Entry } from '../../src/renderer/timeline';

afterEach(cleanup);

describe('<HistorySummary>', () => {
  it('updates the excerpts and counts when the selected path changes', () => {
    const request: Entry = { key: 'u', kind: 'user', text: 'Fix the parser' };
    const { container, rerender, getByText } = render(<HistorySummary entries={[
      request,
      { key: 'a', kind: 'assistant', text: 'Use the buffered parser', thinking: 'Hidden reasoning', streaming: false },
    ]} />);
    expect(getByText('2 messages · 0 tool calls')).toBeTruthy();
    expect(getByText('Use the buffered parser')).toBeTruthy();
    expect(container.textContent).not.toContain('Hidden reasoning');
    rerender(<HistorySummary entries={[request]} />);
    expect(getByText('1 message · 0 tool calls')).toBeTruthy();
    expect(container.textContent).not.toContain('Use the buffered parser');
    expect(getByText('No reply text in this selection.')).toBeTruthy();
  });

  it('warns about unknown tool effects without declaring the work complete', () => {
    const { container, getByText } = render(<HistorySummary entries={[{
      key: 't', kind: 'tool', toolId: 't', tool: 'write', args: 'a.ts',
      input: '', output: '', running: false, ok: true, interrupted: true,
    }]} />);
    expect(getByText('0 messages · 1 tool call')).toBeTruthy();
    expect(container.textContent).toContain('0 done · 0 failed · 0 running · 1 interrupted');
    expect(container.textContent).toContain('They may have made changes.');
    expect(getByText('No request text in this selection.')).toBeTruthy();
  });

  it('shows an empty selection and escapes message markup', () => {
    const { container, getByText, rerender } = render(<HistorySummary entries={[]} />);
    expect(getByText('No messages in this selection.')).toBeTruthy();
    rerender(<HistorySummary entries={[
      { key: 'u', kind: 'user', text: '<img src=x onerror=alert(1)>' },
    ]} />);
    expect(getByText('<img src=x onerror=alert(1)>')).toBeTruthy();
    expect(container.querySelector('img')).toBeNull();
  });
});
