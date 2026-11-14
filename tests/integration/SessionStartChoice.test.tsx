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
    render(<SessionStartChoice sessions={sessions} busy={false} onPreview={onPreview} onBrowse={onBrowse} />);
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

  it('replaces choices with the selected root’s history and retains archives recorded under a root alias', () => {
    const callbacks = { onPreview: vi.fn(), onBrowse: vi.fn() };
    const { rerender } = render(<SessionStartChoice sessions={sessions} busy={false} {...callbacks} />);
    rerender(<SessionStartChoice sessions={[]} busy={false} {...callbacks} />);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    const aliased = { ...sessions[0], cwd: '/code/original-web-alias', title: 'Web work' };
    rerender(<SessionStartChoice sessions={[aliased]} busy={false} {...callbacks} />);
    expect(screen.getByRole('button', { name: 'Preview Web work' })).toBeVisible();
    expect(screen.queryByText('Parser review')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Preview Web work' }));
    expect(callbacks.onPreview).toHaveBeenCalledExactlyOnceWith(aliased);
  });

  it('has no continuation action for an empty history and disables choices during an open', () => {
    const callbacks = { onPreview: vi.fn(), onBrowse: vi.fn() };
    const { rerender } = render(<SessionStartChoice sessions={[]} busy={false} {...callbacks} />);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    rerender(<SessionStartChoice sessions={sessions} busy {...callbacks} />);
    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeDisabled();
      fireEvent.click(button);
    }
    expect(callbacks.onPreview).not.toHaveBeenCalled();
    expect(callbacks.onBrowse).not.toHaveBeenCalled();
  });
});
