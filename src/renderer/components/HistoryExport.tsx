import { useState } from 'react';
import { BracketButton } from './BracketButton';
import {
  sessionExportFilename,
  sessionExportMarkdown,
  type SessionExportInput,
} from '../export-session';

export function HistoryExport({
  input,
}: {
  input: Omit<SessionExportInput, 'exportedAt'> | null;
}) {
  const [copying, setCopying] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [failed, setFailed] = useState(false);

  const copy = async () => {
    if (!input || copying) return;
    setCopying(true);
    setFeedback('');
    setFailed(false);
    try {
      await navigator.clipboard.writeText(
        sessionExportMarkdown({ ...input, exportedAt: new Date() }),
      );
      setFeedback('Context copied. Paste it into a new session in the destination root.');
    } catch {
      setFailed(true);
      setFeedback('Could not copy context. Try again or use Export.');
    } finally {
      setCopying(false);
    }
  };
  const download = () => {
    if (!input) return;
    const exportedAt = new Date();
    const text = sessionExportMarkdown({ ...input, exportedAt });
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = sessionExportFilename(input.title, exportedAt);
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="wb-history-export-actions">
      <div className="wb-history-export-buttons">
        <BracketButton
          disabled={!input || copying}
          onClick={() => void copy()}
          aria-label="Copy context"
          title="Copy the selected history as Markdown, including thinking and tool input/output"
        >
          {copying ? 'Copying…' : 'Copy context'}
        </BracketButton>
        <BracketButton disabled={!input} onClick={download}>
          Export
        </BracketButton>
      </div>
      {feedback && <p role={failed ? 'alert' : 'status'} title={feedback}>{feedback}</p>}
    </div>
  );
}
