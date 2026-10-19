import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { BracketButton } from './BracketButton';
import { FigureFrame } from './FigureFrame';
import { Markdown } from './Markdown';
import type { Entry } from '../timeline';
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

export function Transcript({ entries }: { entries: Entry[] }) {
  return (
    <>
      {entries.map((entry) => {
        if (entry.kind === 'tool')
          return (
            <details
              className={`wb-tool${!entry.ok ? ' wb-tool--error' : ''}`}
              key={entry.key}
            >
              <summary>
                <Icon
                  name={
                    entry.running
                      ? 'activity-terminal'
                      : entry.tool === 'read'
                        ? 'file'
                        : entry.ok
                          ? 'check'
                          : 'file'
                  }
                />
                <span>
                  {entry.tool}
                  {entry.args ? ` / ${entry.args}` : ''}
                </span>
                <small>
                  {entry.running ? 'Running' : entry.ok ? 'Done' : 'Failed'}
                </small>
              </summary>
              <pre>
                {entry.output ||
                  (entry.running ? 'Waiting for output…' : 'No output.')}
              </pre>
            </details>
          );
        return (
          <article
            key={entry.key}
            className={`wb-message wb-message--${entry.kind}`}
          >
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
                  <details className="wb-thinking">
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
      })}
    </>
  );
}

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
