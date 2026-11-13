import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { WorkspaceStatus } from '../../src/renderer/components/WorkspaceStatus';
import type { GitChange, WorkspaceDetails, WorkspaceInfo } from '../../src/renderer/api';

const workspace: WorkspaceInfo = {
  dirName: 'api', name: 'api', cwd: '/repo/api', branch: 'old-branch',
  availability: 'available', sessionCount: 0, lastActive: '',
};
const details: WorkspaceDetails = { branch: 'feature/status', changes: [], files: [] };
const change: GitChange = {
  path: 'app.ts', additions: 1, deletions: 1, staged: false, untracked: false,
};
afterEach(cleanup);

describe('workspace Git status', () => {
  it('counts a partially staged file once overall and in both change groups', () => {
    const onReview = vi.fn();
    render(<WorkspaceStatus workspace={workspace} ready details={{
      ...details,
      changes: [change, { ...change, staged: true }, { ...change, path: 'new.ts', untracked: true }],
    }} onReview={onReview} />);
    expect(screen.getByRole('status')).toHaveTextContent('2 changed files');
    expect(screen.getByText('feature/status · 1 staged · 1 unstaged · 1 untracked')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Review workspace changes' }));
    expect(onReview).toHaveBeenCalledOnce();
  });

  it('shows a clean root only after inspection and explains detached HEAD', () => {
    const { rerender } = render(<WorkspaceStatus workspace={workspace} details={details} ready onReview={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('No changes in this root');
    expect(screen.getByRole('button')).toBeEnabled();
    rerender(<WorkspaceStatus workspace={workspace} details={{ ...details, branch: '', changes: [change] }} ready onReview={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('1 changed file');
    expect(screen.getByText('Detached HEAD · 0 staged · 1 unstaged · 0 untracked')).toBeVisible();
  });

  it.each([
    { ready: false, availability: 'available' as const, gitError: undefined, message: 'Checking Git changes…' },
    { ready: true, availability: 'missing' as const, gitError: undefined, message: 'Restore this folder to inspect Git changes.' },
    { ready: true, availability: 'unavailable' as const, gitError: undefined, message: 'Restore this folder to inspect Git changes.' },
    { ready: true, availability: 'available' as const, gitError: 'Git changes are unavailable for this folder.', message: 'Git changes are unavailable for this folder.' },
  ])('does not claim a clean root when $message', ({ ready, availability, gitError, message }) => {
    render(<WorkspaceStatus workspace={{ ...workspace, availability }} details={{ ...details, gitError }} ready={ready} onReview={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent(message);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.queryByText('No changes in this root')).not.toBeInTheDocument();
    expect(screen.queryByText(/old-branch|feature\/status/)).not.toBeInTheDocument();
  });
});
