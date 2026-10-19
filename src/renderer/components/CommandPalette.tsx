import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { Icon } from './WorkbenchControls';
import type { SessionInfo, SlashCommand, WorkspaceInfo } from '../api';
import type { View } from '../useWorkbench';

type Category = 'Commands' | 'Projects' | 'Sessions' | 'Files' | 'Skills';
type Item = {
  id: string;
  title: string;
  detail: string;
  category: Category;
  run: () => void;
};

export function CommandPalette({
  workspaces,
  sessions,
  files,
  commands,
  onClose,
  onWorkspace,
  onSession,
  onNavigate,
  onFile,
  onCommand,
  onAddWorkspace,
}: {
  workspaces: WorkspaceInfo[];
  sessions: SessionInfo[];
  files: string[];
  commands: SlashCommand[];
  onClose: () => void;
  onWorkspace: (ws: WorkspaceInfo) => void;
  onSession: (session: SessionInfo) => void;
  onNavigate: (view: View) => void;
  onFile: (file: string) => void;
  onCommand: (command: string) => void;
  onAddWorkspace: () => void;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category>('Commands');
  const [index, setIndex] = useState(0);
  const dialog = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    input.current?.focus();
    return () => previous?.focus();
  }, []);
  const items = useMemo<Item[]>(
    () => [
      ...(
        [
          ['New session', 'new'],
          ['Session history', 'history'],
          ['Review changes', 'changes'],
          ['Browse files', 'files'],
          ['Browse skills', 'skills'],
          ['Models & access', 'settings'],
        ] as const
      ).map(([title, view]) => ({
        id: view,
        title,
        detail: 'Navigate in this workspace',
        category: 'Commands' as const,
        run: () => onNavigate(view),
      })),
      {
        id: 'open-project',
        title: 'Open project',
        detail: 'Choose a local folder',
        category: 'Commands',
        run: onAddWorkspace,
      },
      ...commands.map((c) => ({
        id: `command:${c.name}`,
        title: `/${c.name}`,
        detail: c.description ?? c.source ?? 'Pi command',
        category: c.name.startsWith('skill:')
          ? ('Skills' as const)
          : ('Commands' as const),
        run: () => onCommand(`/${c.name} `),
      })),
      ...workspaces.map((ws) => ({
        id: ws.cwd,
        title: ws.name,
        detail: ws.cwd,
        category: 'Projects' as const,
        run: () => onWorkspace(ws),
      })),
      ...sessions.map((s) => ({
        id: s.id,
        title: s.title,
        detail: `${s.messageCount} messages / ${s.model || 'Pi'}`,
        category: 'Sessions' as const,
        run: () => onSession(s),
      })),
      ...files.map((file) => ({
        id: file,
        title: file.split('/').at(-1) ?? file,
        detail: file,
        category: 'Files' as const,
        run: () => onFile(file),
      })),
    ],
    [
      commands,
      files,
      onAddWorkspace,
      onCommand,
      onFile,
      onNavigate,
      onSession,
      onWorkspace,
      sessions,
      workspaces,
    ],
  );
  const matches = items
    .filter(
      (item) =>
        item.category === category &&
        `${item.title} ${item.detail}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .slice(0, 80);
  const selected = Math.min(index, Math.max(0, matches.length - 1));
  const choose = (item: Item) => {
    onClose();
    item.run();
  };
  const keyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex(
        (selected + (e.key === 'ArrowDown' ? 1 : -1) + matches.length) %
          Math.max(1, matches.length),
      );
    }
    if (e.key === 'Enter' && matches[selected]) {
      e.preventDefault();
      choose(matches[selected]);
    }
    if (e.key === 'Tab') {
      const focusable = [
        ...(dialog.current?.querySelectorAll<HTMLElement>('input, button') ??
          []),
      ];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      }
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  };
  useEffect(() => {
    dialog.current
      ?.querySelector('[role="option"][aria-selected="true"]')
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [selected]);
  return (
    <div
      className="wb-overlay"
      onClick={(e) => {
        if (e.currentTarget === e.target) onClose();
      }}
    >
      <div
        ref={dialog}
        className="wb-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Quick switch"
        onKeyDown={keyDown}
      >
        <div className="wb-palette-input">
          <span>⌘</span>
          <span>›</span>
          <input
            ref={input}
            aria-label="Search commands, projects, sessions, files or skills"
            placeholder="Search your workspace…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls="quick-switch-results"
            aria-activedescendant={
              matches[selected] ? `palette-result-${selected}` : undefined
            }
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close quick switch"
          >
            esc
          </button>
        </div>
        <div
          className="wb-palette-tabs"
          role="tablist"
          aria-label="Search categories"
        >
          {(
            ['Commands', 'Projects', 'Sessions', 'Files', 'Skills'] as const
          ).map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={category === name}
              onClick={() => {
                setCategory(name);
                setIndex(0);
              }}
              className={category === name ? 'is-active' : ''}
            >
              {name}
              <small>
                {items.filter((item) => item.category === name).length}
              </small>
            </button>
          ))}
        </div>
        <div
          className="wb-palette-results"
          id="quick-switch-results"
          role="listbox"
          aria-label={category}
        >
          {matches.map((item, i) => (
            <button
              key={`${item.category}:${item.id}`}
              id={`palette-result-${i}`}
              type="button"
              role="option"
              aria-selected={i === selected}
              className={i === selected ? 'is-active' : ''}
              onClick={() => choose(item)}
            >
              <span className="wb-result-index">
                {i === selected ? '↵' : i + 1}
              </span>
              <span>
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
              </span>
              <Icon
                name={
                  category === 'Files'
                    ? 'file-code'
                    : category === 'Projects'
                      ? 'folder'
                      : 'terminal'
                }
              />
            </button>
          ))}
          {!matches.length && (
            <p className="wb-meta wb-padded">
              No matching {category.toLowerCase()}.
            </p>
          )}
        </div>
        <footer className="wb-palette-footer">
          <span>↑↓ navigate · enter open · esc close</span>
          <span>{matches.length} results</span>
        </footer>
      </div>
    </div>
  );
}
