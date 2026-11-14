import {
  memo,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { BracketButton } from './BracketButton';
import { FigureFrame } from './FigureFrame';
import { Markdown } from './Markdown';
import { toolStatus, type Entry } from '../timeline';
import type { ModelInfo, SlashCommand } from '../api';

const icons = import.meta.glob<string>('../assets/workbench/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
});
export type IconName =
  | 'file-code'
  | 'file'
  | 'activity-terminal'
  | 'starter-changes'
  | 'starter-search'
  | 'folder-open'
  | 'folder'
  | 'message-square'
  | 'changes'
  | 'skills'
  | 'settings'
  | 'terminal'
  | 'paperclip'
  | 'check'
  | 'search'
  | 'panel-left'
  | 'chevron-down'
  | 'shield'
  | 'appearance'
  | 'plus';

export function Icon({ name }: { name: IconName }) {
  return (
    <span className="wb-icon" aria-hidden="true">
      <img src={icons[`../assets/workbench/${name}.svg`]} alt="" />
    </span>
  );
}

export function NavItem({
  icon,
  children,
  detail,
  active,
  onClick,
}: {
  icon: IconName;
  children: ReactNode;
  detail?: ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`wb-nav-item${active ? ' is-active' : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      <Icon name={icon} />
      <span>{children}</span>
      {detail !== undefined && <small>{detail}</small>}
    </button>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <label className="wb-search">
      <Icon name="search" />
      <input
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

export function Composer({
  draft,
  onDraft,
  onSend,
  onStop,
  onAttach,
  model,
  models,
  onModel,
  running = false,
  disabled = false,
  busy = false,
  modelDisabled = false,
  allowDefaultModel = true,
  placeholder,
  label = 'Send',
  commands = [],
}: {
  draft: string;
  onDraft: (draft: string) => void;
  onSend: (text?: string) => void;
  onStop?: () => void;
  onAttach: () => void;
  model: string;
  models: ModelInfo[];
  onModel: (value: string) => void;
  running?: boolean;
  disabled?: boolean;
  busy?: boolean;
  placeholder?: string;
  label?: string;
  commands?: SlashCommand[];
  modelDisabled?: boolean;
  allowDefaultModel?: boolean;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  const [index, setIndex] = useState(0);
  const matches = draft.startsWith('/')
    ? commands
        .filter((c) =>
          c.name.toLowerCase().includes(draft.slice(1).toLowerCase()),
        )
        .slice(0, 8)
    : [];
  const selected = Math.min(index, Math.max(0, matches.length - 1));
  const keyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (
      matches.length &&
      ['ArrowDown', 'ArrowUp', 'Tab', 'Escape'].includes(e.key)
    ) {
      e.preventDefault();
      if (e.key === 'ArrowDown') setIndex((selected + 1) % matches.length);
      if (e.key === 'ArrowUp')
        setIndex((selected + matches.length - 1) % matches.length);
      if (e.key === 'Tab') {
        onDraft(`/${matches[selected].name} `);
        setIndex(0);
      }
      if (e.key === 'Escape') onDraft('');
      return;
    }
    if (e.key === 'Escape' && running) {
      e.preventDefault();
      onStop?.();
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && !busy)
        onSend(matches.length ? `/${matches[selected].name}` : undefined);
    }
  };
  return (
    <FigureFrame className="wb-composer">
      {matches.length > 0 && (
        <div
          className="wb-slash-menu"
          role="listbox"
          aria-label="Slash commands"
        >
          {matches.map((c, i) => (
            <button
              key={c.name}
              type="button"
              role="option"
              aria-selected={i === selected}
              className={i === selected ? 'is-active' : ''}
              onClick={() => {
                onDraft(`/${c.name} `);
                input.current?.focus();
              }}
            >
              <strong>/{c.name}</strong>
              <span>{c.description ?? c.source}</span>
            </button>
          ))}
        </div>
      )}
      <div className="wb-composer-input">
        <span aria-hidden="true">›</span>
        <textarea
          ref={input}
          aria-label="Message pi"
          value={draft}
          onChange={(e) => {
            onDraft(e.target.value);
            setIndex(0);
          }}
          onKeyDown={keyDown}
          disabled={disabled || busy}
          placeholder={
            placeholder ?? 'Describe a task, @ a file or / a command…'
          }
          spellCheck={false}
        />
      </div>
      <div className="wb-composer-controls">
        <button
          type="button"
          className="wb-icon-button"
          aria-label="Attach files"
          onClick={onAttach}
          disabled={disabled || busy}
        >
          <Icon name="paperclip" />
        </button>
        <label className="wb-select">
          <select
            aria-label="Session model"
            value={model}
            onChange={(e) => onModel(e.target.value)}
            disabled={disabled || running || busy || modelDisabled}
          >
            {(allowDefaultModel || !model) && (
              <option value="">Pi default model</option>
            )}
            {model &&
              !models.some((m) => `${m.provider}/${m.id}` === model) && (
                <option value={model}>{model.split('/').at(-1)}</option>
              )}
            {models.map((m) => (
              <option
                key={`${m.provider}/${m.id}`}
                value={`${m.provider}/${m.id}`}
              >
                {m.name}
              </option>
            ))}
          </select>
          <Icon name="chevron-down" />
        </label>
        <label
          className="wb-select wb-policy"
          title="Tool permissions are managed by your Pi runtime and extensions."
        >
          <select aria-label="Tool permissions" disabled>
            <option>Runtime policy</option>
          </select>
          <Icon name="chevron-down" />
        </label>
        <span className="wb-send-hint">{running ? 'esc stop' : '⌘↵ send'}</span>
        {running && !draft.trim() ? (
          <BracketButton primary onClick={onStop}>
            Stop
          </BracketButton>
        ) : (
          <BracketButton
            primary
            disabled={disabled || busy || !draft.trim()}
            onClick={() => onSend()}
          >
            {busy ? 'Opening…' : running ? 'Steer' : label}
          </BracketButton>
        )}
      </div>
    </FigureFrame>
  );
}

export const TOOL_TEXT_PREVIEW_LIMIT = 2000;

export type DiffLine = { type: '-' | '+' | ' '; text: string };

export function diffLines(oldText: string, newText: string): DiffLine[] {
  const a = oldText === '' ? [] : oldText.split('\n');
  const b = newText === '' ? [] : newText.split('\n');
  if (a.length * b.length > 250_000)
    return [
      ...a.map((text): DiffLine => ({ type: '-', text })),
      ...b.map((text): DiffLine => ({ type: '+', text })),
    ];
  const dp: Uint32Array[] = Array.from({ length: a.length + 1 }, () =>
    new Uint32Array(b.length + 1),
  );
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ type: ' ', text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: '-', text: a[i++] });
    } else {
      out.push({ type: '+', text: b[j++] });
    }
  }
  while (i < a.length) out.push({ type: '-', text: a[i++] });
  while (j < b.length) out.push({ type: '+', text: b[j++] });
  return out;
}

function useCopy(text: string) {
  const [status, setStatus] = useState<'idle' | 'copying' | 'copied' | 'failed'>('idle');
  const attempt = useRef(0);
  const pending = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    setStatus('idle');
    pending.current = false;
    return () => {
      // A streamed update or recycled row invalidates outstanding feedback.
      attempt.current++;
      clearTimeout(timer.current);
    };
  }, [text]);
  const copy = async () => {
    if (pending.current) return;
    const current = ++attempt.current;
    pending.current = true;
    clearTimeout(timer.current);
    setStatus('copying');
    try {
      await navigator.clipboard.writeText(text);
      if (current !== attempt.current) return;
      setStatus('copied');
      timer.current = setTimeout(() => setStatus('idle'), 1500);
    } catch {
      if (current === attempt.current) setStatus('failed');
    } finally {
      if (current === attempt.current) pending.current = false;
    }
  };
  return { status, copy };
}

function ToolSection({
  title,
  text,
  stateKey,
  expanded,
  children,
}: {
  title: string;
  text: string;
  stateKey: string;
  expanded: Map<string, boolean>;
  children: ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(
    () => expanded.get(stateKey) ?? title === 'Output',
  );
  const { status, copy } = useCopy(text);
  const feedback = status === 'failed'
    ? `Could not copy ${title.toLowerCase()}. Try Copy again.`
    : status === 'copied'
      ? `${title} copied.`
      : status === 'copying'
        ? `Copying ${title.toLowerCase()}…`
        : '';
  return (
    <div className="wb-tool-section">
      <div className="wb-tool-section-head">
        <h3>
          <button
            type="button"
            aria-label={`${title} details`}
            aria-expanded={open}
            aria-controls={id}
            onClick={() => {
              expanded.set(stateKey, !open);
              setOpen(!open);
            }}
          >
            <span aria-hidden="true">{open ? '▾' : '▸'}</span>
            {title}
          </button>
        </h3>
        <button
          type="button"
          className="wb-tool-copy"
          aria-label={`Copy ${title.toLowerCase()}`}
          aria-describedby={feedback ? `${id}-copy` : undefined}
          disabled={status === 'copying'}
          onClick={() => void copy()}
        >
          {status === 'copied' ? 'Copied' : status === 'copying' ? 'Copying…' : 'Copy'}
        </button>
      </div>
      {feedback && (
        <p id={`${id}-copy`} className="wb-tool-copy-feedback" role={status === 'failed' ? 'alert' : 'status'}>
          {feedback}
        </p>
      )}
      <div id={id} hidden={!open}>{open && children}</div>
    </div>
  );
}

function ToolDiffSection({
  text,
  oldText,
  newText,
  stateKey,
  expanded,
}: {
  text: string;
  oldText: string;
  newText: string;
  stateKey: string;
  expanded: Map<string, boolean>;
}) {
  const [showAll, setShowAll] = useState(false);
  const rows = diffLines(oldText, newText);
  const isLong =
    rows.reduce((length, row) => length + row.text.length + 1, 0) >
    TOOL_TEXT_PREVIEW_LIMIT;
  let visible = rows;
  if (isLong && !showAll) {
    visible = [];
    let remaining = TOOL_TEXT_PREVIEW_LIMIT;
    for (const row of rows) {
      if (remaining <= 0) break;
      // Include the diff marker in the budget and clip even a single long row.
      const clipped = row.text.slice(0, remaining - 1);
      visible.push({ ...row, text: clipped });
      remaining -= clipped.length + 1;
    }
  }
  return (
    <ToolSection title="Input" text={text} stateKey={stateKey} expanded={expanded}>
      <div className="wb-tool-diff">
        {visible.map((row, index) => (
          <div
            key={index}
            className={`wb-tool-diff-line wb-tool-diff-line--${row.type === '+' ? 'add' : row.type === '-' ? 'del' : 'context'}`}
          >
            <span aria-hidden="true">{row.type === ' ' ? ' ' : row.type}</span>
            {row.text}
          </div>
        ))}
        {visible.length === 0 && <div className="wb-tool-diff-line">No changes.</div>}
      </div>
      {isLong && !showAll && (
        <p className="wb-tool-notice wb-muted">
          Input preview shortened. Show more or copy the full input.
        </p>
      )}
      {isLong && (
        <button
          type="button"
          className="wb-tool-toggle"
          onClick={() => setShowAll((value) => !value)}
        >
          {showAll ? 'Show less' : 'Show more'}
        </button>
      )}
    </ToolSection>
  );
}

function ToolTextSection({ title, text, stateKey, expanded }: {
  title: string;
  text: string;
  stateKey: string;
  expanded: Map<string, boolean>;
}) {
  const [showAll, setShowAll] = useState(false);
  const [showEnd, setShowEnd] = useState(
    () => expanded.get(`${stateKey}:end`) ?? false,
  );
  const textRef = useRef<HTMLPreElement>(null);
  const isLong = text.length > TOOL_TEXT_PREVIEW_LIMIT;
  const atEnd = title === 'Output' && showEnd;
  const visible =
    isLong && !showAll
      ? atEnd
        ? text.slice(-TOOL_TEXT_PREVIEW_LIMIT)
        : text.slice(0, TOOL_TEXT_PREVIEW_LIMIT)
      : text;
  return (
    <ToolSection title={title} text={text} stateKey={stateKey} expanded={expanded}>
      <pre
        ref={(node) => {
          textRef.current = node;
          // End previews follow appended output and reopen at the final line.
          if (node && atEnd) node.scrollTop = node.scrollHeight;
        }}
      >
        {visible}
      </pre>
      {title === 'Output' && isLong && !showAll && (
        <p className="wb-tool-notice wb-muted">
          Showing {atEnd ? 'last' : 'first'} {TOOL_TEXT_PREVIEW_LIMIT.toLocaleString('en-AU')} of {text.length.toLocaleString('en-AU')} characters.
        </p>
      )}
      {isLong && (
        <div className="wb-tool-preview-actions">
          {title === 'Output' && !showAll && (
            <button
              type="button"
              className="wb-tool-toggle"
              onClick={() => {
                expanded.set(`${stateKey}:end`, !showEnd);
                setShowEnd(!showEnd);
                if (showEnd && textRef.current) textRef.current.scrollTop = 0;
              }}
            >
              {atEnd ? 'Show beginning' : 'Show end'}
            </button>
          )}
          <button
            type="button"
            className="wb-tool-toggle"
            onClick={() => setShowAll((value) => !value)}
          >
            {showAll ? 'Show less' : 'Show more'}
          </button>
        </div>
      )}
    </ToolSection>
  );
}

export const TranscriptRow = memo(function TranscriptRow({
  entry,
  expanded,
}: {
  entry: Entry;
  expanded: Map<string, boolean>;
}) {
  if (entry.kind === 'tool')
    return (
      <details
        className={`wb-tool${!entry.ok ? ' wb-tool--error' : ''}`}
        open={expanded.get(entry.key) ?? false}
        onToggle={(event) => expanded.set(entry.key, event.currentTarget.open)}
      >
        <summary>
          <Icon
            name={
              entry.running
                ? 'activity-terminal'
                : entry.tool === 'read'
                  ? 'file'
                  : entry.ok && !entry.interrupted
                    ? 'check'
                    : 'file'
            }
          />
          <span>
            {entry.tool}
            {entry.args ? ` / ${entry.args}` : ''}
          </span>
          <small>{toolStatus(entry)}</small>
        </summary>
        {entry.interrupted && (
          <p className="wb-tool-notice wb-muted">
            No completion result was recorded. The tool may have made changes;
            check before retrying.
          </p>
        )}
        {entry.oldText !== undefined || entry.newText !== undefined ? (
          <ToolDiffSection
            text={entry.input || 'No input.'}
            oldText={entry.oldText ?? ''}
            newText={entry.newText ?? ''}
            stateKey={`${entry.key}:input`}
            expanded={expanded}
          />
        ) : (
          <ToolTextSection
            title="Input"
            text={entry.input || 'No input.'}
            stateKey={`${entry.key}:input`}
            expanded={expanded}
          />
        )}
        <ToolTextSection
          title="Output"
          stateKey={`${entry.key}:output`}
          expanded={expanded}
          text={
            entry.output ||
            (entry.running ? 'Waiting for output…' : 'No output.')
          }
        />
      </details>
    );
  return (
    <article key={entry.key} className={`wb-message wb-message--${entry.kind}`}>
      <div className="wb-eyebrow">
        {entry.kind === 'user'
          ? '$ YOU'
          : entry.streaming
            ? 'PI / WORKING'
            : 'PI'}
      </div>
      {entry.kind === 'assistant' ? (
        <>
          {entry.thinking && (
            <details
              className="wb-thinking"
              open={expanded.get(entry.key) ?? false}
              onToggle={(event) =>
                expanded.set(entry.key, event.currentTarget.open)
              }
            >
              <summary>Thinking</summary>
              <p>{entry.thinking}</p>
            </details>
          )}
          {entry.text ? (
            <Markdown text={entry.text} />
          ) : (
            entry.streaming && <p className="wb-muted">Thinking…</p>
          )}
        </>
      ) : (
        <p>{entry.text}</p>
      )}
    </article>
  );
});

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="wb-empty">
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </div>
  );
}
