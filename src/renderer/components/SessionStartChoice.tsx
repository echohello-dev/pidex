import type { SessionInfo } from '../api';
import { timeAgo } from '../useWorkbench';

export function SessionStartChoice({
  sessions,
  cwd,
  busy,
  onPreview,
  onBrowse,
}: {
  sessions: SessionInfo[];
  cwd: string;
  busy: boolean;
  onPreview: (session: SessionInfo) => void;
  onBrowse: () => void;
}) {
  const recent = sessions.filter((session) => session.cwd === cwd).slice(0, 2);
  if (!recent.length) return null;

  return (
    <section className="wb-session-choice" aria-label="Continue saved work">
      <div className="wb-section-heading">
        <h3 className="wb-eyebrow">Continue saved work</h3>
        <button type="button" onClick={onBrowse} disabled={busy}>
          View all saved sessions
        </button>
      </div>
      <p className="wb-meta">
        Preview a saved conversation before choosing Resume or Fork from here.
      </p>
      <div className="wb-continue">
        {recent.map((session) => (
          <button
            type="button"
            key={session.file}
            className="wb-session-item"
            aria-label={`Preview ${session.title}`}
            onClick={() => onPreview(session)}
            disabled={busy}
          >
            <span>{session.title}</span>
            <small>Preview · saved {timeAgo(session.timestamp)}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
