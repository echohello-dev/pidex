import { useEffect, useMemo, useRef, useState } from 'react';
import { prepare, layout } from '@chenglou/pretext';
import { PiMark } from './components/PiMark';
import { FigureFrame } from './components/FigureFrame';
import { BracketButton } from './components/BracketButton';
import { applyEvent, entriesFromMessages } from './timeline';
import type { Entry } from './timeline';
import type { SessionInfo, WorkspaceInfo } from './api';

type SessionTab = {
  runtimeId: string;
  cwd: string;
  workspaceName: string;
  title: string;
  model: string;
  entries: Entry[];
  running: boolean;
  exited: boolean;
};

const BODY_FONT = '450 15px Georgia, serif';

function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function ToolOutput({ text }: { text: string }) {
  const lines = text.split('\n');
  const shown = lines.slice(0, 14);
  return (
    <>
      {shown.map((line, i) => (
        <div key={i} className="tool-line">
          {line}
        </div>
      ))}
      {lines.length > shown.length ? (
        <div className="tool-line tool-line--dim">… {lines.length - shown.length} more lines</div>
      ) : null}
    </>
  );
}

function App() {
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [wsSessions, setWsSessions] = useState<Record<string, SessionInfo[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tabs, setTabs] = useState<SessionTab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [opening, setOpening] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  const activeTab = tabs.find(t => t.runtimeId === activeId) ?? null;

  useEffect(() => {
    window.openpi.workspaces().then(setWorkspaces);
  }, []);

  useEffect(() => {
    const offEvent = window.openpi.onSessionEvent(({ sessionId, event }) => {
      setTabs(prev =>
        prev.map(tab => {
          if (tab.runtimeId !== sessionId) return tab;
          const { entries, running } = applyEvent(tab.entries, event);
          return { ...tab, entries, running: running ?? tab.running };
        }),
      );
    });
    const offExit = window.openpi.onSessionExit(({ sessionId }) => {
      setTabs(prev =>
        prev.map(tab =>
          tab.runtimeId === sessionId ? { ...tab, exited: true, running: false } : tab,
        ),
      );
    });
    return () => {
      offEvent();
      offExit();
    };
  }, []);

  useEffect(() => {
    timelineRef.current?.scrollTo({ top: timelineRef.current.scrollHeight });
  }, [activeTab?.entries.length, activeTab?.entries[activeTab.entries.length - 1]]);

  const measuredRows = useMemo(() => {
    if (!activeTab) return 0;
    let rows = 0;
    for (const entry of activeTab.entries) {
      if (entry.kind === 'tool') continue;
      const text = entry.kind === 'assistant' ? entry.text || entry.thinking : entry.text;
      if (!text) continue;
      const prepared = prepare(text, BODY_FONT);
      rows += layout(prepared, 780, 24).lineCount;
    }
    return rows;
  }, [activeTab]);

  const expandWorkspace = async (ws: WorkspaceInfo) => {
    const next = expanded === ws.dirName ? null : ws.dirName;
    setExpanded(next);
    if (next && !wsSessions[next]) {
      const sessions = await window.openpi.sessions(next);
      setWsSessions(prev => ({ ...prev, [next]: sessions }));
    }
  };

  const openSession = async (ws: WorkspaceInfo, info?: SessionInfo) => {
    const existing = tabs.find(
      t => t.cwd === ws.cwd && t.title === (info?.title ?? 'new session'),
    );
    if (existing) {
      setActiveId(existing.runtimeId);
      return;
    }
    setOpening(true);
    try {
      const result = await window.openpi.openSession({
        cwd: ws.cwd,
        sessionFile: info?.file,
      });
      if (result.error || !result.sessionId) {
        return;
      }
      const model =
        result.state?.model?.id ?? result.state?.model?.name ?? info?.model ?? 'default';
      const tab: SessionTab = {
        runtimeId: result.sessionId,
        cwd: ws.cwd,
        workspaceName: ws.name,
        title: info?.title ?? 'new session',
        model,
        entries: entriesFromMessages(result.messages ?? []),
        running: Boolean(result.state?.isStreaming),
        exited: false,
      };
      setTabs(prev => [...prev, tab]);
      setActiveId(tab.runtimeId);
    } finally {
      setOpening(false);
    }
  };

  const closeTab = (runtimeId: string) => {
    window.openpi.closeSession(runtimeId);
    setTabs(prev => {
      const next = prev.filter(t => t.runtimeId !== runtimeId);
      if (activeId === runtimeId) setActiveId(next[next.length - 1]?.runtimeId ?? null);
      return next;
    });
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || !activeTab || activeTab.exited) return;
    const echo: Entry = { key: `local-${Date.now()}`, kind: 'user', text };
    setTabs(prev =>
      prev.map(t => (t.runtimeId === activeTab.runtimeId ? { ...t, entries: [...t.entries, echo] } : t)),
    );
    setDraft('');
    await window.openpi.sendPrompt({
      sessionId: activeTab.runtimeId,
      text,
      streaming: activeTab.running,
    });
  };

  return (
    <div className="app-shell">
      <nav className="tabbar">
        {tabs.map(tab => (
          <button
            key={tab.runtimeId}
            type="button"
            className={`tab${tab.runtimeId === activeId ? ' is-active' : ''}`}
            onClick={() => setActiveId(tab.runtimeId)}
          >
            <span
              className={`tab-dot ${
                tab.exited ? 'tab-dot--done' : tab.running ? 'tab-dot--active' : 'tab-dot--stale'
              }`}
            />
            {tab.workspaceName}
            <span className="tab-branch">{tab.title.slice(0, 24)}</span>
            <span
              className="tab-close"
              role="button"
              aria-label={`Close ${tab.workspaceName}`}
              onClick={e => {
                e.stopPropagation();
                closeTab(tab.runtimeId);
              }}
            >
              ×
            </span>
          </button>
        ))}
        <span className="tabbar-meta">
          <PiMark size={11} />
          electron <b>{window.openpi?.versions.electron ?? '—'}</b> · node{' '}
          <b>{window.openpi?.versions.node ?? '—'}</b>
        </span>
      </nav>

      <div className="app-body">
        <aside className="sidebar">
          <div className="sidebar-head">
            <span className="sidebar-group-label">Workspaces</span>
            <span className="sidebar-group-label">{workspaces.length}</span>
          </div>
          <div className="sidebar-scroll">
            <div className="sidebar-group">
              {workspaces.map(ws => (
                <div key={ws.dirName}>
                  <button
                    type="button"
                    className={`ws-row${ws.dirName === expanded ? ' is-active' : ''}`}
                    onClick={() => expandWorkspace(ws)}
                  >
                    <span className="ws-row-top">
                      <span className="ws-row-name">{ws.name}</span>
                      <span className="ws-row-meta">{timeAgo(ws.lastActive)}</span>
                    </span>
                    <span className="ws-row-branch">
                      {ws.branch || 'no git'} · {ws.sessionCount} sessions
                    </span>
                  </button>
                  {expanded === ws.dirName ? (
                    <div className="ws-sessions">
                      {(wsSessions[ws.dirName] ?? []).slice(0, 12).map(s => (
                        <button
                          key={s.id}
                          type="button"
                          className="session-row"
                          onClick={() => openSession(ws, s)}
                        >
                          <span className="session-row-title">{s.title}</span>
                          <span className="session-row-meta">
                            {s.model || 'pi'} · {s.messageCount} msgs · {timeAgo(s.timestamp)}
                          </span>
                        </button>
                      ))}
                      {wsSessions[ws.dirName] === undefined ? (
                        <span className="session-row-meta">loading…</span>
                      ) : null}
                      {wsSessions[ws.dirName]?.length === 0 ? (
                        <span className="session-row-meta">no sessions</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
          <div className="sidebar-foot">
            <BracketButton
              primary
              style={{ width: '100%' }}
              disabled={!expanded || opening}
              onClick={() => {
                const ws = workspaces.find(w => w.dirName === expanded) ?? workspaces[0];
                if (ws) openSession(ws);
              }}
            >
              {opening ? 'Opening…' : 'New session'}
            </BracketButton>
          </div>
        </aside>

        <main className="main-pane">
          {activeTab ? (
            <>
              <header className="bench-head">
                <div className="bench-head-top">
                  <h1 className="bench-title">{activeTab.workspaceName}</h1>
                  <span
                    className={`ds-badge ${
                      activeTab.exited
                        ? 'ds-badge--done'
                        : activeTab.running
                          ? 'ds-badge--active ds-badge--pulse'
                          : 'ds-badge--stale'
                    }`}
                  >
                    {activeTab.exited ? 'exited' : activeTab.running ? 'running' : 'idle'}
                  </span>
                  <div className="bench-actions">
                    <BracketButton disabled={!activeTab.running} onClick={() => window.openpi.abortSession(activeTab.runtimeId)}>
                      Abort
                    </BracketButton>
                  </div>
                </div>
                <div className="bench-stats">
                  <span className="bench-path">{activeTab.cwd}</span>
                  <span>
                    model <b>{activeTab.model}</b>
                  </span>
                  <span>
                    session <b>{activeTab.title.slice(0, 48)}</b>
                  </span>
                </div>
              </header>

              <div className="timeline" ref={timelineRef}>
                {activeTab.entries.map(entry => {
                  if (entry.kind === 'tool') {
                    return (
                      <FigureFrame
                        key={entry.key}
                        className="tool-card"
                        caption={`${entry.tool}${entry.args ? ` · ${entry.args.slice(0, 60)}` : ''}`}
                        live={entry.running}
                      >
                        <div className="tool-body">
                          {entry.output ? (
                            <ToolOutput text={entry.output} />
                          ) : (
                            <div className="tool-line tool-line--dim">
                              {entry.running ? 'running…' : '(no output)'}
                            </div>
                          )}
                          {!entry.ok ? <div className="tool-line tool-line--del">✗ failed</div> : null}
                        </div>
                      </FigureFrame>
                    );
                  }
                  return (
                    <div key={entry.key} className={`msg msg--${entry.kind}`}>
                      <span className="msg-role">
                        {entry.kind === 'user' ? 'you' : entry.streaming ? 'pi · streaming' : 'pi'}
                      </span>
                      {entry.kind === 'assistant' && entry.thinking ? (
                        <p className="msg-thinking">{entry.thinking}</p>
                      ) : null}
                      {entry.text ? <p className="msg-text">{entry.text}</p> : null}
                      {entry.kind === 'assistant' && entry.streaming && !entry.text ? (
                        <p className="msg-text msg-text--dim">thinking…</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <footer className="composer">
                <div className="composer-row">
                  <span className="composer-prompt">›</span>
                  <input
                    className="composer-input"
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') send();
                    }}
                    placeholder={
                      activeTab.exited
                        ? 'session exited'
                        : activeTab.running
                          ? `steer ${activeTab.workspaceName}…`
                          : `prompt ${activeTab.workspaceName}…`
                    }
                    disabled={activeTab.exited}
                    spellCheck={false}
                  />
                </div>
                <div className="composer-hint">
                  <span>{activeTab.running ? 'enter to steer' : 'enter to send'}</span>
                  <span>{activeTab.model}</span>
                </div>
              </footer>
            </>
          ) : (
            <div className="empty-pane">
              <PiMark size={40} />
              <p className="empty-title">No session open</p>
              <p className="empty-copy">
                Pick a session from the sidebar, or start a new one in the expanded workspace.
              </p>
            </div>
          )}
        </main>
      </div>

      <footer className="statusbar">
        <div className="statusbar-left">
          <span className="status-ok">
            {activeTab?.running ? 'agent running' : 'runtime linked'}
          </span>
          <span>{tabs.length} tabs</span>
        </div>
        <span>
          $ openpi — {measuredRows} rows measured · 0 dom reads
        </span>
      </footer>
    </div>
  );
}

export { App };
