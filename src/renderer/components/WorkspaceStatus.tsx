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
  const message = unavailable
    ? 'Restore this folder to inspect Git changes.'
    : !ready
      ? 'Checking Git changes…'
      : details.gitError
        ? details.gitError
        : count
          ? `${count} changed ${count === 1 ? 'file' : 'files'}`
          : 'No changes in this root';
  const inspected = !unavailable && ready && !details.gitError;

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
          <p className="wb-meta">
            {details.branch || 'Detached HEAD'} · {staged} staged · {unstaged} unstaged · {untracked} untracked
          </p>
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
            <span className="wb-meta" title={inspected ? `${details.branch || 'Detached HEAD'} · ${message}` : message}>
              {inspected && <span className="wb-history-status-branch">{details.branch || 'Detached HEAD'}</span>}
              <span>{inspected && ' · '}{message}</span>
            </span>
          </summary>
          <div className="wb-workspace-status">{content}</div>
        </details>
      </section>
    );
  }
  return <section className="wb-workspace-status" aria-label="Workspace Git status">{content}</section>;
}
