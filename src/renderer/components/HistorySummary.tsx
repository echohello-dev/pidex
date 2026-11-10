import { useMemo } from 'react';
import type { Entry } from '../timeline';
import { sessionSummary } from '../session-summary';

export function HistorySummary({ entries }: { entries: Entry[] }) {
  const summary = useMemo(() => sessionSummary(entries), [entries]);
  const { messages, tools } = summary;
  return (
    <details className="wb-history-summary">
      <summary>
        Branch summary
        <span className="wb-meta">
          {messages} {messages === 1 ? 'message' : 'messages'} ·{' '}
          {tools.total} {tools.total === 1 ? 'tool call' : 'tool calls'}
        </span>
      </summary>
      <div className="wb-history-summary-body">
        {entries.length === 0 ? (
          <p>No messages in this selection.</p>
        ) : (
          <>
            <dl>
              <div>
                <dt>Latest request</dt>
                <dd>
                  {summary.latestRequest || 'No request text in this selection.'}
                </dd>
              </div>
              <div>
                <dt>Latest reply</dt>
                <dd>
                  {summary.latestReply || 'No reply text in this selection.'}
                </dd>
              </div>
            </dl>
            {tools.total > 0 && (
              <p className="wb-meta">
                {tools.done} done · {tools.failed} failed · {tools.running} running ·{' '}
                {tools.interrupted} interrupted
              </p>
            )}
            {(tools.interrupted > 0 || tools.running > 0) && (
              <p className="wb-branch-notice">
                Some tool calls have no completion result. They may have made
                changes. Review their output and the workspace before retrying.
              </p>
            )}
            <p className="wb-meta">
              Excerpts from the selected path. Read the transcript for full context.
            </p>
          </>
        )}
      </div>
    </details>
  );
}
