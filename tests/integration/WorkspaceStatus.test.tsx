import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { WorkspaceStatus } from '../../src/renderer/components/WorkspaceStatus';
import type { GitChange, WorkspaceDetails, WorkspaceInfo } from '../../src/renderer/api';

const workspace: WorkspaceInfo = {
  dirName: 'api', name: 'api', cwd: '/repo/api', branch: 'old-branch',
  availability: 'available', sessionCount: 0, lastActive: '',
};
const details: WorkspaceDetails = { branch: 'feature/status', changes: [], files: [] };
const headCommit = {
  hash: '1234567890abcdef1234567890abcdef12345678',
  subject: 'Fix café parser <script> without running markup',
  committedAt: '2026-11-14T12:00:00+07:00',
};
const change: GitChange = {
  path: 'app.ts', additions: 1, deletions: 1, staged: false, untracked: false,
};
afterEach(cleanup);

describe('workspace Git status', () => {
  it('shows local upstream counts and refreshes them without claiming to fetch', () => {
    const { rerender } = render(<WorkspaceStatus workspace={workspace} details={{ ...details,
      upstream: { state: 'tracked', name: 'origin/feature/status', ahead: 2, behind: 3 },
    }} ready onReview={vi.fn()} />);
    expect(screen.getByLabelText('Upstream comparison')).toHaveTextContent('Upstream origin/feature/status · 2 ahead · 3 behind');
    expect(screen.getByText('Local refs only. No fetch performed.')).toBeVisible();
    rerender(<WorkspaceStatus workspace={workspace} details={{ ...details,
      upstream: { state: 'tracked', name: 'origin/main', ahead: 0, behind: 0 },
    }} ready onReview={vi.fn()} />);
    expect(screen.getByLabelText('Upstream comparison')).toHaveTextContent('Upstream origin/main · 0 ahead · 0 behind');
    expect(screen.queryByText(/origin\/feature/)).not.toBeInTheDocument();
  });

  it('shows upstream comparison only inside expanded saved-history status', () => {
    render(<WorkspaceStatus context="history" workspace={workspace} details={{ ...details,
      upstream: { state: 'tracked', name: 'origin/main', ahead: 1, behind: 2 },
    }} ready onReview={vi.fn()} />);
    expect(screen.getByLabelText('Upstream comparison')).not.toBeVisible();
    fireEvent.click(screen.getByText('Current workspace changes'));
    expect(screen.getByLabelText('Upstream comparison')).toBeVisible();
    expect(screen.getByLabelText('Upstream comparison')).toHaveTextContent('1 ahead · 2 behind');
  });

  it.each([
    { branch: 'main', upstream: { state: 'none' as const }, message: 'No upstream configured.' },
    { branch: '', upstream: undefined, message: 'Upstream comparison unavailable for detached HEAD.' },
    { branch: 'main', upstream: { state: 'unavailable' as const, name: 'origin/gone' }, message: 'Upstream origin/gone unavailable.' },
    { branch: 'main', upstream: { state: 'unavailable' as const }, message: 'Upstream comparison unavailable.' },
  ])('explains $message and preserves change review', ({ branch, upstream, message }) => {
    render(<WorkspaceStatus workspace={workspace} details={{ ...details, branch, upstream, changes: [change] }} ready onReview={vi.fn()} />);
    expect(screen.getByLabelText('Upstream comparison')).toHaveTextContent(message);
    expect(screen.getByRole('status')).toHaveTextContent('1 changed file');
    expect(screen.getByRole('button')).toBeEnabled();
  });

  it('shows current repository hash, literal subject and committed date, then refreshes them', () => {
    const { container, rerender } = render(<WorkspaceStatus workspace={workspace} details={{ ...details, headCommit }} ready onReview={vi.fn()} />);
    expect(screen.getByLabelText('Current repository commit')).toHaveTextContent('Repository HEAD · 12345678');
    expect(screen.getByTitle(headCommit.hash)).toHaveTextContent('12345678');
    expect(screen.getByTitle(headCommit.subject)).toHaveTextContent(headCommit.subject);
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('time')).toHaveAttribute('datetime', headCommit.committedAt);
    expect(container.querySelector('time')).not.toHaveTextContent('Invalid Date');
    rerender(<WorkspaceStatus workspace={workspace} details={{ ...details, headCommit: { ...headCommit, hash: 'abcdef12', subject: 'New branch tip' } }} ready onReview={vi.fn()} />);
    expect(screen.getByLabelText('Current repository commit')).toHaveTextContent('abcdef12');
    expect(screen.getByText('New branch tip')).toBeVisible();
    expect(screen.queryByText(headCommit.subject)).not.toBeInTheDocument();
  });

  it('keeps current repository commit inside the expanded history status', () => {
    render(<WorkspaceStatus context="history" workspace={workspace} details={{ ...details, headCommit }} ready onReview={vi.fn()} />);
    expect(screen.getByText(headCommit.subject)).not.toBeVisible();
    fireEvent.click(screen.getByText('Current workspace changes'));
    expect(screen.getByText(headCommit.subject)).toBeVisible();
    expect(screen.getByText('Saved history does not restore files or switch Git branches.')).toBeVisible();
  });

  it('explains an absent commit without disabling review of an unborn repository', () => {
    render(<WorkspaceStatus workspace={workspace} details={details} ready onReview={vi.fn()} />);
    expect(screen.getByText('No repository commit available.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Review workspace changes' })).toBeEnabled();
  });

  it('distinguishes current files from saved conversation history', () => {
    const { container } = render(<WorkspaceStatus context="history" workspace={workspace} details={details} ready onReview={vi.fn()} />);
    expect(container.querySelector('summary')).toHaveTextContent('feature/status · No changes in this root');
    expect(screen.getByRole('button', { name: 'Review workspace changes', hidden: true })).not.toBeVisible();
    fireEvent.click(screen.getByText('Current workspace changes'));
    expect(screen.getByText('Saved history does not restore files or switch Git branches.')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('No changes in this root');
  });

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
    render(<WorkspaceStatus workspace={{ ...workspace, availability }} details={{ ...details, gitError, headCommit, upstream: { state: 'tracked', name: 'origin/main', ahead: 1, behind: 2 } }} ready={ready} onReview={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent(message);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.queryByText('No changes in this root')).not.toBeInTheDocument();
    expect(screen.queryByText(/old-branch|feature\/status/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Current repository commit')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Upstream comparison')).not.toBeInTheDocument();
  });
});
