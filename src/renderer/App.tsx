import { WorkspaceNavigation } from './components/WorkspaceNavigation';
import { SessionTree, EntryTree } from './components/SessionTree';
import { HistorySummary } from './components/HistorySummary';
import { HistoryExport } from './components/HistoryExport';
import { HistoryHandoff } from './components/HistoryHandoff';
import { WorkspaceStatus } from './components/WorkspaceStatus';
import { useEffect, useState } from 'react';
import { PidexMark } from './components/PidexMark';
import welcomeMark from './assets/workbench/welcome-mark.svg';
import { BracketButton } from './components/BracketButton';
import {
  Composer,
  EmptyState,
  Icon,
  NavItem,
  SearchField,
} from './components/WorkbenchControls';
import {
  ChangesView,
  FilesView,
  SettingsView,
  SkillsView,
} from './components/WorkbenchViews';
import { Transcript } from './components/Transcript';
import { CommandPalette } from './components/CommandPalette';
import { timeAgo, useWorkbench } from './useWorkbench';

function App() {
  const b = useWorkbench();
  const { api, ws, active, view, details, sessions, preview } = b;
  const [sidebar, setSidebar] = useState(true);
  const [terminal, setTerminal] = useState(false);
  const [palette, setPalette] = useState(false);
  const [sessionQuery, setSessionQuery] = useState('');
  const [allHistory, setAllHistory] = useState(false);
  const [paletteFiles, setPaletteFiles] = useState<Record<string, string>>({});
  const paletteFile = paletteFiles[b.selected] ?? '';
  const [resetSettings, setResetSettings] = useState(0);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPalette((p) => !p);
      }
      if (event.key === ',') {
        event.preventDefault();
        b.navigate('settings');
      }
      if (event.key.toLowerCase() === 'h' && event.shiftKey) {
        event.preventDefault();
        b.navigate('history');
      }
      if (event.key.toLowerCase() === 'b') {
        event.preventDefault();
        setSidebar((v) => !v);
      }
      if (event.key.toLowerCase() === 'o') {
        event.preventDefault();
        void b.addWorkspace();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const composer = (placeholder?: string, label?: string) => (
    <div className="wb-composer-target">
      <p className="wb-execution-root" title={ws?.cwd}>
        Run in {ws?.name ?? 'chosen root'} · {branch} · {ws?.cwd}
      </p>
      <Composer
        draft={b.draft}
        onDraft={b.onDraft}
        onSend={b.send}
        onStop={() => active && b.run(() => api.abortSession(active.runtimeId))}
        onAttach={b.attach}
        model={b.currentModel}
        models={b.models}
        onModel={b.changeModel}
        running={view === 'session' && active?.running}
        disabled={
          !ws ||
          ws.availability !== 'available' ||
          (view === 'session' && active?.exited) ||
          b.previewLoading ||
          (view === 'history' && !preview?.ready)
        }
        busy={b.busy}
        placeholder={placeholder}
        label={label}
        commands={active?.commands ?? []}
        modelDisabled={view === 'history'}
        allowDefaultModel={view === 'new' || !active}
      />
    </div>
  );
  const filteredSessions = sessions.filter((s) =>
    `${s.title} ${s.model}`.toLowerCase().includes(sessionQuery.toLowerCase()),
  );
  const title = {
    new: 'Workspace',
    session: active?.title ?? 'Session',
    changes: 'Changes review',
    history: 'Session history',
    settings: 'Models & access',
    skills: 'Skills',
    files: 'Files & preview',
  }[view];
  const branch = details.branch || ws?.branch || 'local';
  const context = `${ws?.name ?? 'pidex'} / ${branch} / ${view === 'history' ? `${sessions.length} sessions` : view === 'changes' ? `${details.changes.length} changes` : view === 'settings' ? 'workspace defaults' : 'local workspace'}`;
  const live = b.tabs;
  const historyExport = preview?.loaded && !b.previewLoading &&
    (preview.ready || preview.entries.length > 0)
    ? {
        title: preview.info.title,
        cwd: preview.info.cwd,
        model: preview.info.model,
        entries: preview.entries,
      }
    : null;

  return (
    <div
      className={`app-shell wb-shell${sidebar ? '' : ' wb-shell--collapsed'}`}
    >
      <header className="wb-titlebar">
        <span
          className={`wb-window-controls${api?.platform === 'darwin' ? ' wb-window-controls--native' : ''}`}
          aria-hidden="true"
        >
          <i />
          <i />
          <i />
        </span>
        <button
          type="button"
          className="wb-icon-button"
          onClick={() => setSidebar((v) => !v)}
          aria-label="Toggle sidebar"
          aria-expanded={sidebar}
        >
          <Icon name="panel-left" />
        </button>
        <PidexMark size={20} />
        <span className="wb-window-title">
          {ws?.name ?? 'pidex'} / {title}
        </span>
        <button
          type="button"
          className="wb-icon-button"
          onClick={() => setPalette(true)}
          aria-label="Quick switch"
        >
          <Icon name="search" />
        </button>
        <kbd>⌘K</kbd>
        <button
          type="button"
          className="wb-icon-button"
          onClick={() => setTerminal((v) => !v)}
          aria-label="Toggle session output"
          aria-expanded={terminal}
        >
          <Icon name="terminal" />
        </button>
      </header>
      <div className="wb-body">
        {sidebar && (
          <aside className="wb-sidebar" aria-label="Workspace navigation">
            <WorkspaceNavigation
              roots={b.workspaces}
              groups={b.groups}
              groupId={b.groupId}
              rootId={b.selected}
              onGroup={b.selectGroup}
              onRoot={b.selectWorkspace}
              onSave={b.saveGroup}
              onAdd={() => void b.addWorkspace()}
            />
            <p className="wb-meta wb-branch">{branch} / local workspace</p>
            <BracketButton
              primary
              onClick={() => {
                b.setActiveId(null);
                b.navigate('new');
              }}
              disabled={!ws || ws.availability !== 'available'}
            >
              New session
            </BracketButton>
            <nav aria-label="Main navigation">
              <NavItem
                icon="message-square"
                active={view === 'history'}
                detail={sessions.length}
                onClick={() => b.navigate('history')}
              >
                Sessions
              </NavItem>
              <NavItem
                icon="changes"
                active={view === 'changes'}
                detail={details.changes.length}
                onClick={() => b.navigate('changes')}
              >
                Changes
              </NavItem>
              <NavItem
                icon="skills"
                active={view === 'skills'}
                onClick={() => b.navigate('skills')}
              >
                Skills
              </NavItem>
            </nav>
            <div className="wb-sidebar-scroll">
              <p className="wb-eyebrow">Open sessions</p>
              {live.map((t) => (
                <button
                  key={t.runtimeId}
                  type="button"
                  className={`wb-session-item${active?.runtimeId === t.runtimeId && view === 'session' ? ' is-active' : ''}`}
                  title={t.cwd}
                  onClick={() => b.activateTab(t)}
                >
                  <span>{t.title}</span>
                  <small>
                    {t.exited ? 'Exited' : t.running ? 'Running' : 'Ready'} /
                    this window
                  </small>
                  <small title={t.cwd}>
                    {b.workspaces.find((w) => w.cwd === t.cwd)?.name} · {t.cwd}
                  </small>
                </button>
              ))}
              <p className="wb-eyebrow">Recent sessions · this root</p>
              {sessions.slice(0, 3).map((s) => (
                <button
                  key={s.file}
                  type="button"
                  className={`wb-session-item${active?.file === s.file && view === 'session' ? ' is-active' : ''}`}
                  onClick={() => b.showSession(s)}
                  disabled={b.busy}
                >
                  <span>{s.title}</span>
                  <small>
                    {b.tabs.find((t) => t.file === s.file)?.running
                      ? 'Working'
                      : 'Saved'}{' '}
                    / {timeAgo(s.timestamp)}
                  </small>
                </button>
              ))}
              {!sessions.length && !live.length && (
                <p className="wb-sidebar-empty">
                  Your sessions will appear here.
                </p>
              )}
              <NavItem icon="plus" onClick={() => void b.addWorkspace()}>
                Open project
              </NavItem>
            </div>
            <NavItem
              icon="settings"
              active={view === 'settings'}
              detail="⌘,"
              onClick={() => b.navigate('settings')}
            >
              Settings
            </NavItem>
            <p className="wb-eyebrow wb-connection">
              {active?.running ? 'PI WORKING / LOCAL' : 'LOCAL WORKSPACE'}
            </p>
          </aside>
        )}
        <main className="wb-main">
          {b.error && (
            <div className="wb-error" role="alert">
              <span>{b.error}</span>
              <button
                type="button"
                aria-label="Dismiss error"
                onClick={() => b.setError('')}
              >
                ×
              </button>
            </div>
          )}
          {!ws ? (
            <div className="wb-welcome">
              <img src={welcomeMark} alt="" aria-hidden="true" />
              <h1>Welcome to pidex</h1>
              <p>
                Pick a project folder to get started. Your conversations and
                settings stay local.
              </p>
              <div className="wb-welcome-picker">
                <span className="wb-eyebrow">Open project</span>
                <div className="wb-path-preview">~/projects /</div>
                <BracketButton
                  primary
                  onClick={() => void b.addWorkspace()}
                  disabled={b.loading || !api}
                >
                  {b.loading ? 'Loading…' : 'Browse folder'}
                </BracketButton>
              </div>
            </div>
          ) : (
            <>
              <header className="wb-view-header">
                <div>
                  <h1>{title}</h1>
                  <p>{context}</p>
                </div>
                {view === 'settings' ? (
                  <BracketButton onClick={() => setResetSettings((v) => v + 1)}>
                    Restore defaults
                  </BracketButton>
                ) : view === 'history' ? (
                  <HistoryExport
                    key={`${preview?.info.file}:${preview?.entryId}:${!!historyExport}`}
                    input={historyExport}
                  />
                ) : (
                  <BracketButton
                    onClick={() =>
                      view === 'new'
                        ? void b.addWorkspace()
                        : b.navigate('files')
                    }
                  >
                    {view === 'new' ? 'Open project' : 'Browse files'}
                  </BracketButton>
                )}
              </header>
              {ws.availability !== 'available' && (
                <div className="wb-root-unavailable" role="status">
                  <strong>
                    {ws.availability === 'missing'
                      ? 'Missing folder'
                      : 'Folder unavailable'}
                  </strong>
                  <p>{ws.cwd}</p>
                  <p>
                    Restore the original folder to start or continue a session.
                    Saved history remains available; adding another root does
                    not relocate it.
                  </p>
                </div>
              )}
              {view === 'new' && (
                <div className="wb-start-scroll">
                  <div className="wb-start">
                    <div className="wb-start-title">
                      <PidexMark size={48} />
                      <div>
                        <h2>Start a session</h2>
                        <p>Bring a task. Pi works in your workspace.</p>
                      </div>
                    </div>
                    <div className="wb-working-directory">
                      <span className="wb-eyebrow">Work in</span>
                      <label className="wb-select">
                        <select
                          aria-label="Working directory"
                          value={b.selected}
                          onChange={(e) => {
                            const next = b.workspaces.find(
                              (w) => w.dirName === e.target.value,
                            );
                            if (next) b.selectWorkspace(next);
                          }}
                        >
                          {b.workspaces
                            .filter((w) =>
                              b.groups
                                .find((g) => g.id === b.groupId)
                                ?.rootIds.includes(w.dirName),
                            )
                            .map((w) => (
                              <option key={w.dirName} value={w.dirName}>
                                {w.name} / {w.branch || 'local'} / {w.cwd}
                              </option>
                            ))}
                        </select>
                        <Icon name="chevron-down" />
                      </label>
                      <span className="wb-meta">{ws.cwd}</span>
                    </div>
                    <WorkspaceStatus
                      workspace={ws}
                      details={details}
                      ready={b.detailsRoot === ws.dirName}
                      onReview={() => b.navigate('changes')}
                    />
                    {composer()}
                    <div className="wb-starters">
                      <button
                        type="button"
                        onClick={() => b.onDraft('Help me track down a bug: ')}
                      >
                        <span>
                          <Icon name="file-code" />
                          Fix a bug
                        </span>
                        <small>Track down a regression.</small>
                      </button>
                      <button
                        type="button"
                        onClick={() => b.navigate('changes')}
                      >
                        <span>
                          <Icon name="starter-changes" />
                          Review changes
                        </span>
                        <small>Check the current diff.</small>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          b.onDraft('Explain the structure of this project.')
                        }
                      >
                        <span>
                          <Icon name="starter-search" />
                          Explore the code
                        </span>
                        <small>Understand this project.</small>
                      </button>
                    </div>
                    <div className="wb-section-heading">
                      <span className="wb-eyebrow">Continue a session</span>
                      <button
                        type="button"
                        onClick={() => b.navigate('history')}
                      >
                        View all / ⌘⇧H
                      </button>
                    </div>
                    <div className="wb-continue">
                      {sessions.slice(0, 2).map((s) => (
                        <button
                          type="button"
                          key={s.id}
                          className="wb-session-item"
                          onClick={() => b.showSession(s)}
                          disabled={b.busy}
                        >
                          <span>{s.title}</span>
                          <small>
                            Saved / {branch} / {timeAgo(s.timestamp)}
                          </small>
                        </button>
                      ))}
                      {!sessions.length && (
                        <p className="wb-meta">
                          No saved sessions yet. Start with a task above.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {view === 'session' &&
                (active ? (
                  <div className="wb-active-layout">
                    <section className="wb-conversation">
                      <Transcript
                        key={active.runtimeId}
                        entries={active.entries}
                        follow
                      >
                        {!active.entries.length && (
                          <EmptyState title="Ready when you are">
                            Send a task to start working with Pi.
                          </EmptyState>
                        )}
                      </Transcript>
                      {composer(
                        active.exited
                          ? 'Session exited. Start a new session to continue.'
                          : active.running
                            ? 'Add a follow-up while pi works…'
                            : 'Continue this session…',
                      )}
                    </section>
                    <aside className="wb-context">
                      <span className="wb-eyebrow">Session</span>
                      <h2>
                        {active.running
                          ? 'Working on'
                          : active.exited
                            ? 'Session exited'
                            : 'Ready to continue'}
                        <br />
                        {active.title}
                      </h2>
                      <span className="wb-eyebrow">Active worktree</span>
                      <div className="wb-static-select">{branch}</div>
                      <span className="wb-eyebrow">Changed files</span>
                      {details.changes.slice(0, 8).map((f, i) => (
                        <button
                          className="wb-file-row"
                          type="button"
                          key={`${f.path}-${i}`}
                          onClick={() => b.navigate('changes')}
                        >
                          <Icon name="file-code" />
                          <span>{f.path.split('/').at(-1)}</span>
                          <small>
                            +{f.additions} −{f.deletions}
                          </small>
                        </button>
                      ))}
                      {!details.changes.length && (
                        <p className="wb-meta">No changed files.</p>
                      )}
                      <BracketButton
                        primary
                        onClick={() => b.navigate('changes')}
                      >
                        Review {details.changes.length} files
                      </BracketButton>
                      {active.startedAt && (
                        <p className="wb-meta">
                          Opened at entry {active.startedAt.slice(0, 8)}. The
                          live branch advances as you send messages.
                        </p>
                      )}
                      <span className="wb-eyebrow">Activity</span>
                      <p className="wb-meta">
                        {active.entries.filter((e) => e.kind === 'tool').length}{' '}
                        tool calls in this session.
                      </p>
                      <p className="wb-meta">
                        {active.running
                          ? 'You can keep typing. Follow-ups steer Pi while it works.'
                          : 'Your conversation is saved locally by Pi.'}
                      </p>
                      <div className="wb-flex-space" />
                      <BracketButton onClick={b.closeSession}>
                        Close session
                      </BracketButton>
                    </aside>
                  </div>
                ) : (
                  <EmptyState title="No session open">
                    Select a saved session or start a new one.
                  </EmptyState>
                ))}
              {view === 'changes' && (
                <ChangesView
                  key={ws.dirName}
                  cwd={ws.cwd}
                  details={details}
                  onDetails={b.setDetails}
                  report={b.report}
                  composer={composer('Ask pi about these changes…')}
                />
              )}
              {view === 'history' && (
                <div className="wb-split-view">
                  <aside className="wb-subpanel">
                    <SearchField
                      value={sessionQuery}
                      onChange={setSessionQuery}
                      placeholder="Search sessions…"
                      label="Search sessions"
                    />
                    <div className="wb-history-list">
                      <SessionTree
                        sessions={sessions}
                        query={sessionQuery}
                        limit={allHistory ? undefined : 30}
                        selectedFile={preview?.info.file}
                        onSelect={(s) => void b.showPreview(s)}
                      />
                      {!filteredSessions.length && (
                        <p className="wb-meta">No sessions found.</p>
                      )}
                    </div>
                    <BracketButton onClick={() => setAllHistory((v) => !v)}>
                      {allHistory ? 'Show recent' : 'Show all sessions'}
                    </BracketButton>
                    {preview?.tree && (
                      <EntryTree
                        tree={preview.tree}
                        selectedId={preview.entryId}
                        onSelect={(id) => void b.showPreview(preview.info, id)}
                      />
                    )}
                  </aside>
                  <section className="wb-conversation wb-history-conversation">
                    {preview ? (
                      <>
                        <div className="wb-history-heading">
                          <div>
                            <h2 title={preview.info.title}>
                              {preview.info.title}
                            </h2>
                            <p
                              className="wb-meta"
                              title={`${preview.info.model || 'Pi'} / Selected ${preview.entryId ?? 'empty'}${preview.entryId === preview.tree?.leafId ? ' / Archive tip' : ''}`}
                            >
                              {preview.info.model || 'Pi'} /{' '}
                              {preview.entryId
                                ? `Selected ${preview.entryId.slice(0, 8)}`
                                : 'Empty session'}
                              {preview.entryId === preview.tree?.leafId
                                ? ' / Archive tip'
                                : ''}
                            </p>
                          </div>
                        </div>
                        <WorkspaceStatus
                          context="history"
                          workspace={ws}
                          details={details}
                          ready={b.detailsRoot === ws.dirName}
                          onReview={() => b.navigate('changes')}
                        />
                        {preview.tree?.warning && (
                          <p className="wb-meta" role="status">
                            {preview.tree.warning}
                          </p>
                        )}
                        {preview.entryId &&
                          preview.entryId !== preview.tree?.leafId && (
                            <p className="wb-branch-notice">
                              Pi RPC cannot resume an earlier entry in place.
                              Continuing creates a new fork from this selection
                              and preserves the source.
                            </p>
                          )}
                        {preview.loaded &&
                          !b.previewLoading &&
                          (preview.ready || preview.entries.length > 0) && (
                            <div className="wb-history-recovery">
                              <HistorySummary entries={preview.entries} />
                              {preview.entries.length > 0 && (
                                <HistoryHandoff
                                  key={`handoff:${preview.info.file}:${preview.entryId}`}
                                  roots={b.workspaces}
                                  sourceRootId={b.selected}
                                  onPrepare={b.prepareHandoff}
                                />
                              )}
                            </div>
                          )}
                        <Transcript
                          key={`${preview.info.file}:${preview.entryId}`}
                          entries={preview.entries}
                        >
                          {b.previewLoading ? (
                            <p className="wb-meta" role="status">
                              Loading session…
                            </p>
                          ) : (
                            <>
                              <div className="wb-fork-actions">
                                <BracketButton
                                  disabled={
                                    b.busy ||
                                    !preview.ready ||
                                    ws.availability !== 'available' ||
                                    !preview.tree?.canContinue ||
                                    !preview.entryId
                                  }
                                  onClick={b.forkSession}
                                >
                                  Fork from here
                                </BracketButton>
                                <span className="wb-meta">
                                  Start a new session from this conversation.
                                </span>
                              </div>
                            </>
                          )}
                        </Transcript>
                        {composer(
                          'Continue selected branch…',
                          preview.entryId &&
                            preview.entryId !== preview.tree?.leafId
                            ? 'Resume in new fork'
                            : 'Resume',
                        )}
                      </>
                    ) : (
                      <EmptyState title="Your session history">
                        Saved conversations will appear here.
                      </EmptyState>
                    )}
                  </section>
                </div>
              )}
              {view === 'settings' &&
                (b.defaultsRoot !== ws.dirName ? (
                  <p className="wb-meta">Loading root defaults…</p>
                ) : (
                  <SettingsView
                    key={ws.cwd}
                    draftCache={b.settingsDrafts.current}
                    cwd={ws.cwd}
                    models={b.models}
                    modelError={b.modelError}
                    modelsLoading={b.modelsLoading}
                    defaults={b.defaults}
                    resetSignal={resetSettings}
                    onSaved={(value) => b.setRootDefaults(ws.cwd, value)}
                    report={b.report}
                    onFiles={() => b.navigate('files')}
                  />
                ))}
              {view === 'skills' && (
                <SkillsView
                  key={ws.cwd}
                  cwd={ws.cwd}
                  commands={active?.commands ?? []}
                  onUse={b.useSkill}
                  report={b.report}
                />
              )}
              {view === 'files' && (
                <>
                  {details.filesTruncated && (
                    <p className="wb-root-unavailable" role="status">
                      File list limited to 3,000 files and seven directory
                      levels. Select a deeper root to browse more.
                    </p>
                  )}
                  <FilesView
                    key={ws.cwd}
                    cwd={ws.cwd}
                    files={details.files}
                    initialFile={paletteFile}
                    report={b.report}
                  />
                </>
              )}
            </>
          )}
          {terminal && (
            <section className="wb-output" aria-label="Session output">
              <header>
                <span className="wb-eyebrow">Session output</span>
                <button
                  type="button"
                  className="wb-icon-button"
                  onClick={() => setTerminal(false)}
                  aria-label="Close session output"
                >
                  ×
                </button>
              </header>
              <pre>
                {active?.entries
                  .filter((e) => e.kind === 'tool' && e.tool === 'bash')
                  .map((e) =>
                    e.kind === 'tool' ? `$ ${e.args}\n${e.output}` : '',
                  )
                  .join('\n\n') ||
                  'Shell output from the current Pi session will appear here.'}
              </pre>
            </section>
          )}
        </main>
      </div>
      <footer className="wb-statusbar">
        <span className={active?.exited ? 'wb-muted' : ''}>
          {!ws
            ? 'RUNTIME IDLE'
            : ws.availability !== 'available'
              ? 'ROOT UNAVAILABLE'
              : active?.exited
                ? 'PI EXITED'
                : active?.running
                  ? 'PI WORKING'
                  : b.busy
                    ? 'PI CONNECTING'
                    : b.modelError && !active
                      ? 'PI UNAVAILABLE'
                      : 'PI READY'}
        </span>
        <span>
          {view === 'history'
            ? 'Local session archive'
            : `${active?.entries.length ?? 0} entries / ${b.tabs.length} open sessions`}
        </span>
      </footer>
      {palette && (
        <CommandPalette
          workspaces={b.workspaces}
          sessions={sessions}
          files={details.files}
          commands={active?.commands ?? []}
          onClose={() => setPalette(false)}
          onWorkspace={b.selectWorkspace}
          onSession={b.showSession}
          onNavigate={b.navigate}
          onFile={(file) => {
            setPaletteFiles((previous) => ({
              ...previous,
              [b.selected]: file,
            }));
            b.navigate('files');
          }}
          onCommand={b.useSkill}
          onAddWorkspace={() => void b.addWorkspace()}
        />
      )}
    </div>
  );
}

export { App };
