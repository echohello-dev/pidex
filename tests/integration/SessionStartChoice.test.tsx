import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SessionStartChoice } from '../../src/renderer/components/SessionStartChoice';
import type { SessionInfo } from '../../src/renderer/api';

const sessions: SessionInfo[] = ['Parser review', 'Keyboard focus', 'Older task'].map((title, index) => ({
  id: 'shared-native-id', file: `/sessions/${index}.jsonl`, cwd: '/code/api',
  title, timestamp: '', model: '', messageCount: 2,
}));
afterEach(cleanup);

describe('new-session continuation choice', () => {
  it('previews the chosen archive and browses history only on explicit actions', () => {
    const onPreview = vi.fn();
    const onBrowse = vi.fn();
    render(<SessionStartChoice sessions={sessions} cwd="/code/api" busy={false} onPreview={onPreview} onBrowse={onBrowse} />);
    expect(screen.getByRole('region', { name: 'Continue saved work' })).toBeVisible();
    expect(screen.getByText(/Preview a saved conversation before choosing Resume/)).toBeVisible();
    expect(screen.queryByText('Older task')).not.toBeInTheDocument();
    expect(onPreview).not.toHaveBeenCalled();
    expect(onBrowse).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Preview Keyboard focus' }));
    expect(onPreview).toHaveBeenCalledExactlyOnceWith(sessions[1]);
    expect(onBrowse).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'View all saved sessions' }));
    expect(onBrowse).toHaveBeenCalledOnce();
  });

  it('never offers another root’s conversations, including while root history refreshes', () => {
    const callbacks = { onPreview: vi.fn(), onBrowse: vi.fn() };
    const { rerender } = render(<SessionStartChoice sessions={sessions} cwd="/code/api" busy={false} {...callbacks} />);
    rerender(<SessionStartChoice sessions={sessions} cwd="/code/web" busy={false} {...callbacks} />);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    rerender(<SessionStartChoice sessions={[...sessions, { ...sessions[0], cwd: '/code/web', title: 'Web work' }]} cwd="/code/web" busy={false} {...callbacks} />);
    expect(screen.getByRole('button', { name: 'Preview Web work' })).toBeVisible();
    expect(screen.queryByText('Parser review')).not.toBeInTheDocument();
  });

  it('has no continuation action for an empty history and disables choices during an open', () => {
    const callbacks = { onPreview: vi.fn(), onBrowse: vi.fn() };
    const { rerender } = render(<SessionStartChoice sessions={[]} cwd="/code/api" busy={false} {...callbacks} />);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    rerender(<SessionStartChoice sessions={sessions} cwd="/code/api" busy {...callbacks} />);
    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeDisabled();
      fireEvent.click(button);
    }
    expect(callbacks.onPreview).not.toHaveBeenCalled();
    expect(callbacks.onBrowse).not.toHaveBeenCalled();
  });
});
