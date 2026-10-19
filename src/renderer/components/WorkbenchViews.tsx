import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { PierrePatch } from './PierreDiff';
import { BracketButton } from './BracketButton';
import { EmptyState, Icon, NavItem, SearchField } from './WorkbenchControls';
import { DEFAULTS, unwrap } from '../useWorkbench';
import type {
  Defaults,
  GitChange,
  ModelInfo,
  SkillInfo,
  SlashCommand,
  WorkspaceDetails,
} from '../api';

function Select({
  label,
  value,
  onChange,
  children,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className="wb-select">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
      >
        {children}
      </select>
      <Icon name="chevron-down" />
    </label>
  );
}

export function ChangesView({
  cwd,
  details,
  onDetails,
  report,
  composer,
}: {
  cwd: string;
  details: WorkspaceDetails;
  onDetails: (details: WorkspaceDetails) => void;
  report: (e: unknown) => void;
  composer: ReactNode;
}) {
  const [selectedKey, setSelectedKey] = useState('');
  const [patch, setPatch] = useState('');
  const [patchError, setPatchError] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const keyOf = (f: GitChange) =>
    `${f.staged ? 'staged' : 'working'}:${f.path}`;
  const file =
    details.changes.find((f) => keyOf(f) === selectedKey) ?? details.changes[0];
  const stagedCount = details.changes.filter((f) => f.staged).length;
  useEffect(() => {
    let cancelled = false;
    setPatch('');
    setPatchError('');
    if (!file) return;
    setLoading(true);
    window.pidex
      .filePatch(cwd, file.path, file.staged, file.untracked)
      .then((r) => {
        if (!cancelled) setPatch(unwrap(r));
      })
      .catch((e) => {
        if (!cancelled)
          setPatchError(
            e instanceof Error ? e.message : 'Preview unavailable.',
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    cwd,
    file?.path,
    file?.staged,
    file?.untracked,
    file?.additions,
    file?.deletions,
  ]);

  const act = async (
    action: 'stage' | 'stage-all' | 'unstage' | 'commit',
    target?: string,
  ) => {
    if (busy) return;
    setBusy(true);
    try {
      onDetails(unwrap(await window.pidex.gitAction(cwd, action, target)));
      if (action === 'commit') setMessage('');
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="wb-split-view">
      <aside className="wb-subpanel wb-change-list">
        <span className="wb-eyebrow">
          {details.changes.length} changes / {stagedCount} staged
        </span>
        <div className="wb-diff-count">
          <span>
            +{details.changes.reduce((n, f) => n + f.additions, 0)} additions
          </span>
          <span>
            −{details.changes.reduce((n, f) => n + f.deletions, 0)} deletions
          </span>
        </div>
        <div className="wb-static-select">
          {details.branch || 'No Git branch'}
        </div>
        <div className="wb-change-files">
          {details.changes.map((f) => (
            <button
              type="button"
              key={keyOf(f)}
              className={`wb-file-row${keyOf(f) === keyOf(file) ? ' is-active' : ''}`}
              onClick={() => setSelectedKey(keyOf(f))}
            >
              <Icon name="file-code" />
              <span title={f.path}>
                {f.path.split('/').at(-1)}
                <small>
                  {f.staged ? 'Staged' : f.untracked ? 'Untracked' : 'Modified'}
                </small>
              </span>
              <small>
                +{f.additions} −{f.deletions}
              </small>
            </button>
          ))}
        </div>
        <BracketButton
          onClick={() => void act('stage-all')}
          disabled={busy || !details.changes.some((f) => !f.staged)}
        >
          Stage all
        </BracketButton>
        <p className="wb-meta">
          {details.gitError ||
            'Changes are read from this workspace. Stage files before committing.'}
        </p>
        <div className="wb-flex-space" />
        <label className="wb-eyebrow" htmlFor="commit-message">
          Commit message
        </label>
        <textarea
          id="commit-message"
          className="wb-commit-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe these changes…"
        />
        <BracketButton
          primary
          disabled={busy || !stagedCount || !message.trim()}
          onClick={() => void act('commit', message)}
        >
          {busy ? 'Working…' : 'Commit'}
        </BracketButton>
        <p className="wb-meta">
          {stagedCount
            ? `Commit includes ${stagedCount} staged files.`
            : 'Stage files to enable commit.'}
        </p>
      </aside>
      <section className="wb-conversation">
        <div className="wb-diff-panel">
          {file ? (
            <>
              <header className="wb-diff-toolbar">
                <Icon name="file-code" />
                <span>{file.path}</span>
                <small className="wb-success">
                  +{file.additions} −{file.deletions}
                </small>
              </header>
              <div className="wb-diff-scroll">
                {loading ? (
                  <p className="wb-meta wb-padded" role="status">
                    Loading diff…
                  </p>
                ) : patchError ? (
                  <EmptyState title="Preview unavailable">
                    {patchError}
                  </EmptyState>
                ) : patch ? (
                  <PierrePatch patch={patch} />
                ) : (
                  <EmptyState title="No text changes">
                    This file may be binary, empty, or contain only metadata
                    changes.
                  </EmptyState>
                )}
              </div>
              <footer className="wb-diff-actions">
                <span className="wb-eyebrow">
                  {file.staged ? 'Staged file' : 'Working copy'}
                </span>
                <BracketButton
                  primary
                  disabled={busy}
                  onClick={() =>
                    void act(file.staged ? 'unstage' : 'stage', file.path)
                  }
                >
                  {file.staged ? 'Unstage file' : 'Stage file'}
                </BracketButton>
              </footer>
            </>
          ) : (
            <EmptyState
              title={
                details.gitError ? 'Git unavailable' : 'Working tree is clean'
              }
            >
              {details.gitError ||
                'Changed files will appear here when you or Pi edit the workspace.'}
            </EmptyState>
          )}
        </div>
        {composer}
      </section>
    </div>
  );
}

export function FilesView({
  cwd,
  files,
  initialFile,
  report,
}: {
  cwd: string;
  files: string[];
  initialFile: string;
  report: (e: unknown) => void;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(initialFile);
  const [tabs, setTabs] = useState<string[]>(initialFile ? [initialFile] : []);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const open = (file: string) => {
    setSelected(file);
    setTabs((prev) => (prev.includes(file) ? prev : [...prev, file]));
  };
  useEffect(() => {
    if (initialFile) open(initialFile);
  }, [initialFile]);
  useEffect(() => {
    let cancelled = false;
    setContent('');
    setError('');
    if (!selected) return;
    setLoading(true);
    window.pidex
      .readFile(cwd, selected)
      .then((r) => {
        if (!cancelled) setContent(unwrap(r));
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Could not read file.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cwd, selected]);
  const filtered = files.filter((file) =>
    file.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="wb-split-view">
      <aside className="wb-subpanel">
        <span className="wb-eyebrow">Project files</span>
        <p className="wb-meta wb-break">{cwd}</p>
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Filter files…"
          label="Filter files"
        />
        <div className="wb-file-tree">
          {filtered.slice(0, 1000).map((file) => (
            <button
              type="button"
              key={file}
              className={`wb-file-row${file === selected ? ' is-active' : ''}`}
              onClick={() => open(file)}
            >
              <Icon name="file-code" />
              <span title={file}>{file}</span>
            </button>
          ))}
          {!filtered.length && <p className="wb-meta">No files found.</p>}
        </div>
        <p className="wb-meta">{files.length} files / read-only preview</p>
        <BracketButton
          onClick={() =>
            void window.pidex.openProject(cwd).then(unwrap).catch(report)
          }
        >
          Open folder
        </BracketButton>
      </aside>
      <section className="wb-file-preview">
        <div className="wb-file-tabs">
          {tabs.map((file) => (
            <div key={file} className={file === selected ? 'is-active' : ''}>
              <button type="button" onClick={() => setSelected(file)}>
                {file.split('/').at(-1)}
              </button>
              <button
                type="button"
                aria-label={`Close ${file}`}
                onClick={() => {
                  const next = tabs.filter((f) => f !== file);
                  setTabs(next);
                  if (file === selected) setSelected(next.at(-1) ?? '');
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        {selected ? (
          <>
            <div className="wb-preview-meta wb-meta">
              {selected} / {content.split('\n').length} lines
            </div>
            <div className="wb-code-preview">
              {loading ? (
                <p role="status" className="wb-meta wb-padded">
                  Loading file…
                </p>
              ) : error ? (
                <EmptyState title="Preview unavailable">{error}</EmptyState>
              ) : (
                <pre>
                  {content.split('\n').map((line, i) => (
                    <div key={i}>
                      <span aria-hidden="true">{i + 1}</span>
                      <code>{line || ' '}</code>
                    </div>
                  ))}
                </pre>
              )}
            </div>
          </>
        ) : (
          <EmptyState title="Choose a file">
            Select a file to preview its contents.
          </EmptyState>
        )}
      </section>
    </div>
  );
}

export function SkillsView({
  cwd,
  commands,
  onUse,
  report,
}: {
  cwd: string;
  commands: SlashCommand[];
  onUse: (text: string) => void;
  report: (e: unknown) => void;
}) {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    window.pidex
      .skills(cwd)
      .then((r) => {
        if (!cancelled) setSkills(unwrap(r));
      })
      .catch(report)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cwd, report]);
  const loaded = commands.filter((c) => c.name.startsWith('skill:'));
  const visible = skills.filter((s) =>
    `${s.name} ${s.description} ${s.source}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <section className="wb-skills-view">
      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Search skills by name, source, or description…"
        label="Search skills"
      />
      <div className="wb-section-heading">
        <span className="wb-eyebrow">Installed / {skills.length} skills</span>
        <span className="wb-meta">Global and workspace skills</span>
      </div>
      {loading && (
        <p role="status" className="wb-meta">
          Loading skills…
        </p>
      )}
      {visible.map((skill) => (
        <div className="wb-skill-row" key={skill.file}>
          <Icon name="skills" />
          <div>
            <strong>
              <span>{skill.name}</span> <small>{skill.source}</small>
            </strong>
            <p className="wb-meta" title={skill.file}>
              {skill.file}
            </p>
          </div>
          <p>{skill.description || 'No description provided.'}</p>
          <BracketButton onClick={() => onUse(`/skill:${skill.name} `)}>
            Use skill
          </BracketButton>
        </div>
      ))}
      {!loading && !visible.length && (
        <EmptyState title="No skills found">
          Install skills in ~/.pi/agent/skills or .pi/skills in your project.
        </EmptyState>
      )}
      {loaded.length > 0 && (
        <>
          <span className="wb-eyebrow">Loaded session skills</span>
          {loaded.map((c) => (
            <button
              key={c.name}
              type="button"
              className="wb-file-row"
              onClick={() => onUse(`/${c.name} `)}
            >
              <Icon name="skills" />
              <span>{c.name}</span>
              <small>{c.source}</small>
            </button>
          ))}
        </>
      )}
    </section>
  );
}

export function SettingsView({
  cwd,
  models,
  modelError,
  modelsLoading,
  defaults,
  resetSignal,
  onSaved,
  report,
  onFiles,
}: {
  cwd: string;
  models: ModelInfo[];
  modelError: string;
  modelsLoading: boolean;
  defaults: Defaults;
  resetSignal: number;
  onSaved: (value: Defaults) => void;
  report: (e: unknown) => void;
  onFiles: () => void;
}) {
  const [draft, setDraft] = useState(defaults);
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState('Models & access');
  const [saved, setSaved] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(
    () => localStorage.getItem('pidex.reduced-motion') === 'true',
  );
  const previousReset = useState(resetSignal)[0];
  useEffect(() => {
    setDraft(defaults);
  }, [defaults]);
  useEffect(() => {
    if (resetSignal !== previousReset) {
      setDraft({ ...DEFAULTS });
      setSaved(false);
    }
  }, [resetSignal, previousReset]);
  const changes = (Object.keys(DEFAULTS) as (keyof Defaults)[]).filter(
    (k) => draft[k] !== defaults[k],
  ).length;
  const providers = useMemo(
    () => [...new Set(models.map((m) => m.provider))],
    [models],
  );
  const save = async () => {
    setBusy(true);
    try {
      onSaved(unwrap(await window.pidex.saveSettings(cwd, draft)));
      setSaved(true);
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  };
  const manage = () =>
    void window.pidex.manageProviders().then(unwrap).catch(report);
  const modelValue = draft.model ? `${draft.provider}/${draft.model}` : '';
  return (
    <div className="wb-settings-layout">
      <aside className="wb-settings-nav">
        <p className="wb-eyebrow">Settings</p>
        <NavItem
          icon="shield"
          active={category === 'Models & access'}
          onClick={() => setCategory('Models & access')}
        >
          Models & access
        </NavItem>
        <NavItem icon="folder" onClick={onFiles}>
          Workspace
        </NavItem>
        <NavItem
          icon="appearance"
          active={category === 'Appearance'}
          onClick={() => setCategory('Appearance')}
        >
          Appearance
        </NavItem>
        <NavItem
          icon="skills"
          active={category === 'Keybindings'}
          onClick={() => setCategory('Keybindings')}
        >
          Keybindings
        </NavItem>
        <NavItem
          icon="plus"
          active={category === 'Extensions'}
          onClick={() => setCategory('Extensions')}
        >
          Extensions
        </NavItem>
      </aside>
      <section className="wb-settings-scroll">
        <div className="wb-settings-content">
          {category === 'Models & access' ? (
            <>
              <div className="wb-settings-scope">
                <span className="wb-eyebrow">Apply to</span>
                <div className="wb-static-select">This workspace</div>
                <p className="wb-meta">Global Pi defaults remain available.</p>
              </div>
              <div className="wb-section-heading">
                <h2>Providers</h2>
                <BracketButton onClick={manage}>
                  Configure providers
                </BracketButton>
              </div>
              {modelError && (
                <p className="wb-inline-error" role="status">
                  {modelError}
                </p>
              )}
              <div className="wb-provider-list">
                {providers.map((provider) => (
                  <div className="wb-provider-row" key={provider}>
                    <Icon name="check" />
                    <div>
                      <span>
                        {provider === 'openai'
                          ? 'OpenAI'
                          : provider === 'anthropic'
                            ? 'Anthropic'
                            : provider}
                      </span>
                      <p className="wb-meta">
                        {models.filter((m) => m.provider === provider).length}{' '}
                        {models.filter((m) => m.provider === provider)
                          .length === 1
                          ? 'model'
                          : 'models'}{' '}
                        available to Pi
                      </p>
                    </div>
                    <BracketButton onClick={manage}>Manage</BracketButton>
                  </div>
                ))}
                {!providers.length && (
                  <p className="wb-meta wb-padded">
                    {modelsLoading
                      ? 'Loading available models from Pi…'
                      : 'Configure a provider with /login in Pi, then reopen this workspace.'}
                  </p>
                )}
              </div>
              <p className="wb-eyebrow">New session defaults</p>
              <div className="wb-setting-rows">
                <div className="wb-setting-row">
                  <div>
                    <span>Default model</span>
                    <p className="wb-meta">
                      Applied when you start a new session.
                    </p>
                  </div>
                  <Select
                    label="Default model"
                    value={modelValue}
                    onChange={(value) => {
                      const m = models.find(
                        (m) => `${m.provider}/${m.id}` === value,
                      );
                      setDraft((prev) => ({
                        ...prev,
                        model: m?.id ?? '',
                        provider: m?.provider ?? '',
                      }));
                      setSaved(false);
                    }}
                  >
                    <option value="">Pi default</option>
                    {modelValue &&
                      !models.some(
                        (m) => `${m.provider}/${m.id}` === modelValue,
                      ) && <option value={modelValue}>{draft.model}</option>}
                    {models.map((m) => (
                      <option
                        key={`${m.provider}/${m.id}`}
                        value={`${m.provider}/${m.id}`}
                      >
                        {m.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="wb-setting-row">
                  <div>
                    <span>Reasoning effort</span>
                    <p className="wb-meta">How much time Pi spends thinking.</p>
                  </div>
                  <Select
                    label="Reasoning effort"
                    value={draft.thinking}
                    onChange={(value) => {
                      setDraft((prev) => ({ ...prev, thinking: value }));
                      setSaved(false);
                    }}
                  >
                    {['off', 'minimal', 'low', 'medium', 'high'].map(
                      (level) => (
                        <option key={level} value={level}>
                          {level[0].toUpperCase() + level.slice(1)}
                        </option>
                      ),
                    )}
                  </Select>
                </div>
                <div className="wb-setting-row">
                  <div>
                    <span>Tools & permissions</span>
                    <p className="wb-meta">
                      Managed by Pi and its installed extensions.
                    </p>
                  </div>
                  <Select
                    label="Default tool permissions"
                    value="runtime"
                    disabled
                  >
                    <option value="runtime">Runtime policy</option>
                  </Select>
                </div>
                <div className="wb-setting-row">
                  <div>
                    <span>Worktree</span>
                    <p className="wb-meta">
                      Sessions run in the selected project folder.
                    </p>
                  </div>
                  <Select label="Default worktree" value="current" disabled>
                    <option value="current">Current workspace</option>
                  </Select>
                </div>
              </div>
              <div className="wb-flex-space" />
              <div className="wb-settings-save">
                <span
                  className={`wb-eyebrow${changes ? ' wb-warning' : ''}`}
                  role="status"
                >
                  {changes
                    ? `${changes} unsaved ${changes === 1 ? 'change' : 'changes'}`
                    : saved
                      ? 'Changes saved'
                      : 'Workspace defaults'}
                </span>
                <BracketButton
                  disabled={!changes || busy}
                  onClick={() => {
                    setDraft(defaults);
                    setSaved(false);
                  }}
                >
                  Cancel
                </BracketButton>
                <BracketButton
                  primary
                  disabled={!changes || busy}
                  onClick={() => void save()}
                >
                  {busy ? 'Saving…' : 'Save changes'}
                </BracketButton>
              </div>
            </>
          ) : category === 'Appearance' ? (
            <>
              <h2>Appearance</h2>
              <div className="wb-setting-rows">
                <div className="wb-setting-row">
                  <div>
                    <span>Color theme</span>
                    <p className="wb-meta">
                      The Pi dark palette from the design system.
                    </p>
                  </div>
                  <Select label="Color theme" value="dark" disabled>
                    <option value="dark">Pi dark</option>
                  </Select>
                </div>
                <label className="wb-setting-row">
                  <div>
                    <span>Reduce motion</span>
                    <p className="wb-meta">
                      Turn off animated interface effects. Saved on this device.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    role="switch"
                    aria-label="Reduce motion"
                    checked={reducedMotion}
                    onChange={(e) => {
                      setReducedMotion(e.target.checked);
                      document.documentElement.dataset.reducedMotion = String(
                        e.target.checked,
                      );
                      localStorage.setItem(
                        'pidex.reduced-motion',
                        String(e.target.checked),
                      );
                    }}
                  />
                </label>
              </div>
            </>
          ) : category === 'Keybindings' ? (
            <>
              <h2>Keybindings</h2>
              {[
                ['⌘K / Ctrl+K', 'Quick switch'],
                ['⌘, / Ctrl+,', 'Settings'],
                ['⌘⇧H / Ctrl+Shift+H', 'Session history'],
                ['⌘B / Ctrl+B', 'Toggle sidebar'],
                ['⌘O / Ctrl+O', 'Open project'],
                ['Enter', 'Send prompt'],
                ['Shift+Enter', 'New line'],
                ['Escape', 'Stop Pi while composing'],
              ].map(([key, action]) => (
                <div className="wb-setting-row" key={key}>
                  <span>{action}</span>
                  <kbd>{key}</kbd>
                </div>
              ))}
            </>
          ) : (
            <>
              <h2>Extensions</h2>
              <p>Pi loads extensions from your local agent configuration.</p>
              <p className="wb-meta">
                Manage your extensions in Pi. Reopen a session after changing
                its configuration.
              </p>
              <BracketButton onClick={manage}>
                Open Pi configuration
              </BracketButton>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
