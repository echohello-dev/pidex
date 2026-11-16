import type { WorkspaceDetails, WorkspaceInfo } from '../api';
import { BracketButton } from './BracketButton';

export function WorkspaceStatus({
  workspace,
  details,
  ready,
  onReview,
  context = 'new',
}: {
  workspace: WorkspaceInfo;
  details: WorkspaceDetails;
  ready: boolean;
  onReview: () => void;
  context?: 'new' | 'history';
}) {
  const unavailable = workspace.availability !== 'available';
  const changes = details.changes;
  const count = new Set(changes.map((change) => change.path)).size;
  const staged = changes.filter((change) => change.staged).length;
  const unstaged = changes.filter((change) => !change.staged && !change.untracked).length;
  const untracked = changes.filter((change) => change.untracked).length;
  const conflicts = details.conflicts ?? [];
  const changeMessage = unavailable
    ? 'Restore this folder to inspect Git changes.'
    : !ready
      ? 'Checking Git changes…'
      : details.gitError
        ? details.gitError
        : count
          ? `${count} changed ${count === 1 ? 'file' : 'files'}`
          : 'No changes in this root';
  const inspected = !unavailable && ready && !details.gitError;
  const conflictMessage = `${conflicts.length} unresolved ${conflicts.length === 1 ? 'conflict' : 'conflicts'}`;
  const message = inspected && conflicts.length
    ? `${changeMessage} · ${conflictMessage}`
    : changeMessage;
  const commit = inspected ? details.headCommit : undefined;
  const operation = inspected ? details.gitOperation : undefined;
  const operationMessage = operation === 'merge'
    ? 'Merge in progress'
    : operation === 'rebase'
      ? 'Rebase in progress'
      : operation === 'unavailable'
        ? 'Git operation status unavailable'
        : '';

  const content = (
    <>
      <div>
        {context === 'new' && <h3>Workspace changes</h3>}
        {context === 'history' && (
          <p className="wb-meta">
            Saved history does not restore files or switch Git branches.
          </p>
        )}
        <p role="status">{message}</p>
        {inspected && (
          <>
            {operation && (
              <div className="wb-workspace-operation" aria-label="Git operation">
                <p>{operationMessage}</p>
                <p className="wb-meta">
                  {operation === 'unavailable'
                    ? 'Check the repository state before continuing.'
                    : 'This operation affects the whole worktree, even with no conflicts in this root. Review it before continuing; Pi can help finish it.'}
                </p>
              </div>
            )}
            {conflicts.length > 0 && (
              <div className="wb-workspace-conflicts" aria-label="Unresolved Git conflicts">
                <p>Review these files before continuing. Pi can help resolve them.</p>
                <ul>
                  {conflicts.slice(0, 3).map((file) => (
                    <li key={file} title={file}>{file}</li>
                  ))}
                </ul>
                {conflicts.length > 3 && (
                  <p className="wb-meta">{conflicts.length - 3} more in workspace changes.</p>
                )}
              </div>
            )}
            <p className="wb-meta">
              {details.branch || 'Detached HEAD'} · {staged} staged · {unstaged} unstaged · {untracked} untracked
            </p>
            <p className="wb-meta wb-workspace-upstream" aria-label="Upstream comparison">
              {!details.branch
                ? 'Upstream comparison unavailable for detached HEAD.'
                : details.upstream?.state === 'none'
                  ? 'No upstream configured.'
                  : details.upstream?.state === 'tracked'
                    ? `Upstream ${details.upstream.name} · ${details.upstream.ahead} ahead · ${details.upstream.behind} behind`
                    : `Upstream ${details.upstream?.state === 'unavailable' && details.upstream.name ? details.upstream.name : 'comparison'} unavailable.`}
              {details.branch && details.upstream?.state !== 'none' && (
                <span className="wb-workspace-upstream-note">Local refs only. No fetch performed.</span>
              )}
            </p>
            {commit ? (
              <div className="wb-workspace-commit" aria-label="Current repository commit">
                <p className="wb-meta">
                  Repository HEAD · <code title={commit.hash}>{commit.hash.slice(0, 8)}</code> ·{' '}
                  <time dateTime={commit.committedAt} title={commit.committedAt}>
                    {new Date(commit.committedAt).toLocaleDateString('en-AU', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </time>
                </p>
                <p className="wb-workspace-commit-subject" title={commit.subject}>{commit.subject}</p>
              </div>
            ) : <p className="wb-meta">No repository commit available.</p>}
          </>
        )}
      </div>
      <BracketButton disabled={!inspected} onClick={onReview}>
        Review workspace changes
      </BracketButton>
    </>
  );
  if (context === 'history') {
    return (
      <section className="wb-history-workspace-status" aria-label="Workspace Git status">
        <details>
          <summary>
            Current workspace changes
            {operation && <span className="wb-meta">{operationMessage}</span>}
            <span className="wb-meta" title={inspected ? `${details.branch || 'Detached HEAD'} · ${message}` : message}>
              {inspected && <span className="wb-history-status-branch">{details.branch || 'Detached HEAD'}</span>}
              <span>{inspected && ' · '}{inspected && conflicts.length ? conflictMessage : message}</span>
            </span>
          </summary>
          <div className="wb-workspace-status">{content}</div>
        </details>
      </section>
    );
  }
  return <section className="wb-workspace-status" aria-label="Workspace Git status">{content}</section>;
}
