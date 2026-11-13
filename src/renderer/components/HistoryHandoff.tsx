import { useState } from 'react';
import type { WorkspaceInfo } from '../api';
import { BracketButton } from './BracketButton';

export function HistoryHandoff({
  roots,
  sourceRootId,
  onPrepare,
}: {
  roots: WorkspaceInfo[];
  sourceRootId: string;
  onPrepare: (rootId: string) => void;
}) {
  const [rootId, setRootId] = useState('');
  const destinations = roots.filter((root) => root.dirName !== sourceRootId);
  const destination = destinations.find((root) => root.dirName === rootId);
  return (
    <details className="wb-history-handoff">
      <summary>Continue in another root</summary>
      <form
        className="wb-history-summary-body"
        aria-label="Prepare context handoff"
        onSubmit={(event) => {
          event.preventDefault();
          if (destination?.availability === 'available') onPrepare(rootId);
        }}
      >
        <p>
          Add the selected history to a new-session draft in another root.
          Existing draft text is kept. Review it before sending.
        </p>
        <p className="wb-meta">
          Files and saved sessions stay in the original root.
        </p>
        <label>
          Destination root
          <select
            value={rootId}
            onChange={(event) => setRootId(event.target.value)}
          >
            <option value="">Choose a root</option>
            {destinations.map((root) => (
              <option
                key={root.dirName}
                value={root.dirName}
                disabled={root.availability !== 'available'}
              >
                {root.name} / {root.cwd}
                {root.availability !== 'available' ? ' (unavailable)' : ''}
              </option>
            ))}
          </select>
        </label>
        {!destinations.some((root) => root.availability === 'available') && (
          <p className="wb-meta">
            Add an available root from the sidebar to prepare a handoff.
          </p>
        )}
        <BracketButton
          type="submit"
          disabled={destination?.availability !== 'available'}
        >
          Prepare draft
        </BracketButton>
      </form>
    </details>
  );
}
